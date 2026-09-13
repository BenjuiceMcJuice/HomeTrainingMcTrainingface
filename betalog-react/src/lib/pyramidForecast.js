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
 * fill rate   credited sends per month at those grades, over the window
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

import { paceReference } from './gradeGoalScore'

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
 * Credited sends per month at the grades that make up the base.
 *
 * Counted off the pyramid rather than the raw log, so the per-session cap and
 * the window apply here exactly as they do to the base itself. Anything else
 * would let the rate be earned by sends the base would not have credited.
 *
 * @param {{readiness: object, windowDays: number}} opts
 * @returns {{credited: number, perMonth: number, perDay: number, windowDays: number}}
 */
export function fillRate(opts) {
  var o       = opts || {}
  var days    = o.windowDays || 0
  var credited = baseTiers(o.readiness).reduce(function (n, t) { return n + (t.own || 0) }, 0)
  if (!days) return { credited: credited, perMonth: 0, perDay: 0, windowDays: 0 }
  return {
    credited:   credited,
    perMonth:   Math.round((credited / days) * DAYS_PER_MONTH * 100) / 100,
    perDay:     credited / days,
    windowDays: days,
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
 *   shortfall: number, rate: object, conversionDays: number,
 *   fillDays: number|null, readyIso: string|null, daysToReady: number|null,
 *   marginDays: number|null, marginWeeks: number|null, onTrack: boolean|null,
 *   basis: {pace: 'log'|'default', jumps: number, window: number},
 *   reason: string|null,
 * }|null}
 */
export function forecastReady(opts) {
  var o = opts || {}
  if (!o.readiness) return null

  var today     = o.todayIso || new Date().toISOString().slice(0, 10)
  var shortfall = baseShortfall(o.readiness)
  var rate      = fillRate({ readiness: o.readiness, windowDays: (o.pyramid || {}).windowDays })

  var pace = paceReference({
    timeline:    o.timeline,
    system:      o.system,
    targetGrade: o.targetGrade,
  })
  var conversionDays = pace.daysPerStep

  var out = {
    shortfall:      shortfall,
    rate:           rate,
    conversionDays: conversionDays,
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

/**
 * The forecast in a sentence. Describes the log and the arithmetic; never the
 * climber, and never a chance of success (§7.1, data-honesty spec §3.4).
 *
 * @param {ReturnType<typeof forecastReady>} f
 * @returns {string|null}
 */
export function describeForecast(f) {
  if (!f) return null
  if (f.reason) return 'No projection — ' + f.reason + '.'
  if (!f.readyIso) return null

  var s = 'Base built around ' + looseDate(f.readyIso) + ' at your current rate'
  if (f.basis.pace === 'default') s += ', using a typical time per grade'
  s += '.'

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
  s += ' (' + r.credited + ' in ' + r.windowDays + ' days)'
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

export {
  DAYS_PER_MONTH, MAX_PROJECTION_DAYS, PLAN_SESSIONS_PER_WEEK,
  SENDS_PER_PLANNED_SESSION, MARGIN_DOCK,
}
