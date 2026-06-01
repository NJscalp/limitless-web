import { isAuthorized, rejectUnauthorized } from '../../_shared/auth.mjs'
import { kieApiFetch, kieApiKey } from '../../_shared/kie.mjs'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'method_not_allowed' })
  }
  if (!isAuthorized(req)) return rejectUnauthorized(res)

  if (!kieApiKey()) {
    return res.status(500).json({ error: 'server_misconfigured_missing_kie_key' })
  }

  const taskId = String(req.query?.taskId || '').trim()
  if (!taskId) {
    return res.status(400).json({ error: 'missing_task_id' })
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
