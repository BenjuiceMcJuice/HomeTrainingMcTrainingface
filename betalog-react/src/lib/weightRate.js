/**
 * BetaLog — how fast a weight goal asks you to move, and whether that is sane.
 *
 * Pure. No React imports, so the arithmetic and the limit can be tested
 * directly and used from both the Dashboard card and the goal sheet — the two
 * must agree, or the app blocks a goal it then quietly recommends.
 *
 * ## Where the numbers come from
 *
 * **The absolute ceiling: 1 kg per week.** NHS weight-loss guidance is 0.5–1 kg
 * (1–2 lb) a week, achieved with roughly a 600 kcal daily deficit. Faster than
 * that is not a stricter version of the same plan; it is a different plan, and
 * the NHS is explicit that heavy restriction without medical supervision risks
 * missing nutrients you need.
 *
 * **The proportional ceiling: 1% of bodyweight per week.** A flat kg figure is
 * the wrong shape for a climbing app: 1 kg/week off 55 kg is nearly twice the
 * ask it is off 100 kg. In athletes, Garthe et al. (2011) compared 0.7%/week
 * against 1.4%/week over the same total loss — the slower group *gained* lean
 * mass and improved countermovement jump and bench press, the faster group did
 * not. The usable reading is that ~0.7%/week is the sweet spot for holding on
 * to strength, and past about 1%/week you are paying for the speed in lean
 * tissue. For a sport scored on strength-to-weight, that is the opposite of the
 * point.
 *
 * So a loss goal is blocked above `min(1% of bodyweight, 1 kg)` per week, and
 * flagged above 0.5%/week — sustainable, but no longer the comfortable end.
 *
 * **Gains are flagged, never blocked.** Realistic lean gain is roughly
 * 0.25–0.5% of bodyweight a week, and above that a goal is unrealistic rather
 * than unsafe. Refusing to let someone set it would be this file overreaching:
 * rapid *loss* carries the health risk that justifies a hard stop.
 *
 * Nothing here is medical advice, and none of it knows anything about the
 * person beyond a number on a scale. It exists to stop the app cheerfully
 * drawing a progress bar towards something no one should be aiming at.
 */

/** Days in the average month, for turning a weekly rate into a monthly one. */
var DAYS_PER_MONTH = 365.25 / 12

/** NHS upper bound on a healthy rate of loss, in kg per week. */
var MAX_KG_PER_WEEK = 1

/** Hard stop for loss, as a percentage of bodyweight per week. */
var MAX_LOSS_PCT_PER_WEEK = 1

/**
 * Below this, a loss is comfortably sustainable.
 *
 * 0.7% is a **ceiling, not a target** — the fastest rate shown to cost nothing,
 * not a rate anyone should be aiming to hit. Garthe tested 0.7 against 1.4 and
 * nothing slower, so it says 1.4%/week costs lean mass and 0.7% does not; it
 * says nothing against 0.4%. Slower is fine, and generally at least as good for
 * body composition — it just takes longer. Hence the band boundary sits here
 * rather than lower: below it there is nothing to warn about.
 */
var STEADY_LOSS_PCT_PER_WEEK = 0.7

/** The fastest rate that held on to lean mass in Garthe et al. — quoted in the
 *  copy as the point past which the speed starts costing something. */
var LEAN_LOSS_PCT_PER_WEEK = 0.7

/** Above this, a gain is faster than lean tissue is generally built. */
var MAX_GAIN_PCT_PER_WEEK = 0.5

/**
 * The fastest a loss goal may ask for, in kg per week.
 *
 * Both ceilings apply and the tighter one wins: the proportional one binds
 * below 100 kg, the absolute one above it. With no bodyweight to go on, only
 * the absolute ceiling is available.
 *
 * @param {number|null} bodyKg
 * @returns {number} kg per week
 */
function weeklyLossLimit(bodyKg) {
  var b = Number(bodyKg)
  if (!isFinite(b) || b <= 0) return MAX_KG_PER_WEEK
  return Math.min((MAX_LOSS_PCT_PER_WEEK / 100) * b, MAX_KG_PER_WEEK)
}

/** Whole days from today to an ISO date, or null when there is no usable date. */
function daysUntil(isoDate, todayIso) {
  if (!isoDate) return null
  var end   = new Date(isoDate + 'T00:00:00')
  var start = new Date((todayIso || new Date().toISOString().slice(0, 10)) + 'T00:00:00')
  if (isNaN(end.getTime()) || isNaN(start.getTime())) return null
  return Math.round((end - start) / 86400000)
}

function round1(v) { return Math.round(v * 10) / 10 }
function round2(v) { return Math.round(v * 100) / 100 }

/**
 * What a weight goal is asking for per week, and whether that is acceptable.
 *
 * The verdict is deliberately about *rate*, not destination — it says nothing
 * about whether the target weight itself is sensible for the person.
 *
 * @param {{
 *   currentKg: number|null,
 *   targetKg: number|null,
 *   targetDate?: string|null,
 *   days?: number|null,
 *   todayIso?: string,
 * }} opts
 * @returns {{
 *   ok: boolean,
 *   direction: 'lose'|'gain'|'hold'|null,
 *   remainingKg: number|null,
 *   days: number|null,
 *   kgPerWeek: number|null,
 *   kgPerMonth: number|null,
 *   pctPerWeek: number|null,
 *   limitKgPerWeek: number,
 *   band: 'steady'|'brisk'|'too_fast'|'past'|'unknown',
 *   blocked: boolean,
 * }}
 */
/** Null for anything that is not a real number — `Number(null)` is 0, and a
 *  blank target is not a target of nothing. */
function num(v) {
  if (v === null || v === undefined || v === '') return null
  var n = Number(v)
  return isFinite(n) ? n : null
}

function assessWeightGoalRate(opts) {
  var o       = opts || {}
  var current = num(o.currentKg)
  var target  = num(o.targetKg)
  var limit   = weeklyLossLimit(o.currentKg)

  var days = num(o.days) === null
    ? daysUntil(o.targetDate || null, o.todayIso)
    : num(o.days)

  var blank = {
    ok: true, direction: null, remainingKg: null, days: days,
    kgPerWeek: null, kgPerMonth: null, pctPerWeek: null,
    limitKgPerWeek: round2(limit), band: 'unknown', blocked: false,
  }

  if (current === null || target === null || current <= 0) return blank

  var remaining = Math.abs(target - current)
  var direction = target < current ? 'lose' : target > current ? 'gain' : 'hold'

  if (direction === 'hold') {
    return Object.assign({}, blank, { direction: 'hold', remainingKg: 0, band: 'steady' })
  }
  if (blank.days === null) return Object.assign({}, blank, { direction: direction, remainingKg: round1(remaining) })

  // A date already past cannot carry a rate — the goal is overdue, which the
  // card says in its own words rather than by dividing by zero.
  if (blank.days <= 0) {
    return Object.assign({}, blank, { direction: direction, remainingKg: round1(remaining), band: 'past' })
  }

  // Rounded before the verdict, not after: the band has to be decided on the
  // number the user is shown, or a card reading "0.7% a week" gets flagged for
  // exceeding 0.7% on a floating-point tail nobody can see.
  var kgPerWeek  = round2((remaining / blank.days) * 7)
  var pctPerWeek = round2((kgPerWeek / current) * 100)

  // The limit is rounded to match, for the same reason the rate is: a goal
  // needing 0.9578 kg/wk against a 0.9580 ceiling would be refused with the
  // words "0.96 kg/wk is above the 0.96 kg/wk ceiling".
  var limitR = round2(limit)

  var band
  if (direction === 'lose') {
    band = kgPerWeek > limitR || pctPerWeek > MAX_LOSS_PCT_PER_WEEK ? 'too_fast'
      : pctPerWeek > STEADY_LOSS_PCT_PER_WEEK ? 'brisk'
        : 'steady'
  } else {
    band = pctPerWeek > MAX_GAIN_PCT_PER_WEEK ? 'too_fast'
      : pctPerWeek > MAX_GAIN_PCT_PER_WEEK / 2 ? 'brisk'
        : 'steady'
  }

  return {
    ok:             band !== 'too_fast',
    direction:      direction,
    remainingKg:    round1(remaining),
    days:           blank.days,
    kgPerWeek:      kgPerWeek,
    kgPerMonth:     round1((remaining / blank.days) * DAYS_PER_MONTH),
    pctPerWeek:     pctPerWeek,
    limitKgPerWeek: round2(limit),
    band:           band,
    // Only a loss is refused. A gain that fast is unrealistic, not unsafe, and
    // refusing it would be this file overreaching.
    blocked:        band === 'too_fast' && direction === 'lose',
  }
}

/**
 * The rate as one short phrase — "0.4 kg/wk · 1.7 kg/month". Shared so the card
 * and the goal sheet quote the same figure the same way.
 *
 * @param {ReturnType<typeof assessWeightGoalRate>} a
 * @returns {string|null}
 */
function describeRate(a) {
  if (!a || a.kgPerWeek === null) return null
  return a.kgPerWeek + ' kg/wk · ' + a.kgPerMonth + ' kg/month'
}

/**
 * Why a goal was refused, or what to watch — one sentence, or null when the
 * rate is unremarkable.
 *
 * @param {ReturnType<typeof assessWeightGoalRate>} a
 * @returns {string|null}
 */
function rateWarning(a) {
  if (!a || a.band === 'unknown' || a.band === 'past' || a.band === 'steady') return null
  if (a.direction === 'lose') {
    if (a.band === 'too_fast') {
      return 'That is ' + a.kgPerWeek + ' kg a week (' + a.pctPerWeek + '% of bodyweight). '
        + 'Healthy loss tops out around ' + a.limitKgPerWeek + ' kg a week for you — '
        + 'give it more time, or aim less far.'
    }
    return a.pctPerWeek + '% of bodyweight a week — past the ~'
      + LEAN_LOSS_PCT_PER_WEEK + '% where lean mass and strength hold up best.'
  }
  if (a.band === 'too_fast') {
    return 'That is ' + a.kgPerWeek + ' kg a week. Lean gain past ~'
      + MAX_GAIN_PCT_PER_WEEK + '% of bodyweight a week is mostly fat or water.'
  }
  return a.pctPerWeek + '% of bodyweight a week — brisk for a lean gain.'
}

/**
 * Band → colour, so the card and the goal card agree on what amber means.
 * Colour in a lib file follows `LEVEL_COLOR` and `BMI_CATS` in `stats.js`: the
 * mapping is part of the verdict, not of either screen's layout.
 */
var RATE_COLOR = {
  steady:   '#7a8299',
  brisk:    '#d97706',
  too_fast: '#ef4444',
  past:     '#ef4444',
  unknown:  '#7a8299',
}

export {
  assessWeightGoalRate, weeklyLossLimit, daysUntil, describeRate, rateWarning, RATE_COLOR,
  MAX_KG_PER_WEEK, MAX_LOSS_PCT_PER_WEEK, STEADY_LOSS_PCT_PER_WEEK,
  LEAN_LOSS_PCT_PER_WEEK, MAX_GAIN_PCT_PER_WEEK, DAYS_PER_MONTH,
}
