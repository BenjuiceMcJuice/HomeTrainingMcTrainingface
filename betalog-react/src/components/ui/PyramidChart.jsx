import { barlow } from '../../lib/utils'

/**
 * The grade pyramid, drawn — one row per tier, each row as wide as the tier it
 * needs, filled as far as the log has filled it.
 *
 * Shared by Plan › Goals and the Dashboard's climbing widgets so the two cannot
 * drift apart: the same goal drawn two ways is worse than not drawing it twice.
 *
 * ## Which way up
 *
 * **Easiest grade at the top, target at the bottom** — so the rows narrow as they
 * descend and the whole thing reads as a funnel down to the goal.
 *
 * `readiness.tiers` arrives hardest-first, because that is the order the model
 * builds and spills in, so this reverses it for display. Two reasons, and the
 * second is the one that settles it:
 *
 * 1. Ben asked for it, 2026-09-12: harder grades belong lower.
 * 2. `GradeChart`, on the very same widget, has always sorted easiest-first and
 *    so puts hard grades at the bottom. Drawn hardest-first the pyramid ran the
 *    ladder the opposite way to the chart directly beneath it — two charts about
 *    the same climbing, disagreeing about which way is up.
 *
 * @param {{
 *   tiers: {grade: string, need: number, have: number, met: boolean}[],
 *   color: string,
 *   trackColor?: string,
 *   compact?: boolean,
 * }} props
 */
export default function PyramidChart({ tiers, color, trackColor, compact }) {
  if (!tiers || !tiers.length) return null

  var track = trackColor || '#eceef5'
  var blockW = compact ? '13px' : '17px'
  var blockH = compact ? '7px' : '8px'

  // Reversed for display only — the model's order is load-bearing, this is not.
  var rows = tiers.slice().reverse()

  return (
    <div className="flex flex-col gap-1">
      {rows.map(function (t) {
        return (
          <div key={t.grade} className="flex items-center gap-2">
            <span
              className="text-[10px] font-bold w-8 shrink-0 text-right"
              style={{ ...barlow, color: t.met ? color : '#bbbcc8' }}
            >
              {t.grade}
            </span>
            <span className="flex-1 flex gap-0.5 justify-center min-w-0">
              {Array.from({ length: t.need }).map(function (_, i) {
                return (
                  <i
                    key={i}
                    className="rounded-sm shrink"
                    style={{
                      height: blockH, width: blockW, minWidth: '3px',
                      background: i < t.have ? color : track,
                    }}
                  />
                )
              })}
            </span>
            <span
              className="text-[9px] font-bold w-8 shrink-0"
              style={{ ...barlow, color: t.met ? '#2a9d5c' : '#7a8299' }}
            >
              {t.have}/{t.need}
            </span>
          </div>
        )
      })}
    </div>
  )
}
