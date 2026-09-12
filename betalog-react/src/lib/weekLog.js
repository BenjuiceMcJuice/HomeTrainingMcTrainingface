/**
 * BetaLog — the sealed weekly score log.
 *
 * Pure. No React imports, so it can be tested directly and used from anywhere.
 *
 * ## Why this is stored rather than derived
 *
 * A week's score is computable from data the app already keeps, so storing it
 * looks redundant. It isn't, because every input is mutable:
 *
 * - **The schedule is edited.** Cutting a routine from seven days a week to
 *   three shrinks the denominator for every week that ever ran, silently
 *   improving the whole history.
 * - **Sessions get backdated and corrected.**
 * - **The scoring constants will be retuned** — the spec says as much.
 *
 * Derived history answers "what would this week score under today's rules";
 * a sealed record answers "what did I actually get". The second is the one
 * worth keeping, so each completed week is frozen once and never recomputed.
 * `scoreVersion` marks which rules produced it, so a later retune is visible
 * rather than invisible.
 *
 * ## Why there is no Sunday-night timer
 *
 * There is nowhere to run one. A PWA cannot wake itself at 23:59; a `setTimeout`
 * only fires while the tab is open, and the push Worker holds no session data.
 * So a week is sealed **the next time the app is opened after it ends**, and
 * anything missed is backfilled. Opening the app on the Monday, or three weeks
 * later, produces the same records either way.
 */

import { mondayOf, shiftDate, todayStr } from './stats'
import { buildWeeklyScore, weekDates } from './weeklyScore'

/**
 * Which ruleset produced a record. Bump when the weights, targets or bands
 * change, so old records stay readable as "scored under v1".
 */
// 1 -> 2 (2026-09-13, BTL-B10): a gym session scores by exercise count rather
// than a flat 2. Weeks already sealed keep version 1 and are never rescored --
// that is the point of sealing them -- so the two are distinguishable rather
// than silently mixed.
export var SCORE_VERSION = 2

/** Never walk back further than this, however old the log is. */
var MAX_BACKFILL_WEEKS = 104

/**
 * The Monday of the most recent **completed** week — the last week that can be
 * sealed. On any day of this week that is last Monday; the current week is
 * still being lived in and is never sealed.
 * @param {string} todayIso
 * @returns {string} "YYYY-MM-DD"
 */
export function lastSealableWeek(todayIso) {
  return shiftDate(mondayOf(todayIso), -7)
}

/**
 * Did anything at all happen in this week?
 *
 * Weeks with no sessions, no drinks and nothing scheduled are not sealed. They
 * are almost always weeks the app was not being used, and recording them as
 * "10 — nothing done, nothing drunk" would fill the history with noise that
 * looks like data. Once a schedule exists every week has due days, so from that
 * point on nothing is skipped.
 */
function weekHasAnything(data, dates, todayIso) {
  var inWeek = {}
  dates.forEach(function (d) { inWeek[d] = true })

  var hasSession = (data.sessions || []).some(function (s) { return s && inWeek[s.date] })
  if (hasSession) return true
  var hasDrink = (data.drinkLog || []).some(function (x) { return x && inWeek[x.date] })
  if (hasDrink) return true

  return (data.scheduleEntries || []).some(function (e) {
    if (!e || !e.days || !e.days.length) return false
    return dates.some(function (ds) {
      if (ds >= todayIso) return false
      if (e.remindFrom && ds < e.remindFrom) return false
      var dt = new Date(ds + 'T12:00:00')
      var dow = dt.getDay() === 0 ? 7 : dt.getDay()
      return e.days.indexOf(dow) !== -1
    })
  })
}

/**
 * The earliest week worth considering: whichever is later of the first week
 * containing data and the backfill limit.
 */
function earliestWeek(data, todayIso) {
  var dates = []
  ;(data.sessions || []).forEach(function (s) { if (s && s.date) dates.push(s.date) })
  ;(data.drinkLog || []).forEach(function (x) { if (x && x.date) dates.push(x.date) })
  ;(data.scheduleEntries || []).forEach(function (e) { if (e && e.remindFrom) dates.push(e.remindFrom) })

  var limit = shiftDate(mondayOf(todayIso), -7 * MAX_BACKFILL_WEEKS)
  if (!dates.length) return limit
  dates.sort()
  var first = mondayOf(dates[0])
  return first > limit ? first : limit
}

/** The stored shape. Flat and self-describing — it outlives the code that made it. */
export function buildWeekRecord(result, sealedAtIso, backfilled) {
  return {
    weekStart:    result.weekStart,
    weekEnd:      result.weekEnd,
    score:        result.score,
    band:         result.band.label,
    training:     { points: result.training.points, target: result.training.target, earned: result.training.earned },
    schedule:     { due: result.schedule.due, done: result.schedule.done, earned: result.schedule.earned, active: result.schedule.active },
    alcohol:      { units: result.alcohol.units, delta: result.alcohol.delta },
    scoreVersion: SCORE_VERSION,
    sealedAt:     sealedAtIso,
    // True when the week was scored after the fact rather than on the first app
    // open after it ended. Not a correctness flag — a provenance one.
    backfilled:   !!backfilled,
  }
}

/**
 * Seal every completed week that has no record yet.
 *
 * Idempotent: a week already in `existing` is never rescored, whatever the
 * current data or constants say. That is the entire point of sealing.
 *
 * @param {{sessions: object[], scheduleEntries: object[], drinkLog: object[]}} data
 * @param {object[]} existing  - records already stored
 * @param {string} [todayIso]
 * @param {string} [nowIso]    - injectable for tests
 * @returns {{ records: object[], added: object[] }} records is the full sorted list
 */
export function sealWeeks(data, existing, todayIso, nowIso) {
  var today  = todayIso || todayStr()
  var sealed = new Date(nowIso || new Date().toISOString()).toISOString()
  var have   = {}
  ;(existing || []).forEach(function (r) { if (r && r.weekStart) have[r.weekStart] = true })

  var last  = lastSealableWeek(today)
  var start = earliestWeek(data, today)
  var added = []

  // A week completed before the app was ever opened for it is a backfill; the
  // most recent completed week is the one being sealed on time.
  for (var wk = start; wk <= last; wk = shiftDate(wk, 7)) {
    if (have[wk]) continue
    var dates = weekDates(wk)
    if (!weekHasAnything(data, dates, today)) continue

    var offset = Math.round((new Date(wk + 'T12:00:00') - new Date(mondayOf(today) + 'T12:00:00')) / (7 * 86400000))
    var result = buildWeeklyScore(data, today, offset)
    added.push(buildWeekRecord(result, sealed, wk !== last))
  }

  var records = (existing || []).concat(added).sort(function (a, b) {
    return a.weekStart < b.weekStart ? -1 : a.weekStart > b.weekStart ? 1 : 0
  })

  return { records: records, added: added }
}

/**
 * The most recent `n` sealed weeks, oldest first — what the card charts.
 * @param {object[]} records
 * @param {number} n
 */
export function recentWeeks(records, n) {
  var sorted = (records || []).slice().sort(function (a, b) {
    return a.weekStart < b.weekStart ? -1 : a.weekStart > b.weekStart ? 1 : 0
  })
  return sorted.slice(Math.max(0, sorted.length - (n || 8)))
}

/**
 * Mean score across the sealed weeks, or null when there are none.
 * @param {object[]} records
 */
export function averageScore(records) {
  if (!records || !records.length) return null
  var sum = records.reduce(function (n, r) { return n + (r.score || 0) }, 0)
  return Math.round(sum / records.length)
}

/**
 * Best and worst sealed weeks.
 * @param {object[]} records
 */
export function scoreRange(records) {
  if (!records || !records.length) return { best: null, worst: null }
  var best = records[0], worst = records[0]
  records.forEach(function (r) {
    if (r.score > best.score) best = r
    if (r.score < worst.score) worst = r
  })
  return { best: best, worst: worst }
}
