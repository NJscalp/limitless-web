// GPT Image 1 — Edit (image-to-image) über die fal-Queue.
// Günstigste Stufe: quality "low". Nutzt den server-seitig hinterlegten FAL_KEY.

const FAL_QUEUE_BASE = (process.env.FAL_QUEUE_BASE || 'https://queue.fal.run').replace(/\/$/, '')
// GPT Image 2 (realistischer als Nano-Banana/GPT-Image-1). Nur dieser fal-Pfad
// von /v1/gpt-image/edit nutzt das Modell — keine andere App betroffen.
const GPT_IMAGE_MODEL = (
  process.env.GPT_IMAGE_EDIT_MODEL || 'openai/gpt-image-2/edit'
).replace(/^\/+/, '')

const ALLOWED_QUALITY = new Set(['auto', 'low', 'medium', 'high'])
const ALLOWED_SIZES = new Set(['1024x1024', '1536x1024', '1024x1536'])

function falKey() {
  return (process.env.FAL_KEY || process.env.FAL_API_KEY || '').trim()
}

function authHeaders() {
  return { Authorization: `Key ${falKey()}`, 'Content-Type': 'application/json' }
}

function gptError(code, detail, status) {
  const err = new Error(code)
  err.detail = detail
  err.status = status
  return err
}

function base64ToDataUri(raw, mime = 'image/jpeg') {
  const trimmed = String(raw || '').trim()
  if (!trimmed) throw gptError('missing_image_base64', null, 400)
  return trimmed.startsWith('data:') ? trimmed : `data:${mime};base64,${trimmed}`
}

export function formatGptImageError(detail) {
  if (!detail) return null
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const parts = detail
      .map((item) => {
        if (typeof item === 'string') return item
        const field = Array.isArray(item?.loc) ? item.loc.filter((p) => p !== 'body').join('.') : ''
        const msg = item?.msg || item?.message
        if (!msg) return null
        return field ? `${field}: ${msg}` : msg
      })
      .filter(Boolean)
    return parts.length ? parts.join('; ') : null
  }
  if (typeof detail === 'object') {
    return formatGptImageError(detail.detail) || detail.message || detail.msg || null
  }
  return null
}

/**
 * Reicht einen GPT-Image-1 Edit-Job ein.
 * @param {{ prompt: string, images?: string[], imageUrls?: string[], quality?: string, size?: string }} input
 * @returns {Promise<{ taskId: string, statusUrl: string|null, responseUrl: string|null }>}
 */
export async function gptImageCreateTask(input = {}) {
  if (!falKey()) throw gptError('server_misconfigured_missing_fal_key', null, 500)

  const prompt = String(input.prompt || '').trim()
  if (!prompt) throw gptError('missing_prompt', null, 400)

  const imageUrls = []
  if (Array.isArray(input.imageUrls)) {
    for (const u of input.imageUrls) {
      const url = String(u || '').trim()
      if (url) imageUrls.push(url)
    }
  }
  if (Array.isArray(input.images)) {
    for (const b of input.images) {
      const raw = String(b || '').trim()
      if (raw) imageUrls.push(base64ToDataUri(raw, 'image/jpeg'))
    }
  }
  if (!imageUrls.length) throw gptError('missing_image', null, 400)

  const quality = ALLOWED_QUALITY.has(String(input.quality || '').trim())
    ? String(input.quality).trim()
    : 'low'

  const body = {
    prompt,
    image_urls: imageUrls.slice(0, 4),
    quality,
    num_images: 1,
    output_format: 'jpeg',
  }
  const size = String(input.size || '').trim()
  if (ALLOWED_SIZES.has(size)) body.image_size = size

  const response = await fetch(`${FAL_QUEUE_BASE}/${GPT_IMAGE_MODEL}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw gptError(formatGptImageError(data) || 'fal_submit_failed', data, response.status)
  }

  const requestId = data?.request_id
  if (!requestId) throw gptError('fal_missing_request_id', data, response.status)

  return {
    taskId: String(requestId),
    statusUrl: typeof data?.status_url === 'string' ? data.status_url : null,
    responseUrl: typeof data?.response_url === 'string' ? data.response_url : null,
  }
}

function deriveStatusUrl(statusUrl, responseUrl) {
  const s = String(statusUrl || '').trim()
  if (s.startsWith('http')) return s
  const r = String(responseUrl || '').trim()
  if (r.startsWith('http')) return `${r.replace(/\/$/, '')}/status`
  return null
}

function pickImageUrl(data) {
  const buckets = [data, data?.data, data?.response, data?.output].filter(Boolean)
  for (const bucket of buckets) {
    const images = bucket?.images
    if (Array.isArray(images)) {
      const url = images.map((img) => img?.url || img?.uri).find(Boolean)
      if (url) return String(url)
    }
    if (typeof bucket?.url === 'string' && bucket.url.startsWith('http')) return bucket.url
  }
  return null
}

/**
 * Fragt den Status eines Jobs ab und liefert bei Erfolg die Bild-URL.
 * @returns {Promise<{ state: 'queued'|'running'|'succeeded'|'failed', imageUrl?: string, failMsg?: string }>}
 */
export async function gptImageTaskState({ statusUrl, responseUrl } = {}) {
  if (!falKey()) throw gptError('server_misconfigured_missing_fal_key', null, 500)

  const resolvedStatusUrl = deriveStatusUrl(statusUrl, responseUrl)
  const resolvedResponseUrl = String(responseUrl || '').trim()
  if (!resolvedStatusUrl) throw gptError('missing_status_url', null, 400)

  const sResp = await fetch(resolvedStatusUrl, { headers: authHeaders() })
  const sData = await sResp.json().catch(() => ({}))
  if (!sResp.ok) {
    throw gptError(formatGptImageError(sData) || 'fal_status_failed', sData, sResp.status)
  }

  const status = String(sData?.status || '').toUpperCase()
  if (status === 'IN_QUEUE') return { state: 'queued' }
  if (status === 'IN_PROGRESS') return { state: 'running' }

  if (status === 'COMPLETED') {
    const resultUrl = resolvedResponseUrl.startsWith('http')
      ? resolvedResponseUrl
      : (typeof sData?.response_url === 'string'
        ? sData.response_url
        : resolvedStatusUrl.replace(/\/status$/, ''))

    const rResp = await fetch(resultUrl, { headers: authHeaders() })
    const rData = await rResp.json().catch(() => ({}))
    if (!rResp.ok) {
      throw gptError(formatGptImageError(rData) || 'fal_result_failed', rData, rResp.status)
    }
    const imageUrl = pickImageUrl(rData) || pickImageUrl(sData)
    if (imageUrl) return { state: 'succeeded', imageUrl }
    return { state: 'failed', failMsg: 'no_image_in_result' }
  }

  if (status === 'FAILED' || status === 'CANCELLED') {
    return { state: 'failed', failMsg: formatGptImageError(sData?.error) || status.toLowerCase() }
  }

  return { state: 'running' }
}
