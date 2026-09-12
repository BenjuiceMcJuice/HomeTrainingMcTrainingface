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

export { DAYS_PER_MONTH, MAX_PROJECTION_DAYS }
