import { useEffect } from 'react'
import { useData } from '../App'
import Storage, { uuid, now } from '../lib/storage'
import {
  getCurrentValue, getCurrentValueDetail, calcGoalProgress, goalMet, goalKind, goalKindLabel,
} from '../lib/goals'

// ---------------------------------------------------------------------------
// Pure helpers — the maths lives in lib/goals.js so non-React callers (the AI
// coach context builder) can use it too. Re-exported here because components
// have always imported it from this hook.
// ---------------------------------------------------------------------------

export { getCurrentValue, getCurrentValueDetail, calcGoalProgress, goalMet, goalKind, goalKindLabel }

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
      // A grade goal ticks off by its kind (spec Q2, 2026-09-13): a send goal on
      // one send at the grade since it was set, a become goal once the base
      // reaches it. Weight and cardio are unchanged. See `goalMet`.
      if (!goalMet(g, sessions, weightLog, today)) return g
      changed = true
      return Object.assign({}, g, { achieved: true, achievedDate: today })
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
      // Grade goals only; null for weight and cardio. Defaults to 'send'.
      kind:         goalKind({ type: params.type, kind: params.kind }),
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
