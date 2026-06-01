import { isAuthorized, rejectUnauthorized } from '../_shared/auth.mjs'
import { kieApiFetch } from '../_shared/kie.mjs'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method_not_allowed' })
  }
  if (!isAuthorized(req)) return rejectUnauthorized(res)

  if (!(process.env.KIE_API_KEY || '').trim()) {
    return res.status(500).json({ error: 'server_misconfigured_missing_kie_key' })
  }

  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body
  const prompt = String(body?.prompt || '').trim()
  const inputUrls = body?.input_urls
  if (!prompt) return res.status(400).json({ error: 'missing_prompt' })
  if (!Array.isArray(inputUrls) || inputUrls.length === 0) {
    return res.status(400).json({ error: 'missing_input_urls' })
  }

  const payload = {
    model: String(body?.model || 'gpt-image-2-image-to-image'),
    input: {
      prompt,
      input_urls: inputUrls.map((u) => String(u)),
      ...(body?.aspect_ratio ? { aspect_ratio: String(body.aspect_ratio) } : { aspect_ratio: 'auto' }),
      ...(body?.resolution ? { resolution: String(body.resolution) } : {}),
    },
  }
  if (body?.callBackUrl) payload.callBackUrl = String(body.callBackUrl)

  try {
    const { response, data } = await kieApiFetch('/api/v1/jobs/createTask', {
      method: 'POST',
      body: payload,
    })
    if (!response.ok || data?.code !== 200) {
      return res.status(502).json({ error: 'kie_api_error', detail: data })
    }
    return res.status(200).json(data)
  } catch (err) {
    console.error('kie image-to-image', err)
    return res.status(502).json({ error: 'kie_network_error', message: String(err?.message || err) })
  }
}

function safeJson(s) {
  try {
    return JSON.parse(s)
  } catch {
    return {}
  }
}
