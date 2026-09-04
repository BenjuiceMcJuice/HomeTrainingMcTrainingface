/**
 * BetaLog — how achievable is a weight goal?
 *
 * Pure. No React imports.
 *
 * `weightRate.js` answers *is this rate healthy* — a rule about physiology that
 * is the same for everyone at a given bodyweight. This file answers a different
 * question: *is this athlete, on this evidence, going to do it?* Two goals can
 * ask for the same safe 0.6 kg/week and be worlds apart in achievability, and
 * the difference is in the log, not in the arithmetic.
 *
 * ## Four signals, in order of how much they are worth
 *
 * 1. **Track record** — the fastest loss this athlete has actually sustained
 *    over a month, from their own weigh-ins. A goal asking for double what
 *    someone has ever done is a different proposition from one asking for what
 *    they did last spring. This is the signal nothing else in the app has, and
 *    it is weighted accordingly.
 * 2. **Trend** — which way the line is pointing right now. A goal at 0% with the
 *    weight going *up* is not "behind"; it has not started.
 * 3. **Headroom** — the required rate against the healthy ceiling from
 *    `weightRate.js`. Over the ceiling the goal is not merely hard, it is one
 *    the app refuses to set.
 * 4. **Schedule debt** — progress made against time elapsed. Half the window
 *    gone and a tenth of the weight off means the remaining rate is worse than
 *    the rate the goal was set at.
 *
 * ## The calorie side
 *
 * The daily deficit follows from the rate alone: fat is ~7,700 kcal/kg, so
 * kg/week × 7700 ÷ 7 is kcal/day. **That number needs no assumptions.**
 *
 * What it *means* needs maintenance, and maintenance needs age and sex, which
 * the athlete profile does not hold (`AthleteProfile` in `types.js`: name,
 * heightCm, weightKg, apeIndex, climbingSince, homeGym). So `estimateMaintenance`
 * takes them as optional inputs, defaults to a mid-population age and the
 * midpoint of the two Mifflin-St Jeor sex constants, and returns its
 * `assumptions` so a caller can show them rather than pretend they are not
 * there. Treat the result as ±15% at best, and the deficit *share* as a rough
 * band rather than a number.
 *
 * Two calorie flags matter more than the estimate's precision, because both
 * survive a 15% error:
 * - **Share of maintenance.** A ~20% deficit is the standard moderate cut;
 *   past ~30% is where adherence and lean-mass losses concentrate.
 * - **Intake below RMR.** Eating under your own resting requirement while
 *   training is the point where "hard diet" becomes "not a plan".
 *
 * None of this is medical advice, and it knows nothing about the person beyond
 * numbers they typed into a climbing app.
 */

import { assessWeightGoalRate, weeklyLossLimit } from './weightRate'

/** Energy in a kg of body fat. The 3,500 kcal/lb rule, in metric. */
var KCAL_PER_KG_FAT = 7700

/** Window used to measure a sustained rate from the log, in days. */
var TRACK_RECORD_DAYS = 28

/** Mifflin-St Jeor sex constants; the midpoint is used when sex is unknown. */
var MSJ_MALE   = 5
var MSJ_FEMALE = -161

/** Age assumed when the profile has none. Mid-range for the app's users. */
var ASSUMED_AGE = 35

/** Deficit as a share of maintenance: standard cut, and the point of concern. */
var MODERATE_DEFICIT_PCT = 20
var STEEP_DEFICIT_PCT    = 30

function round0(v) { return Math.round(v) }
function round1(v) { return Math.round(v * 10) / 10 }
function round2(v) { return Math.round(v * 100) / 100 }

function num(v) {
  if (v === null || v === undefined || v === '') return null
  var n = Number(v)
  return isFinite(n) ? n : null
}

/**
 * Daily calorie deficit implied by a rate of loss. No assumptions beyond the
 * energy density of fat.
 *
 * @param {number} kgPerWeek
 * @returns {number|null} kcal per day
 */
function deficitForRate(kgPerWeek) {
  var r = num(kgPerWeek)
  if (r === null) return null
  return round0((Math.abs(r) * KCAL_PER_KG_FAT) / 7)
}

/**
 * Resting and maintenance energy, with every assumption declared.
 *
 * @param {{
 *   weightKg: number, heightCm: number,
 *   ageYears?: number|null, sex?: 'male'|'female'|null,
 *   sessionsPerWeek?: number|null,
 * }} opts
 * @returns {{
 *   rmr: number|null, maintenance: number|null, activityFactor: number,
 *   assumptions: string[],
 * }}
 */
function estimateMaintenance(opts) {
  var o = opts || {}
  var w = num(o.weightKg)
  var h = num(o.heightCm)
  if (w === null || h === null || w <= 0 || h <= 0) {
    return { rmr: null, maintenance: null, activityFactor: 0, assumptions: ['no height or weight'] }
  }

  var assumptions = []
  var age = num(o.ageYears)
  if (age === null) { age = ASSUMED_AGE; assumptions.push('age assumed ' + ASSUMED_AGE) }

  var sexConst
  if (o.sex === 'male')        sexConst = MSJ_MALE
  else if (o.sex === 'female') sexConst = MSJ_FEMALE
  else {
    // Midway between the two constants — wrong for everybody by ~83 kcal, which
    // is honest, where picking one is wrong by 166 for half of them.
    sexConst = (MSJ_MALE + MSJ_FEMALE) / 2
    assumptions.push('sex not recorded — midpoint of the two formulas, ±83 kcal')
  }

  var rmr = 10 * w + 6.25 * h - 5 * age + sexConst

  // Activity from what is actually logged, rather than a dropdown nobody sets
  // honestly: sedentary 1.35, rising with training frequency, capped where the
  // multiplier stops being credible without measurement.
  var spw = num(o.sessionsPerWeek)
  if (spw === null) { spw = 3; assumptions.push('training frequency assumed 3/week') }
  var factor = Math.min(1.75, 1.35 + 0.05 * Math.max(0, spw))

  return {
    rmr:            round0(rmr),
    maintenance:    round0(rmr * factor),
    activityFactor: round2(factor),
    assumptions:    assumptions,
  }
}

/**
 * The fastest loss this athlete has actually sustained over ~4 weeks, in
 * kg/week, from their weigh-ins.
 *
 * Every pair of entries roughly `TRACK_RECORD_DAYS` apart is a candidate, so a
 * good month found anywhere in the log counts. Returns null when the log is too
 * thin to say anything — which is itself worth reporting, and is not the same
 * as "has never lost weight".
 *
 * @param {{date: string, weight: number}[]} entries
 * @param {number} [windowDays]
 * @returns {{ kgPerWeek: number, from: string, to: string }|null}
 */
function demonstratedLossRate(entries, windowDays) {
  var span = windowDays || TRACK_RECORD_DAYS
  var list = (entries || [])
    .filter(function (e) { return e && e.date && num(e.weight) !== null })
    .slice()
    .sort(function (a, b) { return a.date > b.date ? 1 : -1 })
  if (list.length < 2) return null

  var best = null
  for (var i = 0; i < list.length; i++) {
    for (var j = i + 1; j < list.length; j++) {
      var days = Math.round(
        (new Date(list[j].date + 'T00:00:00') - new Date(list[i].date + 'T00:00:00')) / 86400000
      )
      // Any pair a fortnight to six weeks apart stands in for "a month".
      if (days < span * 0.5 || days > span * 1.5) continue
      var rate = ((list[i].weight - list[j].weight) / days) * 7
      if (best === null || rate > best.kgPerWeek) {
        best = { kgPerWeek: round2(rate), from: list[i].date, to: list[j].date }
      }
    }
  }
  return best
}

/**
 * Recent direction of travel, in kg/week, over the last `days` of the log.
 *
 * @param {{date: string, weight: number}[]} entries
 * @param {number} [days]
 * @param {string} [todayIso]
 * @returns {number|null} negative = losing, positive = gaining
 */
function recentTrend(entries, days, todayIso) {
  var span  = days || 30
  var today = todayIso || new Date().toISOString().slice(0, 10)
  var cutoff = new Date(new Date(today + 'T00:00:00') - span * 86400000).toISOString().slice(0, 10)

  var list = (entries || [])
    .filter(function (e) { return e && e.date && e.date >= cutoff && e.date <= today && num(e.weight) !== null })
    .slice()
    .sort(function (a, b) { return a.date > b.date ? 1 : -1 })
  if (list.length < 2) return null

  var first = list[0]
  var last  = list[list.length - 1]
  var d = Math.round((new Date(last.date + 'T00:00:00') - new Date(first.date + 'T00:00:00')) / 86400000)
  if (d <= 0) return null
  return round2(((last.weight - first.weight) / d) * 7)
}

/**
 * Score a weight goal 1–5 for achievability, with the reasons that produced it.
 *
 * Starts at 5 and deducts. Deducting rather than adding keeps the scale
 * meaningful: 5 means "nothing here argues against it", not "we found five good
 * things".
 *
 * @param {{
 *   goal: {target: number|string, startValue?: number|string, targetDate: string, createdAt?: string},
 *   currentKg: number,
 *   heightCm?: number|null,
 *   weightEntries?: {date: string, weight: number}[],
 *   sessionsPerWeek?: number|null,
 *   ageYears?: number|null,
 *   sex?: 'male'|'female'|null,
 *   todayIso?: string,
 * }} opts
 * @returns {{
 *   score: 1|2|3|4|5|null, label: string,
 *   rate: object,
 *   deficitKcalPerDay: number|null,
 *   maintenance: {rmr: number|null, maintenance: number|null, activityFactor: number, assumptions: string[]},
 *   deficitPctOfMaintenance: number|null,
 *   impliedIntake: number|null,
 *   belowRmr: boolean,
 *   demonstrated: {kgPerWeek: number, from: string, to: string}|null,
 *   trendKgPerWeek: number|null,
 *   scheduleDebt: number|null,
 *   reasons: {factor: string, verdict: 'ok'|'warn'|'bad', detail: string, penalty: number}[],
 * }}
 */
function scoreWeightGoal(opts) {
  var o       = opts || {}
  var goal    = o.goal || {}
  var current = num(o.currentKg)
  var target  = num(goal.target)
  var today   = o.todayIso || new Date().toISOString().slice(0, 10)

  var rate = assessWeightGoalRate({
    currentKg: current, targetKg: target, targetDate: goal.targetDate, todayIso: today,
  })

  var blank = {
    score: null, label: 'Not enough to say', rate: rate,
    deficitKcalPerDay: null, maintenance: estimateMaintenance({ weightKg: current, heightCm: o.heightCm }),
    deficitPctOfMaintenance: null, impliedIntake: null, belowRmr: false,
    demonstrated: null, trendKgPerWeek: null, scheduleDebt: null, reasons: [],
  }
  if (rate.kgPerWeek === null || rate.direction !== 'lose') return blank

  var reasons = []
  var penalty = 0
  function add(factor, verdict, detail, p) {
    reasons.push({ factor: factor, verdict: verdict, detail: detail, penalty: p })
    penalty += p
  }

  // --- 1. Headroom against the healthy ceiling ----------------------------
  var limit = weeklyLossLimit(current)
  var headroom = rate.kgPerWeek / limit
  if (headroom > 1.5) {
    add('headroom', 'bad', 'Needs ' + rate.kgPerWeek + ' kg/wk, over half again the ' + round2(limit) + ' kg/wk healthy ceiling', 2)
  } else if (headroom > 1) {
    add('headroom', 'bad', 'Needs ' + rate.kgPerWeek + ' kg/wk, above the ' + round2(limit) + ' kg/wk healthy ceiling', 1.5)
  } else if (headroom > 0.7) {
    add('headroom', 'warn', 'Needs ' + rate.kgPerWeek + ' kg/wk, near the ' + round2(limit) + ' kg/wk ceiling', 0.5)
  } else {
    add('headroom', 'ok', rate.kgPerWeek + ' kg/wk sits inside the healthy range', 0)
  }

  // --- 2. Track record ----------------------------------------------------
  var demo = demonstratedLossRate(o.weightEntries)
  if (demo === null) {
    add('track record', 'warn', 'No four-week stretch in the log to compare against', 0.5)
  } else if (demo.kgPerWeek <= 0) {
    add('track record', 'bad', 'No sustained loss in the log yet — best month is ' + demo.kgPerWeek + ' kg/wk', 1.5)
  } else if (rate.kgPerWeek > demo.kgPerWeek * 2) {
    add('track record', 'bad', 'Asks for more than twice the best month logged (' + demo.kgPerWeek + ' kg/wk)', 1.5)
  } else if (rate.kgPerWeek > demo.kgPerWeek) {
    add('track record', 'warn', 'Faster than the best month logged (' + demo.kgPerWeek + ' kg/wk)', 0.75)
  } else {
    add('track record', 'ok', 'Slower than a month already achieved (' + demo.kgPerWeek + ' kg/wk)', 0)
  }

  // --- 3. Trend -----------------------------------------------------------
  var trend = recentTrend(o.weightEntries, 30, today)
  if (trend === null) {
    add('trend', 'warn', 'Too few recent weigh-ins to read a direction', 0.25)
  } else if (trend > 0.1) {
    add('trend', 'bad', 'Weight is going up (' + trend + ' kg/wk over 30 days), not down', 1)
  } else if (trend > -0.05) {
    add('trend', 'warn', 'Weight is flat over the last 30 days', 0.5)
  } else {
    add('trend', 'ok', 'Already moving the right way (' + trend + ' kg/wk)', 0)
  }

  // --- 4. Schedule debt ---------------------------------------------------
  var debt = null
  var start = num(goal.startValue)
  if (goal.createdAt && start !== null && start !== target) {
    var elapsed = Math.round((new Date(today + 'T00:00:00') - new Date(String(goal.createdAt).slice(0, 10) + 'T00:00:00')) / 86400000)
    var total   = elapsed + rate.days
    if (elapsed > 0 && total > 0) {
      var timeGone = elapsed / total
      var done     = (start - current) / (start - target)
      debt = round2(timeGone - done)
      if (done < 0) {
        // Going backwards is one fact, and the trend factor above has already
        // charged for it. Half penalty here, or the same problem is paid for
        // twice and swamps everything else in the score.
        add('schedule', 'bad', 'Further from the target than when the goal was set — ' + Math.round(timeGone * 100) + '% of the time gone', 0.5)
      } else if (debt > 0.25) {
        add('schedule', 'bad', Math.round(timeGone * 100) + '% of the time gone, ' + Math.round(done * 100) + '% of the weight off', 1)
      } else if (debt > 0.1) {
        add('schedule', 'warn', 'Behind schedule: ' + Math.round(timeGone * 100) + '% of the time for ' + Math.round(done * 100) + '% of the weight', 0.5)
      } else {
        add('schedule', 'ok', 'On or ahead of schedule so far', 0)
      }
    }
  }

  // --- The calorie picture ------------------------------------------------
  var deficit = deficitForRate(rate.kgPerWeek)
  var maint   = estimateMaintenance({
    weightKg: current, heightCm: o.heightCm,
    ageYears: o.ageYears, sex: o.sex, sessionsPerWeek: o.sessionsPerWeek,
  })

  var deficitPct = null, intake = null, belowRmr = false
  if (maint.maintenance && deficit !== null) {
    deficitPct = round1((deficit / maint.maintenance) * 100)
    intake     = round0(maint.maintenance - deficit)
    belowRmr   = maint.rmr !== null && intake < maint.rmr

    if (deficitPct > STEEP_DEFICIT_PCT) {
      add('calories', 'bad', 'About ' + deficit + ' kcal/day below maintenance (~' + deficitPct + '%), leaving ~' + intake + ' kcal/day to eat', 1)
    } else if (deficitPct > MODERATE_DEFICIT_PCT) {
      add('calories', 'warn', 'About ' + deficit + ' kcal/day below maintenance (~' + deficitPct + '%)', 0.5)
    } else {
      add('calories', 'ok', 'About ' + deficit + ' kcal/day below maintenance (~' + deficitPct + '%)', 0)
    }
    if (belowRmr) {
      add('intake floor', 'bad', 'That leaves ~' + intake + ' kcal/day, under an estimated resting need of ~' + maint.rmr, 1)
    }
  }

  var score = Math.max(1, Math.min(5, Math.round(5 - penalty)))
  var LABEL = {
    5: 'Very achievable', 4: 'Achievable', 3: 'A stretch',
    2: 'Unlikely as set', 1: 'Not achievable as set',
  }

  return {
    score: score,
    label: LABEL[score],
    rate: rate,
    deficitKcalPerDay: deficit,
    maintenance: maint,
    deficitPctOfMaintenance: deficitPct,
    impliedIntake: intake,
    belowRmr: belowRmr,
    demonstrated: demo,
    trendKgPerWeek: trend,
    scheduleDebt: debt,
    reasons: reasons,
  }
}

/**
 * What target, or what date, would this goal need to be a 4?
 *
 * The counter-offer is the useful half of a bad score: "not achievable" without
 * an alternative is just a refusal.
 *
 * @param {{currentKg: number, targetKg: number, days: number, pctPerWeek?: number}} opts
 * @returns {{ targetForDate: number|null, daysForTarget: number|null, weeksForTarget: number|null, atPctPerWeek: number }}
 */
function counterOffer(opts) {
  var o    = opts || {}
  var cur  = num(o.currentKg)
  var tgt  = num(o.targetKg)
  var days = num(o.days)
  var pct  = num(o.pctPerWeek) === null ? 0.7 : num(o.pctPerWeek)
  if (cur === null || tgt === null || cur <= 0) {
    return { targetForDate: null, daysForTarget: null, weeksForTarget: null, atPctPerWeek: pct }
  }

  // Compounding, not linear: the weekly kg falls as the athlete does, which is
  // why a naive "0.67 kg × 16 weeks" overshoots by the better part of a kilo.
  var weekly = pct / 100
  var targetForDate = days !== null && days > 0
    ? round1(cur * Math.pow(1 - weekly, days / 7))
    : null

  var weeks = null
  if (tgt > 0 && tgt < cur) {
    weeks = Math.log(tgt / cur) / Math.log(1 - weekly)
  }

  return {
    targetForDate:  targetForDate,
    daysForTarget:  weeks === null ? null : Math.round(weeks * 7),
    weeksForTarget: weeks === null ? null : round1(weeks),
    atPctPerWeek:   pct,
  }
}

export {
  scoreWeightGoal, estimateMaintenance, deficitForRate,
  demonstratedLossRate, recentTrend, counterOffer,
  KCAL_PER_KG_FAT, TRACK_RECORD_DAYS, MODERATE_DEFICIT_PCT, STEEP_DEFICIT_PCT,
}
