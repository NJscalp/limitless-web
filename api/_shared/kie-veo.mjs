// Google Veo 3.1 (image-to-video MIT nativem Dialog-Ton) über die kie.ai
// Veo-API. Genau wie bei Zyvos "AI Fruit Story": ein Keyframe (GPT Image 2)
// wird zu einem ~8-s-Clip animiert, in dem die 3D-Frucht-Charaktere wirklich
// SPRECHEN (Veo erzeugt Lippensync + Stimme aus dem Szenen-/Dialog-Prompt).
//
// Ablauf:
//   1. Base64-Keyframe → kie File-Upload (öffentliche URL)
//   2. POST /api/v1/veo/generate        → liefert taskId
//   3. GET  /api/v1/veo/record-info?... → pollt (successFlag 0/1/2/3)
//
// Nutzt den server-seitig hinterlegten KIE_API_KEY (wie Seedance/Kling).

import { kieApiKey, kieApiFetch } from './kie.mjs'
import { kieUploadBase64 } from './kie-seedance.mjs'

// veo3_fast = Veo 3.1 Fast (günstig, mit Audio); veo3 = volle Qualität.
const KIE_VEO_MODEL = (process.env.KIE_VEO_MODEL || 'veo3_fast').trim()
const ALLOWED_VEO_MODELS = new Set(['veo3', 'veo3_fast', 'veo3_lite'])
// Veo erlaubt nur 16:9, 9:16 oder Auto.
const ALLOWED_VEO_RATIOS = new Set(['16:9', '9:16', 'Auto'])
// Veo-Clip-Längen.
const ALLOWED_VEO_DURATIONS = new Set([4, 6, 8])

function veoError(code, detail, status) {
  const err = new Error(code)
  err.detail = detail
  err.status = status
  return err
}

function normalizeVeoModel(raw) {
  const v = String(raw || '').trim()
  if (ALLOWED_VEO_MODELS.has(v)) return v
  return ALLOWED_VEO_MODELS.has(KIE_VEO_MODEL) ? KIE_VEO_MODEL : 'veo3_fast'
}

function normalizeVeoRatio(raw) {
  const v = String(raw || '9:16').trim()
  if (v === 'adaptive' || v === 'auto') return 'Auto'
  return ALLOWED_VEO_RATIOS.has(v) ? v : '9:16'
}

/**
 * Reicht einen Veo-3.1-Image-to-Video-Job bei kie ein.
 * @param {{ prompt: string, images?: string[], imageUrls?: string[], aspectRatio?: string, model?: string, resolution?: string, duration?: number }} input
 * @returns {Promise<{ taskId: string }>}
 */
export async function kieVeoCreateTask(input = {}) {
  if (!kieApiKey()) throw veoError('server_misconfigured_missing_kie_key', null, 500)

  const prompt = String(input.prompt || '').trim()
  if (!prompt) throw veoError('missing_prompt', null, 400)

  // Keyframe-URL(s) auflösen (gehostet oder base64 → upload). Veo akzeptiert 1-3.
  const imageUrls = []
  if (Array.isArray(input.imageUrls)) {
    for (const u of input.imageUrls) {
      const url = String(u || '').trim()
      if (url.startsWith('http')) imageUrls.push(url)
    }
  }
  if (Array.isArray(input.images)) {
    let i = 0
    for (const b of input.images) {
      const raw = String(b || '').trim()
      if (!raw) continue
      const uploaded = await kieUploadBase64(raw, `veo-${Date.now()}-${i++}.jpg`, {
        mime: 'image/jpeg',
        uploadPath: 'clavic/veo',
      })
      imageUrls.push(uploaded)
    }
  }

  const body = {
    model: normalizeVeoModel(input.model),
    prompt,
    aspect_ratio: normalizeVeoRatio(input.aspectRatio),
  }
  if (imageUrls.length) body.imageUrls = imageUrls.slice(0, 3)
  const res = String(input.resolution || '').trim().toLowerCase()
  if (res === '720p' || res === '1080p') body.resolution = res
  const durNum = Math.round(Number(input.duration))
  if (ALLOWED_VEO_DURATIONS.has(durNum)) body.duration = durNum

  const { response, data } = await kieApiFetch('/api/v1/veo/generate', {
    method: 'POST',
    body,
  })
  if (!response.ok) {
    throw veoError(data?.msg || data?.message || 'kie_veo_submit_failed', data, response.status)
  }
  const taskId = data?.data?.taskId || data?.data?.task_id
  if (!taskId) throw veoError('kie_missing_task_id', data, response.status)
  return { taskId: String(taskId) }
}

/**
 * Fragt den Status eines Veo-Jobs ab und liefert bei Erfolg die Video-URL.
 * successFlag: 0=generating, 1=success, 2/3=failed.
 * @returns {Promise<{ state: 'queued'|'running'|'succeeded'|'failed', videoUrl?: string, failMsg?: string }>}
 */
export async function kieVeoTaskState({ taskId } = {}) {
  if (!kieApiKey()) throw veoError('server_misconfigured_missing_kie_key', null, 500)

  const id = String(taskId || '').trim()
  if (!id) throw veoError('missing_task_id', null, 400)

  const { response, data } = await kieApiFetch(
    `/api/v1/veo/record-info?taskId=${encodeURIComponent(id)}`
  )
  if (!response.ok) {
    throw veoError(data?.msg || data?.message || 'kie_veo_status_failed', data, response.status)
  }

  const d = data?.data || {}
  const flag = Number(d.successFlag)

  if (flag === 1) {
    let urls = []
    try {
      const parsed = JSON.parse(d.resultUrls || d.response?.resultUrls || '[]')
      if (Array.isArray(parsed)) urls = parsed
    } catch {
      // resultUrls kann bereits ein Array sein
      if (Array.isArray(d.resultUrls)) urls = d.resultUrls
    }
    const videoUrl = urls.find((u) => String(u || '').startsWith('http'))
    if (videoUrl) return { state: 'succeeded', videoUrl: String(videoUrl) }
    return { state: 'failed', failMsg: 'no_video_in_result' }
  }

  if (flag === 2 || flag === 3) {
    return { state: 'failed', failMsg: d.errorMessage || d.failMsg || 'veo_generation_failed' }
  }

  // 0 oder unbekannt → läuft noch
  return { state: 'running' }
}

export { KIE_VEO_MODEL }
