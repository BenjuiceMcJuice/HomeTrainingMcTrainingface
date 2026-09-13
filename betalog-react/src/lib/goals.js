/**
 * BetaLog — Goal maths
 *
 * Pure helpers for reading a goal's current value out of session/weight data
 * and turning it into a 0–1 progress fraction. They live here rather than in
 * useGoals so that non-React modules (the coach context builder) can use them
 * without pulling App.jsx — and the DataContext it holds — into the graph.
 * useGoals re-exports both, so existing importers are unaffected.
 *
 * ## What "Currently" means on a grade goal *(2026-09-12, Ben's call on spec Q1)*
 *
 * **The grade you own — `base` from the pyramid — not the hardest you have
 * touched.** The number anchors a progress bar toward a target, so it is a claim
 * about what is built, and `working` (three *attempts* at a grade, sent or not)
 * would measure progress from somewhere you have not arrived. `project` is the
 * career high the pyramid exists to argue against.
 *
 * This reads **lower** than the number the app showed before, and deliberately.
 * A goal card therefore shows `project` beside it, so nothing is hidden by the
 * change — see `GoalsSection`.
 *
 * **There is no all-time fallback any more, and that is the point.** The old
 * reading fell back to the whole log and labelled it "(all time)"; a base is a
 * statement about the last `PYRAMID_WINDOW_DAYS` and nothing else. When there is
 * no base the honest answer is *no base yet*, with the project grade beside it
 * for context — not a career high wearing a caveat.
 *
 * **The window moved 90 → 180 days with it.** A base needs 8 credited sends at
 * one grade, capped at 2 per session, so it needs four separate sessions; 90
 * days of ordinary climbing rarely contains that, and a base that can never fill
 * is not a measurement. The pyramid's window is now the only one.
 *
 * ## Two kinds of grade goal *(2026-09-13, Ben's call on spec Q2)*
 *
 * *Send a 7a* and *become a 7a climber* are different goals, and until now the
 * app never said which one a goal was: auto-achieve read a 90-day consistent
 * grade, which is neither. `goal.kind` names it, and `goalEvidence` ticks each
 * off by its own rule — one send at the grade inside the pyramid window, or the
 * base reaching the grade — and records what did it.
 *
 * **The default is `send`,** and a goal with no `kind` reads as one. Ben: *"I
 * was most happy when I did my first 7a, not when I became more consistent."*
 * It is also what every existing goal was created meaning, so reading a missing
 * kind as `send` needs no migration and changes no goal's meaning.
 */

import {
  V_GRADES, FRENCH_GRADES, deriveSessionMetres, shiftDate, gradeLevel, buildPublicProfile,
} from './stats'
import {
  pyramidShapeFor, buildPyramid, baseGrade, describePyramidBasis,
  PYRAMID_WINDOW_DAYS,
} from './pyramid'

/**
 * The window a grade goal measures "currently" over.
 *
 * The pyramid's window, not a second one — one reading of one log means one
 * window. Kept as a named export because callers import it for their labels.
 */
export var GRADE_WINDOW_DAYS = PYRAMID_WINDOW_DAYS

/** The kinds a grade goal can be. The first is the default. */
export var GOAL_KINDS = ['send', 'become']

/**
 * Which kind a goal is. Null for anything that is not a grade goal.
 *
 * @param {{type: string, kind?: string}} goal
 * @returns {'send'|'become'|null}
 */
export function goalKind(goal) {
  if (!goal || !pyramidShapeFor(goal.type)) return null
  return goal.kind === 'become' ? 'become' : 'send'
}

/**
 * The goal in words — "Send 6c", "Own 6c". Null for anything that is not a
 * grade goal.
 *
 * *Own*, not *become a 6c climber* (2026-09-13, BTL-B34): the sheet's buttons
 * said "Send it / Own it" and the title said "Become a 6c climber", two
 * vocabularies for one choice. "Own" is the word the pyramid already uses for
 * the base, so the goal and the reading it waits on now share a name. The
 * stored kind is still `become`; only the words changed.
 *
 * @param {{type: string, kind?: string, target: string}} goal
 * @returns {string|null}
 */
export function goalKindLabel(goal) {
  var kind = goalKind(goal)
  if (!kind) return null
  return (kind === 'become' ? 'Own ' : 'Send ') + goal.target
}

/**
 * The public profile friends read, with the pyramid's readings on it.
 *
 * `buildPublicProfile` in `stats.js` cannot read the pyramid — `stats` is
 * imported by `pyramid`, so the import would be circular — and it published
 * the 90-day consistent grade, its level, and an all-time hardest send. Q3
 * answered (Ben, 2026-09-13): friends see **Base**, the same reading as the
 * Dashboard, and *best* and *flash* over the same window, so what a friend
 * sees is what you see. Lower than before, and true.
 *
 * The old keys are kept and overwritten rather than removed, so a friend on an
 * older build still reads a grade where it expects one.
 *
 * @param {object[]} sessions
 * @param {object|null} profile
 * @returns {object} the `buildPublicProfile` shape, plus `base` on each level
 */
export function buildPublicProfileWithBase(sessions, profile) {
  var p = buildPublicProfile(sessions, profile)
  function overlay(summary, type) {
    var r = currentReading(type, sessions)
    if (!r) return summary
    var flash = null
    ;(r.pyramid.tiers || []).forEach(function (t) {
      if (flash === null && t.flashes > 0) flash = t.grade
    })
    if (!summary && !r.base && !r.project) return summary
    var system = type === 'boulder_grade' ? 'v' : 'french'
    return Object.assign({}, summary || {}, {
      base:    r.base,
      project: r.project,
      flash:   flash,
      level:   r.base ? gradeLevel(r.base, system) : null,
      // Kept for older builds; no longer shown anywhere.
      consistent: (summary && summary.consistent) || null,
    })
  }
  return Object.assign({}, p, {
    boulderLevel: overlay(p.boulderLevel, 'boulder_grade'),
    ropeLevel:    overlay(p.ropeLevel, 'rope_grade'),
  })
}

/**
 * The one reader. Everything that shows a climber "what grade you are" goes
 * through this, so two screens cannot disagree about one log.
 *
 * Returns all three readings rather than a single number: the caller decides
 * which to lead with, and `base` alone would throw away the context that makes a
 * low or absent base legible.
 *
 * @param {string} type - 'boulder_grade' | 'rope_grade'
 * @param {object[]} sessions
 * @param {{todayIso?: string, windowDays?: number, capPerSession?: number}} [opts]
 * @returns {{
 *   base: string|null, working: string|null, project: string|null,
 *   sessionCount: number, windowDays: number, basisText: string|null,
 *   pyramid: object,
 * }|null} null when the type is not a grade goal.
 */
export function currentReading(type, sessions, opts) {
  var shape = pyramidShapeFor(type)
  if (!shape) return null

  var o = opts || {}
  var pyramid = buildPyramid({
    sessions:      sessions || [],
    disciplines:   shape.disciplines,
    system:        shape.system,
    todayIso:      o.todayIso,
    windowDays:    o.windowDays,
    capPerSession: o.capPerSession,
  })
  var base = baseGrade(pyramid)

  return {
    base:         base ? base.grade : null,
    working:      pyramid.working ? pyramid.working.grade : null,
    project:      pyramid.project ? pyramid.project.grade : null,
    sessionCount: pyramid.sessionCount,
    windowDays:   pyramid.windowDays,
    basisText:    describePyramidBasis(pyramid),
    pyramid:      pyramid,
  }
}

/**
 * Whether a goal has been hit, and what hit it — what auto-achieve ticks a goal
 * off by, and what the achieved row and the History feed then say about it.
 *
 * - **send** — one send or flash at the target grade or harder, in the goal's
 *   disciplines, **inside the pyramid window**. The evidence is the earliest
 *   such send, so "achieved" carries the date it actually happened.
 * - **become** — the base grade (the grade you own, over the pyramid window)
 *   has reached the target. The evidence is the base itself, dated today: a
 *   base is a reading, not an event.
 * - **weight and cardio** — the current value against the target, as before.
 *
 * ## A send from before the goal was set counts *(2026-09-13, Ben)*
 *
 * Until now a send goal only counted sends dated on or after the day the goal
 * was set — "a claim about what comes next". Ben set *send a 6a* against a 6a he
 * had sent the week before, and the app scored it 2/5 and never said it was
 * done. The window is the one clock everything else in the app reads by, and a
 * send inside it is a send. The goal sheet now refuses a send goal that is
 * already met, so the rule cannot be reached by accident — see `GoalSheet`.
 *
 * @param {import('./types').Goal} goal
 * @param {object[]} sessions
 * @param {object[]} weightLog
 * @param {string} [todayIso]
 * @returns {{
 *   met: boolean,
 *   by: import('./types').GoalAchievedBy | null,
 * }} `by` is null when not met.
 */
export function goalEvidence(goal, sessions, weightLog, todayIso) {
  var none = { met: false, by: null }
  if (!goal) return none
  var shape = pyramidShapeFor(goal.type)
  var today = todayIso || new Date().toISOString().slice(0, 10)

  if (shape) {
    var ladder = shape.system === 'v' ? V_GRADES : FRENCH_GRADES
    var ti = ladder.indexOf(String(goal.target))
    if (ti === -1) return none

    if (goalKind(goal) === 'become') {
      var r = currentReading(goal.type, sessions, { todayIso: today })
      if (!r.base || ladder.indexOf(r.base) < ti) return none
      return { met: true, by: { how: 'base', grade: r.base, date: today } }
    }

    // Same bounds as `buildPyramid`, so a send the pyramid counts is a send the
    // goal counts and vice versa.
    var from = shiftDate(today, -PYRAMID_WINDOW_DAYS)
    var first = null
    ;(sessions || []).forEach(function (s) {
      if (!s || s.type !== 'climb' || !s.date) return
      if (s.date <= from || s.date > today) return
      if (first && s.date >= first.date) return
      ;(s.climbs || []).forEach(function (c) {
        if (!c || shape.disciplines.indexOf(c.discipline) === -1) return
        if (c.outcome !== 'sent' && c.outcome !== 'flashed') return
        if (ladder.indexOf(c.grade) < ti) return
        if (!first || s.date < first.date) first = { how: 'send', grade: c.grade, date: s.date }
      })
    })
    return first ? { met: true, by: first } : none
  }

  var current = getCurrentValue(goal.type, sessions, weightLog)
  if (current === null || current === undefined) return none
  var met = goal.type === 'weight' && Number(goal.target) < Number(goal.startValue)
    ? Number(current) <= Number(goal.target)
    : Number(current) >= Number(goal.target)
  return met ? { met: true, by: { how: 'value', value: current, date: today } } : none
}

/**
 * Whether a goal has been hit. `goalEvidence` with the reasons dropped.
 *
 * @param {import('./types').Goal} goal
 * @param {object[]} sessions
 * @param {object[]} weightLog
 * @param {string} [todayIso]
 * @returns {boolean}
 */
export function goalMet(goal, sessions, weightLog, todayIso) {
  return goalEvidence(goal, sessions, weightLog, todayIso).met
}

/**
 * What achieved a goal, in words — for the achieved row and the History feed.
 * "Sent 6a on 3 Sep", "Base reached 6a", "Reached 74.8 kg". Null when there is
 * nothing recorded, which is every goal achieved before this field existed.
 *
 * @param {import('./types').Goal} goal
 * @returns {string|null}
 */
export function describeAchievedBy(goal) {
  var by = goal && goal.achievedBy
  if (!by) return null
  if (by.how === 'send') return 'Sent ' + by.grade + (by.date ? ' on ' + shortDate(by.date) : '')
  if (by.how === 'base') return 'Base reached ' + by.grade
  if (by.how === 'value') {
    return 'Reached ' + String(by.value) + (goal.unit ? ' ' + goal.unit : '')
  }
  return null
}

function shortDate(iso) {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  } catch {
    return iso
  }
}

/**
 * Get the current measured value for a goal type, and say where it came from.
 *
 * For a grade goal the value is the **base** grade and `basis` is `'base'`, or
 * `null` when the log has no base in the window — there is no fallback, by
 * design. `reading` carries all three readings so a caller can show `project`
 * beside it. Weight and cardio have a single unambiguous source and report
 * 'all'.
 *
 * @param {string} type - GoalType
 * @param {object[]} sessions
 * @param {object[]} weightLog
 * @returns {{value: string|number|null, basis: 'base'|'all'|null, reading?: object}}
 */
export function getCurrentValueDetail(type, sessions, weightLog) {
  if (type === 'boulder_grade' || type === 'rope_grade') {
    var r = currentReading(type, sessions)
    return { value: r.base, basis: r.base ? 'base' : null, reading: r }
  }
  if (type === 'weight') {
    var sorted = (weightLog || []).slice().sort(function (a, b) { return a.date > b.date ? -1 : 1 })
    return { value: sorted.length > 0 ? sorted[0].weight : null, basis: sorted.length > 0 ? 'all' : null }
  }
  if (type === 'run' || type === 'swim' || type === 'cycle') {
    // Normalise to metres before comparing. `cardioQuantity` is a bare number in
    // whatever unit the logger was set to — and the defaults are **miles** for
    // run and cycle and **lengths** for swim, while a distance goal is always in
    // km. Comparing the raw numbers read a 6-mile run as 6 km (understating a
    // 10 km goal as 60% when it was 97%) and a 1500 m swim as 1500 km, which
    // cleared a 1 km goal outright and auto-achieved it. The max was taken
    // across mixed units too, so 1500 always beat 5 whatever they measured.
    var bestM = null
    ;(sessions || []).forEach(function (s) {
      if (!s || s.type !== 'cardio' || s.cardioActivity !== type) return
      // null when the unit is missing, or a swim in lengths with no pool length
      // recorded — in both cases the distance genuinely is not known, so the
      // session cannot contribute to a distance goal.
      var m = deriveSessionMetres(s)
      if (m === null || m === undefined) return
      if (bestM === null || m > bestM) bestM = m
    })
    if (bestM === null) return { value: null, basis: null }
    return { value: Math.round(bestM / 10) / 100, basis: 'all' }
  }
  return { value: null, basis: null }
}

/**
 * Get the current measured value for a goal type from session/weight data.
 * @param {string} type - GoalType
 * @param {object[]} sessions
 * @param {object[]} weightLog
 * @returns {string|number|null}
 */
export function getCurrentValue(type, sessions, weightLog) {
  return getCurrentValueDetail(type, sessions, weightLog).value
}

/**
 * Calculate goal progress as a 0–1 float.
 * @param {import('./types').Goal} goal
 * @param {string|number|null} currentValue
 * @returns {number}
 */
export function calcGoalProgress(goal, currentValue) {
  if (currentValue === null || currentValue === undefined) return 0

  if (goal.type === 'boulder_grade') {
    var si = V_GRADES.indexOf(String(goal.startValue))
    var ti = V_GRADES.indexOf(String(goal.target))
    var ci = V_GRADES.indexOf(String(currentValue))
    if (si === -1 || ti === -1 || ci === -1) return 0
    if (ti <= si) return ci >= ti ? 1 : 0
    return Math.min(1, Math.max(0, (ci - si) / (ti - si)))
  }
  if (goal.type === 'rope_grade') {
    si = FRENCH_GRADES.indexOf(String(goal.startValue))
    ti = FRENCH_GRADES.indexOf(String(goal.target))
    ci = FRENCH_GRADES.indexOf(String(currentValue))
    if (si === -1 || ti === -1 || ci === -1) return 0
    if (ti <= si) return ci >= ti ? 1 : 0
    return Math.min(1, Math.max(0, (ci - si) / (ti - si)))
  }

  // Numeric types
  var start   = Number(goal.startValue) || 0
  var target  = Number(goal.target)
  var current = Number(currentValue)

  // Weight loss: target < startValue
  if (goal.type === 'weight' && target < start) {
    if (start === target) return 1
    return Math.min(1, Math.max(0, (start - current) / (start - target)))
  }

  if (start >= target) return current >= target ? 1 : 0
  return Math.min(1, Math.max(0, (current - start) / (target - start)))
}
