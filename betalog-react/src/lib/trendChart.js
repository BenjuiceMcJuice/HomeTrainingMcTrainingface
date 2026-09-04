/**
 * BetaLog — trend chart geometry, for a value that is a *level* rather than a
 * total.
 *
 * Pure. No React imports, so the arithmetic behind the chart can be tested
 * directly rather than through a rendered component.
 *
 * `barChart.js` measures everything from zero, which is right for the things it
 * draws — minutes trained, sets, units drunk. Bodyweight is not one of them:
 * 78.4 kg is a reading, not an amount accumulated over the bucket, and drawn
 * from zero every weigh-in in a year renders as the same bar. So this file
 * zooms the axis onto the data instead, and `components/dashboard/TrendTimeline`
 * draws what it works out.
 *
 * Three things keep that zoom honest:
 *
 * 1. **A floor on the span** (`MIN_SPAN`). Half a kilo of daily noise on a full
 *    height chart reads as a crisis. Below the floor the range opens out around
 *    the midpoint and the line goes flat, which is what actually happened.
 * 2. **The bounds snap outward** to a round `SNAP` step, so the axis labels are
 *    readable numbers rather than the exact min and max of the data.
 * 3. **The target only joins the scale when it is near enough** to share it.
 *    A goal 20 kg away would squash a year of weigh-ins into one pixel band;
 *    past that the caller is told (`targetShown: false`) and says it in words.
 */

/** Chart height in px when there is anything to plot, and when there is not. */
var CHART_HEIGHT = 56
var EMPTY_HEIGHT = 14

/** Never zoom tighter than this many units top to bottom. */
var MIN_SPAN = 2

/** Breathing room above and below the data, as a share of its span. */
var PAD_RATIO = 0.15

/** Axis bounds snap outward to a multiple of this. */
var SNAP = 0.5

/** Kill the floating-point tails that `78.1 - 0.15` leaves behind. */
function round2(v) {
  return Math.round(v * 100) / 100
}

/**
 * Work out every number needed to draw a trend line.
 *
 * @param {(number|null)[]} values - one per bucket, oldest first; null = no reading
 * @param {{
 *   target?: number | null,
 *   height?: number,
 *   emptyHeight?: number,
 *   minSpan?: number,
 * }} [opts]
 * @returns {{
 *   isEmpty: boolean,
 *   chartHeight: number,
 *   lo: number | null, hi: number | null, span: number | null, mid: number | null,
 *   min: number | null, max: number | null,
 *   first: number | null, last: number | null, change: number | null,
 *   count: number,
 *   firstIndex: number, lastIndex: number,
 *   points: ({ index: number, value: number, x: number, y: number } | null)[],
 *   target: number | null, targetY: number | null, targetShown: boolean,
 * }}
 */
function buildTrendGeometry(values, opts) {
  var o    = opts || {}
  var vals = (values || []).map(function (v) {
    if (v === null || v === undefined || v === '') return null
    var n = Number(v)
    return isNaN(n) ? null : n
  })

  var height      = o.height      === undefined ? CHART_HEIGHT : o.height
  var emptyHeight = o.emptyHeight === undefined ? EMPTY_HEIGHT : o.emptyHeight
  var minSpan     = o.minSpan     === undefined ? MIN_SPAN     : o.minSpan
  var target      = o.target === null || o.target === undefined ? null : Number(o.target)
  if (target !== null && isNaN(target)) target = null

  var dataMin = null, dataMax = null, count = 0
  var firstIndex = -1, lastIndex = -1
  vals.forEach(function (v, i) {
    if (v === null) return
    count++
    if (firstIndex === -1) firstIndex = i
    lastIndex = i
    if (dataMin === null || v < dataMin) dataMin = v
    if (dataMax === null || v > dataMax) dataMax = v
  })

  // Nothing logged in the window — there is no scale to build, and a chart
  // drawn anyway would be an empty box with invented axis numbers on it.
  if (count === 0) {
    return {
      isEmpty: true, chartHeight: emptyHeight,
      lo: null, hi: null, span: null, mid: null,
      min: null, max: null, first: null, last: null, change: null,
      count: 0, firstIndex: -1, lastIndex: -1,
      points: vals.map(function () { return null }),
      target: null, targetY: null, targetShown: false,
    }
  }

  var dataSpan = dataMax - dataMin

  // The target shares the axis only while it does not dominate it: at most
  // three times the data's own span, and always at least a couple of MIN_SPANs
  // so a flat window still shows a goal sitting just below it.
  var lo0 = dataMin, hi0 = dataMax
  var targetShown = false
  if (target !== null) {
    var withLo = Math.min(dataMin, target)
    var withHi = Math.max(dataMax, target)
    var allow  = Math.max(minSpan * 2, dataSpan * 3)
    if (withHi - withLo <= allow) {
      lo0 = withLo
      hi0 = withHi
      targetShown = true
    }
  }

  var pad = (hi0 - lo0) * PAD_RATIO
  var lo1 = lo0 - pad
  var hi1 = hi0 + pad

  if (hi1 - lo1 < minSpan) {
    var midpoint = (hi1 + lo1) / 2
    lo1 = midpoint - minSpan / 2
    hi1 = midpoint + minSpan / 2
  }

  var lo   = round2(Math.floor(lo1 / SNAP) * SNAP)
  var hi   = round2(Math.ceil(hi1 / SNAP) * SNAP)
  var span = round2(hi - lo)

  var n = vals.length
  var points = vals.map(function (v, i) {
    if (v === null) return null
    return {
      index: i,
      value: v,
      // Bucket centres, so the line sits over the same columns the x labels and
      // the tap targets use.
      x: n > 0 ? ((i + 0.5) / n) * 100 : 50,
      y: ((v - lo) / span) * height,
    }
  })

  return {
    isEmpty:     false,
    chartHeight: height,
    lo:          lo,
    hi:          hi,
    span:        span,
    mid:         round2((hi + lo) / 2),
    min:         dataMin,
    max:         dataMax,
    first:       vals[firstIndex],
    last:        vals[lastIndex],
    change:      round2(vals[lastIndex] - vals[firstIndex]),
    count:       count,
    firstIndex:  firstIndex,
    lastIndex:   lastIndex,
    points:      points,
    target:      targetShown ? target : null,
    targetY:     targetShown ? ((target - lo) / span) * height : null,
    targetShown: targetShown,
  }
}

/**
 * The SVG path through every plotted point, in a `0 0 100 <height>` viewBox.
 *
 * Gaps are bridged rather than broken: a fortnight without a weigh-in is a gap
 * in the record, not a change in bodyweight, and a line that stops dead at each
 * one is unreadable at 30 daily buckets. The dots say where the readings are.
 *
 * @param {({ x: number, y: number } | null)[]} points
 * @param {number} height
 * @returns {string} - empty when there is nothing, or only one point, to join
 */
function trendPath(points, height) {
  var d = ''
  ;(points || []).forEach(function (p) {
    if (!p) return
    d += (d ? ' L ' : 'M ') + round2(p.x) + ' ' + round2(height - p.y)
  })
  return d.indexOf('L') === -1 ? '' : d
}

export { buildTrendGeometry, trendPath, CHART_HEIGHT, EMPTY_HEIGHT, MIN_SPAN, SNAP }
