/**
 * BetaLog — When is the base likely to be built?
 *
 * Phase 3 of `docs/specs/betalog_grade_pyramid_spec.md` (§7). The readiness
 * figure says how much of the base exists; this says **when the rest of it
 * plausibly will**, at the rate this athlete has actually been climbing.
 *
 * ## What this deliberately does not produce
 *
 * **A percentage chance.** Ben asked for one and §7.1 is the argument against:
 * readiness `pct` is a measurement of what exists, a chance of success is a
 * prediction, and converting one into the other needs an outcome dataset —
 * thousands of climbers with known pyramids and known results — that does not
 * exist and cannot be derived from one person's log. A number presented as a
 * probability here would be invented, which is the thing the whole spec refuses
 * to do.
 *
 * So the output is a **date and a margin**, both of which are arithmetic on the
 * log and can be checked by hand:
 *
 * ```
 * shortfall   credited sends still missing from the base
 * fill rate   credited sends per month at those grades, since the first climb in the window
 * conversion  how long this athlete has taken to move up a grade before now
 *
 * ready ≈ today + shortfall / fill rate + conversion
 * ```
 *
 * ## Every input is already measured
 *
 * Nothing new is estimated. Shortfall comes from `pyramidReadiness`, the fill
 * rate is counted off the same pyramid with the same per-session cap — so the
 * sends that *fill* the base are counted exactly like the sends that *are* the
 * base — and conversion time is `paceReference`, which reads real grade changes
 * out of the log and falls back to a stated convention when there are none.
 * `basis.pace` says which of the two it used, because a default must never be
 * shown as though it were measured.
 *
 * ## Where it refuses to answer
 *
 * A rate of zero is the important one. Someone who has logged nothing at the
 * relevant grades has no rate, and `shortfall ÷ 0` is not a far-off date — it is
 * an unanswerable question. The result says so (`reason`) instead of producing
 * an enormous number that looks like knowledge.
 */

import { paceReference, gradeTimeline } from './gradeGoalScore'

/** Days in an average month, for turning a rate into a readable one. */
var DAYS_PER_MONTH = 30.44

/** How far ahead a projection is worth stating. Beyond this it is noise. */
var MAX_PROJECTION_DAYS = 365 * 3

function shiftDate(iso, days) {
  var d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function daysBetween(fromIso, toIso) {
  var a = new Date(fromIso + 'T12:00:00')
  var b = new Date(toIso + 'T12:00:00')
  return Math.round((b - a) / 86400000)
}

/**
 * The base beneath the target — every tier except the target's own.
 *
 * `pyramidReadiness` puts the target first and scores the rest, so the same
 * slice is taken here. Counting the target tier would mean the goal's own
 * unclimbed row inflated both the shortfall and the rate.
 */
function baseTiers(readiness) {
  var t = (readiness && readiness.tiers) || []
  return t.slice(1)
}

/**
 * How many credited sends the base is still missing.
 *
 * Per tier this is `need - available`, where available already includes surplus
 * spilling down from harder grades — so climbing above a tier reduces its
 * shortfall, exactly as it fills it.
 *
 * @param {object} readiness - from `pyramidReadiness`
 * @returns {number}
 */
export function baseShortfall(readiness) {
  return baseTiers(readiness).reduce(function (n, t) { return n + (t.short || 0) }, 0)
}

/**
 * The shortest span a rate is ever measured over. One good evening last week is
 * not a monthly pace, and dividing it by seven days would say it was.
 */
var MIN_RATE_DAYS = 28

/**
 * Credited sends per month at the grades that make up the base.
 *
 * Counted off the pyramid rather than the raw log, so the window applies here
 * exactly as it does to the base itself. Anything else would let the rate be
 * earned by sends the base would not have credited.
 *
 * ## Over the days actually climbed, not the whole window
 *
 * Ben, 2026-09-13, on a 6c goal built from four sessions: *"it still doesn't
 * feel right somehow."* The rate divided those sends by all 180 days of the
 * window, including the months before the first of them, so a climber who had
 * only recently started logging read as climbing a fraction as often as they
 * do. The span now runs from the first climb in the window to today — never
 * under `MIN_RATE_DAYS`, never over the window. Without a `firstDate` it falls
 * back to the whole window.
 *
 * @param {{readiness: object, windowDays: number, firstDate?: string|null, todayIso?: string}} opts
 * @returns {{credited: number, perMonth: number, perDay: number, windowDays: number, spanDays: number}}
 */
export function fillRate(opts) {
  var o        = opts || {}
  var win      = o.windowDays || 0
  var credited = baseTiers(o.readiness).reduce(function (n, t) { return n + (t.own || 0) }, 0)
  if (!win) return { credited: credited, perMonth: 0, perDay: 0, windowDays: 0, spanDays: 0 }

  var span = win
  if (o.firstDate) {
    var today = o.todayIso || new Date().toISOString().slice(0, 10)
    span = Math.min(win, Math.max(MIN_RATE_DAYS, daysBetween(o.firstDate, today)))
  }
  return {
    credited:   credited,
    perMonth:   Math.round((credited / span) * DAYS_PER_MONTH * 100) / 100,
    perDay:     credited / span,
    windowDays: win,
    spanDays:   span,
  }
}

/**
 * When the base is likely to be complete, and how that sits against a deadline.
 *
 * @param {{
 *   pyramid: object, readiness: object, sessions?: object[],
 *   system: 'v'|'french', targetGrade: string, disciplines?: string[],
 *   timeline?: object, todayIso?: string, deadlineIso?: string|null,
 * }} opts
 * @returns {{
 *   shortfall: number, rate: object, conversionDays: number, sentTarget: boolean,
 *   fillDays: number|null, readyIso: string|null, daysToReady: number|null,
 *   marginDays: number|null, marginWeeks: number|null, onTrack: boolean|null,
 *   basis: {pace: 'log'|'default'|'sent', jumps: number, window: number},
 *   reason: string|null,
 * }|null}
 */
export function forecastReady(opts) {
  var o = opts || {}
  if (!o.readiness) return null

  var today     = o.todayIso || new Date().toISOString().slice(0, 10)
  var shortfall = baseShortfall(o.readiness)
  var pyr       = o.pyramid || {}
  var rate      = fillRate({
    readiness: o.readiness, windowDays: pyr.windowDays, firstDate: pyr.firstDate, todayIso: today,
  })

  // Moving up to a grade you have already sent takes no time at all. Until
  // 2026-09-13 the conversion step was charged regardless, so a complete base
  // with the target sent last week still projected seven weeks out and scored
  // 2/5 against a three-week deadline. `sentTarget` is the pyramid's own fact
  // about the target tier; when it is true the only thing left is the base.
  var sent = !!o.readiness.sentTarget
  var pace = sent
    ? { daysPerStep: 0, source: 'sent', jumps: 0 }
    : paceReference({
        timeline:    o.timeline,
        system:      o.system,
        targetGrade: o.targetGrade,
      })
  var conversionDays = pace.daysPerStep

  var out = {
    target:         o.targetGrade || null,
    shortfall:      shortfall,
    rate:           rate,
    conversionDays: conversionDays,
    sentTarget:     sent,
    fillDays:       null,
    readyIso:       null,
    daysToReady:    null,
    marginDays:     null,
    marginWeeks:    null,
    onTrack:        null,
    basis:          { pace: pace.source, jumps: pace.jumps, window: rate.windowDays },
    reason:         null,
  }

  // Nothing to build: the base is already there, so only the climb itself is
  // left and conversion time is the whole projection.
  if (shortfall === 0) {
    out.fillDays = 0
  } else if (rate.perDay > 0) {
    out.fillDays = Math.round(shortfall / rate.perDay)
  } else {
    // No rate, so no date. Not "a long way off" — unanswerable.
    out.reason = 'nothing logged at those grades in the last ' + rate.windowDays + ' days'
    return out
  }

  var total = out.fillDays + conversionDays
  if (total > MAX_PROJECTION_DAYS) {
    out.reason = 'further off than this is worth projecting'
    return out
  }

  out.daysToReady = total
  out.readyIso    = shiftDate(today, total)

  if (o.deadlineIso) {
    out.marginDays  = daysBetween(out.readyIso, o.deadlineIso)
    out.marginWeeks = Math.round(out.marginDays / 7)
    out.onTrack     = out.marginDays >= 0
  }

  return out
}

var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

/**
 * A month, loosely — "mid-March". The projection is not precise to the day and
 * saying so in the words is cheaper than a caveat underneath it.
 *
 * @param {string} iso
 * @returns {string}
 */
export function looseDate(iso) {
  var d     = new Date(iso + 'T12:00:00')
  var day   = d.getDate()
  var part  = day <= 10 ? 'early ' : day <= 20 ? 'mid-' : 'late '
  return part + MONTHS[d.getMonth()] + (part === 'mid-' ? '' : '')
}

/** A span of days, loosely, in weeks. */
function looseWeeks(days) {
  var w = Math.round(days / 7)
  if (w < 1) return 'under a week'
  return 'about ' + w + ' week' + (w === 1 ? '' : 's')
}

/**
 * The forecast in a sentence. Describes the log and the arithmetic; never the
 * climber, and never a chance of success (§7.1, data-honesty spec §3.4).
 *
 * **It names the target, not the base.** Until 2026-09-13 this read *"Base built
 * around …"*, but the date has always been the base **plus** the time to move up
 * a grade — on Ben's 6c goal that put the base two months later than the
 * arithmetic did. `describeForecastSteps` shows the two parts separately.
 *
 * @param {ReturnType<typeof forecastReady>} f
 * @returns {string|null}
 */
export function describeForecast(f) {
  if (!f) return null
  if (f.reason) return 'No projection — ' + f.reason + '.'
  if (!f.readyIso) return null

  var s = 'Ready for ' + (f.target || 'the goal') + ' around ' + looseDate(f.readyIso) + ' at your current rate.'

  if (f.marginWeeks !== null) {
    var w = Math.abs(f.marginWeeks)
    if (f.onTrack) {
      s += w === 0
        ? ' That is right on your deadline.'
        : ' That is ' + w + ' week' + (w === 1 ? '' : 's') + ' inside your deadline.'
    } else {
      s += ' That is ' + w + ' week' + (w === 1 ? '' : 's') + ' past your deadline.'
    }
  }
  return s
}

/**
 * The two parts of the date, so each can be judged on its own: how long the
 * base takes to fill at the measured rate, then how long moving up a grade
 * takes. The second is where a convention can hide, so it says where it came
 * from — a default must never read as though it were measured.
 *
 * @param {ReturnType<typeof forecastReady>} f
 * @returns {string|null}
 */
export function describeForecastSteps(f) {
  if (!f || f.reason || !f.readyIso) return null
  var fill = f.fillDays === 0 ? 'Base already full' : 'Base full in ' + looseWeeks(f.fillDays)
  // Nothing to convert: the grade is sent, only the base is in question.
  if (f.sentTarget) return fill + ', and ' + (f.target || 'the grade') + ' is already sent.'
  var pace = f.basis.pace === 'log'
    ? 'your own pace, from ' + f.basis.jumps + ' grade change' + (f.basis.jumps === 1 ? '' : 's')
    : 'a typical time — your log has no grade change to measure yet'
  return fill + ', then ' + looseWeeks(f.conversionDays) + ' to move up a grade (' + pace + ').'
}

/**
 * How the rate was measured, for the line under the forecast. A figure without
 * its sample invites over-reading (data-honesty spec §3.2).
 *
 * @param {ReturnType<typeof forecastReady>} f
 * @returns {string|null}
 */
export function describeForecastBasis(f) {
  if (!f || !f.rate) return null
  var r = f.rate
  var s = r.perMonth + ' send' + (r.perMonth === 1 ? '' : 's') + ' a month at those grades'
  s += ' (' + r.credited + ' in ' + r.spanDays + ' days)'
  if (f.shortfall > 0) s += ', ' + f.shortfall + ' still to go'
  return s
}

/**
 * The plan, as opposed to the measurement: one climbing session a week.
 *
 * Ben asked whether the rate should default to a weekly minimum when the log is
 * thinner than that. **Not as a default** — on his own log that assumed 7.3× the
 * rate he was actually climbing at, and flipped a 6c goal from *past your
 * deadline* to *comfortably inside it* on nothing he had done. A floor on a
 * measurement is fiction wearing the measurement's clothes.
 *
 * As a **second line** it is genuinely useful, because it is a lever rather than
 * a verdict: *at your rate, March; climbing weekly, October.* Both true, and the
 * difference between them is the thing he can act on.
 *
 * `SENDS_PER_PLANNED_SESSION` is deliberately conservative: one session a week
 * contributing 2 credited sends to the base. It is not a claim about how much
 * anyone climbs in an evening, it is the smallest assumption that still answers
 * "what if I went regularly".
 */
var PLAN_SESSIONS_PER_WEEK = 1
var SENDS_PER_PLANNED_SESSION = 2

/** Credited base sends per day, if the plan were followed. */
export function plannedRatePerDay() {
  return (PLAN_SESSIONS_PER_WEEK * SENDS_PER_PLANNED_SESSION) / 7
}

/**
 * The same projection, run at the planned rate instead of the measured one.
 *
 * Returns null when the measurement is already at least as fast as the plan —
 * there is nothing to offer someone already climbing more than weekly, and a
 * "what if you climbed less" line helps nobody.
 *
 * @param {{readiness: object, conversionDays: number, measuredPerDay: number,
 *          todayIso?: string, deadlineIso?: string|null}} opts
 * @returns {{readyIso: string, daysToReady: number, marginDays: number|null,
 *            marginWeeks: number|null, onTrack: boolean|null}|null}
 */
export function forecastAtPlannedRate(opts) {
  var o         = opts || {}
  var perDay    = plannedRatePerDay()
  if (!o.readiness) return null
  if (o.measuredPerDay >= perDay) return null

  var today     = o.todayIso || new Date().toISOString().slice(0, 10)
  var shortfall = baseShortfall(o.readiness)
  var total     = Math.round(shortfall / perDay) + (o.conversionDays || 0)
  if (total > MAX_PROJECTION_DAYS) return null

  var readyIso = shiftDate(today, total)
  var out = {
    readyIso: readyIso, daysToReady: total,
    marginDays: null, marginWeeks: null, onTrack: null,
  }
  if (o.deadlineIso) {
    out.marginDays  = daysBetween(readyIso, o.deadlineIso)
    out.marginWeeks = Math.round(out.marginDays / 7)
    out.onTrack     = out.marginDays >= 0
  }
  return out
}

/**
 * The what-if in a sentence. Says plainly that it is a plan, not a reading.
 *
 * @param {ReturnType<typeof forecastAtPlannedRate>} p
 * @returns {string|null}
 */
export function describePlan(p) {
  if (!p || !p.readyIso) return null
  var s = 'Climbing weekly: ' + looseDate(p.readyIso)
  if (p.marginWeeks !== null) {
    var w = Math.abs(p.marginWeeks)
    s += p.onTrack
      ? (w === 0 ? ', right on your deadline' : ', ' + w + ' week' + (w === 1 ? '' : 's') + ' inside it')
      : ', still ' + w + ' week' + (w === 1 ? '' : 's') + ' past it'
  }
  return s + '.'
}

/**
 * How far over the available time a projection may run before it costs a mark.
 *
 * `ratio` is projected days ÷ days until the deadline. 1.0 is landing exactly on
 * it. Needing half again as long is a real miss; needing two and a half times as
 * long is a different kind of goal entirely.
 */
var MARGIN_DOCK = [
  { over: 2.5, dock: 3 },
  { over: 1.5, dock: 2 },
  { over: 1.0, dock: 1 },
]

/**
 * The goal's mark out of 5: how built the base is, docked by whether the date is
 * reachable at the measured rate.
 *
 * ## Why this is not `readiness.score`
 *
 * Ben, 2026-09-13: *"obviously overall achievability in a week should be less
 * than if I gave myself a month. Does this change or not?"* It did not, and that
 * was an inconsistency rather than a design: the **weight** goal's dots already
 * include a `schedule` signal, so the same five-dot control meant *will you make
 * it?* on one card and *how built is your base?* on the other. Nobody chose that;
 * the two were built months apart.
 *
 * So the dots now answer the same question on both. **`readiness.label` does not
 * change** — "Base forming" is a statement about the climbing, and moving a date
 * must not rewrite it.
 *
 * This is not the percentage §7.1 refuses. It is not a chance of success: it is
 * the base's completeness, reduced by a ratio of two dates, and both halves are
 * arithmetic on the log. No dock is applied when there is no deadline, or when
 * the rate is too thin to project from — an unanswerable question must not read
 * as a bad answer.
 *
 * @param {{readiness: object, forecast: object|null}} opts
 * @returns {{score: 1|2|3|4|5, docked: number, reason: string|null}}
 */
export function goalScore(opts) {
  var o    = opts || {}
  var base = (o.readiness && o.readiness.score) || 1
  var f    = o.forecast

  if (!f || f.reason || f.daysToReady === null || f.marginDays === null) {
    return { score: base, docked: 0, reason: null }
  }
  if (f.onTrack) return { score: base, docked: 0, reason: null }

  // days from today to the deadline. `marginDays` is deadline minus ready, and
  // ready is today plus daysToReady, so the two add rather than subtract — it
  // is negative when the projection overshoots, which is exactly this branch.
  var available = f.daysToReady + f.marginDays
  if (available <= 0) {
    return { score: 1, docked: base - 1, reason: 'the deadline has passed' }
  }

  var ratio = f.daysToReady / available
  var dock  = 0
  for (var i = 0; i < MARGIN_DOCK.length; i++) {
    if (ratio > MARGIN_DOCK[i].over) { dock = MARGIN_DOCK[i].dock; break }
  }
  var score = Math.max(1, base - dock)
  return {
    score:  score,
    docked: base - score,
    reason: dock ? 'at this rate the base lands past the deadline' : null,
  }
}

/**
 * Everything the deadline adds to one grade goal, in one call: the forecast, its
 * sentences, the weekly what-if, and the mark out of 5.
 *
 * **Every screen that shows a grade goal's dots goes through this.** Ben,
 * 2026-09-13: the goal sheet showed one mark and the goal card and Dashboard
 * another. The sheet drew the raw readiness score; the cards drew `goalScore`,
 * which docks it for the deadline. Two readings of one goal, assembled by hand
 * in three places. One function means one answer.
 *
 * @param {{
 *   pyramid: object, readiness: object, sessions: object[],
 *   system: 'v'|'french', disciplines: string[], targetGrade: string,
 *   deadlineIso?: string|null, todayIso?: string,
 * }} opts
 * @returns {{
 *   forecast: object|null, forecastLine: string|null, stepsLine: string|null,
 *   basisLine: string|null, planLine: string|null,
 *   mark: {score: number, docked: number, reason: string|null}|null,
 * }}
 */
export function readGradeGoal(opts) {
  var o = opts || {}
  if (!o.readiness) {
    return { forecast: null, forecastLine: null, stepsLine: null, basisLine: null, planLine: null, mark: null }
  }

  var today    = o.todayIso || new Date().toISOString().slice(0, 10)
  var deadline = o.deadlineIso || null
  var forecast = forecastReady({
    pyramid:     o.pyramid,
    readiness:   o.readiness,
    system:      o.system,
    targetGrade: o.targetGrade,
    todayIso:    today,
    deadlineIso: deadline,
    timeline:    gradeTimeline(o.sessions, o.disciplines, o.system, today),
  })

  // The lever beside the verdict: what a weekly habit would buy. Only offered
  // when it is actually faster than what the log already shows.
  var plan = forecastAtPlannedRate({
    readiness:      o.readiness,
    conversionDays: forecast ? forecast.conversionDays : 0,
    measuredPerDay: forecast && forecast.rate ? forecast.rate.perDay : 0,
    todayIso:       today,
    deadlineIso:    deadline,
  })

  return {
    forecast:     forecast,
    forecastLine: describeForecast(forecast),
    stepsLine:    describeForecastSteps(forecast),
    basisLine:    forecast && !forecast.reason ? describeForecastBasis(forecast) : null,
    planLine:     describePlan(plan),
    mark:         goalScore({ readiness: o.readiness, forecast: forecast }),
  }
}

export {
  DAYS_PER_MONTH, MAX_PROJECTION_DAYS, MIN_RATE_DAYS, PLAN_SESSIONS_PER_WEEK,
  SENDS_PER_PLANNED_SESSION, MARGIN_DOCK,
}
