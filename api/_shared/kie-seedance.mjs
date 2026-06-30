// Seedance 2.0 (Fast) — Reference-to-Video über die kie.ai Jobs-API.
// Nutzt den server-seitig hinterlegten KIE_API_KEY.
//
// Ablauf:
//   1. Base64-Referenzbilder → kie File-Upload (liefert öffentliche URLs)
//   2. POST /api/v1/jobs/createTask  → liefert taskId
//   3. GET  /api/v1/jobs/recordInfo?taskId=…  → pollt bis success/fail
//
// Statuswerte von kie: waiting | queuing | generating | success | fail

import { kieApiKey, kieApiFetch } from './kie.mjs'

const KIE_UPLOAD_URL = (
  process.env.KIE_UPLOAD_URL || 'https://kieai.redpandaai.co/api/file-base64-upload'
).replace(/\/?$/, '')

const KIE_SEEDANCE_MODEL = (
  process.env.KIE_SEEDANCE_MODEL || 'bytedance/seedance-2-fast'
).replace(/^\/+/, '')

const KIE_KLING_VIDEO_MODEL = (
  process.env.KIE_KLING_VIDEO_MODEL || 'kling-3.0/video'
).replace(/^\/+/, '')

const ALLOWED_RATIOS = new Set(['16:9', '4:3', '1:1', '3:4', '9:16', '21:9'])
// Seedance auf kie akzeptiert diese Längen direkt.
const ALLOWED_DURATIONS = new Set([5, 10, 15])

// Wählbare Auflösung (App-Menü). Default 480p aus Kostengründen; 720p wird
// in der App teurer abgerechnet, damit die Marge positiv bleibt.
const ALLOWED_RESOLUTIONS = new Set(['480p', '720p'])
const DEFAULT_RESOLUTION = '480p'

function normalizeResolution(raw) {
  const v = String(raw || '').trim().toLowerCase()
  return ALLOWED_RESOLUTIONS.has(v) ? v : DEFAULT_RESOLUTION
}

function kieError(code, detail, status) {
  const err = new Error(code)
  err.detail = detail
  err.status = status
  return err
}

function normalizeRatio(raw) {
  const v = String(raw || '9:16').trim()
  if (v === 'adaptive' || v === 'auto') return '9:16'
  return ALLOWED_RATIOS.has(v) ? v : '9:16'
}

function base64ToDataUri(raw, mime = 'image/jpeg') {
  const trimmed = String(raw || '').trim()
  if (!trimmed) return null
  return trimmed.startsWith('data:') ? trimmed : `data:${mime};base64,${trimmed}`
}

/**
 * Lädt eine Base64-Datei bei kie hoch und gibt die öffentliche URL zurück.
 * Standardmäßig als JPEG; für Videos `mime`/`uploadPath` setzen.
 */
export async function kieUploadBase64(base64, fileName, { mime = 'image/jpeg', uploadPath = 'clavic/seedance' } = {}) {
  const dataUri = base64ToDataUri(base64, mime)
  if (!dataUri) throw kieError('missing_image_base64', null, 400)

  const response = await fetch(KIE_UPLOAD_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${kieApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      base64Data: dataUri,
      uploadPath,
      fileName: fileName || `ref-${Date.now()}.jpg`,
    }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw kieError('kie_upload_failed', data, response.status)
  }

  const d = data?.data || {}
  const url = d.downloadUrl || d.fileUrl || d.url || d.fileDownloadUrl
  if (!url || !String(url).startsWith('http')) {
    throw kieError('kie_upload_no_url', data, response.status)
  }
  return String(url)
}

/**
 * Reicht einen Reference-to-Video-Job bei kie ein.
 * @param {{ prompt: string, images?: string[], imageUrls?: string[], videoUrls?: string[], resolution?: string, duration?: number|string, aspectRatio?: string, generateAudio?: boolean, fast?: boolean }} input
 * @returns {Promise<{ taskId: string }>}
 */
export async function kieSeedanceCreateTask(input = {}) {
  if (!kieApiKey()) throw kieError('server_misconfigured_missing_kie_key', null, 500)

  const prompt = String(input.prompt || '').trim()
  if (!prompt) throw kieError('missing_prompt', null, 400)

  const imageUrls = []
  if (Array.isArray(input.imageUrls)) {
    for (const u of input.imageUrls) {
      const url = String(u || '').trim()
      if (url.startsWith('http')) imageUrls.push(url)
    }
  }
  // Base64-Bilder zuerst zu kie-URLs hochladen.
  if (Array.isArray(input.images)) {
    let i = 0
    for (const b of input.images) {
      const raw = String(b || '').trim()
      if (!raw) continue
      const uploaded = await kieUploadBase64(raw, `ref-${Date.now()}-${i++}.jpg`)
      imageUrls.push(uploaded)
    }
  }

  const videoUrls = []
  if (Array.isArray(input.videoUrls)) {
    for (const u of input.videoUrls) {
      const url = String(u || '').trim()
      if (url.startsWith('http')) videoUrls.push(url)
    }
  }
  // Vom Nutzer hochgeladene Referenz-Videos (Base64) zuerst zu kie-URLs hochladen
  // (Motion-Studio: eigenes Video als @Video1).
  if (Array.isArray(input.videos)) {
    let vi = 0
    for (const b of input.videos) {
      const raw = String(b || '').trim()
      if (!raw) continue
      const uploaded = await kieUploadBase64(raw, `motion-${Date.now()}-${vi++}.mp4`, {
        mime: 'video/mp4',
        uploadPath: 'clavic/motion',
      })
      videoUrls.push(uploaded)
    }
  }

  // Pro-Request-Override (z. B. "bytedance/seedance-2-mini" für günstigere i2v).
  // Ohne Override: globales Default-Modell (Day-One-App bleibt unberührt).
  const model = String(input.model || '').trim()
    || (input.fast === false ? KIE_SEEDANCE_MODEL.replace('-fast', '') : KIE_SEEDANCE_MODEL)

  const apiInput = {
    prompt,
    resolution: normalizeResolution(input.resolution),
    aspect_ratio: normalizeRatio(input.aspectRatio),
    generate_audio: input.generateAudio !== false,
  }
  if (imageUrls.length) apiInput.reference_image_urls = imageUrls.slice(0, 9)
  if (videoUrls.length) apiInput.reference_video_urls = videoUrls.slice(0, 3)
  // Erlaubte Längen (5/10/15 s) werden gesendet - auch bei Reference-Video,
  // damit laengere Clips bis 15 s moeglich sind statt dem Default ~5 s.
  const durNum = Math.round(Number(input.duration))
  if (ALLOWED_DURATIONS.has(durNum)) {
    apiInput.duration = durNum
  }

  const { response, data } = await kieApiFetch('/api/v1/jobs/createTask', {
    method: 'POST',
    body: { model, input: apiInput },
  })

  if (!response.ok) {
    throw kieError(data?.msg || data?.message || 'kie_submit_failed', data, response.status)
  }

  const taskId = data?.data?.taskId || data?.data?.task_id
  if (!taskId) throw kieError('kie_missing_task_id', data, response.status)

  return { taskId: String(taskId), model }
}

/**
 * Kling 3.0 image-to-video (model `kling-3.0/video`). Unterstützt multi_shots
 * (mehrere Szenen via multi_prompt) ODER einen einzelnen prompt. Bilder werden
 * als base64 hochgeladen (→ image_urls). Status läuft über kieSeedanceTaskState.
 */
export async function kieKlingVideoCreateTask(input = {}) {
  if (!kieApiKey()) throw kieError('server_misconfigured_missing_kie_key', null, 500)

  let imageUrls = []
  if (Array.isArray(input.imageUrls)) {
    imageUrls = input.imageUrls.filter((u) => String(u || '').startsWith('http'))
  }
  if (!imageUrls.length && Array.isArray(input.images)) {
    for (const b of input.images.slice(0, 4)) {
      const url = await kieUploadBase64(b, `kling-${Date.now()}.jpg`, { uploadPath: 'clavic/kling' })
      if (url) imageUrls.push(url)
    }
  }
  if (!imageUrls.length) throw kieError('missing_image', null, 400)

  const apiInput = {
    image_urls: imageUrls.slice(0, 2),
    duration: String(input.duration || '5'),
    aspect_ratio: input.aspectRatio || input.aspect_ratio || '9:16',
    mode: input.mode || 'std',
  }
  const shots = Array.isArray(input.multiPrompt) ? input.multiPrompt
    : (Array.isArray(input.multi_prompt) ? input.multi_prompt : null)
  if (shots && shots.length) {
    apiInput.multi_shots = true
    apiInput.multi_prompt = shots.map((s) => ({
      prompt: String(s.prompt || '').slice(0, 500),
      duration: Math.max(1, Math.min(12, Math.round(Number(s.duration) || 3))),
    }))
  } else {
    apiInput.multi_shots = false
    apiInput.prompt = String(input.prompt || '').slice(0, 2000)
  }
  if (input.sound != null) apiInput.sound = !!input.sound

  const { response, data } = await kieApiFetch('/api/v1/jobs/createTask', {
    method: 'POST',
    body: { model: KIE_KLING_VIDEO_MODEL, input: apiInput },
  })
  if (!response.ok) throw kieError(data?.msg || data?.message || 'kie_kling_video_submit_failed', data, response.status)
  const taskId = data?.data?.taskId || data?.data?.task_id
  if (!taskId) throw kieError('kie_missing_task_id', data, response.status)
  return { taskId: String(taskId), model: KIE_KLING_VIDEO_MODEL }
}

/**
 * Fragt den Status eines kie-Jobs ab und liefert bei Erfolg die Video-URL.
 * @returns {Promise<{ state: 'queued'|'running'|'succeeded'|'failed', videoUrl?: string, failMsg?: string }>}
 */
export async function kieSeedanceTaskState({ taskId } = {}) {
  if (!kieApiKey()) throw kieError('server_misconfigured_missing_kie_key', null, 500)

  const id = String(taskId || '').trim()
  if (!id) throw kieError('missing_task_id', null, 400)

  const { response, data } = await kieApiFetch(
    `/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(id)}`
  )
  if (!response.ok) {
    throw kieError(data?.msg || data?.message || 'kie_status_failed', data, response.status)
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
    const videoUrl = urls.find((u) => String(u || '').startsWith('http'))
    if (videoUrl) return { state: 'succeeded', videoUrl: String(videoUrl) }
    return { state: 'failed', failMsg: 'no_video_in_result' }
  }

  if (state === 'fail') {
    return { state: 'failed', failMsg: d.failMsg || d.failCode || 'generation_failed' }
  }

  return { state: 'running' }
}

/**
 * Reicht einen Kling 3.0 Motion-Control-Job bei kie ein.
 * Überträgt die Bewegung aus dem Referenzvideo auf das Motiv im Bild.
 * background_source "input_image" behält den Hintergrund des Bildes.
 * @param {{ prompt?: string, images?: string[], imageUrls?: string[], videos?: string[], videoUrls?: string[], mode?: string, characterOrientation?: string, backgroundSource?: string }} input
 * @returns {Promise<{ taskId: string }>}
 */
export async function kieKlingMotionCreateTask(input = {}) {
  if (!kieApiKey()) throw kieError('server_misconfigured_missing_kie_key', null, 500)

  // Bild-URL(s) auflösen (gehostet oder base64 → upload)
  const imgUrls = []
  if (Array.isArray(input.imageUrls)) {
    for (const u of input.imageUrls) {
      const url = String(u || '').trim()
      if (url.startsWith('http')) imgUrls.push(url)
    }
  }
  if (Array.isArray(input.images)) {
    let i = 0
    for (const b of input.images) {
      const raw = String(b || '').trim()
      if (!raw) continue
      const up = await kieUploadBase64(raw, `kling-img-${Date.now()}-${i++}.jpg`, {
        mime: 'image/jpeg',
        uploadPath: 'clavic/kling',
      })
      imgUrls.push(up)
    }
  }

  // Video-URL(s) auflösen (gehostet oder base64 → upload)
  const vidUrls = []
  if (Array.isArray(input.videoUrls)) {
    for (const u of input.videoUrls) {
      const url = String(u || '').trim()
      if (url.startsWith('http')) vidUrls.push(url)
    }
  }
  if (Array.isArray(input.videos)) {
    let i = 0
    for (const b of input.videos) {
      const raw = String(b || '').trim()
      if (!raw) continue
      const up = await kieUploadBase64(raw, `kling-vid-${Date.now()}-${i++}.mp4`, {
        mime: 'video/mp4',
        uploadPath: 'clavic/kling',
      })
      vidUrls.push(up)
    }
  }

  if (!imgUrls.length) throw kieError('missing_image', null, 400)
  if (!vidUrls.length) throw kieError('missing_video', null, 400)

  const apiInput = {
    input_urls: imgUrls.slice(0, 1),
    video_urls: vidUrls.slice(0, 1),
    character_orientation: input.characterOrientation === 'image' ? 'image' : 'video',
    background_source: input.backgroundSource === 'input_image' ? 'input_image' : 'input_video',
    mode: String(input.mode || '720p').trim(),
  }
  const p = String(input.prompt || '').trim()
  if (p) apiInput.prompt = p

  const { response, data } = await kieApiFetch('/api/v1/jobs/createTask', {
    method: 'POST',
    body: { model: 'kling-3.0/motion-control', input: apiInput },
  })
  if (!response.ok) {
    throw kieError(data?.msg || data?.message || 'kie_kling_submit_failed', data, response.status)
  }
  const taskId = data?.data?.taskId || data?.data?.task_id
  if (!taskId) throw kieError('kie_missing_task_id', data, response.status)
  return { taskId: String(taskId) }
}

export { KIE_SEEDANCE_MODEL }
