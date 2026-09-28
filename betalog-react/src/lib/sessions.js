// ---------------------------------------------------------------------------
// sessions.js — pure readings of a session, shared by History, Log and the
// Dashboard. No React imports.
// ---------------------------------------------------------------------------

import { hardestGrade } from './stats'

/**
 * The summary line under a climb session: how many climbs, the best send, and
 * the hardest grade tried when it is harder than anything sent —
 * "11 climbs · Best V4 · Tried V5". Attempts and projects both count as
 * tried, and say so, so a one-off go above the sends never reads as a send
 * (BTL-B70). Ben, 2026-09-28, on "11 climbs · 8 Flash to V3 · 1 Send at V4 ·
 * 1 Att at V4 · 1 Proj at …": "maybe we just show the best result. And
 * highest attempt/project."
 *
 * One function for History's card and the Continue card on Log, so the two
 * lines cannot drift (BTL-B75).
 *
 * @param {Array<{grade: string, outcome: string, discipline: string}>} climbs
 * @returns {string}
 */
export function climbSummaryLine(climbs) {
  if (!climbs || climbs.length === 0) return 'No climbs logged'
  var best    = hardestGrade(climbs, true)
  var hardest = hardestGrade(climbs, false)
  var parts   = [climbs.length + ' climb' + (climbs.length !== 1 ? 's' : '')]
  if (best) parts.push('Best ' + best)
  if (hardest && hardest !== best) parts.push('Tried ' + hardest)
  return parts.join(' · ')
}

/** Where a session was: its own location, else the first climb that has one. */
export function sessionVenue(session) {
  if (!session) return ''
  if (session.location) return session.location
  var withLoc = (session.climbs || []).filter(function (c) { return c && c.location })
  return withLoc.length ? withLoc[0].location : ''
}

function changedMs(s) {
  var t = Date.parse(s.updatedAt || s.createdAt || '')
  return isNaN(t) ? 0 : t
}

/**
 * The open climb session (BTL-B75, B76, B109): one the logger saved as you
 * go and nobody has finished yet. Only the live logger writes `endedAt: null`;
 * *Done* or *Finish* stamps it. Sessions logged before B76 have no `endedAt`
 * at all and are never open, and comp sessions (climbs derived from the card)
 * never carry it. Several open → the most recently changed.
 *
 * No timer closes a session — not three hours, not midnight. Ben,
 * 2026-09-28: *"I want it to always be manually closed. This way you'll be
 * forced to choose the effort level."*
 *
 * @param {Array} sessions
 * @returns {object|null}
 */
export function openClimbSession(sessions) {
  var best = null
  ;(sessions || []).forEach(function (s) {
    if (!isOpenClimbSession(s)) return
    if (!best || changedMs(s) > changedMs(best)) best = s
  })
  return best
}

/** A climb session saved as you go and not finished — see `openClimbSession`. */
export function isOpenClimbSession(s) {
  return !!s && s.type === 'climb' && !s.comp && s.endedAt === null
}

var DAY_NAMES   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
var MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * A session's date as the Continue card says it — *Today*, *Yesterday*, or
 * *Sun 27 Sep* — so a session left open overnight says whose day it is.
 * @param {string} date   "YYYY-MM-DD"
 * @param {string} today  "YYYY-MM-DD"
 */
export function sessionDayLabel(date, today) {
  if (!date) return ''
  if (date === today) return 'Today'
  var t = new Date(today + 'T12:00:00Z')
  t.setUTCDate(t.getUTCDate() - 1)
  if (date === t.toISOString().slice(0, 10)) return 'Yesterday'
  var d = new Date(date + 'T12:00:00Z')
  return DAY_NAMES[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MONTH_NAMES[d.getUTCMonth()]
}

var DISCIPLINE_ACCENT = { boulder: '#c0622a', lead: '#4f7ef8', toprope: '#2a9d5c' }

/** The discipline accent of a session's last climb — the colour the logger will open in. */
export function climbAccent(session) {
  var climbs = (session && session.climbs) || []
  var last = climbs.length ? climbs[climbs.length - 1] : null
  return (last && DISCIPLINE_ACCENT[last.discipline]) || DISCIPLINE_ACCENT.boulder
}

function deriveDiscipline(climbs) {
  if (!climbs.length) return null
  var first = climbs[0].discipline
  return climbs.every(function (c) { return c.discipline === first }) ? first : null
}

/**
 * The climb logger's form → the session fields it writes (BTL-B76). The form
 * lists climbs newest-first; the log keeps them oldest-first, each stamped
 * with the venue. `difficulty` stays null until a feel is picked — the log
 * says "not given" rather than recording a feel nobody gave (spec Q1).
 *
 * @param {{ climbs: Array, difficulty: number|null, notes: string, location: string, date: string }} form
 * @returns {{ date: string, discipline: string|null, difficulty: number|null, notes: string, location: string|null, climbs: Array }}
 */
export function climbSessionFields(form) {
  var loc = (form.location || '').trim() || null
  return {
    date:       form.date,
    discipline: deriveDiscipline(form.climbs),
    difficulty: form.difficulty || null,
    notes:      form.notes || '',
    location:   loc,
    climbs:     form.climbs.slice().reverse().map(function (c) {
      return Object.assign({}, c, { location: loc })
    }),
  }
}
