/**
 * BetaLog — bar chart geometry.
 *
 * Pure. No React imports, so the arithmetic behind a bar chart can be tested
 * directly rather than through a rendered component.
 *
 * Extracted from `AlcoholFreeCard`'s timeline (widget system spec, phase C) so
 * the cardio and gym charts in phase D reuse it instead of the codebase
 * growing a third hand-rolled bar renderer. `components/dashboard/BarTimeline`
 * draws what this works out.
 */

/** Chart height in px when there is anything to show, and when there is not. */
var CHART_HEIGHT = 46
var EMPTY_HEIGHT = 14

/** A bar with a value is never thinner than this; an empty one is a 2px stub. */
var MIN_BAR   = 3
var EMPTY_BAR = 2

/**
 * Headroom above the tallest bar. The taller chart leaves room for the peak
 * bar's value label to sit above it; the flat one only needs to clear the
 * guideline.
 */
var HEADROOM       = 1.3
var EMPTY_HEADROOM = 1.15

/**
 * Work out every number needed to draw a bar chart.
 *
 * @param {number[]} values - one per bucket, oldest first
 * @param {{ guideline?: number | null, height?: number, emptyHeight?: number }} [opts]
 * @returns {{
 *   isEmpty: boolean,
 *   chartHeight: number,
 *   scaleMax: number,
 *   maxValue: number,
 *   peakIndex: number,
 *   guideline: number | null,
 *   guidelineY: number | null,
 *   bars: { value: number, height: number, over: boolean }[],
 * }}
 */
function buildBarGeometry(values, opts) {
  var o    = opts || {}
  var vals = (values || []).map(function (v) { return Number(v) || 0 })
  var guideline = o.guideline || null

  var maxValue = 0
  vals.forEach(function (v) { if (v > maxValue) maxValue = v })

  // An all-zero window has nothing to scale — collapse the chart rather than
  // show empty air above a row of stubs.
  var isEmpty     = maxValue === 0
  var chartHeight = isEmpty
    ? (o.emptyHeight === undefined ? EMPTY_HEIGHT : o.emptyHeight)
    : (o.height === undefined ? CHART_HEIGHT : o.height)

  var scaleMax = Math.max(maxValue, guideline || 0, 1) * (isEmpty ? EMPTY_HEADROOM : HEADROOM)

  // The *last* bar at the maximum, so a repeated peak labels the recent one.
  var peakIndex = -1
  if (!isEmpty) {
    vals.forEach(function (v, i) { if (v === maxValue) peakIndex = i })
  }

  var bars = vals.map(function (v) {
    return {
      value:  v,
      height: v > 0 ? Math.max(MIN_BAR, (v / scaleMax) * chartHeight) : EMPTY_BAR,
      over:   !!guideline && v > guideline,
    }
  })

  // The line is only worth drawing when it falls inside the chart, and never
  // on an empty window where it would be the only thing in it.
  var showGuideline = !isEmpty && !!guideline && guideline < scaleMax

  return {
    isEmpty:     isEmpty,
    chartHeight: chartHeight,
    scaleMax:    scaleMax,
    maxValue:    maxValue,
    peakIndex:   peakIndex,
    guideline:   guideline,
    guidelineY:  showGuideline ? (guideline / scaleMax) * chartHeight : null,
    bars:        bars,
  }
}

/**
 * Which bucket indices carry an x-axis label, counting back from the most
 * recent so the newest bucket is always labelled.
 *
 * @param {number} count
 * @param {number} step - label every nth bucket
 * @returns {Object<number, boolean>}
 */
function labelledIndices(count, step) {
  var s   = step > 0 ? step : 1
  var out = {}
  for (var i = count - 1; i >= 0; i -= s) out[i] = true
  return out
}

export { buildBarGeometry, labelledIndices, CHART_HEIGHT, EMPTY_HEIGHT }
