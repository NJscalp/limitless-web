// Image- und Video-Upscaling über die fal-Queue.
// Nutzt den server-seitig hinterlegten FAL_KEY (siehe fal.mjs).
//
// Modelle (per Env überschreibbar):
//   Bild:  fal-ai/clarity-upscaler
//   Video: fal-ai/topaz/upscale/video

import {
  falApiKey,
  falQueueFetch,
  falFetchAbsolute,
  base64ToDataUri,
  formatFalErrorMessage,
} from './fal.mjs'

const IMAGE_MODEL = (process.env.UPSCALE_IMAGE_MODEL || 'fal-ai/clarity-upscaler').replace(/^\/+/, '')
const VIDEO_MODEL = (process.env.UPSCALE_VIDEO_MODEL || 'fal-ai/topaz/upscale/video').replace(/^\/+/, '')

function upscaleError(code, detail, status) {
  const err = new Error(code)
  err.detail = detail
  err.status = status
  return err
}

function clampFactor(raw, fallback = 2) {
  const n = Math.round(Number(raw))
  if (!Number.isFinite(n)) return fallback
  return Math.min(4, Math.max(2, n))
}

/**
 * Reicht einen Upscale-Job bei fal ein.
 * @param {{ type?: string, image?: string, video?: string, imageUrl?: string, videoUrl?: string, factor?: number }} input
 * @returns {Promise<{ taskId: string, statusUrl: string|null, responseUrl: string|null }>}
 */
export async function upscaleCreateTask(input = {}) {
  if (!falApiKey()) throw upscaleError('server_misconfigured_missing_fal_key', null, 500)

  const isVideo = String(input.type || '').toLowerCase() === 'video'
  const factor = clampFactor(input.factor)

  let model
  let body

  if (isVideo) {
    const urlRaw = String(input.videoUrl || '').trim()
    const url = urlRaw.startsWith('http')
      ? urlRaw
      : (input.video ? base64ToDataUri(String(input.video), 'video/mp4') : null)
    if (!url) throw upscaleError('missing_video', null, 400)
    model = VIDEO_MODEL
    body = { video_url: url, upscale_factor: factor }
  } else {
    const urlRaw = String(input.imageUrl || '').trim()
    const url = urlRaw.startsWith('http')
      ? urlRaw
      : (input.image ? base64ToDataUri(String(input.image), 'image/jpeg') : null)
    if (!url) throw upscaleError('missing_image', null, 400)
    model = IMAGE_MODEL
    body = { image_url: url, upscale_factor: factor }
  }

  const { response, data } = await falQueueFetch(`/${model}`, { method: 'POST', body })
  if (!response.ok) {
    throw upscaleError(formatFalErrorMessage(data) || 'fal_submit_failed', data, response.status)
  }

  const requestId = data?.request_id
  if (!requestId) throw upscaleError('fal_missing_request_id', data, response.status)

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

function pickResultUrl(data, isVideo) {
  const buckets = [data, data?.data, data?.response, data?.output].filter(Boolean)
  for (const bucket of buckets) {
    if (isVideo) {
      const v = bucket?.video?.url || bucket?.video_url
      if (v && String(v).startsWith('http')) return String(v)
    } else {
      const img = bucket?.image?.url
        || (Array.isArray(bucket?.images) ? bucket.images.map((i) => i?.url).find(Boolean) : null)
      if (img && String(img).startsWith('http')) return String(img)
    }
    if (typeof bucket?.url === 'string' && bucket.url.startsWith('http')) return bucket.url
  }
  return null
}

/**
 * Fragt den Status eines Upscale-Jobs ab.
 * @returns {Promise<{ state: 'queued'|'running'|'succeeded'|'failed', resultUrl?: string, failMsg?: string }>}
 */
export async function upscaleTaskState({ statusUrl, responseUrl, type } = {}) {
  if (!falApiKey()) throw upscaleError('server_misconfigured_missing_fal_key', null, 500)

  const isVideo = String(type || '').toLowerCase() === 'video'
  const resolvedStatusUrl = deriveStatusUrl(statusUrl, responseUrl)
  const resolvedResponseUrl = String(responseUrl || '').trim()
  if (!resolvedStatusUrl) throw upscaleError('missing_status_url', null, 400)

  const { response, data } = await falFetchAbsolute(resolvedStatusUrl)
  if (!response.ok) {
    throw upscaleError(formatFalErrorMessage(data) || 'fal_status_failed', data, response.status)
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
      throw upscaleError(formatFalErrorMessage(rData) || 'fal_result_failed', rData, rRes.status)
    }
    const url = pickResultUrl(rData, isVideo) || pickResultUrl(data, isVideo)
    if (url) return { state: 'succeeded', resultUrl: url }
    return { state: 'failed', failMsg: 'no_result' }
  }

  if (status === 'FAILED' || status === 'CANCELLED') {
    return { state: 'failed', failMsg: formatFalErrorMessage(data?.error) || status.toLowerCase() }
  }

  return { state: 'running' }
}

export { IMAGE_MODEL, VIDEO_MODEL }
