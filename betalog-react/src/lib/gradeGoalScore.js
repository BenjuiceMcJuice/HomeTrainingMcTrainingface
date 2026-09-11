/**
 * BetaLog — how achievable is a climbing grade goal?
 *
 * Pure. No React imports.
 *
 * Phase C of the goals spec ("the achievability rating"), and the counterpart to
 * `weightGoalScore.js`. It answers the same question — *is this athlete, on this
 * evidence, going to do it?* — from the only evidence a climbing log holds:
 * grades attempted, grades sent, and how often.
 *
 * There is no `weightRate.js` equivalent here, and there should not be. A weight
 * goal has a health ceiling that is the same for everyone at a given bodyweight,
 * which is why the app refuses to save one that exceeds it. Climbing a grade
 * faster than usual is not a health risk, so **nothing here ever blocks a goal**.
 * It is a bet, and the athlete makes it.
 *
 * ## Four signals, in order of how much they are worth
 *
 * 1. **Pace** — grades to go against days left, as days per grade, compared with
 *    how long a grade has actually taken *this* athlete. The reference comes from
 *    their own log when the log contains a grade change, and from a stated
 *    default when it does not.
 * 2. **Volume** — sessions in that discipline per week. Grades move on mileage,
 *    and a goal set by someone climbing once a fortnight is a different
 *    proposition from the same goal set by someone climbing twice a week.
 * 3. **Reach** — whether anything harder than the current consistent grade is
 *    being attempted at all. A log of nothing but comfortable sends is a log of
 *    someone not trying to move, whatever the goal says.
 * 4. **Schedule debt** — grades gained against time elapsed since the goal was
 *    set. The same factor, and the same half-penalty-when-going-backwards rule,
 *    as the weight scorer.
 *
 * ## The pace reference, and how much to trust it
 *
 * **From the log, when there is one.** `gradeTimeline` replays the consistent
 * grade — the same ≥3 attempts, ≥40% send rate rule the rest of the app uses —
 * over a rolling window at fortnightly steps, and reads the days between first
 * reaching one grade and first reaching the next. That is this athlete's own
 * rate, measured the same way the goal will be judged, and it beats any table.
 *
 * **Otherwise, a declared default.** There is no published figure for how long a
 * climbing grade takes: it depends on age, background, frequency, body, injury
 * and luck, and no study tracks it. So the fallback is a convention, not a
 * finding — `DEFAULT_DAYS_PER_STEP`, deliberately generous, scaled by how hard
 * the target is, and reported through `referenceSource: 'default'` so the UI can
 * say where the number came from rather than implying it is measured. The first
 * real grade change in the log supersedes it.
 *
 * **A French step is not a V step.** The French ladder runs 6a, 6a+, 6b, so one
 * rung is roughly half a V-grade. The reference is per rung of whichever ladder
 * the goal is on, which is why the two systems have different defaults.
 *
 * None of this knows anything about the climber beyond what they logged.
 */

import {
  V_GRADES, FRENCH_GRADES, calcDisciplineStats, gradeLevel, shiftDate, daysBetween,
} from './stats'
import { SCORE_LABEL, reasonList } from './goalScore'

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

/** Sessions a week below which grades are unlikely to move. */
var LOW_VOLUME = 1
var GOOD_VOLUME = 1.5

function round1(v) { return Math.round(v * 10) / 10 }

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

/**
 * How much climbing, and how much of it above the current level.
 *
 * @param {object[]} sessions - already filtered to the window
 * @param {string[]} disciplines
 * @param {number} windowDays
 * @param {number} currentIdx - ladder index of the current consistent grade, or -1
 * @param {number} targetIdx
 * @param {string[]} gradeOrder
 * @returns {{sessionsPerWeek: number, sessions: number, aboveCurrent: number, atTarget: number, sentAtTarget: number}}
 */
function windowVolume(sessions, disciplines, windowDays, currentIdx, targetIdx, gradeOrder) {
  var count = 0, above = 0, atTarget = 0, sentAtTarget = 0
  ;(sessions || []).forEach(function (s) {
    if (!s || s.type !== 'climb') return
    var touched = false
    ;(s.climbs || []).forEach(function (c) {
      if (disciplines.indexOf(c.discipline) === -1) return
      touched = true
      var idx = gradeOrder.indexOf(c.grade)
      if (idx < 0) return
      if (currentIdx >= 0 && idx > currentIdx) above++
      if (idx >= targetIdx) {
        atTarget++
        if (c.outcome === 'sent' || c.outcome === 'flashed') sentAtTarget++
      }
    })
    if (touched) count++
  })
  return {
    sessions:        count,
    sessionsPerWeek: round1(count / (windowDays / 7)),
    aboveCurrent:    above,
    atTarget:        atTarget,
    sentAtTarget:    sentAtTarget,
  }
}

/**
 * Score a climbing grade goal 1–5 for achievability, with the reasons behind it.
 *
 * Starts at 5 and deducts, like every scorer in the app.
 *
 * Returns `score: null` — "not enough to say" — when there is no consistent
 * grade to measure from, when the target is already at or below it, or when the
 * date carries no time. None of those is a bad goal; they are goals this cannot
 * comment on.
 *
 * @param {{
 *   goal: {type: string, target: string, startValue?: string, targetDate: string, createdAt?: string},
 *   currentGrade: string|null,
 *   sessions: object[],
 *   todayIso?: string,
 * }} opts
 * @returns {{
 *   score: 1|2|3|4|5|null, label: string,
 *   gradesToGo: number|null, days: number|null,
 *   daysPerStepNeeded: number|null,
 *   reference: {daysPerStep: number, source: 'log'|'default', jumps: number}|null,
 *   timeline: ReturnType<typeof gradeTimeline>|null,
 *   volume: object|null,
 *   scheduleDebt: number|null,
 *   reasons: {factor: string, verdict: 'ok'|'warn'|'bad', detail: string, penalty: number}[],
 * }}
 */
function scoreGradeGoal(opts) {
  var o     = opts || {}
  var goal  = o.goal || {}
  var shape = gradeGoalShape(goal.type)
  var today = o.todayIso || new Date().toISOString().slice(0, 10)

  var blank = {
    score: null, label: 'Not enough to say',
    gradesToGo: null, days: null, daysPerStepNeeded: null,
    reference: null, timeline: null, volume: null, scheduleDebt: null, reasons: [],
  }
  if (!shape) return blank

  var order      = shape.gradeOrder
  var targetIdx  = order.indexOf(String(goal.target))
  var currentIdx = o.currentGrade ? order.indexOf(String(o.currentGrade)) : -1
  if (targetIdx < 0 || currentIdx < 0) return blank

  var gradesToGo = targetIdx - currentIdx
  var days       = daysBetween(today, goal.targetDate)
  // Already there, or the date has run out: the card says both in its own words,
  // and neither is a thing to rate.
  if (gradesToGo <= 0 || days === null || !isFinite(days) || days <= 0) return blank

  var sessions = (o.sessions || []).filter(function (s) { return s && s.type === 'climb' && s.date })
  var timeline = gradeTimeline(sessions, shape.disciplines, shape.system, today)
  var ref      = paceReference({ timeline: timeline, system: shape.system, targetGrade: goal.target })
  var needed   = Math.round(days / gradesToGo)

  var windowFrom = shiftDate(today, -WINDOW_DAYS)
  var recent     = sessions.filter(function (s) { return s.date > windowFrom && s.date <= today })
  var vol        = windowVolume(recent, shape.disciplines, WINDOW_DAYS, currentIdx, targetIdx, order)

  var R    = reasonList()
  var unit = shape.system === 'v' ? 'grade' : 'grade step'
  // What the pace is being measured against, phrased so a default can never be
  // mistaken for something read off this athlete's own climbing.
  var refTail = ref.source === 'log'
    ? 'the ' + ref.daysPerStep + ' days a ' + unit + ' has taken you'
    : 'a typical ' + ref.daysPerStep + ' days a ' + unit

  // --- 1. Pace -------------------------------------------------------------
  // The ratio is time allowed over time it takes: above 1 the goal is more
  // patient than the reference, below it the goal is asking for a speed-up.
  var ratio = needed / ref.daysPerStep
  if (ratio >= 1) {
    R.add('pace', 'ok', needed + ' days a ' + unit + ', against ' + refTail, 0)
  } else if (ratio >= 0.6) {
    R.add('pace', 'warn', 'Wants a ' + unit + ' every ' + needed + ' days, against ' + refTail, 0.5)
  } else if (ratio >= 0.35) {
    R.add('pace', 'bad', 'Wants a ' + unit + ' every ' + needed + ' days — roughly twice ' + refTail, 1.5)
  } else {
    R.add('pace', 'bad', 'Wants a ' + unit + ' every ' + needed + ' days — far faster than ' + refTail, 2)
  }

  // --- 2. Volume -----------------------------------------------------------
  var disciplineWord = goal.type === 'boulder_grade' ? 'Bouldering' : 'Roped climbing'
  if (vol.sessions === 0) {
    R.add('volume', 'bad', 'No ' + disciplineWord.toLowerCase() + ' logged in the last ' + WINDOW_DAYS + ' days', 1.25)
  } else if (vol.sessionsPerWeek < LOW_VOLUME / 2) {
    R.add('volume', 'bad', disciplineWord + ' ' + vol.sessionsPerWeek + '× a week — grades move on mileage', 1.25)
  } else if (vol.sessionsPerWeek < LOW_VOLUME) {
    R.add('volume', 'warn', disciplineWord + ' ' + vol.sessionsPerWeek + '× a week, under once a week', 0.75)
  } else if (vol.sessionsPerWeek < GOOD_VOLUME) {
    R.add('volume', 'warn', disciplineWord + ' ' + vol.sessionsPerWeek + '× a week', 0.25)
  } else {
    R.add('volume', 'ok', disciplineWord + ' ' + vol.sessionsPerWeek + '× a week', 0)
  }

  // --- 3. Reach ------------------------------------------------------------
  // Sends at the target are the strongest thing the log can say short of the
  // goal being met: the grade is in reach and the goal is now about repeating
  // it. Nothing above the current grade at all is the opposite — a log of
  // comfortable climbing, whatever the goal says.
  if (vol.sessions === 0) {
    // Already charged for by volume; saying it twice would swamp the score.
    R.add('reach', 'warn', 'Nothing logged to judge what you are trying', 0)
  } else if (vol.sentAtTarget > 0) {
    R.add('reach', 'ok', vol.sentAtTarget + ' send' + (vol.sentAtTarget === 1 ? '' : 's')
      + ' at ' + goal.target + ' or harder already — it is about repeatability now', 0)
  } else if (vol.atTarget >= 3) {
    R.add('reach', 'ok', vol.atTarget + ' tries at ' + goal.target + ' or harder in the last ' + WINDOW_DAYS + ' days', 0)
  } else if (vol.aboveCurrent >= 3) {
    R.add('reach', 'warn', 'Nothing sent at ' + goal.target + ' yet, though you are trying above ' + o.currentGrade, 0.25)
  } else if (vol.aboveCurrent > 0) {
    R.add('reach', 'warn', 'Only ' + vol.aboveCurrent + ' climb' + (vol.aboveCurrent === 1 ? '' : 's')
      + ' harder than ' + o.currentGrade + ' in the last ' + WINDOW_DAYS + ' days', 0.75)
  } else {
    R.add('reach', 'bad', 'Nothing harder than ' + o.currentGrade + ' attempted in the last ' + WINDOW_DAYS + ' days', 1)
  }

  // --- 4. Schedule debt ----------------------------------------------------
  var debt = null
  var startIdx = goal.startValue ? order.indexOf(String(goal.startValue)) : -1
  if (goal.createdAt && startIdx >= 0 && startIdx < targetIdx) {
    var elapsed = daysBetween(String(goal.createdAt).slice(0, 10), today)
    var total   = elapsed + days
    if (elapsed > 0 && total > 0) {
      var timeGone = elapsed / total
      var done     = (currentIdx - startIdx) / (targetIdx - startIdx)
      debt = Math.round((timeGone - done) * 100) / 100
      if (done < 0) {
        // The consistent grade has dropped since the goal was set. Half penalty:
        // the reach factor above has already charged for a log that is not
        // moving, and the same fact should not be paid for twice.
        R.add('schedule', 'bad', 'Consistent grade has dropped since the goal was set', 0.5)
      } else if (debt > 0.25) {
        R.add('schedule', 'bad', Math.round(timeGone * 100) + '% of the time gone, still at ' + o.currentGrade, 1)
      } else if (debt > 0.1) {
        R.add('schedule', 'warn', 'Behind schedule: ' + Math.round(timeGone * 100) + '% of the time for '
          + Math.round(done * 100) + '% of the climb', 0.5)
      } else {
        R.add('schedule', 'ok', 'On or ahead of schedule so far', 0)
      }
    }
  }

  var score = R.score()
  return {
    score:             score,
    label:             SCORE_LABEL[score],
    gradesToGo:        gradesToGo,
    days:              days,
    daysPerStepNeeded: needed,
    reference:         ref,
    timeline:          timeline,
    volume:            vol,
    scheduleDebt:      debt,
    reasons:           R.reasons,
  }
}

/**
 * The pace as one short phrase, for the line above the reasons — the grade
 * equivalent of `describeRate` in `weightRate.js`, and deliberately the same
 * shape: what the goal asks for, then what it is being measured against.
 *
 * @param {ReturnType<typeof scoreGradeGoal>} s
 * @param {'v'|'french'} [system]
 * @returns {string|null}
 */
function describeGradePace(s, system) {
  if (!s || s.daysPerStepNeeded === null || !s.reference) return null
  var unit = system === 'french' ? 'grade step' : 'grade'
  var each = s.gradesToGo === 1
    ? '1 ' + unit + ' in ' + s.days + ' days'
    : s.gradesToGo + ' ' + unit + 's in ' + s.days + ' days · ' + s.daysPerStepNeeded + ' days each'
  return each
}

/**
 * Where the comparison figure came from, in words — so a default is never shown
 * as though it were measured from the athlete's own climbing.
 *
 * @param {ReturnType<typeof scoreGradeGoal>} s
 * @param {'v'|'french'} [system]
 * @returns {string|null}
 */
function describeGradeReference(s, system) {
  if (!s || !s.reference) return null
  var unit = system === 'french' ? 'grade step' : 'grade'
  if (s.reference.source === 'log') {
    return 'Your own log: a ' + unit + ' every ' + s.reference.daysPerStep + ' days across '
      + s.reference.jumps + ' grade change' + (s.reference.jumps === 1 ? '' : 's')
  }
  return 'No grade change in your log yet — compared against a typical ' + s.reference.daysPerStep
    + ' days a ' + unit
}

export {
  scoreGradeGoal, gradeTimeline, paceReference, gradeGoalShape,
  consistentGradeAt, windowVolume, describeGradePace, describeGradeReference,
  WINDOW_DAYS, STEP_DAYS, MAX_HISTORY_DAYS, DEFAULT_DAYS_PER_STEP, LEVEL_FACTOR,
}
