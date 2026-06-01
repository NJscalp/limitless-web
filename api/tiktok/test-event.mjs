import { isAuthorized, rejectUnauthorized } from '../_shared/auth.mjs'

const TIKTOK_EVENTS_API_URL =
  process.env.TIKTOK_EVENTS_API_URL || 'https://business-api.tiktok.com/open_api/v1.3/event/track/'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method_not_allowed' })
  }
  if (!isAuthorized(req)) return rejectUnauthorized(res)

  const accessToken = (process.env.TIKTOK_ACCESS_TOKEN || '').trim()
  const pixelCode = (process.env.TIKTOK_PIXEL_CODE || '').trim()
  if (!accessToken || !pixelCode) {
    return res.status(500).json({ error: 'server_misconfigured_missing_tiktok_credentials' })
  }

  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body
  const event = String(body?.event || '').trim()
  if (!event) return res.status(400).json({ error: 'missing_event' })

  const eventId = body?.eventId ? String(body.eventId) : `dayone-${Date.now()}`
  const timestamp =
    typeof body?.timestamp === 'number' ? Math.floor(body.timestamp) : Math.floor(Date.now() / 1000)
  const testEventCode = String(
    body?.testEventCode || process.env.TIKTOK_TEST_EVENT_CODE || ''
  ).trim()
  const properties =
    body?.properties && typeof body.properties === 'object' ? body.properties : {}
  const context = body?.context && typeof body.context === 'object' ? body.context : {}

  const payload = {
    pixel_code: pixelCode,
    event,
    event_id: eventId,
    timestamp,
    context: { page: {}, ad: {}, ...context },
    properties,
    ...(testEventCode ? { test_event_code: testEventCode } : {}),
  }

  try {
    const response = await fetch(TIKTOK_EVENTS_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'access-token': accessToken,
      },
      body: JSON.stringify(payload),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || data?.code !== 0) {
      return res.status(502).json({ error: 'tiktok_api_error', detail: data })
    }
    return res.status(200).json({ ok: true, request: payload, response: data })
  } catch (err) {
    return res.status(502).json({ error: 'tiktok_network_error', message: String(err?.message || err) })
  }
}

function safeJson(s) {
  try {
    return JSON.parse(s)
  } catch {
    return {}
  }
}
