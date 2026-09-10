/**
 * BetaLog — Goal maths
 *
 * Pure helpers for reading a goal's current value out of session/weight data
 * and turning it into a 0–1 progress fraction. They live here rather than in
 * useGoals so that non-React modules (the coach context builder) can use them
 * without pulling App.jsx — and the DataContext it holds — into the graph.
 * useGoals re-exports both, so existing importers are unaffected.
 */

import { V_GRADES, FRENCH_GRADES, calcDisciplineStats } from './stats'

/**
 * Get the current measured value for a goal type from session/weight data.
 * @param {string} type - GoalType
 * @param {object[]} sessions
 * @param {object[]} weightLog
 * @returns {string|number|null}
 */
export function getCurrentValue(type, sessions, weightLog) {
  var stats
  if (type === 'boulder_grade') {
    stats = calcDisciplineStats(sessions || [], ['boulder'], V_GRADES, 'v')
    return stats.consistent ? stats.consistent.grade : null
  }
  if (type === 'rope_grade') {
    stats = calcDisciplineStats(sessions || [], ['lead', 'toprope'], FRENCH_GRADES, 'french')
    return stats.consistent ? stats.consistent.grade : null
  }
  if (type === 'weight') {
    var sorted = (weightLog || []).slice().sort(function (a, b) { return a.date > b.date ? -1 : 1 })
    return sorted.length > 0 ? sorted[0].weight : null
  }
  if (type === 'run' || type === 'swim' || type === 'cycle') {
    var best = null
    ;(sessions || []).forEach(function (s) {
      if (s.type === 'cardio' && s.cardioActivity === type && s.cardioQuantity) {
        if (best === null || s.cardioQuantity > best) best = s.cardioQuantity
      }
    })
    return best
  }
  return null
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
