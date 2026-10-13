// ---------------------------------------------------------------------------
// sessions.js — pure readings of a session, shared by History, Log and the
// Dashboard. No React imports.
// ---------------------------------------------------------------------------

import { hardestGrade } from './stats'

/**
 * The summary line under a climb session: how many climbs, the best send, and
 * the hardest grade tried when it is harder than anything sent —
 * "11 climbs · Best V4 · Tried V5". An attempt counts as tried, and says so,
 * so a one-off go above the sends never reads as a send (BTL-B70); a repeat
 * was climbed clean, so it can be the Best — the line describes the day, and
 * only the pyramid cares whether a problem was new. Ben, 2026-09-28, on "11 climbs · 8 Flash to V3 · 1 Send at V4 ·
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

/**
 * The open gym session (BTL-B154): one Log › Train saved as you go and
 * nobody has finished yet — the same rule as a climb session's. Ben,
 * 2026-10-13: *"In training mode when we click log can we maybe have the same
 * as the climbing whereby until you finally save it it shows as an active
 * session"*. Several open → the most recently changed.
 *
 * @param {Array} sessions
 * @returns {object|null}
 */
export function openGymSession(sessions) {
  var best = null
  ;(sessions || []).forEach(function (s) {
    if (!isOpenGymSession(s)) return
    if (!best || changedMs(s) > changedMs(best)) best = s
  })
  return best
}

/** A gym session saved as you go and not finished — see `openGymSession`. */
export function isOpenGymSession(s) {
  return !!s && s.type === 'gym' && s.endedAt === null
}

/** Either kind of open session — History's OPEN mark and its *Continue logging*. */
export function isOpenSession(s) {
  return isOpenClimbSession(s) || isOpenGymSession(s)
}

/** What a gym session is called — its routine, else its first exercise. */
export function gymSessionName(session) {
  if (!session) return ''
  if (session.routineName) return session.routineName
  var ex = session.exercises || []
  return ex.length ? ex[0].name : 'Gym session'
}

/**
 * How far an open gym session has got, for the Continue card and row —
 * *3 of 6 done* for a routine, the set count for anything else.
 */
export function gymProgressLine(session) {
  var ex = (session && session.exercises) || []
  if (!ex.length) return 'No exercises logged'
  if (session.routineId) {
    var done = ex.filter(function (e) { return e.done === true }).length
    return done + ' of ' + ex.length + ' done'
  }
  var sets = ex.reduce(function (n, e) { return n + (e.sets || []).length }, 0)
  return sets + ' set' + (sets !== 1 ? 's' : '')
}

/**
 * The gym logger's exercise cards → the exercises it writes. A routine keeps
 * each card's tick (unticked = skipped); anything else is all done. While the
 * session is open the ticks are written as they stand, so continuing it later
 * shows exactly what was ticked. On finishing, a routine with *nothing*
 * ticked is read as "just logged normally" and saved all done — the rule the
 * sheet has had since ticks were added: ticking even one opts into tracking.
 *
 * @param {Array<{exerciseId: string, name: string, trackingType: string, sets: Array<{reps: number, weight: number}>, done?: boolean}>} cards
 * @param {boolean} isRoutine
 * @param {boolean} finishing
 */
export function gymExercises(cards, isRoutine, finishing) {
  var noTicks = !cards.some(function (c) { return c.done })
  return cards.map(function (card) {
    return {
      exerciseId:   card.exerciseId,
      name:         card.name,
      trackingType: card.trackingType,
      sets:         card.sets.map(function (s) {
        return { reps: s.reps, weight: s.weight, rir: null, done: true }
      }),
      done:         !isRoutine ? true : (finishing && noTicks) ? true : !!card.done,
    }
  })
}

/**
 * What *Finish* writes to an open session without opening it: `endedAt`, and
 * for a gym routine with nothing ticked, every exercise done (`gymExercises`).
 * @param {object} session
 * @param {string} at  ISO timestamp
 */
export function finishPatch(session, at) {
  var patch = { endedAt: at }
  if (session && session.type === 'gym' && session.routineId) {
    var ex = session.exercises || []
    if (ex.length && !ex.some(function (e) { return e.done === true })) {
      patch.exercises = ex.map(function (e) { return Object.assign({}, e, { done: true }) })
    }
  }
  return patch
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

/** The colour an open session is offered in: its climbing discipline, or Train's blue for gym. */
export function sessionAccent(session) {
  return session && session.type === 'gym' ? '#4f7ef8' : climbAccent(session)
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
 * `venueId` is the registry venue the name stands for, or null for a typed
 * name (lib/venues.js); a blank name carries no venue either way.
 *
 * @param {{ climbs: Array, difficulty: number|null, notes: string, location: string, venueId?: string|null, date: string }} form
 * @returns {{ date: string, discipline: string|null, difficulty: number|null, notes: string, location: string|null, venueId: string|null, climbs: Array }}
 */
/**
 * The discipline of the most recent climb session that has climbs, so a new
 * session opens with its grade chips ready for the same one (2026-10-11). The
 * logger used to open unselected: one tap every session for the usual answer.
 * @param {object[]} sessions
 * @returns {string|null}
 */
export function lastClimbDiscipline(sessions) {
  var best = null
  ;(sessions || []).forEach(function (s) {
    if (!s || s.type !== 'climb' || !(s.climbs || []).length) return
    if (!best || (s.date || '') > (best.date || '')) best = s
  })
  if (!best) return null
  return best.discipline || (best.climbs[0] && best.climbs[0].discipline) || null
}

export function climbSessionFields(form) {
  var loc = (form.location || '').trim() || null
  return {
    date:       form.date,
    discipline: deriveDiscipline(form.climbs),
    difficulty: form.difficulty || null,
    notes:      form.notes || '',
    location:   loc,
    venueId:    loc && form.venueId ? form.venueId : null,
    climbs:     form.climbs.slice().reverse().map(function (c) {
      return Object.assign({}, c, { location: loc })
    }),
  }
}
