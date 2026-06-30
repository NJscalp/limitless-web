// GPT Image 1 — Edit (image-to-image).
// Eine Serverless Function für beide Schritte (Hobby-Plan-Limit schonen):
//   /v1/gpt-image/edit   → action "submit"
//   /v1/gpt-image/status → action "status"
// Läuft über die fal-Queue mit dem server-seitig hinterlegten FAL_KEY.

import { isAuthorized, rejectUnauthorized } from '../_shared/auth.mjs'

async function loadGptImage() {
  return import('../_shared/gpt-image-edit.mjs')
}

async function loadKieImageEdit() {
  return import('../_shared/kie-image-edit.mjs')
}

async function loadKieImagen() {
  return import('../_shared/kie-imagen.mjs')
}

function wantsKie(body) {
  return String(body?.provider || '').trim().toLowerCase() === 'kie'
}

// Imagen 4 ist reines Text-to-Image (kein Bild-Input) → eigener Sub-Pfad.
function wantsImagen(body) {
  return wantsKie(body)
    && String(body?.model || '').trim().toLowerCase().startsWith('google/imagen')
}

function isTransient(status) {
  return status === 408 || status === 429 || status === 502 || status === 503 || status === 504
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method_not_allowed' })
  }
  if (!isAuthorized(req)) return rejectUnauthorized(res)

  const action = String(req.query?.action || '').trim().toLowerCase()
  const body = typeof req.body === 'string' ? safeJson(req.body) : (req.body || {})

  // --- ElevenLabs TTS (kie.ai) — folded in here so it doesn't add a function ---
  if (body?.tts) {
    let tts
    try { tts = await import('../_shared/kie-tts.mjs') }
    catch (err) { return res.status(500).json({ error: 'kie_tts_module_load_failed', message: String(err?.message || err) }) }
    if (action === 'status') {
      const taskId = String(body?.taskId || body?.responseUrl || body?.response_url || '').trim()
      if (!taskId) return res.status(400).json({ error: 'missing_task_id' })
      try {
        const state = await tts.kieTtsTaskState({ taskId })
        return res.status(200).json({ code: 200, msg: 'success', data: state })
      } catch (err) {
        const httpStatus = err?.status ?? err?.detail?.status
        if (isTransient(httpStatus)) return res.status(200).json({ code: 200, msg: 'success', data: { state: 'running', transient: true } })
        return res.status(502).json({ error: String(err?.message || 'kie_tts_status_failed'), detail: err?.detail || null })
      }
    }
    try {
      const created = await tts.kieTtsCreateTask({
        text: body?.text, voice: body?.voice,
        stability: body?.stability, similarity_boost: body?.similarity_boost,
        style: body?.style, speed: body?.speed,
      })
      return res.status(200).json({ code: 200, msg: 'success', data: { taskId: created.taskId, responseUrl: created.taskId, state: 'processing', provider: 'kie-tts' } })
    } catch (err) {
      const status = err?.status && err.status >= 400 && err.status < 600 ? err.status : 502
      return res.status(status).json({ error: String(err?.message || 'kie_tts_submit_failed'), detail: err?.detail || null })
    }
  }

  // --- Nano Banana 2 (kie.ai) ---
  if (wantsKie(body)) {
    // Imagen 4 (Text-to-Image, kein Bild-Input) — eigener Sub-Pfad.
    if (wantsImagen(body)) {
      let imagen
      try {
        imagen = await loadKieImagen()
      } catch (err) {
        console.error('kie imagen module load failed', err)
        return res.status(500).json({
          error: 'kie_imagen_module_load_failed',
          message: String(err?.message || err),
        })
      }
      const prompt = String(body?.prompt || '').trim()
      if (!prompt) return res.status(400).json({ error: 'missing_prompt' })
      try {
        const created = await imagen.kieImagenCreateTask({
          prompt,
          aspectRatio: body?.aspectRatio || body?.aspect_ratio,
          negativePrompt: body?.negativePrompt || body?.negative_prompt,
          seed: body?.seed,
        })
        return res.status(200).json({
          code: 200,
          msg: 'success',
          data: {
            taskId: created.taskId,
            // iOS nutzt `responseUrl` als Job-Kennung.
            responseUrl: created.taskId,
            state: 'processing',
            model: created.model,
            provider: 'kie',
          },
        })
      } catch (err) {
        console.error('kie imagen submit', err?.detail || err)
        const status = err?.status && err.status >= 400 && err.status < 600 ? err.status : 502
        return res.status(status).json({
          error: String(err?.message || 'kie_imagen_submit_failed'),
          detail: err?.detail || null,
        })
      }
    }

    let kie
    try {
      kie = await loadKieImageEdit()
    } catch (err) {
      console.error('kie image-edit module load failed', err)
      return res.status(500).json({
        error: 'kie_image_edit_module_load_failed',
        message: String(err?.message || err),
      })
    }

    if (action === 'status') {
      const taskId = String(
        body?.taskId || body?.responseUrl || body?.response_url || body?.statusUrl || ''
      ).trim()
      if (!taskId) return res.status(400).json({ error: 'missing_task_id' })
      try {
        const state = await kie.kieImageEditTaskState({ taskId })
        return res.status(200).json({ code: 200, msg: 'success', data: state })
      } catch (err) {
        console.error('kie image-edit status', err?.detail || err)
        const httpStatus = err?.status ?? err?.detail?.status
        if (isTransient(httpStatus)) {
          return res.status(200).json({
            code: 200,
            msg: 'success',
            data: { state: 'running', transient: true },
          })
        }
        return res.status(502).json({
          error: String(err?.message || 'kie_image_edit_status_failed'),
          detail: err?.detail || null,
        })
      }
    }

    const prompt = String(body?.prompt || '').trim()
    if (!prompt) return res.status(400).json({ error: 'missing_prompt' })
    try {
      const created = await kie.kieImageEditCreateTask({
        prompt,
        images: Array.isArray(body?.images) ? body.images : undefined,
        imageUrls: Array.isArray(body?.imageUrls || body?.image_urls)
          ? (body.imageUrls || body.image_urls)
          : undefined,
        aspectRatio: body?.aspectRatio || body?.aspect_ratio,
        resolution: body?.resolution,
        model: body?.model,
      })
      return res.status(200).json({
        code: 200,
        msg: 'success',
        data: {
          taskId: created.taskId,
          // iOS verwendet `responseUrl` als Job-Kennung -> taskId zurückgeben.
          responseUrl: created.taskId,
          state: 'processing',
          // Tatsächlich genutztes kie-Modell (Default GPT Image 2, Override z. B.
          // "nano-banana-pro" für den Chat-Edit-Tab).
          model: created.model,
          provider: 'kie',
        },
      })
    } catch (err) {
      console.error('kie image-edit submit', err?.detail || err)
      const status = err?.status && err.status >= 400 && err.status < 600 ? err.status : 502
      return res.status(status).json({
        error: String(err?.message || 'kie_image_edit_submit_failed'),
        detail: err?.detail || null,
      })
    }
  }

  let gptImage
  try {
    gptImage = await loadGptImage()
  } catch (err) {
    console.error('gpt-image module load failed', err)
    return res.status(500).json({
      error: 'gpt_image_module_load_failed',
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
      const state = await gptImage.gptImageTaskState({ statusUrl, responseUrl })
      return res.status(200).json({ code: 200, msg: 'success', data: state })
    } catch (err) {
      console.error('gpt-image status', err?.detail || err)
      const httpStatus = err?.status ?? err?.detail?.status
      if (isTransient(httpStatus)) {
        return res.status(200).json({
          code: 200,
          msg: 'success',
          data: { state: 'running', transient: true },
        })
      }
      return res.status(502).json({
        error: String(err?.message || 'gpt_image_status_failed'),
        detail: err?.detail || null,
      })
    }
  }

  // --- Job einreichen (Default / "submit" / "edit") ---
  const prompt = String(body?.prompt || '').trim()
  if (!prompt) return res.status(400).json({ error: 'missing_prompt' })

  try {
    const created = await gptImage.gptImageCreateTask({
      prompt,
      images: Array.isArray(body?.images) ? body.images : undefined,
      imageUrls: Array.isArray(body?.imageUrls || body?.image_urls)
        ? (body.imageUrls || body.image_urls)
        : undefined,
      quality: body?.quality,
      size: body?.size ?? body?.image_size,
    })

    return res.status(200).json({
      code: 200,
      msg: 'success',
      data: {
        taskId: created.taskId,
        statusUrl: created.statusUrl,
        responseUrl: created.responseUrl,
        state: 'processing',
        model: 'gpt-image-1-edit',
        provider: 'fal',
      },
    })
  } catch (err) {
    console.error('gpt-image submit', err?.detail || err)
    const status = err?.status && err.status >= 400 && err.status < 600 ? err.status : 502
    return res.status(status).json({
      error: String(err?.message || 'gpt_image_submit_failed'),
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
