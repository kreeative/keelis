import { useMemo } from 'react'
import { create as createQr } from 'qrcode'
import styles from './QRCode.module.css'

/** QR rendered as SVG in currentColor. Size in px. */
export function QRCode({ value, size = 200, label }: { value: string; size?: number; label: string }) {
  const { path, count } = useMemo(() => {
    const qr = createQr(value, { errorCorrectionLevel: 'M' })
    const count = qr.modules.size
    const data = qr.modules.data
    let d = ''
    for (let y = 0; y < count; y++) {
      for (let x = 0; x < count; x++) {
        if (data[y * count + x]) d += `M${x} ${y}h1v1h-1z`
      }
    }
    return { path: d, count }
  }, [value])
  return (
    <svg className={styles.qr} width={size} height={size} viewBox={`0 0 ${count} ${count}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <path d={path} fill="currentColor" />
    </svg>
  )
}
