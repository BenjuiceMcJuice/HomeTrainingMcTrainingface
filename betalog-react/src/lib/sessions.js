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
 * Today's climb session to continue (BTL-B75): a climb session dated `today`
 * that is not a comp session — a comp card's climbs are derived from the card
 * and are only ever changed through it — and has not been finished
 * (`endedAt`, stamped by *Done* or *Finish*, BTL-B76). Several → the most
 * recently changed.
 *
 * There is no "open" status; a session is offered until it is finished, or
 * until the day is over.
 *
 * With `opts.withinMs`, only a session last changed within that long before
 * `opts.nowMs` — the Dashboard shows it only while you are plausibly still at
 * the wall; the Log card has no window.
 *
 * @param {Array} sessions
 * @param {string} today  "YYYY-MM-DD", the same "today" the logger dates with
 * @param {{ nowMs?: number, withinMs?: number }} [opts]
 * @returns {object|null}
 */
export function todaysClimbSession(sessions, today, opts) {
  var o = opts || {}
  var best = null
  ;(sessions || []).forEach(function (s) {
    if (!s || s.type !== 'climb' || s.date !== today || s.comp || s.endedAt) return
    if (o.withinMs != null && o.nowMs != null && o.nowMs - changedMs(s) > o.withinMs) return
    if (!best || changedMs(s) > changedMs(best)) best = s
  })
  return best
}

/** How long the Dashboard's Continue row stays after the session's last change (spec Q4). */
export var CONTINUE_DASHBOARD_MS = 3 * 60 * 60 * 1000

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
