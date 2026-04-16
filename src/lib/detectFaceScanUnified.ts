import { canvasToJpegBase64, createDetectionCanvas } from './faceScanImagePrep'
import { detectFaceScanGeometryFromCanvas, defaultFaceScanGeometry } from './faceScanGeometry'
import { tryFetchVisionFaceOverlay } from './fetchVisionFaceOverlay'

export type { FaceScanGeometry } from './faceScanGeometry'

/**
 * 1. Optional: Backend mit Apple-Vision-kompatibler JSON-Antwort (`/api/face-landmarks`).
 * 2. Sonst: MediaPipe/TensorFlow.js im Browser.
 *
 * Ein gemeinsames, EXIF-korrigiertes Canvas (`createDetectionCanvas`) versorgt Vision und TF
 * mit denselben Pixeln wie das sichtbare Foto; das Cover-Mapping bleibt mit dem Scan-Rahmen konsistent.
 */
export async function detectFaceScanUnified(
  img: HTMLImageElement,
  imageBase64Fallback: string,
  displayW: number,
  displayH: number,
): Promise<FaceScanGeometry | null> {
  const canvas = await createDetectionCanvas(img)
  const fromCanvas =
    canvas && canvas.width > 0 && canvas.height > 0 ? canvasToJpegBase64(canvas) : ''
  const visionPayload = fromCanvas || imageBase64Fallback

  const vision = await tryFetchVisionFaceOverlay(visionPayload, displayW, displayH)
  if (vision) return vision
  if (!canvas) return null
  return detectFaceScanGeometryFromCanvas(canvas, displayW, displayH)
}

export { defaultFaceScanGeometry }
