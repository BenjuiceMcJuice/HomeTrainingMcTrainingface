import { useEffect } from 'react'
import { useData } from '../App'
import Storage, { uuid, now } from '../lib/storage'
import { V_GRADES, FRENCH_GRADES } from '../lib/stats'
import { getCurrentValue, getCurrentValueDetail, calcGoalProgress } from '../lib/goals'

// ---------------------------------------------------------------------------
// Pure helpers — the maths lives in lib/goals.js so non-React callers (the AI
// coach context builder) can use it too. Re-exported here because components
// have always imported it from this hook.
// ---------------------------------------------------------------------------

export { getCurrentValue, getCurrentValueDetail, calcGoalProgress }

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
      var detail  = getCurrentValueDetail(g.type, sessions, weightLog)
      var current = detail.value
      if (current === null) return g
      // Achieving a goal is a claim about now, so it may only be made on the
      // 90-day reading. A grade goal whose "current" figure had to fall back to
      // the whole log is being measured against a season that may be two years
      // old: good enough to show on the card, marked as such, and nowhere near
      // good enough to declare the goal done. The card keeps reporting progress
      // either way; it just will not tick itself off on stale evidence.
      if (detail.basis === 'all' && (g.type === 'boulder_grade' || g.type === 'rope_grade')) return g
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
