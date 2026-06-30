// ElevenLabs Text-to-Speech via kie.ai jobs API. Uses the server-side KIE key.
// Same createTask / recordInfo pattern as kie-image-edit.mjs.
import { kieApiKey, kieApiFetch } from './kie.mjs'

const TTS_MODEL = (process.env.KIE_TTS_MODEL || 'elevenlabs/text-to-speech-multilingual-v2').replace(/^\/+/, '')

function ttsError(code, detail, status) {
  const err = new Error(code); err.detail = detail; err.status = status; return err
}

export async function kieTtsCreateTask(input = {}) {
  if (!kieApiKey()) throw ttsError('server_misconfigured_missing_kie_key', null, 500)
  const text = String(input.text || '').trim()
  if (!text) throw ttsError('missing_text', null, 400)

  const apiInput = {
    text: text.slice(0, 5000),
    voice: String(input.voice || 'ErXwobaYiN019PkySvjV').trim(), // default: young male
    stability: Number.isFinite(+input.stability) ? +input.stability : 0.4,
    similarity_boost: Number.isFinite(+input.similarity_boost) ? +input.similarity_boost : 0.85,
    style: Number.isFinite(+input.style) ? +input.style : 0.35,
    speed: Number.isFinite(+input.speed) ? +input.speed : 1.05,
  }

  const { response, data } = await kieApiFetch('/api/v1/jobs/createTask', {
    method: 'POST',
    body: { model: TTS_MODEL, input: apiInput },
  })
  if (!response.ok) throw ttsError(data?.msg || data?.message || 'kie_tts_submit_failed', data, response.status)
  const taskId = data?.data?.taskId || data?.data?.task_id
  if (!taskId) throw ttsError('kie_missing_task_id', data, response.status)
  return { taskId: String(taskId) }
}

export async function kieTtsTaskState({ taskId } = {}) {
  if (!kieApiKey()) throw ttsError('server_misconfigured_missing_kie_key', null, 500)
  const id = String(taskId || '').trim()
  if (!id) throw ttsError('missing_task_id', null, 400)

  const { response, data } = await kieApiFetch(`/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(id)}`)
  if (!response.ok) throw ttsError(data?.msg || data?.message || 'kie_tts_status_failed', data, response.status)

  const d = data?.data || {}
  const state = String(d.state || '').toLowerCase()
  if (state === 'waiting' || state === 'queuing') return { state: 'queued' }
  if (state === 'generating' || state === '') return { state: 'running' }

  if (state === 'success') {
    let urls = []
    try {
      const parsed = JSON.parse(d.resultJson || '{}')
      if (Array.isArray(parsed?.resultUrls)) urls = parsed.resultUrls
    } catch { /* ignore */ }
    // tolerate other shapes
    if (!urls.length && Array.isArray(d.resultUrls)) urls = d.resultUrls
    if (!urls.length && typeof d.audioUrl === 'string') urls = [d.audioUrl]
    const audioUrl = urls.find((u) => String(u || '').startsWith('http'))
    if (audioUrl) return { state: 'succeeded', audioUrl: String(audioUrl) }
    return { state: 'failed', failMsg: 'no_audio_in_result' }
  }
  if (state === 'fail') return { state: 'failed', failMsg: d.failMsg || d.failCode || 'generation_failed' }
  return { state: 'running' }
}
