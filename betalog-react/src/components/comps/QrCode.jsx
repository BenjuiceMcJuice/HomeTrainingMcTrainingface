import { useMemo } from 'react'
import qrcode from 'qrcode-generator'

/**
 * A QR code as inline SVG — the poster's link to a comp. `qrcode-generator`
 * has no dependencies and draws straight to SVG, so nothing is fetched and
 * nothing is rasterised.
 * @param {{ value: string, size?: number, label?: string }} props
 */
export default function QrCode({ value, size, label }) {
  var svg = useMemo(function () {
    if (!value) return ''
    var qr = qrcode(0, 'M')
    qr.addData(value)
    qr.make()
    return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true })
  }, [value])
  var px = size || 200
  return (
    <div
      aria-label={label || 'QR code'}
      role="img"
      style={{ width: px, height: px }}
      className="[&>svg]:w-full [&>svg]:h-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
