/**
 * BetaLog — the grade pyramid.
 *
 * Pure. No React imports.
 *
 * ## Why this exists
 *
 * `calcConsistentGrade` reduces a whole climbing log to **one grade** — the
 * hardest with ≥3 attempts and ≥40% sent. Everything about the *shape* of
 * someone's climbing is discarded at that line, and on 2026-09-11 four separate
 * constants had to be invented to smuggle pieces of it back in: `IDLE_PENALTY`,
 * `SENT_AT_TARGET_FLOOR`, `MIN_WINDOW_SESSIONS`, and the running-max /
 * rise-must-stick rules in `gradeGoalScore`. Each one existed because a single
 * number could not say what the log plainly showed — that an athlete had flashed
 * the target grade, or had only warmed up, or had not climbed at all.
 *
 * The log is already the right shape. One row per climb, carrying a grade, an
 * outcome and a date, is exactly the **grade pyramid** every climbing coach asks
 * for on paper. This module keeps that shape instead of collapsing it.
 *
 * ## The pyramid, and where the numbers come from
 *
 * Eric Hörst introduced the grade pyramid in *How to Climb 5.12*; it is now
 * standard coaching material. The canonical structure is a 2:1 ratio between
 * tiers — **1 · 2 · 4 · 8** reading down from the target grade — with the base
 * set at a grade the climber sends consistently.
 *
 * `PYRAMID_SHAPE` is therefore a **convention taken from the coaching
 * literature**, not a measurement, and it is exported so a caller can say so.
 * The direction it encodes is not controversial (progress slows sharply as
 * grades get harder: a beginner moves two grades in months, a V8 climber spends
 * years on one); the exact counts are a widely-taught rule of thumb.
 *
 * ## Three rules that make this robust where the single number was not
 *
 * 1. **Surplus spills downward.** A send is credited to its own tier first; what
 *    is left over satisfies the tiers below. Ten sends at 6c+ therefore
 *    demonstrate the 6c tier, because climbing harder plainly covers easier —
 *    while a *single* send at 7a fills only the top tier and nothing beneath it,
 *    which is the whole point of a pyramid.
 * 2. **One session cannot fill a tier.** Laps are training, not pyramid entries,
 *    and the log has no route identity (`Climb.routeId` is typed and always
 *    null), so six sends of *the same* V4 are indistinguishable from six
 *    different ones. `MAX_SENDS_PER_SESSION` caps what any one session
 *    contributes per grade. Cheap, needs no new data, and kills lap inflation.
 * 3. **Nothing needs a minimum-evidence guard.** A thin log simply produces
 *    empty tiers, which is the truth. `MIN_WINDOW_SESSIONS` exists in `goals.js`
 *    only because one number had to be either right or wrong with nothing in
 *    between; a pyramid is allowed to be partly built.
 *
 * Phase 1 of the pyramid spec: the model, wired to nothing.
 */

import { V_GRADES, FRENCH_GRADES, shiftDate } from './stats'

/**
 * Sends wanted at the target grade and each grade below it, from the coaching
 * literature's 2:1 pyramid. Index 0 is the target itself.
 */
var PYRAMID_SHAPE = [1, 2, 4, 8]

/**
 * How many tiers of that shape actually count.
 *
 * **Four — the literature's own depth.** An earlier version capped this at three
 * on the strength of a measurement that turned out to be invalid: a log whose
 * hardest send was V4 appeared to read *53% ready for V7* at four tiers, and the
 * fourth tier was blamed. The real culprit was the readiness arithmetic of the
 * time, which counted total material and so let a full easy row carry an empty
 * top. Once readiness was rebuilt from the bottom (see `pyramidReadiness`) the
 * same log and the same four tiers read 25%, and the case for capping the depth
 * went with it.
 *
 * Ben's underlying point still holds and is still load-bearing — the bottom tier
 * does sit in warm-up territory and does not get logged. **Surplus spill is what
 * answers it**, not a shorter pyramid: real volume at the grades above flows down
 * and covers the tier nobody bothers to log, which is exactly what it should do.
 * A climber with genuine mileage is not punished for skipping the warm-ups; a
 * climber with no mileage has nothing to spill and is not flattered.
 *
 * Still shrinks near the bottom of the ladder, where there is nowhere to put a
 * fourth tier. That is the right shape at a low grade, not a truncated one.
 */
var PYRAMID_MAX_DEPTH = 4

/**
 * How far back a pyramid looks, in days.
 *
 * Longer than the 90 days `goals.js` uses for *current form*, because these
 * answer different questions: form is "what are you climbing now", a pyramid is
 * "what have you built". Sends accumulate rather than expire, and at one or two
 * sessions a week a 90-day window could never fill an eight-wide base.
 */
var PYRAMID_WINDOW_DAYS = 180

/**
 * The most any single session may contribute to one grade's tier.
 *
 * See rule 2 above. Two rather than one because a genuinely varied session that
 * happens to include two problems at a grade should count for both.
 */
var MAX_SENDS_PER_SESSION = 2

/**
 * Attempts at a grade before it counts as one you are actively working.
 *
 * Deliberately the same 3 that `calcConsistentGrade` already uses, so "working
 * grade" stays continuous with the number the app has always shown rather than
 * introducing a second, differently-calibrated threshold.
 */
var WORKING_MIN_ATTEMPTS = 3

/** Readiness → the words for it. About what is built, not about likelihood. */
var READINESS_LABEL = {
  5: 'Pyramid complete',
  4: 'Base nearly there',
  3: 'Base forming',
  2: 'Base thin',
  1: 'No base yet',
}

function ladderFor(system) { return system === 'v' ? V_GRADES : FRENCH_GRADES }

function isSend(outcome) { return outcome === 'sent' || outcome === 'flashed' }

/**
 * The disciplines and ladder a grade goal type is measured on.
 *
 * @param {string} type - 'boulder_grade' | 'rope_grade'
 * @returns {{disciplines: string[], system: 'v'|'french'}|null}
 */
function pyramidShapeFor(type) {
  if (type === 'boulder_grade') return { disciplines: ['boulder'], system: 'v' }
  if (type === 'rope_grade')    return { disciplines: ['lead', 'toprope'], system: 'french' }
  return null
}

/**
 * Build the grade pyramid for one discipline over a window.
 *
 * Returns a tier per grade actually climbed, hardest first, plus the three
 * readings that replace the single consistent grade:
 *
 * - **project** — the hardest grade sent, however rarely. One send is enough.
 * - **working** — the hardest grade being genuinely tried (`WORKING_MIN_ATTEMPTS`
 *   attempts), sent or not. What you are on at the moment.
 * - **base** — the hardest grade you have done a lot of. The grade you own
 *   rather than have touched; computed by `baseGrade` from this result.
 *
 * @param {{
 *   sessions: object[],
 *   disciplines: string[],
 *   system: 'v'|'french',
 *   todayIso?: string,
 *   windowDays?: number,
 *   capPerSession?: number,
 * }} opts
 * @returns {{
 *   system: 'v'|'french', from: string, to: string, windowDays: number,
 *   capPerSession: number, sessionCount: number,
 *   tiers: {grade: string, idx: number, credited: number, sends: number,
 *           attempts: number, flashes: number, sessions: number}[],
 *   byGrade: Object<string, object>,
 *   project: {grade: string, idx: number}|null,
 *   working: {grade: string, idx: number}|null,
 *   totalSends: number, totalAttempts: number,
 * }}
 */
function buildPyramid(opts) {
  var o      = opts || {}
  var order  = ladderFor(o.system)
  var today  = o.todayIso || new Date().toISOString().slice(0, 10)
  var days   = o.windowDays === undefined ? PYRAMID_WINDOW_DAYS : o.windowDays
  var cap    = o.capPerSession === undefined ? MAX_SENDS_PER_SESSION : o.capPerSession
  var from   = shiftDate(today, -days)
  var discs  = o.disciplines || []

  var byGrade = {}
  var sessionCount = 0
  var totalSends = 0, totalAttempts = 0

  function bucket(g) {
    if (!byGrade[g]) {
      byGrade[g] = { grade: g, idx: order.indexOf(g), credited: 0, sends: 0, attempts: 0, flashes: 0, sessions: 0 }
    }
    return byGrade[g]
  }

  ;(o.sessions || []).forEach(function (s) {
    if (!s || s.type !== 'climb' || !s.date) return
    if (s.date <= from || s.date > today) return

    // Per session, per grade: how many sends happened, so the cap can be applied
    // before anything reaches the tier totals.
    var sendsHere = {}
    var touched = false

    ;(s.climbs || []).forEach(function (c) {
      if (!c || discs.indexOf(c.discipline) === -1) return
      if (order.indexOf(c.grade) === -1) return
      touched = true

      var b = bucket(c.grade)
      b.attempts++
      totalAttempts++
      if (isSend(c.outcome)) {
        b.sends++
        totalSends++
        sendsHere[c.grade] = (sendsHere[c.grade] || 0) + 1
      }
      if (c.outcome === 'flashed') b.flashes++
    })

    if (touched) sessionCount++

    Object.keys(sendsHere).forEach(function (g) {
      var b = bucket(g)
      b.credited += Math.min(sendsHere[g], cap)
      b.sessions++
    })
  })

  var tiers = Object.keys(byGrade)
    .map(function (g) { return byGrade[g] })
    .sort(function (a, b) { return b.idx - a.idx })

  var project = null, working = null
  tiers.forEach(function (t) {
    if (project === null && t.sends > 0) project = { grade: t.grade, idx: t.idx }
    if (working === null && t.attempts >= WORKING_MIN_ATTEMPTS) working = { grade: t.grade, idx: t.idx }
  })

  return {
    system: o.system, from: from, to: today, windowDays: days, capPerSession: cap,
    sessionCount: sessionCount,
    tiers: tiers, byGrade: byGrade,
    project: project, working: working,
    totalSends: totalSends, totalAttempts: totalAttempts,
  }
}

/**
 * How much of the pyramid under a target grade actually exists.
 *
 * Tiers are walked from the target downward. Each is filled from its own grade's
 * credited sends first; the surplus carries down to the tier beneath, so
 * climbing harder than a tier covers it (rule 1 in the module note) while a lone
 * send at the target fills nothing below itself.
 *
 * @param {{
 *   pyramid: ReturnType<typeof buildPyramid>,
 *   targetGrade: string,
 *   shape?: number[],
 * }} opts
 * @returns {{
 *   target: string|null,
 *   tiers: {grade: string, need: number, own: number, have: number, met: boolean, short: number}[],
 *   required: number, credited: number, pct: number, fillPct: number,
 *   solidTiers: number, filledTiers: number, depth: number,
 *   truncated: boolean, topTierMet: boolean, complete: boolean, sentTarget: boolean,
 *   score: 1|2|3|4|5, label: string,
 *   nextUp: {grade: string, short: number}|null,
 * }}
 */
function pyramidReadiness(opts) {
  var o     = opts || {}
  var pyr   = o.pyramid || { byGrade: {}, system: 'v' }
  var order = ladderFor(pyr.system)
  var depth = o.maxDepth === undefined ? PYRAMID_MAX_DEPTH : o.maxDepth
  var shape = (o.shape || PYRAMID_SHAPE).slice(0, depth)
  var ti    = order.indexOf(String(o.targetGrade))

  var blank = {
    target: null, tiers: [], required: 0, credited: 0, pct: 0,
    fillPct: 0, solidTiers: 0, filledTiers: 0, depth: 0,
    truncated: false, topTierMet: false, complete: false, sentTarget: false,
    score: 1, label: READINESS_LABEL[1], nextUp: null,
  }
  if (ti < 0) return blank

  var tiers = []
  var carry = 0
  var required = 0, credited = 0, filled = 0
  var truncated = false

  for (var i = 0; i < shape.length; i++) {
    var idx = ti - i
    // Ran off the bottom of the ladder: a V1 pyramid has nowhere to put a third
    // tier. Recorded, but no longer disqualifying — a shallow pyramid at a low
    // grade is the right shape rather than a broken one.
    if (idx < 0) { truncated = true; break }
    var grade = order[idx]
    var need  = shape[i]
    var own   = (pyr.byGrade[grade] || {}).credited || 0
    var avail = own + carry
    var have  = Math.min(avail, need)
    var met   = avail >= need

    carry = Math.max(0, avail - need)
    required += need
    credited += have
    if (met) filled++

    tiers.push({ grade: grade, need: need, own: own, have: have, met: met, short: Math.max(0, need - avail) })
  }

  // **Built from the bottom, stopping at the first gap.** A pyramid with a hole
  // in it is not partly built; it is built up to the hole, which is true of real
  // pyramids and turns out to be what makes this discriminate. Counting total
  // material instead let full easy tiers carry an empty top: a log whose hardest
  // send was V4 read 57% ready for V6, because the V4 tier was full while V5 and
  // V6 were untouched. Bottom-up it reads 33%, which is the honest number.
  var solid = 0
  for (var j = tiers.length - 1; j >= 0; j--) {
    if (!tiers[j].met) break
    solid++
  }

  var pct     = tiers.length > 0 ? solid / tiers.length : 0
  var fillPct = required > 0 ? credited / required : 0
  // 0 → 1, complete → 5. No thresholds to tune: the scale is the completeness.
  var score = Math.max(1, Math.min(5, Math.round(1 + pct * 4)))

  // The tier most worth filling: biggest shortfall, and on a tie the lower grade,
  // because that is the one holding the rest up.
  var nextUp = null
  tiers.forEach(function (t) {
    if (t.short <= 0) return
    if (nextUp === null || t.short >= nextUp.short) nextUp = { grade: t.grade, short: t.short }
  })

  var targetTier = pyr.byGrade[order[ti]] || {}

  return {
    target: order[ti],
    tiers: tiers,
    required: required,
    credited: credited,
    pct: Math.round(pct * 1000) / 1000,
    fillPct: Math.round(fillPct * 1000) / 1000,
    solidTiers: solid,
    filledTiers: filled,
    depth: tiers.length,
    truncated: truncated,
    topTierMet: tiers.length > 0 ? tiers[0].met : false,
    complete: tiers.length > 0 && solid === tiers.length,
    sentTarget: (targetTier.sends || 0) > 0,
    score: score,
    label: READINESS_LABEL[score],
    nextUp: nextUp,
  }
}

/**
 * The hardest grade you have actually done a lot of — the grade you *own*, as
 * opposed to `project` (touched once) or `working` (currently trying).
 *
 * **Not** "the hardest grade whose pyramid is complete", which is what this was
 * until 2026-09-12 and which conflated two different questions. Readiness asks
 * *can I get to this grade*, and a single send sitting on a broad base answers
 * yes — so on a well-logged V4/V5 season, one V6 send made `baseGrade` report
 * **V6**, because everything under it was full. Owning a grade is the other
 * question: have you done it repeatedly?
 *
 * So it reads the spread directly: the hardest grade whose own credited sends
 * meet the widest requirement in the shape. On the same log that answers V4 —
 * twenty-four V4 sends against four V5s and one V6 — which is what a coach would
 * say looking at it.
 *
 * @param {ReturnType<typeof buildPyramid>} pyramid
 * @param {number[]} [shape]
 * @returns {{grade: string, idx: number}|null}
 */
function baseGrade(pyramid, shape) {
  if (!pyramid || !pyramid.tiers || !pyramid.tiers.length) return null
  var s = shape || PYRAMID_SHAPE
  var widest = Math.max.apply(null, s)
  // Tiers are hardest first, so the first qualifying one is the hardest owned.
  for (var i = 0; i < pyramid.tiers.length; i++) {
    if (pyramid.tiers[i].credited >= widest) {
      return { grade: pyramid.tiers[i].grade, idx: pyramid.tiers[i].idx }
    }
  }
  return null
}

/**
 * Everything a grade goal needs, in one call — the pyramid, its readings, and
 * readiness against the goal's target.
 *
 * @param {{
 *   goalType: string, targetGrade: string, sessions: object[],
 *   todayIso?: string, windowDays?: number, capPerSession?: number,
 * }} opts
 * @returns {{pyramid: object, readiness: object, base: object|null}|null}
 */
function pyramidForGoal(opts) {
  var o = opts || {}
  var shape = pyramidShapeFor(o.goalType)
  if (!shape) return null

  var pyramid = buildPyramid({
    sessions: o.sessions, disciplines: shape.disciplines, system: shape.system,
    todayIso: o.todayIso, windowDays: o.windowDays, capPerSession: o.capPerSession,
  })

  return {
    pyramid:   pyramid,
    readiness: pyramidReadiness({ pyramid: pyramid, targetGrade: o.targetGrade }),
    base:      baseGrade(pyramid),
  }
}

export {
  buildPyramid, pyramidReadiness, baseGrade, pyramidForGoal, pyramidShapeFor,
  PYRAMID_SHAPE, PYRAMID_MAX_DEPTH, PYRAMID_WINDOW_DAYS, MAX_SENDS_PER_SESSION,
  WORKING_MIN_ATTEMPTS, READINESS_LABEL,
}
