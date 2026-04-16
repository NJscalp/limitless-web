import { parseVisionOverlayPayload } from './visionOverlayPayload'
import type { FaceScanGeometry } from './faceScanGeometry'

/**
 * Ruft optional ein Backend auf, das **Apple Vision** (oder gleiche Geometrie) liefert.
 * Ohne konfigurierte URL: 501 → null, dann Fallback auf TensorFlow im Browser.
 *
 * Vercel: `FACE_LANDMARKS_URL` auf einen Dienst, der dasselbe JSON wie die App erzeugt
 * (z. B. kleiner macOS-Server mit `detectFaceForOverlay`).
 */
export async function tryFetchVisionFaceOverlay(
  imageBase64: string,
  displayWidth: number,
  displayHeight: number,
): Promise<FaceScanGeometry | null> {
  try {
    const res = await fetch('/api/face-landmarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64,
        displayWidth,
        displayHeight,
      }),
    })
    if (res.status === 501 || res.status === 404) return null
    if (!res.ok) return null
    const data = await res.json()
    if (data?.error && !data.faceRect) return null
    return parseVisionOverlayPayload(data)
  } catch {
    return null
  }
}
