/**
 * BetaLog — Is this pace possible?
 *
 * ## Why this exists *(BTL-B3, 2026-09-12)*
 *
 * `CardioLogSheet` opens every new log at **30 minutes** and resets to 30 each
 * time the sheet is opened. A duration nobody corrects is still a duration the
 * app believes: in Ben's export, **24 of 36 walks are logged at exactly 30
 * minutes** regardless of distance, which puts one of them at 10.6 mph.
 *
 * That is not a cosmetic problem. Calorie burn is MET × weight × time, and for
 * anything with a distance the MET itself comes from the pace — `getPaceMET`
 * divides metres by minutes — so a wrong duration corrupts the pace, the MET
 * *and* the time, and `CardioStatsCard` inherits all of it.
 *
 * **The fix is not to guess the real duration.** Nobody knows how long that walk
 * took, and inventing one would be the same class of mistake as reading a career
 * high as today's form. What the app can say is that the number it was given is
 * not possible — a 5 km walk in 30 minutes is a 10 km/h walk, which is running —
 * and ask the person who was there.
 *
 * So this module answers one question, purely: **does the implied speed exceed
 * what is physically plausible for this activity?** The caller decides what to
 * do about it. Nothing here blocks a save: the log is the athlete's, and a
 * refusal to record a session is worse than a suspect one that is flagged.
 *
 * ## Where the ceilings come from
 *
 * Each is set above the top band of the `PACE_MET` tables in `stats.js` — the
 * fastest pace the calorie model has a number for — and below or around a
 * well-known elite mark, so the check fires on data-entry mistakes and not on a
 * good session. They are **deliberately generous**: a false positive nags
 * somebody who did something impressive, which is worse than missing a mistake.
 */

/**
 * Fastest plausible sustained speed per activity, in metres per minute.
 *
 * - `walk` 145 m/min ≈ 8.7 km/h ≈ 5.4 mph — race-walkers reach this; ordinary
 *   walking does not, and `PACE_MET.walk` tops out at 108 (4.0 mph).
 * - `run` 350 m/min ≈ 21 km/h ≈ 13.0 mph — a shade under 100m world-record pace,
 *   so nothing sustainable can reach it.
 * - `cycle` 750 m/min ≈ 45 km/h ≈ 28 mph — professional road-race pace.
 * - `row` 400 m/min — above world-record 2k pace (~340).
 * - `swim` 110 m/min ≈ 1.8 m/s — just under 100m freestyle world-record pace.
 */
var IMPLAUSIBLE_ABOVE = {
  walk:  145,
  run:   350,
  cycle: 750,
  row:   400,
  swim:  110,
}

/** Activities with no meaningful distance, so no pace to check. */
function hasCeiling(activity) {
  return Object.prototype.hasOwnProperty.call(IMPLAUSIBLE_ABOVE, activity)
}

/**
 * Speed implied by a distance and a duration, in metres per minute.
 *
 * @param {number|null} metres
 * @param {number|null} durationMins
 * @returns {number|null} null when either input is missing or non-positive —
 *   an unanswerable question, not a fast one.
 */
export function impliedSpeed(metres, durationMins) {
  if (!metres || !durationMins) return null
  if (metres <= 0 || durationMins <= 0) return null
  return metres / durationMins
}

/**
 * Check whether a logged session implies a speed nothing can sustain.
 *
 * @param {{activity: string, metres: number|null, durationMins: number|null}} opts
 * @returns {{mPerMin: number, kmh: number, mph: number, limitKmh: number}|null}
 *   null when the pace is plausible, unknown, or the activity has no ceiling.
 */
export function checkPace(opts) {
  var o = opts || {}
  if (!hasCeiling(o.activity)) return null

  var mPerMin = impliedSpeed(o.metres, o.durationMins)
  if (mPerMin === null) return null

  var limit = IMPLAUSIBLE_ABOVE[o.activity]
  if (mPerMin <= limit) return null

  return {
    mPerMin:  Math.round(mPerMin * 10) / 10,
    kmh:      Math.round(mPerMin * 0.06 * 10) / 10,
    mph:      Math.round(mPerMin * 0.0372823 * 10) / 10,
    limitKmh: Math.round(limit * 0.06 * 10) / 10,
  }
}

/**
 * The warning, in words. Describes the arithmetic and asks a question; it never
 * tells the athlete what they did — the app does not know which of the two
 * numbers is wrong, only that together they are impossible.
 *
 * @param {ReturnType<typeof checkPace>} check
 * @param {string} activity
 * @returns {string|null}
 */
export function describePace(check, activity) {
  if (!check) return null
  var verb = activity === 'swim' ? 'swim' : activity === 'cycle' ? 'ride' : activity
  return 'That is ' + check.kmh + ' km/h (' + check.mph + ' mph) — faster than a '
    + verb + ' goes. Check the duration and distance.'
}

export { IMPLAUSIBLE_ABOVE }
