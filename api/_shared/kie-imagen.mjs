// Google Imagen 4 (inkl. Ultra-Modus) — Text-to-Image über die kie.ai Jobs-API.
// Nutzt den server-seitig hinterlegten KIE_API_KEY.
//
// Ablauf:
//   1. POST /api/v1/jobs/createTask  (model "google/imagen4") → liefert taskId
//   2. GET  /api/v1/jobs/recordInfo?taskId=…  → pollt bis success/fail
//      (Status-Polling teilt sich die Logik aus kie-image-edit.mjs.)
//
// Wichtig: Imagen 4 ist rein Text-to-Image — es akzeptiert KEIN Bild-Input
// und kann daher keine Fotos editieren. Für Bild-Edits stattdessen
// kie-image-edit.mjs (GPT Image 2 / Nano Banana Pro) nutzen.

import { kieApiKey, kieApiFetch } from './kie.mjs'

const KIE_IMAGEN_MODEL = (process.env.KIE_IMAGEN_MODEL || 'google/imagen4').replace(/^\/+/, '')

const ALLOWED_RATIOS = new Set(['1:1', '16:9', '9:16', '3:4', '4:3', 'auto'])

function kieError(code, detail, status) {
  const err = new Error(code)
  err.detail = detail
  err.status = status
  return err
}

function normalizeRatio(raw) {
  const v = String(raw || '1:1').trim()
  return ALLOWED_RATIOS.has(v) ? v : '1:1'
}

/**
 * Reicht einen Imagen-4-Text-to-Image-Job bei kie ein.
 * @param {{ prompt: string, aspectRatio?: string, negativePrompt?: string, seed?: string }} input
 * @returns {Promise<{ taskId: string, model: string }>}
 */
export async function kieImagenCreateTask(input = {}) {
  if (!kieApiKey()) throw kieError('server_misconfigured_missing_kie_key', null, 500)

  const prompt = String(input.prompt || '').trim()
  if (!prompt) throw kieError('missing_prompt', null, 400)

  const apiInput = {
    prompt,
    negative_prompt: String(input.negativePrompt || '').trim(),
    aspect_ratio: normalizeRatio(input.aspectRatio),
    seed: String(input.seed || '').trim(),
  }

  const { response, data } = await kieApiFetch('/api/v1/jobs/createTask', {
    method: 'POST',
    body: { model: KIE_IMAGEN_MODEL, input: apiInput },
  })

  if (!response.ok) {
    throw kieError(data?.msg || data?.message || 'kie_imagen_submit_failed', data, response.status)
  }

  const taskId = data?.data?.taskId || data?.data?.task_id
  if (!taskId) throw kieError('kie_missing_task_id', data, response.status)

  return { taskId: String(taskId), model: KIE_IMAGEN_MODEL }
}

export { KIE_IMAGEN_MODEL }
