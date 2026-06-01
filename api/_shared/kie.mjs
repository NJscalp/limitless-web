const KIE_API_BASE = (process.env.KIE_API_BASE || 'https://api.kie.ai').replace(/\/$/, '')

export async function kieApiFetch(path, { method = 'GET', body } = {}) {
  const apiKey = (process.env.KIE_API_KEY || '').trim()
  const response = await fetch(`${KIE_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  const data = await response.json().catch(() => ({}))
  return { response, data, apiKey }
}
