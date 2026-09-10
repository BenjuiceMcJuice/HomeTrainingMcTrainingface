import { SCORE_BANDS } from '../../lib/weeklyScore'
import { barlow } from '../../lib/utils'

/**
 * The Shameometer face — a 180° needle dial, VERY POOR to EXCELLENT.
 *
 * Inline SVG, no library. The geometry is all in viewBox units so the whole
 * thing scales with its container and needs no measurement or resize listener.
 *
 * Band labels are **not** drawn on the arc. Five labels around a semicircle
 * either collide at the ends ("VERY POOR" and "EXCELLENT" meeting the
 * horizontal) or have to be rotated tangentially, which reads as messy at phone
 * width. They live in a legend row underneath instead, where the active band
 * can also be highlighted — which the arc could not do.
 */

var VB_W = 200
var VB_H = 116
var CX = 100
var CY = 104
var R_OUT = 88
var R_IN = 56

/** Point on a circle. 180° is due left, 0° due right, y growing downward. */
function polar(r, angleDeg) {
  var rad = (angleDeg * Math.PI) / 180
  return { x: CX + r * Math.cos(rad), y: CY - r * Math.sin(rad) }
}

/** One annulus sector, from `a1` down to `a2` (both in the 180…0 sweep). */
function segmentPath(a1, a2) {
  var o1 = polar(R_OUT, a1)
  var o2 = polar(R_OUT, a2)
  var i2 = polar(R_IN, a2)
  var i1 = polar(R_IN, a1)
  // sweep-flag 1: left to right across the top is clockwise in screen space.
  return [
    'M', o1.x, o1.y,
    'A', R_OUT, R_OUT, 0, 0, 1, o2.x, o2.y,
    'L', i2.x, i2.y,
    'A', R_IN, R_IN, 0, 0, 0, i1.x, i1.y,
    'Z',
  ].join(' ')
}

/** Score 0-100 → angle, where 0 sits at 180° (left) and 100 at 0° (right). */
function angleFor(score) {
  var s = Math.max(0, Math.min(100, score))
  return 180 - (s / 100) * 180
}

export default function ScoreDial({ score, band, ghostScore, ghostLabel }) {
  // Bands are stored best-first; the dial reads worst-first from the left.
  var ordered = SCORE_BANDS.slice().reverse()

  var segments = ordered.map(function (b, i) {
    var lo = b.min
    var hi = i === ordered.length - 1 ? 100 : ordered[i + 1].min
    return { band: b, a1: angleFor(lo), a2: angleFor(hi) }
  })

  var needle = angleFor(score)
  var tip    = polar(R_OUT - 6, needle)
  var baseL  = polar(7, needle + 90)
  var baseR  = polar(7, needle - 90)

  var hasGhost = typeof ghostScore === 'number'
  var ghostA   = hasGhost ? angleFor(ghostScore) : 0
  var gOut     = hasGhost ? polar(R_OUT + 4, ghostA) : null
  var gIn      = hasGhost ? polar(R_IN - 4, ghostA) : null

  return (
    <div className="mt-1">
      <svg
        viewBox={'0 0 ' + VB_W + ' ' + VB_H}
        className="w-full"
        style={{ maxHeight: 170, display: 'block' }}
        role="meter"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={score + ' out of 100, ' + (band ? band.label : '')}
      >
        {segments.map(function (s) {
          var active = band && s.band.label === band.label
          return (
            <path
              key={s.band.label}
              d={segmentPath(s.a1, s.a2)}
              fill={s.band.color}
              // The band you are in is the one that matters; the rest recede.
              opacity={active ? 1 : 0.28}
              style={{ transition: 'opacity 400ms' }}
            />
          )
        })}

        {hasGhost && (
          <line
            x1={gIn.x} y1={gIn.y} x2={gOut.x} y2={gOut.y}
            stroke="#7a8299" strokeWidth="2" strokeLinecap="round" opacity="0.75"
          >
            <title>{ghostLabel || 'Last week'}: {ghostScore}</title>
          </line>
        )}

        {/* Needle. Rotating a fixed shape would be simpler, but drawing it from
            polar points keeps the pivot exact at any score. */}
        <polygon
          points={[baseL.x + ',' + baseL.y, tip.x + ',' + tip.y, baseR.x + ',' + baseR.y].join(' ')}
          fill="#1a1d2e"
          style={{ transition: 'all 600ms cubic-bezier(0.34, 1.2, 0.64, 1)' }}
        />
        <circle cx={CX} cy={CY} r="9" fill="#fff" stroke="#1a1d2e" strokeWidth="2.5" />
        <circle cx={CX} cy={CY} r="2.5" fill="#1a1d2e" />
      </svg>

      <div className="flex justify-center gap-1 -mt-1 flex-wrap">
        {ordered.map(function (b) {
          var active = band && b.label === band.label
          return (
            <span
              key={b.label}
              className="rounded px-1.5 py-0.5 text-[8px] font-bold leading-none"
              style={{
                ...barlow,
                background: active ? b.color : b.bg,
                color:      active ? '#fff'  : '#bbbcc8',
                letterSpacing: '0.02em',
              }}
            >
              {b.label}
            </span>
          )
        })}
      </div>
    </div>
  )
}
