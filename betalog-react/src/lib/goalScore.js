/**
 * BetaLog — the shape an achievability score takes, whatever the goal.
 *
 * Pure. No React imports.
 *
 * `weightGoalScore.js` came first and invented this shape; `gradeGoalScore.js`
 * is the second goal type to use it. The parts that are not about weight or
 * about grades — the 1–5 scale, its words, its colours, and the rule for which
 * reasons are worth showing — live here so the two modules cannot drift into
 * disagreeing about what a 3 means or what amber looks like. The goals spec asks
 * for exactly this ("the rating shape is shared, so climbing slots in behind the
 * same components").
 *
 * `weightGoalScore.js` re-exports `topReasons` and `SCORE_COLOR`, so everything
 * that already imported them from there is unaffected.
 *
 * ## Deduct, never add
 *
 * Every scorer starts at 5 and subtracts. That keeps the top of the scale
 * meaning "nothing here argues against it" rather than "we found five good
 * things" — which matters, because a thin log has nothing good to find and would
 * otherwise score the same as a goal with real evidence against it.
 */

/** Score → the word for it. The same five words for every goal type. */
var SCORE_LABEL = {
  5: 'Very achievable',
  4: 'Achievable',
  3: 'A stretch',
  2: 'Unlikely as set',
  1: 'Not achievable as set',
}

/**
 * Score → colour.
 *
 * Lives with the verdict rather than in a component, so the Dashboard card, the
 * goal card and the goal sheet cannot disagree about what amber means — the same
 * reasoning as `RATE_COLOR` in `weightRate.js` and `LEVEL_COLOR` in `stats.js`.
 */
var SCORE_COLOR = {
  5: '#2a9d5c',
  4: '#2a9d5c',
  3: '#d97706',
  2: '#ef4444',
  1: '#ef4444',
}

/**
 * Total penalty → a 1–5 score. Clamped, so no scorer can produce a 0 or a 6 by
 * adding a factor.
 *
 * @param {number} penalty
 * @returns {1|2|3|4|5}
 */
function scoreFromPenalty(penalty) {
  var p = Number(penalty)
  if (!isFinite(p)) p = 0
  return Math.max(1, Math.min(5, Math.round(5 - p)))
}

/**
 * A collector for the `{factor, verdict, detail, penalty}` reasons every scorer
 * builds, so they all record them the same way and none forgets to total up.
 *
 * @returns {{ add: (factor: string, verdict: 'ok'|'warn'|'bad', detail: string, penalty: number) => void,
 *             reasons: object[], total: () => number, score: () => 1|2|3|4|5 }}
 */
function reasonList() {
  var reasons = []
  var penalty = 0
  return {
    reasons: reasons,
    add: function (factor, verdict, detail, p) {
      reasons.push({ factor: factor, verdict: verdict, detail: detail, penalty: p })
      penalty += p
    },
    total: function () { return penalty },
    score: function () { return scoreFromPenalty(penalty) },
  }
}

/**
 * The reasons worth showing, worst first.
 *
 * At most two: all of them is a wall on a phone. Nothing at 4–5 — there the
 * score has nothing to say, and a card should not manufacture concern.
 *
 * `exclude` drops factors the surrounding screen already states. Both the goal
 * card and the goal sheet print a pace sentence directly above this, so
 * repeating that factor there says the same thing twice in two voices and pushes
 * a genuinely new reason off the end of the list.
 *
 * @param {{score: number|null, reasons?: object[]}} s
 * @param {number} [max]
 * @param {string[]} [exclude] - factor names to leave out
 * @returns {string[]}
 */
function topReasons(s, max, exclude) {
  if (!s || s.score === null || s.score > 3) return []
  var skip = exclude || []
  return (s.reasons || [])
    .filter(function (r) { return r.penalty > 0 && skip.indexOf(r.factor) === -1 })
    .slice()
    .sort(function (a, b) { return b.penalty - a.penalty })
    .slice(0, max === undefined ? 2 : max)
    .map(function (r) { return r.detail })
}

export { SCORE_LABEL, SCORE_COLOR, scoreFromPenalty, reasonList, topReasons }
