import { barlow } from '../../lib/utils'
import { gradeColor } from '../../lib/stats'
import { OWN_SENDS } from '../../lib/pyramid'

/**
 * The one pyramid colour. It was the widget's discipline colour — orange on
 * Boulder, blue on Rope — until 2026-09-13, when Ben asked for both in the
 * Rope blue: the bar chart under it is orange on both cards and he wanted the
 * pyramid to differ from the chart on both, the same way. Discipline is said
 * by the card's icon and edge; the pyramid no longer repeats it.
 */
export var PYRAMID_COLOR = '#4f7ef8'

/**
 * The fill of a row you **own** — a deeper step of the same blue, so it reads as
 * the same pyramid, more so, rather than as a second colour.
 */
export var PYRAMID_OWNED_COLOR = '#2f5fe0'

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
 * ## The owned row
 *
 * Ben, 2026-09-18: *"Could we perhaps mark a row as owned?"* A row is owned when
 * the grade has `OWN_SENDS` credited sends, whatever the pyramid asks of it —
 * the same rule the header's *Base* reads by. That row's blocks take the deeper
 * blue and its count reads **owned** instead of *4/4*, which is where the
 * information is: a 6b row full at 4 says nothing about whether 6b is owned,
 * and a base is the thing the whole model is about. No hatching — at eight
 * pixels tall a block has one bit to give, filled or not, and a pattern reads
 * as a glitch. `ownedAt` exists for tiers published by an older build that
 * carry no `own`; those rows simply never mark.
 *
 * ## The count column — always sends out of eight
 *
 * The blocks are always the pyramid for the target, 1 · 2 · 4 · 8. The count
 * beside each row is that grade's sends out of `OWN_SENDS` — *owned*, 5/8,
 * 2/8, 1/8 — on every pyramid, whatever the goal. It was an *Own*-goal thing
 * first (BTL-B52): owning *"should roughly progress through the grades"*. Ben,
 * 2026-09-23, asked for it everywhere: on a *Send V5* goal the rows read
 * *4/4 · 0/2 · 0/1*, which repeats the blocks and hides how far each grade is
 * from owned. Now the blocks say the pyramid and the count says ownership, so
 * one card gives both. Tiers from an older build with no `own` fall back to
 * *have/need*.
 *
 * ## Label colour
 *
 * With `gradeSystem` the grade labels take their level colour — the colour the
 * header badge, the bar chart's labels and the goal picker already give that
 * grade — so one grade is one colour on one card. It used to be the pyramid
 * colour when met and grey when not, which put V2 in teal on the badge and in
 * orange on the pyramid two lines below. The count on the right goes green
 * when a row is owned, so the label carries no state it needs to.
 *
 * @param {{
 *   tiers: {grade: string, need: number, have: number, met: boolean}[],
 *   color?: string,
 *   gradeSystem?: 'v' | 'french',
 *   trackColor?: string,
 *   compact?: boolean,
 *   ownedAt?: number,
 * }} props
 */
export default function PyramidChart({ tiers, color, gradeSystem, trackColor, compact, ownedAt }) {
  if (!tiers || !tiers.length) return null

  var fill  = color || PYRAMID_COLOR
  var owned = color ? fill : PYRAMID_OWNED_COLOR
  var track = trackColor || '#eceef5'
  var ownAt = ownedAt || OWN_SENDS
  var blockW = compact ? '13px' : '17px'
  var blockH = compact ? '7px' : '8px'

  // Reversed for display only — the model's order is load-bearing, this is not.
  var rows = tiers.slice().reverse()

  return (
    <div className="flex flex-col gap-1">
      {rows.map(function (t) {
        var isOwned = typeof t.own === 'number' && t.own >= ownAt
        var count = isOwned ? 'owned'
          : typeof t.own === 'number' ? t.own + '/' + ownAt
          : t.have + '/' + t.need
        var countMet = isOwned || (typeof t.own !== 'number' && t.met)
        return (
          <div key={t.grade} className="flex items-center gap-2">
            <span
              className="text-[10px] font-bold w-8 shrink-0 text-right"
              style={{ ...barlow, color: gradeSystem ? gradeColor(t.grade, gradeSystem) : (t.met ? fill : '#bbbcc8') }}
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
                      background: i < t.have ? (isOwned ? owned : fill) : track,
                    }}
                  />
                )
              })}
            </span>
            <span
              className="text-[9px] font-bold w-8 shrink-0"
              style={{ ...barlow, color: countMet ? '#2a9d5c' : '#7a8299' }}
            >
              {count}
            </span>
          </div>
        )
      })}
    </div>
  )
}
