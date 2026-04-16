import type { FaceContourRegion, FaceScanGeometry, ScanPoint } from './faceScanGeometry'

function isPoint(v: unknown): v is ScanPoint {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as ScanPoint).x === 'number' &&
    typeof (v as ScanPoint).y === 'number' &&
    Number.isFinite((v as ScanPoint).x) &&
    Number.isFinite((v as ScanPoint).y)
  )
}

function isRect(v: unknown): v is FaceScanGeometry['faceRect'] {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as FaceScanGeometry['faceRect']).x === 'number' &&
    typeof (v as FaceScanGeometry['faceRect']).y === 'number' &&
    typeof (v as FaceScanGeometry['faceRect']).width === 'number' &&
    typeof (v as FaceScanGeometry['faceRect']).height === 'number'
  )
}

function isContour(v: unknown): v is FaceContourRegion {
  if (typeof v !== 'object' || v === null) return false
  const c = v as FaceContourRegion
  return (
    typeof c.id === 'string' &&
    typeof c.closed === 'boolean' &&
    Array.isArray(c.points) &&
    c.points.every(isPoint)
  )
}

/**
 * Parsed JSON vom Backend — gleiche Struktur wie `FaceScanGeometry`,
 * alle Koordinaten im **Scan-Rahmen** (z. B. 260×340), wie `detectFaceForOverlay` in der App.
 */
export function parseVisionOverlayPayload(data: unknown): FaceScanGeometry | null {
  if (typeof data !== 'object' || data === null) return null
  const o = data as Record<string, unknown>
  if (!isRect(o.faceRect)) return null
  const keys: (keyof FaceScanGeometry)[] = [
    'foreheadCenter',
    'leftEye',
    'rightEye',
    'nose',
    'mouth',
    'chin',
    'jawLeft',
    'jawRight',
  ]
  const pts: Partial<FaceScanGeometry> = { faceRect: o.faceRect }
  for (const k of keys) {
    if (!isPoint(o[k])) return null
    pts[k] = o[k] as ScanPoint
  }
  const contours = o.contours
  if (!Array.isArray(contours) || !contours.every(isContour)) return null
  return {
    faceRect: o.faceRect,
    foreheadCenter: pts.foreheadCenter!,
    leftEye: pts.leftEye!,
    rightEye: pts.rightEye!,
    nose: pts.nose!,
    mouth: pts.mouth!,
    chin: pts.chin!,
    jawLeft: pts.jawLeft!,
    jawRight: pts.jawRight!,
    contours,
  }
}
