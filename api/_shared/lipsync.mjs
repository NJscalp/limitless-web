// Lip-Sync über die fal-Queue (fal-ai/sync-lipsync).
// Treibt die Mundbewegung eines Videos passend zu einer Audiospur und bettet
// diese Audiospur ins Ergebnis ein. Nutzt den server-seitig hinterlegten
// FAL_KEY (siehe fal.mjs). Wird vom "Du bist gut Genug"-Musikvideo-Template
// genutzt: jedes Seedance-Segment wird auf seinen Song-Abschnitt lippensynchron
// gemacht; die App fügt die Segmente danach lokal zusammen.

import {
  falApiKey,
  falQueueFetch,
  falFetchAbsolute,
  formatFalErrorMessage,
} from './fal.mjs'

const LIPSYNC_MODEL = (process.env.LIPSYNC_MODEL || 'fal-ai/sync-lipsync').replace(/^\/+/, '')

function lipsyncError(code, detail, status) {
  const err = new Error(code)
  err.detail = detail
  err.status = status
  return err
}

/**
 * Reicht einen Lip-Sync-Job bei fal ein.
 * @param {{ videoUrl?: string, audioUrl?: string }} input
 * @returns {Promise<{ taskId: string, statusUrl: string|null, responseUrl: string|null }>}
 */
export async function lipsyncCreateTask(input = {}) {
  if (!falApiKey()) throw lipsyncError('server_misconfigured_missing_fal_key', null, 500)

  const videoUrl = String(input.videoUrl || '').trim()
  const audioUrl = String(input.audioUrl || '').trim()
  if (!videoUrl.startsWith('http')) throw lipsyncError('missing_video_url', null, 400)
  if (!audioUrl.startsWith('http')) throw lipsyncError('missing_audio_url', null, 400)

  const body = { video_url: videoUrl, audio_url: audioUrl }

  const { response, data } = await falQueueFetch(`/${LIPSYNC_MODEL}`, { method: 'POST', body })
  if (!response.ok) {
    throw lipsyncError(formatFalErrorMessage(data) || 'fal_submit_failed', data, response.status)
  }

  const requestId = data?.request_id
  if (!requestId) throw lipsyncError('fal_missing_request_id', data, response.status)

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

function pickVideoUrl(data) {
  const buckets = [data, data?.data, data?.response, data?.output].filter(Boolean)
  for (const bucket of buckets) {
    const v = bucket?.video?.url || bucket?.video_url
    if (v && String(v).startsWith('http')) return String(v)
    if (typeof bucket?.url === 'string' && bucket.url.startsWith('http')) return bucket.url
  }
  return null
}

/**
 * Fragt den Status eines Lip-Sync-Jobs ab.
 * @returns {Promise<{ state: 'queued'|'running'|'succeeded'|'failed', videoUrl?: string, failMsg?: string }>}
 */
export async function lipsyncTaskState({ statusUrl, responseUrl } = {}) {
  if (!falApiKey()) throw lipsyncError('server_misconfigured_missing_fal_key', null, 500)

  const resolvedStatusUrl = deriveStatusUrl(statusUrl, responseUrl)
  const resolvedResponseUrl = String(responseUrl || '').trim()
  if (!resolvedStatusUrl) throw lipsyncError('missing_status_url', null, 400)

  const { response, data } = await falFetchAbsolute(resolvedStatusUrl)
  if (!response.ok) {
    throw lipsyncError(formatFalErrorMessage(data) || 'fal_status_failed', data, response.status)
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
      throw lipsyncError(formatFalErrorMessage(rData) || 'fal_result_failed', rData, rRes.status)
    }
    const url = pickVideoUrl(rData) || pickVideoUrl(data)
    if (url) return { state: 'succeeded', videoUrl: url }
    return { state: 'failed', failMsg: 'no_result' }
  }

  if (status === 'FAILED' || status === 'CANCELLED') {
    return { state: 'failed', failMsg: formatFalErrorMessage(data?.error) || status.toLowerCase() }
  }

  return { state: 'running' }
}

export { LIPSYNC_MODEL }
