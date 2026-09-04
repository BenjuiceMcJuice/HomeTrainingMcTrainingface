import { buildTrendGeometry, trendPath } from '../../lib/trendChart'
import { labelledIndices } from '../../lib/barChart'
import { barlow } from '../../lib/utils'

/**
 * Shared line chart for dashboard widgets — a value that is a *level*, plotted
 * over a window, with a labelled y axis, an optional target line, and
 * tap-to-select.
 *
 * The sibling of `BarTimeline`, for the cards `BarTimeline` cannot serve:
 * bodyweight measured from zero is a row of identical bars. The arithmetic
 * lives in `lib/trendChart.js`; this file is what it looks like.
 *
 * Buckets carry their own labels and their own value, exactly as they do for
 * `BarTimeline`, except that `value` may be `null` — a bucket with no reading
 * in it, which is a gap in the line rather than a zero.
 *
 * The y axis gets a real gutter with three ticks. `BarTimeline` can get away
 * with one guideline label because a bar's height is readable against zero; a
 * zoomed axis is not readable without its numbers.
 *
 * @param {{
 *   buckets: { key: string, label: string, fullLabel: string, value: number|null }[],
 *   accentColor: string,
 *   unitLabel?: string,
 *   target?: number | null,
 *   targetLabel?: string,
 *   format?: (v: number) => string,
 *   cardBg?: string,
 *   selected?: number | null,
 *   onSelect?: (index: number | null) => void,
 *   gap?: number,
 *   labelMode?: 'step' | 'edges',
 *   labelStep?: number,
 *   endLabel?: string,
 * }} props
 */

/** Width of the y-axis gutter. Fits "100.5" at 8px without wrapping. */
var AXIS_W = 26

export default function TrendTimeline({
  buckets, accentColor, unitLabel,
  target, targetLabel, format, cardBg,
  selected, onSelect,
  gap, labelMode, labelStep, endLabel,
}) {
  var bars   = buckets || []
  var geo    = buildTrendGeometry(bars.map(function (b) { return b.value }), { target: target })
  var barGap = gap === undefined ? 3 : gap
  var units  = unitLabel === undefined ? '' : unitLabel
  var fmt    = format || function (v) { return String(v) }

  var pickedIdx = selected === undefined ? null : selected
  var picked    = pickedIdx !== null && bars[pickedIdx] ? bars[pickedIdx] : null

  function toggle(i) {
    if (!onSelect) return
    onSelect(pickedIdx === i ? null : i)
  }

  var labelled = labelledIndices(bars.length, labelStep === undefined ? 2 : labelStep)

  function ariaFor(b) {
    return b.fullLabel + ' · ' + (b.value === null || b.value === undefined
      ? 'no reading'
      : fmt(b.value) + (units ? ' ' + units : ''))
  }

  // No readings in the window: the axis numbers would be invented, so the chart
  // gives way to whatever the card says instead.
  if (geo.isEmpty) return null

  var tickStyle = {
    ...barlow,
    position: 'absolute', right: 4,
    fontSize: 8, lineHeight: 1, color: 'rgba(26,29,46,0.38)',
  }

  return (
    <div>
      <div style={{ display: 'flex', marginTop: 8 }}>
        {/* Y axis. Three ticks is enough to read a value off the line and few
            enough not to become the loudest thing in the card. */}
        <div style={{ width: AXIS_W, position: 'relative', height: geo.chartHeight, flexShrink: 0 }}>
          <span className="tabular-nums" style={{ ...tickStyle, top: 0, transform: 'translateY(-50%)' }}>{fmt(geo.hi)}</span>
          <span className="tabular-nums" style={{ ...tickStyle, top: '50%', transform: 'translateY(-50%)' }}>{fmt(geo.mid)}</span>
          <span className="tabular-nums" style={{ ...tickStyle, bottom: 0, transform: 'translateY(50%)' }}>{fmt(geo.lo)}</span>
        </div>

        <div style={{ flex: 1, position: 'relative', height: geo.chartHeight, minWidth: 0 }}>
          {/* Gridlines at the three ticks, faint enough to sit under the line */}
          {[0, 0.5, 1].map(function (f) {
            return (
              <div
                key={f}
                style={{
                  position: 'absolute', left: 0, right: 0, bottom: f * geo.chartHeight,
                  borderTop: '1px solid rgba(26,29,46,0.07)', pointerEvents: 'none',
                }}
              />
            )
          })}

          {geo.targetY !== null && (
            <div
              style={{
                position: 'absolute', left: 0, right: 0, bottom: geo.targetY,
                borderTop: '1px dashed rgba(212,116,42,0.7)', pointerEvents: 'none',
              }}
            >
              {targetLabel && (
                <span
                  className="tabular-nums"
                  style={{
                    ...barlow,
                    position: 'absolute', right: 0, top: 0, transform: 'translateY(-50%)',
                    fontSize: 8, lineHeight: 1, color: '#d4742a',
                    background: cardBg || '#ffffff', paddingLeft: 3, paddingRight: 1,
                  }}
                >
                  {targetLabel}
                </span>
              )}
            </div>
          )}

          {/* The line. A non-scaling stroke keeps it 1.5px however wide the card
              gets — the viewBox is stretched to fit, the stroke is not. */}
          <svg
            width="100%" height={geo.chartHeight}
            viewBox={'0 0 100 ' + geo.chartHeight}
            preserveAspectRatio="none"
            style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}
            aria-hidden="true"
          >
            <path
              d={trendPath(geo.points, geo.chartHeight)}
              fill="none"
              stroke={accentColor}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              opacity={picked ? 0.45 : 0.9}
            />
          </svg>

          {geo.points.map(function (p) {
            if (!p) return null
            var isLast   = p.index === geo.lastIndex
            var isPicked = pickedIdx === p.index
            var size     = isPicked ? 7 : isLast ? 6 : 4
            return (
              <div
                key={bars[p.index].key}
                style={{
                  position: 'absolute',
                  left: p.x + '%', bottom: p.y,
                  width: size, height: size, borderRadius: '50%',
                  transform: 'translate(-50%, 50%)',
                  background: accentColor,
                  border: isPicked || isLast ? '1.5px solid #fff' : 'none',
                  boxShadow: isPicked ? '0 0 0 1.5px rgba(26,29,46,0.35)' : 'none',
                  opacity: picked && !isPicked ? 0.35 : 1,
                  pointerEvents: 'none',
                  transition: 'bottom 0.3s ease, opacity 0.2s ease',
                }}
              />
            )
          })}

          {/* Tap targets, one per bucket, over the whole chart height. Buckets
              with no reading are inert — selecting one says nothing. */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', gap: barGap }}>
            {bars.map(function (b, i) {
              var empty = b.value === null || b.value === undefined
              return (
                <button
                  key={b.key}
                  type="button"
                  onClick={function () { if (!empty) toggle(i) }}
                  aria-label={ariaFor(b)}
                  title={ariaFor(b)}
                  disabled={empty}
                  style={{
                    flex: 1, height: '100%',
                    background: 'none', border: 0, padding: 0,
                    cursor: empty ? 'default' : 'pointer',
                  }}
                />
              )
            })}
          </div>
        </div>
      </div>

      {/* X labels, aligned to the plot area rather than the axis gutter. */}
      <div style={{ paddingLeft: AXIS_W }}>
        {labelMode === 'edges' ? (
          <div className="flex justify-between" style={{ marginTop: 4 }}>
            <span className="text-[9px] text-[#bbbcc8] tabular-nums" style={barlow}>{bars.length ? bars[0].label : ''}</span>
            <span className="text-[9px] text-[#bbbcc8] tabular-nums" style={barlow}>{bars.length ? bars[Math.floor(bars.length / 2)].label : ''}</span>
            <span className="text-[9px] text-[#bbbcc8]" style={barlow}>{endLabel || (bars.length ? bars[bars.length - 1].label : '')}</span>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: barGap, marginTop: 4 }}>
            {bars.map(function (b, i) {
              return (
                <span
                  key={b.key}
                  className="text-[9px] text-[#bbbcc8] tabular-nums"
                  style={{ ...barlow, flex: 1, textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap' }}
                >
                  {labelled[i] ? b.label : ''}
                </span>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
