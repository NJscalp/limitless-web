// Nano Banana 2 — Image Edit (Bild → Bild) über die kie.ai Jobs-API.
// Nutzt den server-seitig hinterlegten KIE_API_KEY.
//
// Ablauf:
//   1. Base64-Bilder → kie File-Upload (liefert öffentliche URLs)
//   2. POST /api/v1/jobs/createTask  (model "nano-banana-2") → liefert taskId
//   3. GET  /api/v1/jobs/recordInfo?taskId=…  → pollt bis success/fail
//
// Statuswerte von kie: waiting | queuing | generating | success | fail

import { kieApiKey, kieApiFetch } from './kie.mjs'
import { kieUploadBase64 } from './kie-seedance.mjs'

// GPT Image 2 (image-to-image) über kie.ai — realistischer als Nano-Banana.
const KIE_GPT_IMAGE_MODEL = (process.env.KIE_GPT_IMAGE_MODEL || 'gpt-image-2-image-to-image').replace(/^\/+/, '')

// Erlaubte Modell-Overrides (Client kann `model` mitschicken, z. B. für den
// Chat-Edit-Tab). Default bleibt GPT Image 2 — wird nur ersetzt, wenn ein
// gültiger Slug aus dieser Allowlist ankommt. Nicht gelistete Werte fallen
// bewusst auf GPT Image 2 zurück, damit die anderen Templates unangetastet
// bleiben und kein beliebiges Modell durchgereicht werden kann.
const KIE_MODEL_OVERRIDES = new Set([
  'nano-banana-pro',
  'nano-banana-2',
  'nano-banana',
])

function kieEditModelFor(rawModel) {
  const v = String(rawModel || '').trim().toLowerCase()
  return KIE_MODEL_OVERRIDES.has(v) ? v : KIE_GPT_IMAGE_MODEL
}

// Vom Client wählbare Auflösung (Qualität): 1K (low) / 2K (medium) / 4K (high).
const ALLOWED_RES = new Set(['1K', '2K', '4K'])
function normalizeResolution(raw) {
  const v = String(raw || '1K').trim().toUpperCase()
  return ALLOWED_RES.has(v) ? v : '1K'
}

const ALLOWED_RATIOS = new Set([
  'auto', '1:1', '3:2', '2:3', '4:3', '3:4', '5:4', '4:5',
  '16:9', '9:16', '2:1', '1:2', '3:1', '1:3', '21:9', '9:21',
])

function kieError(code, detail, status) {
  const err = new Error(code)
  err.detail = detail
  err.status = status
  return err
}

function normalizeRatio(raw) {
  const v = String(raw || 'auto').trim()
  return ALLOWED_RATIOS.has(v) ? v : 'auto'
}

/**
 * Reicht einen Image-Edit-Job bei kie ein.
 * @param {{ prompt: string, images?: string[], imageUrls?: string[], aspectRatio?: string, resolution?: string, model?: string }} input
 *   `model` (optional): Slug z. B. "nano-banana-pro" für den Chat-Edit-Tab.
 *   Fehlt der Wert oder ist er nicht in der Allowlist, wird GPT Image 2
 *   verwendet — die anderen Templates bleiben unangetastet.
 * @returns {Promise<{ taskId: string, model: string }>}
 */
export async function kieImageEditCreateTask(input = {}) {
  if (!kieApiKey()) throw kieError('server_misconfigured_missing_kie_key', null, 500)

  const prompt = String(input.prompt || '').trim()
  if (!prompt) throw kieError('missing_prompt', null, 400)

  const model = kieEditModelFor(input.model)

  const imageInput = []
  if (Array.isArray(input.imageUrls)) {
    for (const u of input.imageUrls) {
      const url = String(u || '').trim()
      if (url.startsWith('http')) imageInput.push(url)
    }
  }
  if (Array.isArray(input.images)) {
    let i = 0
    for (const b of input.images) {
      const raw = String(b || '').trim()
      if (!raw) continue
      const uploaded = await kieUploadBase64(raw, `edit-${Date.now()}-${i++}.jpg`)
      imageInput.push(uploaded)
    }
  }
  if (!imageInput.length) throw kieError('missing_image', null, 400)

  const ratio = normalizeRatio(input.aspectRatio)
  let resolution = normalizeResolution(input.resolution)
  // GPT Image 2: 1:1 unterstützt kein 4K → auf 2K herabstufen.
  if (ratio === '1:1' && resolution === '4K') resolution = '2K'
  const apiInput = {
    prompt,
    input_urls: imageInput.slice(0, 16),
    aspect_ratio: ratio,
    resolution,
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
 * Fragt den Status eines Nano-Banana-Jobs ab und liefert bei Erfolg die Bild-URL.
 * @returns {Promise<{ state: 'queued'|'running'|'succeeded'|'failed', imageUrl?: string, failMsg?: string }>}
 */
export async function kieImageEditTaskState({ taskId } = {}) {
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
    const imageUrl = urls.find((u) => String(u || '').startsWith('http'))
    if (imageUrl) return { state: 'succeeded', imageUrl: String(imageUrl) }
    return { state: 'failed', failMsg: 'no_image_in_result' }
  }

  if (state === 'fail') {
    return { state: 'failed', failMsg: d.failMsg || d.failCode || 'generation_failed' }
  }

  return { state: 'running' }
}

export { KIE_GPT_IMAGE_MODEL }
