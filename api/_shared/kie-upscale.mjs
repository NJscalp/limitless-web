// Image- & Video-Upscaling über kie.ai Topaz.
// Nutzt den server-seitig hinterlegten KIE_API_KEY.
//
// Modelle:
//   Bild:  topaz/image-upscale  (upscale_factor 1|2|4|8)
//   Video: topaz/video-upscale  (upscale_factor 1|2|4)
//
// Ablauf:
//   1. Base64-Datei → kie File-Upload (liefert öffentliche URL)
//   2. POST /api/v1/jobs/createTask → liefert taskId
//   3. GET  /api/v1/jobs/recordInfo?taskId=… → pollt bis success/fail

import { kieApiKey, kieApiFetch } from './kie.mjs'
import { kieUploadBase64 } from './kie-seedance.mjs'

const IMAGE_MODEL = (process.env.KIE_UPSCALE_IMAGE_MODEL || 'topaz/image-upscale').replace(/^\/+/, '')
const VIDEO_MODEL = (process.env.KIE_UPSCALE_VIDEO_MODEL || 'topaz/video-upscale').replace(/^\/+/, '')

function upscaleError(code, detail, status) {
  const err = new Error(code)
  err.detail = detail
  err.status = status
  return err
}

function clampFactor(raw, { max }) {
  const allowed = max === 8 ? [1, 2, 4, 8] : [1, 2, 4]
  const n = Math.round(Number(raw))
  if (!Number.isFinite(n)) return 2
  // nächstliegenden erlaubten Faktor wählen, mind. 2
  const candidate = allowed.includes(n) ? n : 2
  return Math.max(2, candidate)
}

/**
 * Reicht einen Topaz-Upscale-Job bei kie ein.
 * @param {{ type?: string, image?: string, video?: string, imageUrl?: string, videoUrl?: string, factor?: number }} input
 * @returns {Promise<{ taskId: string }>}
 */
export async function kieUpscaleCreateTask(input = {}) {
  if (!kieApiKey()) throw upscaleError('server_misconfigured_missing_kie_key', null, 500)

  const isVideo = String(input.type || '').toLowerCase() === 'video'

  let model
  let apiInput

  if (isVideo) {
    let url = String(input.videoUrl || '').trim()
    if (!url.startsWith('http')) {
      const raw = String(input.video || '').trim()
      if (!raw) throw upscaleError('missing_video', null, 400)
      url = await kieUploadBase64(raw, `upscale-${Date.now()}.mp4`, {
        mime: 'video/mp4',
        uploadPath: 'clavic/upscale',
      })
    }
    model = VIDEO_MODEL
    apiInput = { video_url: url, upscale_factor: String(clampFactor(input.factor, { max: 4 })) }
  } else {
    let url = String(input.imageUrl || '').trim()
    if (!url.startsWith('http')) {
      const raw = String(input.image || '').trim()
      if (!raw) throw upscaleError('missing_image', null, 400)
      url = await kieUploadBase64(raw, `upscale-${Date.now()}.jpg`, {
        mime: 'image/jpeg',
        uploadPath: 'clavic/upscale',
      })
    }
    model = IMAGE_MODEL
    apiInput = { image_url: url, upscale_factor: String(clampFactor(input.factor, { max: 8 })) }
  }

  const { response, data } = await kieApiFetch('/api/v1/jobs/createTask', {
    method: 'POST',
    body: { model, input: apiInput },
  })

  // kie antwortet teils mit HTTP 200, aber code!=200 im Body (z. B. Validierung).
  // Das explizit als Fehler werfen, statt nur „kie_missing_task_id" zu melden.
  const bodyCode = Number(data?.code)
  const bodyOk = !Number.isFinite(bodyCode) || bodyCode === 200
  if (!response.ok || !bodyOk) {
    throw upscaleError(data?.msg || data?.message || 'kie_submit_failed', data, response.status)
  }

  const taskId = data?.data?.taskId || data?.data?.task_id
  if (!taskId) throw upscaleError('kie_missing_task_id', data, response.status)

  return { taskId: String(taskId) }
}

/**
 * Fragt den Status eines Topaz-Upscale-Jobs ab.
 * @returns {Promise<{ state: 'queued'|'running'|'succeeded'|'failed', resultUrl?: string, failMsg?: string }>}
 */
export async function kieUpscaleTaskState({ taskId } = {}) {
  if (!kieApiKey()) throw upscaleError('server_misconfigured_missing_kie_key', null, 500)

  const id = String(taskId || '').trim()
  if (!id) throw upscaleError('missing_task_id', null, 400)

  const { response, data } = await kieApiFetch(
    `/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(id)}`
  )
  if (!response.ok) {
    throw upscaleError(data?.msg || data?.message || 'kie_status_failed', data, response.status)
  }

  const d = data?.data || {}
  const state = String(d.state || '').toLowerCase()

  if (state === 'waiting' || state === 'queuing') return { state: 'queued' }
  if (state === 'generating' || state === '') return { state: 'running' }

  if (state === 'success') {
    let urls = []
    try {
      const parsed = JSON.parse(d.resultJson || '{}')
      if (Array.isArray(parsed?.resultUrls)) urls = parsed.resultUrls
    } catch {
      // ignore parse errors
    }
    const resultUrl = urls.find((u) => String(u || '').startsWith('http'))
    if (resultUrl) return { state: 'succeeded', resultUrl: String(resultUrl) }
    return { state: 'failed', failMsg: 'no_result' }
  }

  if (state === 'fail') {
    return { state: 'failed', failMsg: d.failMsg || d.failCode || 'generation_failed' }
  }

  return { state: 'running' }
}

export { IMAGE_MODEL, VIDEO_MODEL }
