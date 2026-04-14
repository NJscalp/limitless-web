/**
 * Vercel Serverless: proxies to the same backend as the iOS app (`POST /v1/face-analyze-full`).
 *
 * Env: FACE_BACKEND_URL (required), FACE_BACKEND_SECRET (optional, matches APP_SHARED_SECRET on Node server)
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  const base = (process.env.FACE_BACKEND_URL || '').replace(/\/$/, '')
  const secret = (process.env.FACE_BACKEND_SECRET || '').trim()

  if (!base) {
    return res.status(501).json({
      error: 'backend_not_configured',
      hint: 'Set FACE_BACKEND_URL in Vercel env to your face API base URL (same server as the iOS app).',
    })
  }

  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body
  const imageBase64 = body?.imageBase64

  if (typeof imageBase64 !== 'string' || !imageBase64.length) {
    return res.status(400).json({ error: 'missing_imageBase64' })
  }

  const headers = { 'Content-Type': 'application/json' }
  if (secret) {
    headers.Authorization = `Bearer ${secret}`
  }

  try {
    const r = await fetch(`${base}/v1/face-analyze-full`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ imageBase64 }),
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
