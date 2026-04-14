import type { ScanPoint } from './faceScanGeometry'

/**
 * Wie Swift `ContourLineView.smoothPath`: Catmull-Rom-ähnliche Kontrollpunkte, tension 5.
 */
export function smoothContourToSvgD(points: ScanPoint[], closed: boolean): string {
  if (points.length < 2) return ''
  const tension = 5
  const pts = closed ? [...points, points[0], points[1]] : [...points]

  let d = `M ${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[Math.min(pts.length - 1, i + 1)]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    const cp1x = p1.x + (p2.x - p0.x) / tension
    const cp1y = p1.y + (p2.y - p0.y) / tension
    const cp2x = p2.x - (p3.x - p1.x) / tension
    const cp2y = p2.y - (p3.y - p1.y) / tension
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
  }
  if (closed) d += ' Z'
  return d
}
