/**
 * Optional: Proxy zu einem Dienst, der **Apple Vision** ausführt (nur auf macOS/iOS möglich).
 *
 * Setze in Vercel:
 *   FACE_LANDMARKS_URL=https://dein-mac-server.example.com/v1/face-landmarks
 *   FACE_LANDMARKS_SECRET=…  (optional; sonst FACE_BACKEND_SECRET)
 *
 * Upstream-Request: POST JSON { imageBase64, displayWidth?, displayHeight? }
 *
 * Erwartete JSON-Antwort — gleiche Semantik wie Swift `DetectedFaceData` nach `detectFaceForOverlay`
 * (alle Punkte im **Scan-Rahmen**-Koordinatensystem, z. B. 260×340):
 *
 * {
 *   "faceRect": { "x": 52, "y": 51, "width": 156, "height": 238 },
 *   "foreheadCenter": { "x": 130, "y": 75 },
 *   "leftEye": { "x": 96, "y": 116 },
 *   "rightEye": { "x": 164, "y": 116 },
 *   "nose": { "x": 130, "y": 160 },
 *   "mouth": { "x": 130, "y": 197 },
 *   "chin": { "x": 130, "y": 255 },
 *   "jawLeft": { "x": 78, "y": 221 },
 *   "jawRight": { "x": 182, "y": 221 },
 *   "contours": [
 *     { "id": "jaw", "closed": false, "points": [{ "x": 0, "y": 0 }] },
 *     { "id": "leftEye", "closed": true, "points": [] }
 *   ]
 * }
 *
 * contour-ids wie in FaceView: jaw, leftEye, rightEye, leftBrow, rightBrow, noseBridge, nose,
 * outerLips, innerLips, median (innerLips/median können leer sein; Web zeichnet sie wie die App nicht).
 *
 * Ohne FACE_LANDMARKS_URL: 501 — Browser nutzt TensorFlow.js (kein 1:1 zu Vision).
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  const base = (process.env.FACE_LANDMARKS_URL || '').replace(/\/$/, '')
  const secret = (process.env.FACE_LANDMARKS_SECRET || process.env.FACE_BACKEND_SECRET || '').trim()

  if (!base) {
    return res.status(501).json({
      error: 'vision_backend_not_configured',
      hint:
        'Apple Vision läuft nicht im Browser. Setze FACE_LANDMARKS_URL auf einen macOS-Dienst, der Vision ausführt, oder die App nutzt TensorFlow.js.',
    })
  }

  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body
  if (typeof body?.imageBase64 !== 'string' || !body.imageBase64.length) {
    return res.status(400).json({ error: 'missing_imageBase64' })
  }

  const headers = { 'Content-Type': 'application/json' }
  if (secret) {
    headers.Authorization = `Bearer ${secret}`
  }

  try {
    const r = await fetch(base, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        imageBase64: body.imageBase64,
        displayWidth: body.displayWidth ?? 260,
        displayHeight: body.displayHeight ?? 340,
      }),
    })
    const data = await r.json().catch(() => ({}))
    return res.status(r.status).json(data)
  } catch (e) {
    return res.status(502).json({ error: 'proxy_failed', message: String(e?.message || e) })
  }
}

function safeJson(s) {
  try {
    return JSON.parse(s)
  } catch {
    return {}
  }
}
