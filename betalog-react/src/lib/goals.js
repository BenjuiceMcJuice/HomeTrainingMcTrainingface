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
 * ## What did *not* change
 *
 * **Auto-achieve still reads the old consistent grade** (`achievementReading`
 * below), on its original 90-day window and all-time guard. Pointing it at
 * `base` would mean a goal could not tick off until 8 sends at the target —
 * correct for *become a 7a climber*, wrong for *send a 7a*, and every existing
 * goal is implicitly the second kind. Which of the two a goal *is* is spec Q2
 * and is not settled here, so achievement behaviour is held exactly as it was
 * rather than converted by a side effect.
 */

import {
  V_GRADES, FRENCH_GRADES, calcDisciplineStats, filterSessionsByDays,
  countDisciplineSessions, MIN_WINDOW_SESSIONS,
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

/** The window auto-achieve still measures over. See the module note. */
export var ACHIEVE_WINDOW_DAYS = 90

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
 * The consistent grade over the recent window, falling back to all time.
 *
 * **This is the pre-pyramid reading, kept for auto-achieve only.** It is no
 * longer what a goal card displays — see the module note — but it still decides
 * whether a goal ticks itself off, deliberately unchanged so that answering spec
 * Q1 does not quietly answer Q2 as well.
 *
 * **The window has to hold enough climbing to be read.** `calcConsistentGrade`
 * asks for three attempts at a grade, which a single evening of warm-ups meets
 * on its own: three V1s and nothing else made a V4 climber's goal report
 * "Currently V1 · 4 grades to go", with `basis: 'window'` presenting it as a
 * live measurement. One session is a sample of one day, not of your climbing, so
 * below `MIN_WINDOW_SESSIONS` the window is skipped entirely and the all-time
 * figure is used and labelled — stale and honest beats fresh and wrong.
 *
 * @param {object[]} sessions
 * @param {string[]} disciplines
 * @param {string[]} gradeOrder
 * @param {'v'|'french'} system
 * @returns {{value: string|null, basis: 'window'|'all'|null}}
 */
function consistentGrade(sessions, disciplines, gradeOrder, system) {
  var all    = sessions || []
  var window = filterSessionsByDays(all, ACHIEVE_WINDOW_DAYS)

  if (countDisciplineSessions(window, disciplines) >= MIN_WINDOW_SESSIONS) {
    var recent = calcDisciplineStats(window, disciplines, gradeOrder, system)
    if (recent.consistent) return { value: recent.consistent.grade, basis: 'window' }
  }

  var ever = calcDisciplineStats(all, disciplines, gradeOrder, system)
  if (ever.consistent) return { value: ever.consistent.grade, basis: 'all' }

  return { value: null, basis: null }
}

/**
 * The reading auto-achieve judges a grade goal by. Not for display.
 *
 * Separate from `getCurrentValueDetail` on purpose: the two answer different
 * questions now, and collapsing them again is what would convert every existing
 * goal to the harder kind without anyone deciding to.
 *
 * @param {string} type - GoalType
 * @param {object[]} sessions
 * @param {object[]} weightLog
 * @returns {{value: string|number|null, basis: 'window'|'all'|null}}
 */
export function getAchievementValueDetail(type, sessions, weightLog) {
  if (type === 'boulder_grade') {
    return consistentGrade(sessions, ['boulder'], V_GRADES, 'v')
  }
  if (type === 'rope_grade') {
    return consistentGrade(sessions, ['lead', 'toprope'], FRENCH_GRADES, 'french')
  }
  return getCurrentValueDetail(type, sessions, weightLog)
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
