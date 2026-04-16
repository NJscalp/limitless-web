/**
 * 1:1 zur iOS `detectFaceForOverlay` + `AdaptiveFaceScanOverlay`:
 * - gleiches Display (z. B. 260×340), gleiches „cover“-Mapping wie Swift `scaledToFill`
 * - Kontur-Reihenfolge wie `FaceView.detectFaceForOverlay` (jaw, Augen, Brauen, …)
 * - Stirn wie Swift: Mittelpunkt zwischen Augen, y = leftEye.y - (mouth.y - leftEye.y) * 0.45
 */

import type { Face, FaceLandmarksDetector, Keypoint } from '@tensorflow-models/face-landmarks-detection'
import { createDetectionCanvas } from './faceScanImagePrep'

export type ScanPoint = { x: number; y: number }

/** Entspricht `FaceContourRegion` in FaceView.swift */
export type FaceContourRegion = {
  id: string
  closed: boolean
  points: ScanPoint[]
}

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
  contours: FaceContourRegion[]
}

/** FACEMESH_FACE_OVAL (Mediapipe) — wie Gesichtskontur / „jaw“-Outline */
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

/** @mediapipe/face_mesh FACEMESH_LEFT_EYEBROW Kantenfolge */
const LEFT_BROW_INDICES = [276, 283, 282, 295, 285, 300, 293, 334, 296, 336]

/** FACEMESH_RIGHT_EYEBROW */
const RIGHT_BROW_INDICES = [46, 53, 52, 65, 55, 70, 63, 105, 66, 107]

const NOSE_BRIDGE_INDICES = [6, 197, 195, 5]

/** Nase (geschlossene Form) — typische MediaPipe-Indizes, radial sortiert */
const NOSE_LOOP_INDICES = [
  98, 97, 2, 326, 327, 294, 278, 344, 440, 275, 363, 420, 437, 456, 198, 131, 134, 102, 49, 220, 305,
  290, 328, 460,
]

/** Äußere Lippenkontur (vereinigt obere/untere Kette) */
const OUTER_LIP_INDICES = [
  61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185,
]

function orderRadialByIndices(keypoints: Keypoint[], indices: number[], mapKp: (kp: Keypoint) => ScanPoint): ScanPoint[] {
  const pts: ScanPoint[] = []
  for (const i of indices) {
    const p = keypoints[i]
    if (p) pts.push(mapKp(p))
  }
  if (pts.length < 2) return pts
  let cx = 0
  let cy = 0
  for (const p of pts) {
    cx += p.x
    cy += p.y
  }
  cx /= pts.length
  cy /= pts.length
  return [...pts].sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx))
}

/** object-fit: cover — entspricht Swift `scaledW/scaledH/offX/offY` für Bild → Display */
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
  let n = 0
  for (const i of indices) {
    const p = keypoints[i]
    if (!p) continue
    sx += p.x
    sy += p.y
    n++
  }
  if (n === 0) return { x: dispW / 2, y: dispH / 2 }
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

/** Stirn wie Swift `detectFaceForOverlay` */
function swiftForeheadCenter(leftEye: ScanPoint, rightEye: ScanPoint, mouth: ScanPoint): ScanPoint {
  return {
    x: (leftEye.x + rightEye.x) / 2,
    y: leftEye.y - (mouth.y - leftEye.y) * 0.45,
  }
}

/**
 * Konturen in derselben Reihenfolge wie `detectFaceForOverlay` → `contours.append`
 * (innerLips/median: Swift lineWidth 0 — weglassen)
 */
function buildContoursFromKeypoints(
  keypoints: Keypoint[],
  imgW: number,
  imgH: number,
  dispW: number,
  dispH: number,
): FaceContourRegion[] {
  const mk = (kp: Keypoint) => mapKeypoint(kp, imgW, imgH, dispW, dispH)
  const regions: FaceContourRegion[] = []

  const jawPts = FACE_OVAL_INDICES.map((i) => keypoints[i]).filter(Boolean) as Keypoint[]
  if (jawPts.length > 2) {
    regions.push({
      id: 'jaw',
      closed: false,
      points: FACE_OVAL_INDICES.map((i) => keypoints[i])
        .filter(Boolean)
        .map((kp) => mk(kp as Keypoint)),
    })
  }

  const le = orderRadialByIndices(keypoints, LEFT_EYE_INDICES, (kp) => mk(kp))
  if (le.length > 2) regions.push({ id: 'leftEye', closed: true, points: le })

  const re = orderRadialByIndices(keypoints, RIGHT_EYE_INDICES, (kp) => mk(kp))
  if (re.length > 2) regions.push({ id: 'rightEye', closed: true, points: re })

  const lb = LEFT_BROW_INDICES.map((i) => keypoints[i])
    .filter(Boolean)
    .map((kp) => mk(kp as Keypoint))
  if (lb.length > 2) regions.push({ id: 'leftBrow', closed: false, points: lb })

  const rb = RIGHT_BROW_INDICES.map((i) => keypoints[i])
    .filter(Boolean)
    .map((kp) => mk(kp as Keypoint))
  if (rb.length > 2) regions.push({ id: 'rightBrow', closed: false, points: rb })

  const nb = NOSE_BRIDGE_INDICES.map((i) => keypoints[i])
    .filter(Boolean)
    .map((kp) => mk(kp as Keypoint))
  if (nb.length > 1) regions.push({ id: 'noseBridge', closed: false, points: nb })

  const ns = orderRadialByIndices(keypoints, NOSE_LOOP_INDICES, (kp) => mk(kp))
  if (ns.length > 2) regions.push({ id: 'nose', closed: true, points: ns })

  const lip = orderRadialByIndices(keypoints, OUTER_LIP_INDICES, (kp) => mk(kp))
  if (lip.length > 2) regions.push({ id: 'outerLips', closed: true, points: lip })

  return regions
}

/** Swift: Kieferpunkte aus Face-Contour bei 1/4 und 3/4 — hier MediaPipe-Oval-Indizes */
function jawLeftRightFromOval(keypoints: Keypoint[], imgW: number, imgH: number, dispW: number, dispH: number) {
  const n = FACE_OVAL_INDICES.length
  const iL = Math.max(0, Math.floor(n / 4))
  const iR = Math.max(0, Math.floor((3 * n) / 4))
  const kpL = keypoints[FACE_OVAL_INDICES[iL]]
  const kpR = keypoints[FACE_OVAL_INDICES[iR]]
  const fallback = (x: number, y: number) => ({ x, y })
  if (!kpL || !kpR) {
    return {
      jawLeft: fallback(dispW * 0.3, dispH * 0.65),
      jawRight: fallback(dispW * 0.7, dispH * 0.65),
    }
  }
  return {
    jawLeft: mapKeypoint(kpL, imgW, imgH, dispW, dispH),
    jawRight: mapKeypoint(kpR, imgW, imgH, dispW, dispH),
  }
}

/** Ellipse als Platzhalter-Kontur (wenn noch keine KI-Daten) */
function placeholderJawContour(displayW: number, displayH: number): FaceContourRegion {
  const cx = displayW * 0.5
  const cy = displayH * 0.48
  const rx = displayW * 0.32
  const ry = displayH * 0.4
  const n = 42
  const pts: ScanPoint[] = []
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2
    pts.push({ x: cx + Math.cos(t) * rx, y: cy + Math.sin(t) * ry * 0.96 })
  }
  return { id: 'jaw', closed: true, points: pts }
}

/** Fallback exakt wie Swift `AdaptiveFaceScanOverlay.effectiveFace` (FaceView.swift) */
export function defaultFaceScanGeometry(displayW: number, displayH: number): FaceScanGeometry {
  const w = displayW
  const h = displayH
  const mk = (fx: number, fy: number): ScanPoint => ({ x: w * fx, y: h * fy })
  const faceRect = { x: w * 0.2, y: h * 0.15, width: w * 0.6, height: h * 0.7 }
  return {
    faceRect,
    foreheadCenter: mk(0.5, 0.22),
    leftEye: mk(0.37, 0.34),
    rightEye: mk(0.63, 0.34),
    nose: mk(0.5, 0.47),
    mouth: mk(0.5, 0.58),
    chin: mk(0.5, 0.75),
    jawLeft: mk(0.3, 0.65),
    jawRight: mk(0.7, 0.65),
    contours: [placeholderJawContour(displayW, displayH)],
  }
}

let detectorPromise: Promise<FaceLandmarksDetector> | null = null

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Beim App-Start aufrufen: lädt tf.js/WebGL + MediaPipe, damit der erste Scan nicht auf „kaltem“ Shader scheitert. */
export async function warmUpFaceScanDetector(): Promise<void> {
  try {
    await getDetector()
  } catch {
    /* Erst-Scan nutzt dann Retries in detectFaceScanGeometryFromCanvas */
  }
}

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
          refineLandmarks: true,
        },
      )
    })()
  }
  return detectorPromise
}

function geometryFromFaceObservation(
  face: Face,
  iw: number,
  ih: number,
  displayW: number,
  displayH: number,
): FaceScanGeometry | null {
  const { keypoints, box } = face
  if (!keypoints?.length) return null

  const faceRect = mapBoxToDisplay(box, iw, ih, displayW, displayH)

  const leftEye = averageLandmark(keypoints, LEFT_EYE_INDICES, iw, ih, displayW, displayH)
  const rightEye = averageLandmark(keypoints, RIGHT_EYE_INDICES, iw, ih, displayW, displayH)
  const nose = averageLandmark(keypoints, NOSE_BRIDGE_INDICES, iw, ih, displayW, displayH)
  const mouth = averageLandmark(keypoints, OUTER_LIP_INDICES, iw, ih, displayW, displayH)
  const chinIdx = FACE_OVAL_INDICES[Math.floor(FACE_OVAL_INDICES.length / 2)]
  const chinKp = keypoints[chinIdx]
  const chin = chinKp
    ? mapKeypoint(chinKp, iw, ih, displayW, displayH)
    : mapKeypoint(keypoints[152], iw, ih, displayW, displayH)
  const { jawLeft, jawRight } = jawLeftRightFromOval(keypoints, iw, ih, displayW, displayH)
  const foreheadCenter = swiftForeheadCenter(leftEye, rightEye, mouth)

  const contours = buildContoursFromKeypoints(keypoints, iw, ih, displayW, displayH)

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
    contours,
  }
}

/**
 * MediaPipe auf einem Canvas, dessen Pixelraum zu dem Bild passt, das mit
 * `object-fit: cover` im Scan-Rahmen angezeigt wird (nach {@link createDetectionCanvas}).
 * Mehrere Versuche: erster Lauf scheitert oft, wenn WebGL/tf.js noch kompiliert.
 */
export async function detectFaceScanGeometryFromCanvas(
  canvas: HTMLCanvasElement,
  displayW: number,
  displayH: number,
): Promise<FaceScanGeometry | null> {
  const iw = canvas.width
  const ih = canvas.height
  if (!iw || !ih) return null

  const maxAttempts = 5
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await sleep(120 + attempt * 100)
    }
    try {
      const detector = await getDetector()
      const faces = await detector.estimateFaces(canvas, { flipHorizontal: false, staticImageMode: true })
      if (faces.length) {
        const g = geometryFromFaceObservation(faces[0], iw, ih, displayW, displayH)
        if (g) return g
      }
    } catch {
      /* nächster Versuch */
    }
  }

  return null
}

export async function detectFaceScanGeometry(
  image: HTMLImageElement,
  displayW: number,
  displayH: number,
): Promise<FaceScanGeometry | null> {
  const canvas = await createDetectionCanvas(image)
  if (!canvas) return null
  return detectFaceScanGeometryFromCanvas(canvas, displayW, displayH)
}
