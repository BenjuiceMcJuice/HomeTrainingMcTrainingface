import { buildBarGeometry, labelledIndices } from '../../lib/barChart'
import { barlow } from '../../lib/utils'

/**
 * Shared bar chart for dashboard widgets — bars over a window, one per bucket,
 * with an optional guideline, a value label on the peak, and tap-to-select.
 *
 * Extracted from the alcohol card (widget system spec, phase C) so cardio and
 * gym can have the same chart in phase D rather than a third implementation.
 * The arithmetic lives in `lib/barChart.js`; this file is what it looks like.
 *
 * Buckets carry their own labels: `label` for the axis, `fullLabel` for the
 * screen reader and tooltip.
 *
 * @param {{
 *   buckets: { key: string, label: string, fullLabel: string, value: number }[],
 *   accentColor: string,
 *   overColor?: string,
 *   emptyColor?: string,
 *   unitLabel?: string,
 *   guideline?: number | null,
 *   guidelineLabel?: string,
 *   cardBg?: string,
 *   selected?: number | null,
 *   onSelect?: (index: number | null) => void,
 *   gap?: number,
 *   labelMode?: 'step' | 'edges',
 *   labelStep?: number,
 *   endLabel?: string,
 * }} props
 */
export default function BarTimeline({
  buckets, accentColor, overColor, emptyColor, unitLabel,
  guideline, guidelineLabel, cardBg,
  selected, onSelect,
  gap, labelMode, labelStep, endLabel,
}) {
  var bars    = buckets || []
  var geo     = buildBarGeometry(bars.map(function (b) { return b.value }), { guideline: guideline })
  var barGap  = gap === undefined ? 3 : gap
  var units   = unitLabel === undefined ? '' : unitLabel
  var overCol = overColor  || accentColor
  var emptyCol = emptyColor || 'rgba(26,29,46,0.10)'

  var pickedIdx = selected === undefined ? null : selected
  var picked    = pickedIdx !== null && bars[pickedIdx] ? bars[pickedIdx] : null

  function toggle(i) {
    if (!onSelect) return
    onSelect(pickedIdx === i ? null : i)
  }

  var labelled = labelledIndices(bars.length, labelStep === undefined ? 2 : labelStep)
  var ariaFor  = function (b) { return b.fullLabel + ' · ' + b.value + (units ? ' ' + units : '') }

  return (
    <div>
      <div style={{ position: 'relative', marginTop: 8, height: geo.chartHeight }}>
        {geo.guidelineY !== null && (
          <div
            style={{
              position: 'absolute', left: 0, right: 0,
              bottom: geo.guidelineY,
              borderTop: '1px dashed rgba(26,29,46,0.22)',
              pointerEvents: 'none',
            }}
          >
            {/* Labelling the guideline turns it into the chart's y reference */}
            {guidelineLabel && (
              <span
                className="tabular-nums"
                style={{
                  ...barlow,
                  position: 'absolute', right: 0, top: 0, transform: 'translateY(-50%)',
                  fontSize: 8, lineHeight: 1, color: 'rgba(26,29,46,0.38)',
                  background: cardBg, paddingLeft: 3, paddingRight: 1,
                }}
              >
                {guidelineLabel}
              </span>
            )}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: barGap, height: '100%' }}>
          {bars.map(function (b, i) {
            var g        = geo.bars[i]
            var isLast   = i === bars.length - 1
            var isPicked = pickedIdx === i
            var dimmed   = !!picked && !isPicked
            return (
              <button
                key={b.key}
                type="button"
                onClick={function () { toggle(i) }}
                aria-label={ariaFor(b)}
                title={ariaFor(b)}
                style={{
                  flex: 1, height: '100%', position: 'relative',
                  display: 'flex', alignItems: 'flex-end',
                  background: 'none', border: 0, padding: 0, cursor: 'pointer',
                }}
              >
                {i === geo.peakIndex && (
                  <span
                    className="tabular-nums"
                    style={{
                      ...barlow,
                      position: 'absolute', bottom: g.height + 2, left: '50%', transform: 'translateX(-50%)',
                      fontSize: 8, lineHeight: 1, whiteSpace: 'nowrap', pointerEvents: 'none',
                      color: g.over ? overCol : accentColor, opacity: dimmed ? 0.3 : 0.85,
                    }}
                  >
                    {b.value}
                  </span>
                )}
                <div
                  style={{
                    width: '100%', height: g.height, borderRadius: 2,
                    background: g.value > 0 ? (g.over ? overCol : accentColor) : emptyCol,
                    opacity: dimmed ? 0.3 : g.value > 0 ? (isPicked || isLast ? 1 : 0.82) : 1,
                    boxShadow: isPicked ? '0 0 0 1.5px rgba(26,29,46,0.35)' : 'none',
                    transition: 'height 0.3s ease, opacity 0.2s ease',
                  }}
                />
              </button>
            )
          })}
        </div>
      </div>

      {/* X labels. Daily buckets are too many to label individually, so they
          get the ends and the middle instead of every nth. */}
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
  )
}
