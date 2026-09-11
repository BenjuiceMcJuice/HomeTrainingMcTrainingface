/**
 * BetaLog — Goal maths
 *
 * Pure helpers for reading a goal's current value out of session/weight data
 * and turning it into a 0–1 progress fraction. They live here rather than in
 * useGoals so that non-React modules (the coach context builder) can use them
 * without pulling App.jsx — and the DataContext it holds — into the graph.
 * useGoals re-exports both, so existing importers are unaffected.
 *
 * ## Why a grade goal reads the last 90 days *(2026-09-11)*
 *
 * "Currently V4" used to mean *the hardest grade you have ever been consistent
 * at*, over the whole log. That is a career high, not a starting point, and it
 * made a grade goal measure from somewhere the athlete might not have been for
 * two years: the bar showed progress already banked, the distance-to-go was
 * flattering, and a goal could auto-achieve off a season that ended long ago.
 *
 * The Dashboard had already settled this for its own level cards — 90 days, with
 * an all-time fallback and the words "(all time)" when it falls back
 * (`LevelCard.jsx`). Goals now read the same way, so the two screens stop
 * disagreeing about what grade you climb.
 *
 * **The fallback matters as much as the window.** Someone three months off the
 * wall has no 90-day consistent grade at all, and reporting "no data yet" on
 * their goal would be a regression from a number that, while stale, was true.
 * So: the 90-day figure when there is one, the all-time figure when there is
 * not, and `basis` on the result saying which — the caller shows the difference
 * rather than hiding it.
 */

import { V_GRADES, FRENCH_GRADES, calcDisciplineStats, filterSessionsByDays } from './stats'

/** The window a grade goal measures "currently" over. Matches the Dashboard. */
export var GRADE_WINDOW_DAYS = 90

/**
 * The consistent grade over the recent window, falling back to all time.
 *
 * @param {object[]} sessions
 * @param {string[]} disciplines
 * @param {string[]} gradeOrder
 * @param {'v'|'french'} system
 * @returns {{value: string|null, basis: 'window'|'all'|null}}
 */
function currentGrade(sessions, disciplines, gradeOrder, system) {
  var all = sessions || []
  var recent = calcDisciplineStats(filterSessionsByDays(all, GRADE_WINDOW_DAYS), disciplines, gradeOrder, system)
  if (recent.consistent) return { value: recent.consistent.grade, basis: 'window' }

  var ever = calcDisciplineStats(all, disciplines, gradeOrder, system)
  if (ever.consistent) return { value: ever.consistent.grade, basis: 'all' }

  return { value: null, basis: null }
}

/**
 * Get the current measured value for a goal type, and say where it came from.
 *
 * `basis` is only meaningful for grade goals, where the value may be a 90-day
 * reading ('window') or an all-time fallback ('all'). Weight and cardio have a
 * single unambiguous source and report 'all'.
 *
 * @param {string} type - GoalType
 * @param {object[]} sessions
 * @param {object[]} weightLog
 * @returns {{value: string|number|null, basis: 'window'|'all'|null}}
 */
export function getCurrentValueDetail(type, sessions, weightLog) {
  if (type === 'boulder_grade') {
    return currentGrade(sessions, ['boulder'], V_GRADES, 'v')
  }
  if (type === 'rope_grade') {
    return currentGrade(sessions, ['lead', 'toprope'], FRENCH_GRADES, 'french')
  }
  if (type === 'weight') {
    var sorted = (weightLog || []).slice().sort(function (a, b) { return a.date > b.date ? -1 : 1 })
    return { value: sorted.length > 0 ? sorted[0].weight : null, basis: sorted.length > 0 ? 'all' : null }
  }
  if (type === 'run' || type === 'swim' || type === 'cycle') {
    var best = null
    ;(sessions || []).forEach(function (s) {
      if (s.type === 'cardio' && s.cardioActivity === type && s.cardioQuantity) {
        if (best === null || s.cardioQuantity > best) best = s.cardioQuantity
      }
    })
    return { value: best, basis: best === null ? null : 'all' }
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
