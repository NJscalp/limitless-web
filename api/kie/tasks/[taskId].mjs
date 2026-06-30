import { isAuthorized, rejectUnauthorized } from '../../_shared/auth.mjs'
import { kieApiFetch, kieApiKey } from '../../_shared/kie.mjs'

async function loadFalModules() {
  const [fal, prompts] = await Promise.all([
    import('../../_shared/fal.mjs'),
    import('../../_shared/future-self-prompts.mjs'),
  ])
  return { ...fal, ...prompts }
}

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

  let falMods
  try {
    falMods = await loadFalModules()
  } catch (err) {
    console.error('task status module load failed', err)
    return res.status(500).json({
      error: 'glow_up_module_load_failed',
      message: String(err?.message || err),
    })
  }

  const {
    falApiKey,
    falTaskEnvelopeForClient,
    formatFalErrorMessage,
    isFalTaskId,
    stripFalTaskPrefix,
  } = falMods

  if (isFalTaskId(taskId)) {
    if (!falApiKey()) {
      return res.status(500).json({ error: 'server_misconfigured_missing_fal_key' })
    }
    try {
      const statusUrl = String(req.query?.statusUrl || req.query?.status_url || '').trim() || undefined
      const responseUrl = String(req.query?.responseUrl || req.query?.response_url || '').trim() || undefined
      const envelope = await falTaskEnvelopeForClient(stripFalTaskPrefix(taskId), {
        statusUrl,
        responseUrl,
      })
      return res.status(200).json(envelope)
    } catch (err) {
      console.error('fal task status', err?.detail || err)
      const detail = err?.detail || null
      const httpStatus = err?.status ?? detail?.status
      if (httpStatus === 408 || httpStatus === 429 || httpStatus === 502 || httpStatus === 503 || httpStatus === 504) {
        return res.status(200).json({
          code: 200,
          msg: 'success',
          data: {
            taskId,
            state: 'processing',
            status: 'IN_PROGRESS',
            transient: true,
          },
        })
      }
      const hint =
        formatFalErrorMessage(detail?.body?.detail)
        || formatFalErrorMessage(detail?.body)
        || detail?.body?.message
        || (typeof detail?.body === 'string' ? detail.body : null)
      return res.status(502).json({
        error: 'fal_network_error',
        message: hint || String(err?.message || err),
        detail,
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
