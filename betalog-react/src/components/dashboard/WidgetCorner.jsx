/**
 * The widget's identity mark, moved out of the layout and into the corner.
 *
 * Every card used to open with a 40px circular icon in a column of its own: 40
 * for the circle, 12 for the gap. On the four cards where `WidgetShell` sat
 * *beside* that column rather than around it — weight, gym, cardio, level —
 * the 52px ate the whole card: headline, window chips, chart and captions all
 * shunted right, and the chart lost more than an eighth of a 393px phone to an
 * icon it was not describing. On the two where the icon sat inside the header
 * only — alcohol, training load — the column instead left a tall blank gutter
 * beside the header, and the card read with two different left edges.
 *
 * So the mark becomes a corner. A tinted right-triangle fills the top-left,
 * which is the one part of a card nothing else ever occupies, and the icon is
 * rendered inline at the head of the headline row — inside the wedge visually,
 * but in the text flow, so it holds no column open. Everything that is not the
 * headline starts at the card's own padding, and every card has one left edge.
 *
 * Decorative: `aria-hidden` and `pointerEvents: none`, so it never competes
 * with the `WidgetShell` header button drawn over it. The card needs
 * `position: relative` and nothing else — the wedge clips itself to the card's
 * corner radius rather than asking for `overflow: hidden`, because the charts
 * inside draw peak labels that have to escape their own box.
 */
export default function WidgetCorner({ accent, size, radius }) {
  var s = size || 40

  return (
    <span
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: s,
        height: s,
        overflow: 'hidden',
        borderTopLeftRadius: radius || 16,
        pointerEvents: 'none',
      }}
    >
      {/* Painted from the accent at low alpha rather than from the pale named
          tints the icon circles used: on white those were so faint the mark
          read as a smudge, and a marker nobody can see is not a marker. The
          hairline down the hypotenuse is what makes it a deliberate corner
          rather than a wash. Cards whose accent already moves with their state
          — the load zone, the alcohol tier, the climbing level — get a corner
          that moves with it too. */}
      <svg width={s} height={s} viewBox={'0 0 ' + s + ' ' + s} style={{ display: 'block' }}>
        <path d={'M0 0 H' + s + ' L0 ' + s + ' Z'} fill={accent + '1f'} />
        <path d={'M' + s + ' 0 L0 ' + s} stroke={accent} strokeWidth="1" strokeOpacity="0.3" fill="none" />
      </svg>
    </span>
  )
}
