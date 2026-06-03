import { isAuthorized, rejectUnauthorized } from '../_shared/auth.mjs'
import { falApiKey, falCreateFutureSelfTask } from '../_shared/fal.mjs'
import { futureSelfCombinedPrompt } from '../_shared/future-self-prompts.mjs'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method_not_allowed' })
  }
  if (!isAuthorized(req)) return rejectUnauthorized(res)

  if (!falApiKey()) {
    return res.status(500).json({ error: 'server_misconfigured_missing_fal_key' })
  }

  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body
  const imageBase64 = String(body?.imageBase64 || body?.init_image || '').trim()
  const mode = body?.mode
  if (!imageBase64) {
    return res.status(400).json({ error: 'missing_image_base64' })
  }

  if (!futureSelfCombinedPrompt(mode)) {
    return res.status(503).json({
      error: 'missing_glow_up_prompt',
      detail:
        `Glow-up is disabled: no prompt for mode "${mode}" in api/_shared/future-self-prompts.mjs.`,
    })
  }

  try {
    const created = await falCreateFutureSelfTask(imageBase64, mode, {
      imageWidth: body?.imageWidth ?? body?.width,
      imageHeight: body?.imageHeight ?? body?.height,
    })
    return res.status(200).json({
      code: 200,
      msg: 'success',
      data: {
        taskId: created.taskId,
        mode: mode || 'front',
        model: created.model,
        provider: created.provider,
        imageSize: created.imageSize,
      },
    })
  } catch (err) {
    console.error('fal future-self', err?.detail || err)
    return res.status(502).json({
      error: String(err?.message || 'fal_future_self_failed'),
      detail: err?.detail || null,
    })
  }
}

function safeJson(s) {
  try {
    return JSON.parse(s)
  } catch {
    return {}
  }
}
