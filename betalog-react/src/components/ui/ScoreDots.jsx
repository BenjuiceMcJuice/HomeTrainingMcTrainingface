import { SCORE_COLOR } from '../../lib/weightGoalScore'

/**
 * A 1–5 rating as filled dots.
 *
 * Dots rather than "2/5" because of where this first appears: the Dashboard
 * weight card's rate line already reads `Lose 1.33 kg/wk · 5.8 kg/month · 57d
 * left`, and a bare number on the end of that reads as a fourth quantity —
 * kilos? weeks? Dots read as a rating at a glance and cost no words, which is
 * the whole requirement on a widget cut back to one line.
 *
 * Decorative: the score is always accompanied by its label or its reasons
 * somewhere the user can reach, so this carries an `aria-label` and nothing
 * else. It is never a control — `WidgetShell` forbids interactive elements in a
 * header row that is itself the collapse button.
 *
 * @param {{ score: number|null, max?: number, size?: number, gap?: number, title?: string }} props
 */
export default function ScoreDots({ score, max, size, gap, title }) {
  if (score === null || score === undefined) return null

  var total = max === undefined ? 5 : max
  var d     = size === undefined ? 5 : size
  var space = gap === undefined ? 2 : gap
  var color = SCORE_COLOR[score] || '#7a8299'
  var dots  = []

  for (var i = 1; i <= total; i++) dots.push(i)

  return (
    <span
      role="img"
      aria-label={title || (score + ' out of ' + total + ' achievable')}
      title={title || undefined}
      style={{ display: 'inline-flex', alignItems: 'center', gap: space, verticalAlign: 'middle' }}
    >
      {dots.map(function (i) {
        return (
          <span
            key={i}
            style={{
              width: d, height: d, borderRadius: '50%',
              background: i <= score ? color : 'rgba(26,29,46,0.15)',
            }}
          />
        )
      })}
    </span>
  )
}
