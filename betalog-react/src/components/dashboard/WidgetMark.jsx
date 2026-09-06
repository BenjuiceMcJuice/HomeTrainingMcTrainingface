/**
 * How a dashboard widget says what type it is.
 *
 * One rule, from Ben: **every widget the same in style, different by type.** So
 * the mark is one component, not a per-card decision — the shape is identical
 * on all nine cards and only the icon and the accent change. This file is the
 * only place that shape is decided.
 *
 * It comes in two halves because the mark has two halves:
 *
 * - `WidgetMark` — the icon, inline at the head of the headline row. Inline
 *   rather than in a column of its own: a 40px circle in its own flex column
 *   used to cost 52px off the whole card (see the widget system spec).
 * - `WidgetEdge` — an optional card-level flourish, absolutely positioned. The
 *   card supplies `position: relative` and nothing else.
 *
 * `VARIANT` picks the style. Kept as a switch rather than inlined so the look
 * can be changed in one line instead of nine files.
 */

// 'chip'  — icon in a rounded-square tile of accent tint
// 'spine' — bare icon, plus a full-height accent bar down the card's left edge
// 'rule'  — bare icon, plus an accent bar across the card's top edge
// 'bare'  — the icon in the accent colour, and nothing else
var VARIANT = 'chip'

export function WidgetEdge({ accent, radius }) {
  if (VARIANT === 'spine') {
    return (
      <span
        aria-hidden="true"
        style={{
          position: 'absolute', top: 10, bottom: 10, left: 0, width: 3,
          borderTopRightRadius: 3, borderBottomRightRadius: 3,
          background: accent, opacity: 0.85, pointerEvents: 'none',
        }}
      />
    )
  }
  if (VARIANT === 'rule') {
    return (
      <span
        aria-hidden="true"
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          borderTopLeftRadius: radius || 16, borderTopRightRadius: radius || 16,
          background: accent, opacity: 0.85, pointerEvents: 'none',
        }}
      />
    )
  }
  return null
}

export default function WidgetMark({ icon, accent, size }) {
  var Icon = icon
  var s = size || 14

  if (VARIANT === 'chip') {
    // Padding on the SVG itself rather than a wrapping div: it keeps the mark a
    // single inline box, so it sits on the headline's own line without the
    // flex row having to reason about a nested container.
    return (
      <Icon
        size={s}
        className="shrink-0"
        style={{
          color: accent,
          alignSelf: 'center',
          background: accent + '1f',
          padding: 4,
          borderRadius: 7,
          boxSizing: 'content-box',
        }}
      />
    )
  }

  return <Icon size={s} className="shrink-0" style={{ color: accent, alignSelf: 'center' }} />
}
