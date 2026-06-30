// Image- & Video-Upscaling.
// Eine Serverless Function für beide Schritte (Hobby-Plan-Limit schonen):
//   /v1/upscale/submit  → action "submit"
//   /v1/upscale/status  → action "status"
// Läuft über die fal-Queue mit dem server-seitig hinterlegten FAL_KEY.

import { isAuthorized, rejectUnauthorized } from '../_shared/auth.mjs'

async function loadUpscale() {
  return import('../_shared/upscale.mjs')
}

async function loadKieUpscale() {
  return import('../_shared/kie-upscale.mjs')
}

async function loadLipsync() {
  return import('../_shared/lipsync.mjs')
}

function wantsKie(body) {
  return String(body?.provider || '').trim().toLowerCase() === 'kie'
}

function wantsLipsync(body) {
  return String(body?.kind || '').trim().toLowerCase() === 'lipsync'
}

function isTransient(status) {
  return status === 408 || status === 429 || status === 502 || status === 503 || status === 504
}

// Öffentlich gehostete Song-Abschnitte für das Musikvideo-Template.
const LIPSYNC_SLICE_FILES = { a: 'song-a.m4a', b: 'song-b.m4a', c: 'song-c.m4a' }

function lipsyncAudioUrl(req, body) {
  const direct = String(body?.audioUrl || body?.audio_url || '').trim()
  if (direct.startsWith('http')) return direct
  const slice = String(body?.slice || '').trim().toLowerCase()
  const file = LIPSYNC_SLICE_FILES[slice]
  if (!file) return null
  const env = String(process.env.PUBLIC_BASE_URL || '').trim().replace(/\/$/, '')
  const host = req.headers['x-forwarded-host'] || req.headers.host
  const proto = req.headers['x-forwarded-proto'] || 'https'
  const base = env.startsWith('http')
    ? env
    : (host ? `${proto}://${host}` : 'https://limitless-web-beryl.vercel.app')
  return `${base}/${file}`
}

// Lip-Sync (Musikvideo-Template) läuft über dieselbe fal-Queue-Mechanik wie
// Upscale, daher hier mit eingebettet statt als eigene Function
// (Hobby-Plan: max. 12 Serverless Functions).
async function handleLipsync(req, res, action, body) {
  let lipsync
  try {
    lipsync = await loadLipsync()
  } catch (err) {
    console.error('lipsync module load failed', err)
    return res.status(500).json({ error: 'lipsync_module_load_failed', message: String(err?.message || err) })
  }

  if (action === 'status') {
    const statusUrl = String(body?.statusUrl || body?.status_url || '').trim()
    const responseUrl = String(body?.responseUrl || body?.response_url || '').trim()
    if (!statusUrl && !responseUrl) return res.status(400).json({ error: 'missing_status_or_response_url' })
    try {
      const state = await lipsync.lipsyncTaskState({ statusUrl, responseUrl })
      return res.status(200).json({ code: 200, msg: 'success', data: state })
    } catch (err) {
      console.error('lipsync status', err?.detail || err)
      const httpStatus = err?.status ?? err?.detail?.status
      if (isTransient(httpStatus)) {
        return res.status(200).json({ code: 200, msg: 'success', data: { state: 'running', transient: true } })
      }
      return res.status(502).json({ error: String(err?.message || 'lipsync_status_failed'), detail: err?.detail || null })
    }
  }

  const videoUrl = String(body?.videoUrl || body?.video_url || '').trim()
  if (!videoUrl.startsWith('http')) return res.status(400).json({ error: 'missing_video_url' })
  const audioUrl = lipsyncAudioUrl(req, body)
  if (!audioUrl) return res.status(400).json({ error: 'missing_audio_or_invalid_slice' })

  try {
    const created = await lipsync.lipsyncCreateTask({ videoUrl, audioUrl })
    return res.status(200).json({
      code: 200,
      msg: 'success',
      data: {
        taskId: created.taskId,
        statusUrl: created.statusUrl,
        responseUrl: created.responseUrl,
        state: 'processing',
        provider: 'fal',
      },
    })
  } catch (err) {
    console.error('lipsync submit', err?.detail || err)
    const status = err?.status && err.status >= 400 && err.status < 600 ? err.status : 502
    return res.status(status).json({ error: String(err?.message || 'lipsync_submit_failed'), detail: err?.detail || null })
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method_not_allowed' })
  }
  if (!isAuthorized(req)) return rejectUnauthorized(res)

  const action = String(req.query?.action || '').trim().toLowerCase()
  const body = typeof req.body === 'string' ? safeJson(req.body) : (req.body || {})

  // --- Lip-Sync (Musikvideo-Template) ---
  if (wantsLipsync(body)) {
    return handleLipsync(req, res, action, body)
  }

  const type = String(body?.type || 'image').trim().toLowerCase()

  // --- Topaz über kie.ai ---
  if (wantsKie(body)) {
    let kie
    try {
      kie = await loadKieUpscale()
    } catch (err) {
      console.error('kie upscale module load failed', err)
      return res.status(500).json({
        error: 'kie_upscale_module_load_failed',
        message: String(err?.message || err),
      })
    }

    if (action === 'status') {
      const taskId = String(
        body?.taskId || body?.responseUrl || body?.response_url || body?.statusUrl || ''
      ).trim()
      if (!taskId) return res.status(400).json({ error: 'missing_task_id' })
      try {
        const state = await kie.kieUpscaleTaskState({ taskId, type })
        return res.status(200).json({ code: 200, msg: 'success', data: state })
      } catch (err) {
        console.error('kie upscale status', err?.detail || err)
        const httpStatus = err?.status ?? err?.detail?.status
        if (isTransient(httpStatus)) {
          return res.status(200).json({
            code: 200,
            msg: 'success',
            data: { state: 'running', transient: true },
          })
        }
        return res.status(502).json({
          error: String(err?.message || 'kie_upscale_status_failed'),
          detail: err?.detail || null,
        })
      }
    }

    try {
      const created = await kie.kieUpscaleCreateTask({
        type,
        image: typeof body?.image === 'string' ? body.image : undefined,
        video: typeof body?.video === 'string' ? body.video : undefined,
        imageUrl: body?.imageUrl ?? body?.image_url,
        videoUrl: body?.videoUrl ?? body?.video_url,
        factor: body?.factor ?? body?.upscale_factor,
      })
      return res.status(200).json({
        code: 200,
        msg: 'success',
        data: {
          taskId: created.taskId,
          // iOS nutzt `responseUrl` als Job-Kennung -> taskId zurückgeben.
          responseUrl: created.taskId,
          state: 'processing',
          type,
          provider: 'kie',
        },
      })
    } catch (err) {
      console.error('kie upscale submit', err?.detail || err)
      const status = err?.status && err.status >= 400 && err.status < 600 ? err.status : 502
      return res.status(status).json({
        error: String(err?.message || 'kie_upscale_submit_failed'),
        detail: err?.detail || null,
      })
    }
  }

  let upscale
  try {
    upscale = await loadUpscale()
  } catch (err) {
    console.error('upscale module load failed', err)
    return res.status(500).json({
      error: 'upscale_module_load_failed',
      message: String(err?.message || err),
    })
  }

  // --- Status-Polling ---
  if (action === 'status') {
    const statusUrl = String(body?.statusUrl || body?.status_url || '').trim()
    const responseUrl = String(body?.responseUrl || body?.response_url || '').trim()
    if (!statusUrl && !responseUrl) {
      return res.status(400).json({ error: 'missing_status_or_response_url' })
    }
    try {
      const state = await upscale.upscaleTaskState({ statusUrl, responseUrl, type })
      return res.status(200).json({ code: 200, msg: 'success', data: state })
    } catch (err) {
      console.error('upscale status', err?.detail || err)
      const httpStatus = err?.status ?? err?.detail?.status
      if (isTransient(httpStatus)) {
        return res.status(200).json({
          code: 200,
          msg: 'success',
          data: { state: 'running', transient: true },
        })
      }
      return res.status(502).json({
        error: String(err?.message || 'upscale_status_failed'),
        detail: err?.detail || null,
      })
    }
  }

  // --- Job einreichen ---
  try {
    const created = await upscale.upscaleCreateTask({
      type,
      image: typeof body?.image === 'string' ? body.image : undefined,
      video: typeof body?.video === 'string' ? body.video : undefined,
      imageUrl: body?.imageUrl ?? body?.image_url,
      videoUrl: body?.videoUrl ?? body?.video_url,
      factor: body?.factor ?? body?.upscale_factor,
    })

    return res.status(200).json({
      code: 200,
      msg: 'success',
      data: {
        taskId: created.taskId,
        statusUrl: created.statusUrl,
        responseUrl: created.responseUrl,
        state: 'processing',
        type,
        provider: 'fal',
      },
    })
  } catch (err) {
    console.error('upscale submit', err?.detail || err)
    const status = err?.status && err.status >= 400 && err.status < 600 ? err.status : 502
    return res.status(status).json({
      error: String(err?.message || 'upscale_submit_failed'),
      detail: err?.detail || null,
    })
  }
}

function safeJson(s) {
  try {
    return JSON.parse(s)
  } catch {
    return {}
  }
}
