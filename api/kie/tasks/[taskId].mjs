import { isAuthorized, rejectUnauthorized } from '../../_shared/auth.mjs'
import { falApiKey, falTaskEnvelopeForClient } from '../../_shared/fal.mjs'
import { isFalTaskId, stripFalTaskPrefix } from '../../_shared/future-self-prompts.mjs'
import { kieApiFetch, kieApiKey } from '../../_shared/kie.mjs'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'method_not_allowed' })
  }
  if (!isAuthorized(req)) return rejectUnauthorized(res)

  const taskId = String(req.query?.taskId || '').trim()
  if (!taskId) {
    return res.status(400).json({ error: 'missing_task_id' })
  }

  if (isFalTaskId(taskId)) {
    if (!falApiKey()) {
      return res.status(500).json({ error: 'server_misconfigured_missing_fal_key' })
    }
    try {
      const envelope = await falTaskEnvelopeForClient(stripFalTaskPrefix(taskId))
      return res.status(200).json(envelope)
    } catch (err) {
      console.error('fal task status', err?.detail || err)
      return res.status(502).json({
        error: 'fal_network_error',
        message: String(err?.message || err),
        detail: err?.detail || null,
      })
    }
  }

  if (!kieApiKey()) {
    return res.status(500).json({ error: 'server_misconfigured_missing_kie_key' })
  }

  try {
    const { response, data } = await kieApiFetch(
      `/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`
    )
    if (!response.ok) {
      return res.status(502).json({ error: 'kie_api_error', detail: data })
    }
    return res.status(200).json(data)
  } catch (err) {
    console.error('kie task status', err)
    return res.status(502).json({ error: 'kie_network_error', message: String(err?.message || err) })
  }
}
