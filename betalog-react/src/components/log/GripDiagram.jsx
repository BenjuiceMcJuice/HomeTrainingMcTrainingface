// Grip picture shown above the hangboard timer countdown: the back of the hand on the left
// (which fingers), the hand from the thumb side on the right (what shape they are in).
// The drawing lives in src/lib/gripDiagram.js; this only mounts it.
import { render, spec, VIEW_BOX } from '../../lib/gripDiagram'

export default function GripDiagram({ grip, color, dimColor, bg }) {
  if (!grip) return null

  var gt     = grip.gripType || grip.grip || 'open-hand'
  var markup = render(spec(grip.fingers || '4 Finger', gt), color, dimColor, bg || '#ffffff')

  return (
    <svg
      width="300"
      height="140"
      viewBox={VIEW_BOX}
      role="img"
      aria-label={grip.gripName || gt}
      style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  )
}
