/**
 * BetaLog — scheduled routine adherence, and the Shameometer that scores it.
 *
 * Pure. No React imports, so it can be tested directly and used from anywhere.
 *
 * The schedule already knows which routines are due on which weekdays, and the
 * session log already knows which routines were actually done. Nothing joined
 * the two, so a routine could sit in the schedule firing reminders for weeks
 * with nothing ever recording that it never happened. This module does that
 * join and puts a number on it.
 *
 * Three rules decide what is fair to count, and they matter more than the
 * arithmetic:
 *
 * 1. **Today is never missed.** A routine due today is still in play until the
 *    day is out, so scoring stops at yesterday. Counting today would drag every
 *    score down every morning and recover it every evening, which is noise, not
 *    signal.
 * 2. **Nothing before `remindFrom` counts.** That field is the first scheduled
 *    day at the time the reminder was set, so it is the honest start of the
 *    commitment. Without it, adding a routine today would open with weeks of
 *    retroactive failure for days when nothing was promised.
 * 3. **Default routines are matched by family, not by id.** Seeded routines
 *    carry a version suffix (`dr-submaxrepeaters-v4` → `-v5`) and a session
 *    stores whichever id was current when it was logged. A strict id match
 *    would silently stop crediting real sessions the moment a default routine
 *    was revised — the schedule points at v5 while the history is all v4.
 */

import { shiftDate, daysBetween, todayStr } from './stats'

/**
 * The stable identity of a routine, ignoring default-routine versioning.
 *
 * Seeded ids look like `dr-<name>-v5`; user routines are uuids and are returned
 * untouched. Only the `dr-` prefix opts into suffix-stripping, so a user
 * routine that happens to end in something v-shaped is left alone.
 * @param {string | null | undefined} routineId
 * @returns {string | null}
 */
export function routineFamily(routineId) {
  if (!routineId) return null
  var id = String(routineId)
  if (id.indexOf('dr-') !== 0) return id
  return id.replace(/-v\d+$/, '')
}

/**
 * Every date in `[startIso, endIso]` whose weekday is in the entry's `days`,
 * bounded below by the entry's `remindFrom`.
 *
 * @param {import('./types').ScheduleEntry} entry
 * @param {string} startIso - "YYYY-MM-DD", inclusive
 * @param {string} endIso   - "YYYY-MM-DD", inclusive
 * @returns {string[]} ISO dates, earliest first
 */
export function dueDates(entry, startIso, endIso) {
  if (!entry || !entry.days || !entry.days.length) return []
  var from = startIso
  if (entry.remindFrom && entry.remindFrom > from) from = entry.remindFrom
  if (from > endIso) return []

  var out = []
  var cursor = from
  // Bounded by the window rather than by a while(true): a malformed date would
  // otherwise spin here forever.
  var span = daysBetween(from, endIso)
  for (var i = 0; i <= span; i++) {
    var d = new Date(cursor + 'T12:00:00')
    var dow = d.getDay() === 0 ? 7 : d.getDay()
    if (entry.days.indexOf(dow) !== -1) out.push(cursor)
    cursor = shiftDate(cursor, 1)
  }
  return out
}

/**
 * The set of dates on which a routine family was actually logged.
 * @param {import('./types').Session[]} sessions
 * @returns {Object<string, Object<string, boolean>>} family → { date: true }
 */
function indexSessionsByFamily(sessions) {
  var index = {}
  ;(sessions || []).forEach(function (s) {
    var fam = routineFamily(s && s.routineId)
    if (!fam || !s.date) return
    if (!index[fam]) index[fam] = {}
    index[fam][s.date] = true
  })
  return index
}

/**
 * Adherence for one schedule entry over a window.
 *
 * `missedStreak` counts back from the most recent due day, so it answers "how
 * long has this been ignored" rather than "what is the worst it has ever been".
 * A routine done on its last due day has a streak of 0 no matter what came
 * before it.
 *
 * @param {import('./types').ScheduleEntry} entry
 * @param {Object<string, Object<string, boolean>>} doneIndex - from indexSessionsByFamily
 * @param {string} startIso
 * @param {string} endIso
 * @returns {{ id: string, routineName: string, due: number, done: number, missed: number,
 *            pct: number|null, missedStreak: number, lastDone: string|null, dueDates: string[],
 *            doneDates: Object<string, boolean> }}
 */
export function entryAdherence(entry, doneIndex, startIso, endIso) {
  var dates = dueDates(entry, startIso, endIso)
  var fam   = routineFamily(entry && entry.routineId)
  var hits  = (fam && doneIndex[fam]) || {}

  var done = 0
  var doneDates = {}
  dates.forEach(function (d) {
    if (hits[d]) { done++; doneDates[d] = true }
  })

  var missedStreak = 0
  for (var i = dates.length - 1; i >= 0; i--) {
    if (doneDates[dates[i]]) break
    missedStreak++
  }

  // The last time this routine was done at all — not only within the window,
  // and not only on a due day. "Last done 5 weeks ago" is the useful fact when
  // a card is showing 0%, and restricting it to the window would just render
  // "never" for exactly the routines the card most wants to describe.
  var lastDone = null
  Object.keys(hits).forEach(function (d) {
    if (!lastDone || d > lastDone) lastDone = d
  })

  return {
    id:           entry.id,
    routineName:  entry.routineName || 'Routine',
    routineId:    entry.routineId || null,
    due:          dates.length,
    done:         done,
    missed:       dates.length - done,
    pct:          dates.length ? Math.round((done / dates.length) * 100) : null,
    missedStreak: missedStreak,
    lastDone:     lastDone,
    dueDates:     dates,
    doneDates:    doneDates,
  }
}

/**
 * Adherence across the whole schedule.
 *
 * The overall percentage pools due days rather than averaging the per-routine
 * percentages: a routine scheduled seven days a week is a bigger commitment
 * than one scheduled on Mondays, and averaging would let the Monday one paper
 * over it.
 *
 * @param {import('./types').ScheduleEntry[]} scheduleEntries
 * @param {import('./types').Session[]} sessions
 * @param {number} windowDays - how many days back to score, ending yesterday
 * @param {string} [todayIso] - defaults to today; injectable for tests
 * @returns {{ entries: object[], due: number, done: number, missed: number,
 *             pct: number|null, start: string, end: string, scored: boolean }}
 */
export function buildAdherence(scheduleEntries, sessions, windowDays, todayIso) {
  var today = todayIso || todayStr()
  // Rule 1: the window ends yesterday. Today's routines are not yet missed.
  var end   = shiftDate(today, -1)
  var start = shiftDate(end, -(Math.max(1, windowDays) - 1))

  var doneIndex = indexSessionsByFamily(sessions)
  var rows = (scheduleEntries || []).map(function (e) {
    return entryAdherence(e, doneIndex, start, end)
  })

  var due  = rows.reduce(function (n, r) { return n + r.due },  0)
  var done = rows.reduce(function (n, r) { return n + r.done }, 0)

  return {
    entries: rows,
    due:     due,
    done:    done,
    missed:  due - done,
    pct:     due ? Math.round((done / due) * 100) : null,
    start:   start,
    end:     end,
    // Nothing was due in the window — a brand new schedule, or one that only
    // fires on a weekday the window hasn't reached. The card says so rather
    // than showing a 0% nobody earned.
    scored:  due > 0,
  }
}

/**
 * The Shameometer bands, best first.
 *
 * Seven of them, and deliberately not evenly spaced: the top of the scale is
 * split finely because the difference between 90% and 100% is where the habit
 * actually lives, while everything under 40% is already the same message told
 * louder. `min` is inclusive.
 *
 * The tone is meant to be funny at your own expense, so the low bands sting a
 * bit. If that stops being useful, this array is the only thing to edit — the
 * gauge, the colours and the copy all read from here.
 */
export var SHAME_BANDS = [
  { min: 95, label: 'Flawless',     note: 'Nothing missed. Insufferable.',                 color: '#2a9d5c', bg: '#edfaf2' },
  { min: 85, label: 'Locked in',    note: 'This is what the schedule was for.',            color: '#2a9d5c', bg: '#edfaf2' },
  { min: 70, label: 'Solid',        note: 'Good, with the odd day quietly skipped.',       color: '#4f7ef8', bg: '#eff4ff' },
  { min: 55, label: 'Wobbly',       note: 'More on than off, but only just.',              color: '#0284c7', bg: '#eff8ff' },
  { min: 40, label: 'Patchy',       note: 'You are negotiating with yourself daily.',      color: '#d97706', bg: '#fffbeb' },
  { min: 20, label: 'Shaky',        note: 'The reminders are going off. That is all.',     color: '#ea580c', bg: '#fff7ed' },
  { min:  1, label: 'Ghosting it',  note: 'A schedule you look at is not a schedule.',     color: '#e11d48', bg: '#fff1f2' },
  { min:  0, label: 'Total shame',  note: 'Not once. Delete it or do it.',                 color: '#9f1239', bg: '#fff1f2' },
]

/**
 * The band a percentage falls in. Null percentages (nothing due) have no band.
 * @param {number|null} pct
 * @returns {object|null}
 */
export function shameBand(pct) {
  if (pct === null || pct === undefined) return null
  for (var i = 0; i < SHAME_BANDS.length; i++) {
    if (pct >= SHAME_BANDS[i].min) return SHAME_BANDS[i]
  }
  return SHAME_BANDS[SHAME_BANDS.length - 1]
}
