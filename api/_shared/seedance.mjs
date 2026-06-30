// Seedance 2.0 Fast — Reference-to-Video über die fal-Queue.
// Nutzt den bereits server-seitig konfigurierten FAL_KEY (siehe fal.mjs).

import {
  falApiKey,
  falQueueFetch,
  falFetchAbsolute,
  base64ToDataUri,
  formatFalErrorMessage,
} from './fal.mjs'

const SEEDANCE_MODEL = (
  process.env.SEEDANCE_MODEL || 'bytedance/seedance-2.0/fast/reference-to-video'
).replace(/^\/+/, '')

const ALLOWED_RESOLUTIONS = new Set(['480p', '720p'])
const ALLOWED_RATIOS = new Set(['auto', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16'])

function seedanceError(code, detail, status) {
  const err = new Error(code)
  err.detail = detail
  err.status = status
  return err
}

function normalizeResolution(raw) {
  const v = String(raw || '720p').trim()
  return ALLOWED_RESOLUTIONS.has(v) ? v : '720p'
}

function normalizeRatio(raw) {
  const v = String(raw || 'auto').trim()
  if (v === 'adaptive') return 'auto'
  return ALLOWED_RATIOS.has(v) ? v : 'auto'
}

function normalizeDuration(raw) {
  if (raw === undefined || raw === null || raw === 'auto') return 'auto'
  const n = Math.round(Number(raw))
  if (!Number.isFinite(n)) return 'auto'
  return String(Math.min(15, Math.max(4, n)))
}

/**
 * Reicht einen Reference-to-Video-Job bei fal ein.
 * @param {{ prompt: string, images?: string[], imageUrls?: string[], resolution?: string, duration?: number|string, aspectRatio?: string, generateAudio?: boolean, seed?: number }} input
 * @returns {Promise<{ taskId: string, statusUrl: string|null, responseUrl: string|null }>}
 */
export async function seedanceCreateTask(input = {}) {
  if (!falApiKey()) throw seedanceError('server_misconfigured_missing_fal_key', null, 500)

  const prompt = String(input.prompt || '').trim()
  if (!prompt) throw seedanceError('missing_prompt', null, 400)

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

  const videoUrls = []
  if (Array.isArray(input.videoUrls)) {
    for (const u of input.videoUrls) {
      const url = String(u || '').trim()
      if (url.startsWith('http')) videoUrls.push(url)
    }
  }

  const body = {
    prompt,
    resolution: normalizeResolution(input.resolution),
    duration: normalizeDuration(input.duration),
    aspect_ratio: normalizeRatio(input.aspectRatio),
    generate_audio: input.generateAudio !== false,
  }
  if (imageUrls.length) body.image_urls = imageUrls.slice(0, 9)
  if (videoUrls.length) body.video_urls = videoUrls.slice(0, 3)
  if (Number.isFinite(Number(input.seed))) body.seed = Math.round(Number(input.seed))

  const { response, data } = await falQueueFetch(`/${SEEDANCE_MODEL}`, {
    method: 'POST',
    body,
  })

  if (!response.ok) {
    throw seedanceError(
      formatFalErrorMessage(data) || 'fal_submit_failed',
      data,
      response.status
    )
  }

  const requestId = data?.request_id
  if (!requestId) throw seedanceError('fal_missing_request_id', data, response.status)

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

/**
 * Fragt den Status eines Jobs ab und liefert bei Erfolg die Video-URL.
 * @returns {Promise<{ state: 'queued'|'running'|'succeeded'|'failed', videoUrl?: string, failMsg?: string }>}
 */
export async function seedanceTaskState({ statusUrl, responseUrl } = {}) {
  if (!falApiKey()) throw seedanceError('server_misconfigured_missing_fal_key', null, 500)

  const resolvedStatusUrl = deriveStatusUrl(statusUrl, responseUrl)
  const resolvedResponseUrl = String(responseUrl || '').trim()
  if (!resolvedStatusUrl) throw seedanceError('missing_status_url', null, 400)

  const { response, data } = await falFetchAbsolute(resolvedStatusUrl)
  if (!response.ok) {
    throw seedanceError(
      formatFalErrorMessage(data) || 'fal_status_failed',
      data,
      response.status
    )
  }

  const status = String(data?.status || '').toUpperCase()

  if (status === 'IN_QUEUE') return { state: 'queued' }
  if (status === 'IN_PROGRESS') return { state: 'running' }

  if (status === 'COMPLETED') {
    const resultUrl = resolvedResponseUrl.startsWith('http')
      ? resolvedResponseUrl
      : (typeof data?.response_url === 'string' ? data.response_url : resolvedStatusUrl.replace(/\/status$/, ''))

    const { response: rRes, data: rData } = await falFetchAbsolute(resultUrl)
    if (!rRes.ok) {
      throw seedanceError(
        formatFalErrorMessage(rData) || 'fal_result_failed',
        rData,
        rRes.status
      )
    }
    const videoUrl = rData?.video?.url || rData?.data?.video?.url
    if (videoUrl && String(videoUrl).startsWith('http')) {
      return { state: 'succeeded', videoUrl: String(videoUrl) }
    }
    return { state: 'failed', failMsg: 'no_video_in_result' }
  }

  if (status === 'FAILED' || status === 'CANCELLED') {
    return {
      state: 'failed',
      failMsg: formatFalErrorMessage(data?.error) || status.toLowerCase(),
    }
  }

  return { state: 'running' }
}

export { SEEDANCE_MODEL }
