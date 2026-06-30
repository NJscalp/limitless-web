// Lip-Sync über die kie.ai Jobs-API (statt fal). Treibt die Mundbewegung eines
// Videos passend zu einer Audiospur (Video-zu-Video) – robust auch für Cartoon-
// Charaktere, da auf dem bereits animierten Clip gearbeitet wird. Modell per
// Env (KIE_LIPSYNC_MODEL) ODER pro Request (input.model) wählbar → leicht auf das
// jeweils beste kie-Lip-Sync-Modell umstellbar. Gleiches createTask/recordInfo-
// Muster wie kie-tts.mjs / kie-image-edit.mjs.
import { kieApiKey, kieApiFetch } from './kie.mjs'

const LIPSYNC_MODEL = (process.env.KIE_LIPSYNC_MODEL || 'volcengine/video-to-video-lip-sync').replace(/^\/+/, '')

function lsError(code, detail, status) {
  const e = new Error(code); e.detail = detail; e.status = status; return e
}

export async function kieLipsyncCreateTask(input = {}) {
  if (!kieApiKey()) throw lsError('server_misconfigured_missing_kie_key', null, 500)
  const model = String(input.model || LIPSYNC_MODEL).replace(/^\/+/, '')

  // Flexible Eingabe: Video-zu-Video (video_url) ODER Bild-zu-Video (image_url),
  // jeweils + audio_url. Beide gängigen Feldnamen mitsenden (Modelle variieren).
  const apiInput = {}
  const video = String(input.videoUrl || input.video_url || '').trim()
  const image = String(input.imageUrl || input.image_url || '').trim()
  const audio = String(input.audioUrl || input.audio_url || '').trim()
  if (video) { apiInput.video_url = video }
  if (image) { apiInput.image_url = image }
  if (audio) { apiInput.audio_url = audio }
  if (input.prompt) apiInput.prompt = String(input.prompt)
  if (input.resolution) apiInput.resolution = String(input.resolution)
  // volcengine/video-to-video-lip-sync verlangt zusätzlich `mode` und richtet
  // die Audiospur am Video aus (`align_audio`) für saubere Synchronität.
  apiInput.mode = String(input.mode || process.env.KIE_LIPSYNC_MODE || 'lite')
  apiInput.align_audio = true

  if (!audio || (!video && !image)) throw lsError('missing_lipsync_input', null, 400)

  const { response, data } = await kieApiFetch('/api/v1/jobs/createTask', {
    method: 'POST',
    body: { model, input: apiInput },
  })
  if (!response.ok) throw lsError(data?.msg || data?.message || 'kie_lipsync_submit_failed', data, response.status)
  const taskId = data?.data?.taskId || data?.data?.task_id
  if (!taskId) throw lsError('kie_missing_task_id', data, response.status)
  return { taskId: String(taskId), model }
}

export async function kieLipsyncTaskState({ taskId } = {}) {
  if (!kieApiKey()) throw lsError('server_misconfigured_missing_kie_key', null, 500)
  const id = String(taskId || '').trim()
  if (!id) throw lsError('missing_task_id', null, 400)

  const { response, data } = await kieApiFetch(`/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(id)}`)
  if (!response.ok) throw lsError(data?.msg || data?.message || 'kie_lipsync_status_failed', data, response.status)

  const d = data?.data || {}
  const state = String(d.state || '').toLowerCase()
  if (state === 'waiting' || state === 'queuing') return { state: 'queued' }
  if (state === 'generating' || state === '') return { state: 'running' }

  if (state === 'success') {
    let urls = []
    try { const p = JSON.parse(d.resultJson || '{}'); if (Array.isArray(p?.resultUrls)) urls = p.resultUrls } catch { /* ignore */ }
    if (!urls.length && Array.isArray(d.resultUrls)) urls = d.resultUrls
    if (!urls.length && typeof d.videoUrl === 'string') urls = [d.videoUrl]
    const videoUrl = urls.find((u) => String(u || '').startsWith('http'))
    if (videoUrl) return { state: 'succeeded', videoUrl: String(videoUrl) }
    return { state: 'failed', failMsg: 'no_video_in_result' }
  }
  if (state === 'fail') return { state: 'failed', failMsg: d.failMsg || d.failCode || 'generation_failed' }
  return { state: 'running' }
}

export { LIPSYNC_MODEL }
