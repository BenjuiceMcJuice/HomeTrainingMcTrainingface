import { useEffect } from 'react'
import { useData } from '../App'
import Storage, { uuid, now } from '../lib/storage'
import { V_GRADES, FRENCH_GRADES, calcDisciplineStats } from '../lib/stats'

// ---------------------------------------------------------------------------
// Pure helpers — exported so components can compute current value / progress
// without mounting the full hook
// ---------------------------------------------------------------------------

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
 * @param {import('../lib/types').Goal} goal
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

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export default function useGoals() {
  var { data, setData } = useData()
  var sessions  = data.sessions  || []
  var weightLog = data.weightLog || []
  var goals     = data.goals     || []

  // Auto-check achievements when sessions or weight log changes
  useEffect(function () {
    var today   = new Date().toISOString().slice(0, 10)
    var changed = false
    var next = goals.map(function (g) {
      if (g.achieved) return g
      var current = getCurrentValue(g.type, sessions, weightLog)
      if (current === null) return g
      var met = false
      if (g.type === 'boulder_grade') {
        met = V_GRADES.indexOf(String(current)) >= V_GRADES.indexOf(String(g.target))
      } else if (g.type === 'rope_grade') {
        met = FRENCH_GRADES.indexOf(String(current)) >= FRENCH_GRADES.indexOf(String(g.target))
      } else if (g.type === 'weight' && Number(g.target) < Number(g.startValue)) {
        met = Number(current) <= Number(g.target)
      } else {
        met = Number(current) >= Number(g.target)
      }
      if (met) {
        changed = true
        return Object.assign({}, g, { achieved: true, achievedDate: today })
      }
      return g
    })
    if (changed) {
      Storage.saveGoals(next)
      setData(function (prev) { return Object.assign({}, prev, { goals: next }) })
    }
  }, [sessions, weightLog])

  function addGoal(params) {
    var startValue = getCurrentValue(params.type, sessions, weightLog)
    if (startValue === null) startValue = 0
    var goal = {
      id:           uuid(),
      type:         params.type,
      target:       params.target,
      unit:         params.unit || null,
      targetDate:   params.targetDate,
      startValue:   startValue,
      createdAt:    now(),
      achieved:     false,
      achievedDate: null,
    }
    var next = goals.concat([goal])
    Storage.saveGoals(next)
    setData(function (prev) { return Object.assign({}, prev, { goals: next }) })
  }

  function updateGoal(id, updates) {
    var next = goals.map(function (g) { return g.id === id ? Object.assign({}, g, updates) : g })
    Storage.saveGoals(next)
    setData(function (prev) { return Object.assign({}, prev, { goals: next }) })
  }

  function deleteGoal(id) {
    var next = goals.filter(function (g) { return g.id !== id })
    Storage.saveGoals(next)
    setData(function (prev) { return Object.assign({}, prev, { goals: next }) })
  }

  return { goals, addGoal, updateGoal, deleteGoal }
}
