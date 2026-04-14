/**
 * Gesichts-Geometrie für die Scan-Overlay-Animation (Display-Koordinaten, object-fit: cover).
 * MediaPipe Face Mesh Indizes wie @mediapipe/face_mesh FACEMESH_FACE_OVAL / Augen.
 */

import type { Face, FaceLandmarksDetector, Keypoint } from '@tensorflow-models/face-landmarks-detection'

export type ScanPoint = { x: number; y: number }

export type FaceScanGeometry = {
  faceRect: { x: number; y: number; width: number; height: number }
  foreheadCenter: ScanPoint
  leftEye: ScanPoint
  rightEye: ScanPoint
  nose: ScanPoint
  mouth: ScanPoint
  chin: ScanPoint
  jawLeft: ScanPoint
  jawRight: ScanPoint
  /** Gesichtskontur (geschlossen), für SVG polyline */
  faceOval: ScanPoint[]
}

/** Kette wie FACEMESH_FACE_OVAL (Mediapipe) */
const FACE_OVAL_INDICES = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148,
  176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
]

const LEFT_EYE_INDICES = [
  263, 249, 390, 373, 374, 380, 381, 382, 362, 466, 388, 387, 386, 385, 384, 398,
]

const RIGHT_EYE_INDICES = [
  33, 7, 163, 144, 145, 153, 154, 155, 133, 246, 161, 160, 159, 158, 157, 173,
]

/** Fallback wie Swift `AdaptiveFaceScanOverlay` ohne `faceData` */
export function defaultFaceScanGeometry(displayW: number, displayH: number): FaceScanGeometry {
  const w = displayW
  const h = displayH
  const mk = (fx: number, fy: number): ScanPoint => ({ x: w * fx, y: h * fy })
  const faceRect = { x: w * 0.2, y: h * 0.15, width: w * 0.6, height: h * 0.7 }
  const foreheadCenter = mk(0.5, 0.22)
  const leftEye = mk(0.37, 0.34)
  const rightEye = mk(0.63, 0.34)
  const nose = mk(0.5, 0.47)
  const mouth = mk(0.5, 0.58)
  const chin = mk(0.5, 0.75)
  const jawLeft = mk(0.3, 0.65)
  const jawRight = mk(0.7, 0.65)
  const faceOval = FACE_OVAL_INDICES.map((_, i) => {
    const t = (i / FACE_OVAL_INDICES.length) * Math.PI * 2
    const cx = w * 0.5
    const cy = h * 0.48
    const rx = w * 0.32
    const ry = h * 0.42
    return { x: cx + Math.cos(t) * rx, y: cy + Math.sin(t) * ry * 0.95 }
  })
  return {
    faceRect,
    foreheadCenter,
    leftEye,
    rightEye,
    nose,
    mouth,
    chin,
    jawLeft,
    jawRight,
    faceOval,
  }
}

/** object-fit: cover — Bildpunkt → Anzeige im Kasten */
export function mapImageToDisplayCover(
  ix: number,
  iy: number,
  imgW: number,
  imgH: number,
  dispW: number,
  dispH: number,
): ScanPoint {
  const scale = Math.max(dispW / imgW, dispH / imgH)
  const drawnW = imgW * scale
  const drawnH = imgH * scale
  const ox = (dispW - drawnW) / 2
  const oy = (dispH - drawnH) / 2
  return { x: ix * scale + ox, y: iy * scale + oy }
}

function mapKeypoint(
  kp: { x: number; y: number },
  imgW: number,
  imgH: number,
  dispW: number,
  dispH: number,
): ScanPoint {
  return mapImageToDisplayCover(kp.x, kp.y, imgW, imgH, dispW, dispH)
}

function averageLandmark(
  keypoints: Keypoint[],
  indices: number[],
  imgW: number,
  imgH: number,
  dispW: number,
  dispH: number,
): ScanPoint {
  let sx = 0
  let sy = 0
  for (const i of indices) {
    const p = keypoints[i]
    if (!p) continue
    sx += p.x
    sy += p.y
  }
  const n = indices.length
  return mapKeypoint({ x: sx / n, y: sy / n }, imgW, imgH, dispW, dispH)
}

function mapBoxToDisplay(
  box: Face['box'],
  imgW: number,
  imgH: number,
  dispW: number,
  dispH: number,
): { x: number; y: number; width: number; height: number } {
  const tl = mapImageToDisplayCover(box.xMin, box.yMin, imgW, imgH, dispW, dispH)
  const br = mapImageToDisplayCover(box.xMax, box.yMax, imgW, imgH, dispW, dispH)
  return {
    x: tl.x,
    y: tl.y,
    width: Math.max(1, br.x - tl.x),
    height: Math.max(1, br.y - tl.y),
  }
}

let detectorPromise: Promise<FaceLandmarksDetector> | null = null

async function getDetector(): Promise<FaceLandmarksDetector> {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const tf = await import('@tensorflow/tfjs-core')
      await import('@tensorflow/tfjs-backend-webgl')
      try {
        await tf.setBackend('webgl')
      } catch {
        await import('@tensorflow/tfjs-backend-cpu')
        await tf.setBackend('cpu')
      }
      await tf.ready()
      const faceLandmarksDetection = await import('@tensorflow-models/face-landmarks-detection')
      return faceLandmarksDetection.createDetector(
        faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
        {
          runtime: 'tfjs',
          maxFaces: 1,
          refineLandmarks: false,
        },
      )
    })()
  }
  return detectorPromise
}

/**
 * Erkennt Gesichtslandmarks und projiziert in den Anzeige-Rahmen (z. B. 260×340).
 */
export async function detectFaceScanGeometry(
  image: HTMLImageElement,
  displayW: number,
  displayH: number,
): Promise<FaceScanGeometry | null> {
  const iw = image.naturalWidth
  const ih = image.naturalHeight
  if (!iw || !ih) return null

  let faces: Face[]
  try {
    const detector = await getDetector()
    faces = await detector.estimateFaces(image, { flipHorizontal: false, staticImageMode: true })
  } catch {
    return null
  }

  if (!faces.length) return null

  const { keypoints, box } = faces[0]
  if (!keypoints?.length) return null

  const faceRect = mapBoxToDisplay(box, iw, ih, displayW, displayH)

  const foreheadCenter = mapKeypoint(keypoints[10], iw, ih, displayW, displayH)
  const leftEye = averageLandmark(keypoints, LEFT_EYE_INDICES, iw, ih, displayW, displayH)
  const rightEye = averageLandmark(keypoints, RIGHT_EYE_INDICES, iw, ih, displayW, displayH)
  const nose = mapKeypoint(keypoints[1], iw, ih, displayW, displayH)
  const mouth = averageLandmark(keypoints, [13, 14], iw, ih, displayW, displayH)
  const chin = mapKeypoint(keypoints[152], iw, ih, displayW, displayH)
  const jawLeft = mapKeypoint(keypoints[234], iw, ih, displayW, displayH)
  const jawRight = mapKeypoint(keypoints[454], iw, ih, displayW, displayH)

  const faceOval = FACE_OVAL_INDICES.map((idx) => mapKeypoint(keypoints[idx], iw, ih, displayW, displayH))

  return {
    faceRect,
    foreheadCenter,
    leftEye,
    rightEye,
    nose,
    mouth,
    chin,
    jawLeft,
    jawRight,
    faceOval,
  }
}
