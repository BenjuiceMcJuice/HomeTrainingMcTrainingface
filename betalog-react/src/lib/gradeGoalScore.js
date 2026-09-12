/**
 * BetaLog — how long a climbing grade has actually taken this athlete.
 *
 * Pure. No React imports.
 *
 * **This file used to hold `scoreGradeGoal`**, a 1–5 achievability rating built
 * from pace, volume, reach and schedule debt. It was replaced on 2026-09-12 by
 * `lib/pyramid.js`, which reads the *shape* of the log instead of inferring from
 * a pace — and in doing so retired all four of the tuning constants the scorer
 * had accumulated in a single day (`IDLE_PENALTY`, `SENT_AT_TARGET_FLOOR`,
 * `MIN_WINDOW_SESSIONS`, and the running-max rules). That the constants could be
 * deleted rather than carried across is the evidence the rewrite was worth doing.
 *
 * What survives is the part the pyramid has no view on: **time**. The pyramid
 * says what has been built; it says nothing about how fast this athlete moves
 * between grades. `gradeTimeline` and `paceReference` measure exactly that, from
 * the log, and they are the inputs phase 3 of the pyramid spec needs to turn a
 * deadline into a projected date.
 *
 * ## The pace reference, and how much to trust it
 *
 * **From the log, when there is one.** `gradeTimeline` replays the consistent
 * grade — the same ≥3 attempts, ≥40% send rate rule the rest of the app uses —
 * over a rolling window at fortnightly steps, and reads the days between
 * establishing one grade and establishing the next. That is this athlete's own
 * rate, and it beats any table.
 *
 * **Otherwise, a declared default.** There is no published figure for how long a
 * climbing grade takes: it depends on age, background, frequency, body, injury
 * and luck, and no study tracks it. So the fallback is a convention, not a
 * finding — `DEFAULT_DAYS_PER_STEP`, deliberately generous, scaled by how hard
 * the target is, and reported through `referenceSource: 'default'` so a caller
 * can say where the number came from rather than implying it is measured.
 *
 * **A French step is not a V step.** The French ladder runs 6a, 6a+, 6b, so one
 * rung is roughly half a V-grade, which is why the two systems differ.
 */

import {
  V_GRADES, FRENCH_GRADES, calcDisciplineStats, gradeLevel, shiftDate, daysBetween,
  countDisciplineSessions, MIN_WINDOW_SESSIONS,
} from './stats'

/** Window used to read a consistent grade — matches the Dashboard's 90d view. */
var WINDOW_DAYS = 90

/** Step between sample points when replaying the timeline. A fortnight is fine
 *  grained enough to date a grade change usefully and keeps the replay cheap. */
var STEP_DAYS = 14

/** How far back the replay looks. Bounds the work — 2 years at a fortnightly
 *  step is 53 sample points — and a jump from four years ago is not evidence
 *  about this year anyway. */
var MAX_HISTORY_DAYS = 730

/**
 * Days per ladder rung assumed when the log holds no grade change.
 *
 * A convention, not a measurement. Four months for a V-grade and two for a
 * French rung (half a V-grade) is at the patient end of what climbers report,
 * which is the right way for a fallback to be wrong: it makes an unknown athlete
 * look slower than they may be, so the score errs towards "this is a stretch"
 * rather than cheerfully endorsing a goal on no evidence.
 */
var DEFAULT_DAYS_PER_STEP = { v: 120, french: 60 }

/**
 * The default, scaled by how hard the target is.
 *
 * Progress slows as grades get harder — the one thing about grade progression
 * that is not controversial. The tiers are `stats.js`'s own level bands, so this
 * file invents no new boundaries.
 */
var LEVEL_FACTOR = {
  'Beginner':     0.6,
  'Intermediate': 0.8,
  'Advanced':     1,
  'Expert':       1.5,
  'Elite':        2,
  'Pro':          2.5,
  'World Class':  3,
}

function median(nums) {
  if (!nums.length) return null
  var s = nums.slice().sort(function (a, b) { return a - b })
  var mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

function ladderFor(system) { return system === 'v' ? V_GRADES : FRENCH_GRADES }

/**
 * The disciplines a goal type measures, and the ladder it is scored on.
 *
 * @param {string} type - 'boulder_grade' | 'rope_grade'
 * @returns {{disciplines: string[], system: 'v'|'french', gradeOrder: string[]}|null}
 */
function gradeGoalShape(type) {
  if (type === 'boulder_grade') return { disciplines: ['boulder'], system: 'v', gradeOrder: V_GRADES }
  if (type === 'rope_grade')    return { disciplines: ['lead', 'toprope'], system: 'french', gradeOrder: FRENCH_GRADES }
  return null
}

/**
 * The consistent grade as it stood at a given date, from the trailing window.
 *
 * Returns null when the window holds fewer than `MIN_WINDOW_SESSIONS` sessions
 * in the discipline, for the same reason the goal card does — and here it
 * matters twice over. A single warm-up-only evening inside a long run of V4
 * reads as "consistent at V1", which puts a **drop** in the timeline, and the
 * return to form then reads as a three-rung *rise*: one such day set the pace
 * reference to nine days a grade, which would have made almost any goal look
 * comfortably paced. A thin window produces no point at all rather than a
 * confident wrong one.
 *
 * @param {object[]} sessions
 * @param {string[]} disciplines
 * @param {'v'|'french'} system
 * @param {string} asOfIso
 * @param {number} [windowDays]
 * @returns {{grade: string, idx: number}|null}
 */
function consistentGradeAt(sessions, disciplines, system, asOfIso, windowDays) {
  var span   = windowDays === undefined ? WINDOW_DAYS : windowDays
  var from   = shiftDate(asOfIso, -span)
  var inWin  = (sessions || []).filter(function (s) {
    return s && s.date && s.date > from && s.date <= asOfIso
  })
  if (countDisciplineSessions(inWin, disciplines) < MIN_WINDOW_SESSIONS) return null
  var stats = calcDisciplineStats(inWin, disciplines, ladderFor(system), system)
  if (!stats.consistent) return null
  return { grade: stats.consistent.grade, idx: stats.consistent.idx }
}

/**
 * Replay the consistent grade backwards through the log, and read the grade
 * changes out of it.
 *
 * The samples are collapsed into **runs** — stretches where the consistent grade
 * held steady — and a **jump** is a run that sits higher than the run before it.
 * Its length is measured from the day the lower grade was established to the day
 * the higher one was, which is the honest answer to "how long did that grade
 * take you". Everything is measured on the same ≥3 attempts / ≥40% send-rate
 * rule the goal itself will be judged by, so history and target are
 * commensurable.
 *
 * Two rules earn their place here, and both came from real logs:
 *
 * - **A regained grade counts.** An earlier version tracked the running maximum,
 *   so a strong season two years ago erased every grade change since: an athlete
 *   who climbed V6, lost form, and worked back from V3 to V4 was reported as
 *   having never moved a grade. Regaining a grade is the same motion as gaining
 *   one for pacing purposes, and it is the only evidence a returning climber has.
 * - **A rise has to stick.** One fortnight's sample above the previous level is
 *   noise, and counting it would report a wildly fast reference off a single good
 *   session. A rise counts only once the higher grade holds for a second sample,
 *   or when it is where the log currently ends. The reference is then a median
 *   rather than a mean, so a log that yo-yos across a grade boundary cannot
 *   flatter itself with its shortest crossings.
 *
 * @param {object[]} sessions
 * @param {string[]} disciplines
 * @param {'v'|'french'} system
 * @param {string} [todayIso]
 * @returns {{
 *   points: {date: string, grade: string, idx: number}[],
 *   runs: {grade: string, idx: number, start: string, end: string, samples: number}[],
 *   jumps: {from: string, to: string, fromDate: string, toDate: string, days: number, daysPerStep: number}[],
 *   medianDaysPerStep: number|null,
 *   fastestDaysPerStep: number|null,
 * }}
 */
function gradeTimeline(sessions, disciplines, system, todayIso) {
  var today = todayIso || new Date().toISOString().slice(0, 10)
  var list  = (sessions || []).filter(function (s) { return s && s.type === 'climb' && s.date })
  var blank = { points: [], runs: [], jumps: [], medianDaysPerStep: null, fastestDaysPerStep: null }
  if (!list.length) return blank

  // Never sample before the log starts — an empty window reads as "no consistent
  // grade", which is true but says nothing, and each one costs a full pass.
  var earliest = list.reduce(function (min, s) { return s.date < min ? s.date : min }, list[0].date)
  var floor    = shiftDate(today, -MAX_HISTORY_DAYS)
  if (earliest < floor) earliest = floor

  var points = []
  for (var d = today; d >= earliest; d = shiftDate(d, -STEP_DAYS)) {
    var at = consistentGradeAt(list, disciplines, system, d)
    if (at) points.push({ date: d, grade: at.grade, idx: at.idx })
  }
  points.reverse()
  if (points.length < 2) return Object.assign({}, blank, { points: points, runs: [] })

  // Collapse into runs — stretches where the grade held steady.
  var runs = []
  points.forEach(function (p) {
    var last = runs[runs.length - 1]
    if (last && last.idx === p.idx) { last.end = p.date; last.samples++; return }
    runs.push({ grade: p.grade, idx: p.idx, start: p.date, end: p.date, samples: 1 })
  })

  var jumps = []
  for (var i = 1; i < runs.length; i++) {
    var from = runs[i - 1]
    var to   = runs[i]
    if (to.idx <= from.idx) continue
    // A rise has to stick: one sample above the previous level, with the log
    // continuing past it, is a single good fortnight rather than a grade gained.
    if (to.samples < 2 && i !== runs.length - 1) continue
    var steps = to.idx - from.idx
    var days  = daysBetween(from.start, to.start)
    if (days <= 0) continue
    jumps.push({
      from: from.grade, to: to.grade, fromDate: from.start, toDate: to.start,
      days: days,
      // Two rungs crossed in one go is one jump, not two: charge the elapsed
      // days across the rungs rather than crediting the whole span to each.
      daysPerStep: Math.round(days / steps),
    })
  }
  if (!jumps.length) return Object.assign({}, blank, { points: points, runs: runs })

  var perStep = jumps.map(function (j) { return j.daysPerStep })
  return {
    points: points,
    runs: runs,
    jumps: jumps,
    medianDaysPerStep:  Math.round(median(perStep)),
    fastestDaysPerStep: Math.min.apply(null, perStep),
  }
}

/**
 * The pace reference: how long one rung takes this athlete, or the stated
 * default when the log cannot say.
 *
 * @param {{
 *   timeline: ReturnType<typeof gradeTimeline>,
 *   system: 'v'|'french',
 *   targetGrade?: string,
 * }} opts
 * @returns {{daysPerStep: number, source: 'log'|'default', jumps: number}}
 */
function paceReference(opts) {
  var o  = opts || {}
  var tl = o.timeline || { jumps: [], medianDaysPerStep: null }
  if (tl.medianDaysPerStep) {
    return { daysPerStep: tl.medianDaysPerStep, source: 'log', jumps: tl.jumps.length }
  }
  var base   = DEFAULT_DAYS_PER_STEP[o.system === 'v' ? 'v' : 'french']
  var factor = LEVEL_FACTOR[gradeLevel(o.targetGrade, o.system)] || 1
  return { daysPerStep: Math.round(base * factor), source: 'default', jumps: 0 }
}

export {
  gradeTimeline, paceReference, gradeGoalShape, consistentGradeAt,
  WINDOW_DAYS, STEP_DAYS, MAX_HISTORY_DAYS, DEFAULT_DAYS_PER_STEP, LEVEL_FACTOR,
}
