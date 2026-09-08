// Seedance 2.0 Fast — Reference-to-Video.
// Eine einzige Serverless Function für beide Schritte (Hobby-Plan-Limit schonen):
//   /v1/seedance/reference-to-video → action "submit"
//   /v1/seedance/status            → action "status"
// Beides läuft über die fal-Queue mit dem server-seitig hinterlegten FAL_KEY.

import { isAuthorized, rejectUnauthorized } from '../_shared/auth.mjs'
import { validateImagesPayload } from '../_shared/request-limits.mjs'

async function loadSeedance() {
  return import('../_shared/seedance.mjs')
}

async function loadKieSeedance() {
  return import('../_shared/kie-seedance.mjs')
}

async function loadWavespeed() {
  return import('../_shared/wavespeed.mjs')
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
  const provider = String(body?.provider || '').trim().toLowerCase()

  // --- Lip-Sync über kie.ai (statt fal) — hier mitverdrahtet (Hobby-Limit).
  //     Video-zu-Video: treibt die Mundbewegung eines (Cartoon-)Videos passend
  //     zur TTS-Audiospur → "redender" Charakter. kie-Jobs-Muster (taskId).
  //     submit: { lipsync:true, videoUrl, audioUrl, [model] } → { taskId }
  //     status: { lipsync:true, taskId } → { state, videoUrl }
  if (body?.lipsync) {
    let ls
    try { ls = await import('../_shared/kie-lipsync.mjs') }
    catch (err) { return res.status(500).json({ error: 'kie_lipsync_module_load_failed', message: String(err?.message || err) }) }
    if (action === 'status') {
      const taskId = String(body?.taskId || body?.task_id || body?.responseUrl || body?.response_url || '').trim()
      if (!taskId) return res.status(400).json({ error: 'missing_task_id' })
      try {
        const state = await ls.kieLipsyncTaskState({ taskId })
        return res.status(200).json({ code: 200, msg: 'success', data: state })
      } catch (err) {
        const httpStatus = err?.status ?? err?.detail?.status
        if (isTransient(httpStatus)) return res.status(200).json({ code: 200, msg: 'success', data: { state: 'running', transient: true } })
        return res.status(502).json({ error: String(err?.message || 'kie_lipsync_status_failed'), detail: err?.detail || null })
      }
    }
    try {
      const created = await ls.kieLipsyncCreateTask({
        videoUrl: body?.videoUrl || body?.video_url,
        imageUrl: body?.imageUrl || body?.image_url,
        audioUrl: body?.audioUrl || body?.audio_url,
        prompt: body?.prompt,
        resolution: body?.resolution,
        model: body?.model,   // optionaler Override (zum Proben des besten Modells)
      })
      return res.status(200).json({
        code: 200, msg: 'success',
        data: { taskId: created.taskId, responseUrl: created.taskId, state: 'processing', provider: 'kie-lipsync', model: created.model },
      })
    } catch (err) {
      const status = err?.status && err.status >= 400 && err.status < 600 ? err.status : 502
      return res.status(status).json({ error: String(err?.message || 'kie_lipsync_submit_failed'), detail: err?.detail || null })
    }
  }

  // --- Kling 3.0 image-to-video (kling-3.0/video, multi_shots) ---
  if (body?.klingVideo) {
    let kie
    try { kie = await loadKieSeedance() }
    catch (err) { return res.status(500).json({ error: 'kie_seedance_module_load_failed', message: String(err?.message || err) }) }
    if (action === 'status') {
      const taskId = String(body?.taskId || body?.task_id || body?.responseUrl || '').trim()
      if (!taskId) return res.status(400).json({ error: 'missing_task_id' })
      try {
        const state = await kie.kieSeedanceTaskState({ taskId })
        return res.status(200).json({ code: 200, msg: 'success', data: state })
      } catch (err) {
        const httpStatus = err?.status ?? err?.detail?.status
        if (isTransient(httpStatus)) return res.status(200).json({ code: 200, msg: 'success', data: { state: 'running', transient: true } })
        return res.status(502).json({ error: String(err?.message || 'kie_kling_video_status_failed'), detail: err?.detail || null })
      }
    }
    try {
      const created = await kie.kieKlingVideoCreateTask({
        images: Array.isArray(body?.images) ? body.images : undefined,
        imageUrls: Array.isArray(body?.imageUrls || body?.image_urls) ? (body.imageUrls || body.image_urls) : undefined,
        prompt: body?.prompt,
        multiPrompt: body?.multiPrompt || body?.multi_prompt,
        duration: body?.duration,
        aspectRatio: body?.aspectRatio || body?.aspect_ratio,
        mode: body?.mode,
        sound: body?.sound,
      })
      return res.status(200).json({ code: 200, msg: 'success', data: { taskId: created.taskId, responseUrl: created.taskId, state: 'processing', provider: 'kie', model: created.model } })
    } catch (err) {
      const status = err?.status && err.status >= 400 && err.status < 600 ? err.status : 502
      return res.status(status).json({ error: String(err?.message || 'kie_kling_video_submit_failed'), detail: err?.detail || null })
    }
  }

  // --- AI Fruit Story: Drehbuch planen (Claude) ---
  // (hier mitverdrahtet, damit das Hobby-Funktionslimit von 12 nicht überschritten wird)
  if (action === 'fruitplan') {
    try {
      const { planFruitStory } = await import('../_shared/fruit-story-planner.mjs')
      const story = await planFruitStory(body)
      return res.status(200).json({ code: 200, msg: 'success', data: story })
    } catch (err) {
      console.error('fruit-story plan', err?.detail || err)
      const status = err?.status && err.status >= 400 && err.status < 600 ? err.status : 502
      return res.status(status).json({
        error: String(err?.message || 'fruit_story_plan_failed'),
        detail: err?.detail || null,
      })
    }
  }

  // --- WaveSpeed AI (dritter Provider): generischer Video/Model-Pfad ---
  //   submit: { provider:"wavespeed", model, prompt, images?/imageUrls?, input?, duration?, resolution?, aspectRatio? } → { taskId }
  //   status: { provider:"wavespeed", taskId } → { state, videoUrl }
  if (provider === 'wavespeed') {
    let ws
    try { ws = await loadWavespeed() }
    catch (err) { return res.status(500).json({ error: 'wavespeed_module_load_failed', message: String(err?.message || err) }) }

    if (action === 'status') {
      const taskId = String(body?.taskId || body?.task_id || body?.responseUrl || '').trim()
      if (!taskId) return res.status(400).json({ error: 'missing_task_id' })
      try {
        const state = await ws.wavespeedTaskState({ taskId, getUrl: body?.getUrl || body?.get_url })
        return res.status(200).json({ code: 200, msg: 'success', data: state })
      } catch (err) {
        const httpStatus = err?.status ?? err?.detail?.status
        if (isTransient(httpStatus)) return res.status(200).json({ code: 200, msg: 'success', data: { state: 'running', transient: true } })
        return res.status(502).json({ error: String(err?.message || 'wavespeed_status_failed'), detail: err?.detail || null })
      }
    }

    const imageCheck = validateImagesPayload(body?.images)
    if (!imageCheck.ok) return res.status(imageCheck.status).json({ error: imageCheck.error, message: imageCheck.message })
    try {
      const created = await ws.wavespeedCreateTask({
        model: body?.model,
        input: (body?.input && typeof body.input === 'object') ? body.input : undefined,
        prompt: body?.prompt,
        images: Array.isArray(body?.images) ? body.images : undefined,
        imageUrls: Array.isArray(body?.imageUrls || body?.image_urls) ? (body.imageUrls || body.image_urls) : undefined,
        imagesField: body?.imagesField || body?.images_field,
        videosField: body?.videosField || body?.videos_field,
        // Referenz-Videos (Kling 3.0 Motion Control: `video`): base64 → Upload.
        videos: Array.isArray(body?.videos) ? body.videos : undefined,
        videoUrls: Array.isArray(body?.videoUrls || body?.video_urls) ? (body.videoUrls || body.video_urls) : undefined,
        lastImage: body?.lastImage || body?.last_image,
        aspectRatio: body?.aspectRatio ?? body?.aspect_ratio,
        resolution: body?.resolution,
        duration: body?.duration,
        generateAudio: body?.generateAudio ?? body?.generate_audio,
        seed: body?.seed,
      })
      return res.status(200).json({
        code: 200, msg: 'success',
        data: { taskId: created.taskId, responseUrl: created.taskId, getUrl: created.getUrl, state: 'processing', model: created.model, provider: 'wavespeed' },
      })
    } catch (err) {
      console.error('wavespeed submit', err?.detail || err)
      const status = err?.status && err.status >= 400 && err.status < 600 ? err.status : 502
      return res.status(status).json({ error: String(err?.message || 'wavespeed_submit_failed'), detail: err?.detail || null })
    }
  }

  // --- kie.ai-Provider (z. B. Lego-Trend): eigener Pfad über die kie-Jobs-API ---
  if (provider === 'kie') {
    const imageCheck = validateImagesPayload(body?.images)
    if (!imageCheck.ok) {
      return res.status(imageCheck.status).json({ error: imageCheck.error, message: imageCheck.message })
    }

    let kie
    try {
      kie = await loadKieSeedance()
    } catch (err) {
      console.error('kie-seedance module load failed', err)
      return res.status(500).json({
        error: 'kie_seedance_module_load_failed',
        message: String(err?.message || err),
      })
    }

    if (action === 'status') {
      const taskId = String(body?.taskId || body?.task_id || '').trim()
      if (!taskId) return res.status(400).json({ error: 'missing_task_id' })
      // AI Fruit Story: Veo-3.1-Job über eigenen Status-Endpunkt pollen.
      if (body?.veo === true) {
        try {
          const { kieVeoTaskState } = await import('../_shared/kie-veo.mjs')
          const state = await kieVeoTaskState({ taskId })
          return res.status(200).json({ code: 200, msg: 'success', data: state })
        } catch (err) {
          console.error('kie-veo status', err?.detail || err)
          const httpStatus = err?.status ?? err?.detail?.status
          if (isTransient(httpStatus)) {
            return res.status(200).json({ code: 200, msg: 'success', data: { state: 'running', transient: true } })
          }
          return res.status(502).json({ error: String(err?.message || 'veo_status_failed'), detail: err?.detail || null })
        }
      }
      try {
        const state = await kie.kieSeedanceTaskState({ taskId })
        return res.status(200).json({ code: 200, msg: 'success', data: state })
      } catch (err) {
        console.error('kie-seedance status', err?.detail || err)
        const httpStatus = err?.status ?? err?.detail?.status
        if (isTransient(httpStatus)) {
          return res.status(200).json({
            code: 200,
            msg: 'success',
            data: { state: 'running', transient: true },
          })
        }
        return res.status(502).json({
          error: String(err?.message || 'kie_seedance_status_failed'),
          detail: err?.detail || null,
        })
      }
    }

    // --- AI Fruit Story: Szene mit Veo 3.1 animieren (sprechende Früchte) ---
    if (body?.veo === true) {
      const veoPrompt = String(body?.prompt || '').trim()
      if (!veoPrompt) return res.status(400).json({ error: 'missing_prompt' })
      try {
        const { kieVeoCreateTask } = await import('../_shared/kie-veo.mjs')
        const created = await kieVeoCreateTask({
          prompt: veoPrompt,
          images: Array.isArray(body?.images) ? body.images : undefined,
          imageUrls: Array.isArray(body?.imageUrls || body?.image_urls)
            ? (body.imageUrls || body.image_urls) : undefined,
          aspectRatio: body?.aspectRatio ?? body?.aspect_ratio,
          model: body?.model,
          resolution: body?.resolution,
          duration: body?.duration,
        })
        return res.status(200).json({
          code: 200, msg: 'success',
          data: { taskId: created.taskId, state: 'processing', model: 'veo-3.1', provider: 'kie' },
        })
      } catch (err) {
        console.error('kie-veo submit', err?.detail || err)
        const status = err?.status && err.status >= 400 && err.status < 600 ? err.status : 502
        return res.status(status).json({ error: String(err?.message || 'veo_submit_failed'), detail: err?.detail || null })
      }
    }

    // --- Kling 3.0 Motion Control (Bewegungsübertragung Video → Bild) ---
    if (body?.kling === true || String(body?.model || '') === 'kling-motion') {
      try {
        const created = await kie.kieKlingMotionCreateTask({
          prompt: body?.prompt,
          images: Array.isArray(body?.images) ? body.images : undefined,
          imageUrls: Array.isArray(body?.imageUrls || body?.image_urls)
            ? (body.imageUrls || body.image_urls) : undefined,
          videos: Array.isArray(body?.videos) ? body.videos : undefined,
          videoUrls: Array.isArray(body?.videoUrls || body?.video_urls)
            ? (body.videoUrls || body.video_urls) : undefined,
          mode: body?.mode,
          characterOrientation: body?.characterOrientation ?? body?.character_orientation,
          backgroundSource: body?.backgroundSource ?? body?.background_source,
        })
        return res.status(200).json({
          code: 200, msg: 'success',
          data: { taskId: created.taskId, state: 'processing', model: 'kling-3.0-motion', provider: 'kie' },
        })
      } catch (err) {
        console.error('kie-kling submit', err?.detail || err)
        const status = err?.status && err.status >= 400 && err.status < 600 ? err.status : 502
        return res.status(status).json({
          error: String(err?.message || 'kie_kling_submit_failed'),
          detail: err?.detail || null,
        })
      }
    }

    // --- HappyHorse 1.1 Reference-to-Video (happyhorse-1-1/reference-to-video) ---
    if (body?.happyHorse === true || String(body?.model || '').trim() === 'happyhorse-1-1/reference-to-video') {
      const hhPrompt = String(body?.prompt || '').trim()
      if (!hhPrompt) return res.status(400).json({ error: 'missing_prompt' })
      try {
        const { kieHappyHorseR2vCreateTask } = await import('../_shared/kie-happyhorse.mjs')
        const created = await kieHappyHorseR2vCreateTask({
          prompt: hhPrompt,
          images: Array.isArray(body?.images) ? body.images : undefined,
          imageUrls: Array.isArray(body?.imageUrls || body?.image_urls)
            ? (body.imageUrls || body.image_urls) : undefined,
          resolution: body?.resolution,
          aspectRatio: body?.aspectRatio ?? body?.aspect_ratio,
          duration: body?.duration,
          seed: body?.seed,
        })
        return res.status(200).json({
          code: 200, msg: 'success',
          data: {
            taskId: created.taskId,
            state: 'processing',
            model: created.model,
            provider: 'kie',
          },
        })
      } catch (err) {
        console.error('kie-happyhorse submit', err?.detail || err)
        const status = err?.status && err.status >= 400 && err.status < 600 ? err.status : 502
        return res.status(status).json({
          error: String(err?.message || 'kie_happyhorse_submit_failed'),
          detail: err?.detail || null,
        })
      }
    }

    // --- Gemini Omni Video (gemini-omni-video) — R2V @720p ---
    if (body?.geminiOmni === true || String(body?.model || '').trim() === 'gemini-omni-video') {
      const omniPrompt = String(body?.prompt || '').trim()
      if (!omniPrompt) return res.status(400).json({ error: 'missing_prompt' })
      try {
        const { kieOmniVideoCreateTask } = await import('../_shared/kie-omni.mjs')
        const created = await kieOmniVideoCreateTask({
          prompt: omniPrompt,
          images: Array.isArray(body?.images) ? body.images : undefined,
          imageUrls: Array.isArray(body?.imageUrls || body?.image_urls)
            ? (body.imageUrls || body.image_urls) : undefined,
          videoUrls: Array.isArray(body?.videoUrls || body?.video_urls)
            ? (body.videoUrls || body.video_urls) : undefined,
          videoList: Array.isArray(body?.videoList || body?.video_list)
            ? (body.videoList || body.video_list) : undefined,
          aspectRatio: body?.aspectRatio ?? body?.aspect_ratio,
          duration: body?.duration,
          videoStart: body?.videoStart ?? body?.video_start,
          videoEnds: body?.videoEnds ?? body?.video_ends,
        })
        return res.status(200).json({
          code: 200, msg: 'success',
          data: {
            taskId: created.taskId,
            state: 'processing',
            model: created.model,
            provider: 'kie',
          },
        })
      } catch (err) {
        console.error('kie-omni submit', err?.detail || err)
        const status = err?.status && err.status >= 400 && err.status < 600 ? err.status : 502
        return res.status(status).json({
          error: String(err?.message || 'kie_omni_submit_failed'),
          detail: err?.detail || null,
        })
      }
    }

    // --- Wan 2.7 Reference-to-Video (wan/2-7-r2v) ---
    if (body?.wanR2v === true || String(body?.model || '').trim() === 'wan/2-7-r2v') {
      const wanPrompt = String(body?.prompt || '').trim()
      if (!wanPrompt) return res.status(400).json({ error: 'missing_prompt' })
      try {
        const { kieWanR2vCreateTask } = await import('../_shared/kie-wan.mjs')
        const created = await kieWanR2vCreateTask({
          prompt: wanPrompt,
          images: Array.isArray(body?.images) ? body.images : undefined,
          imageUrls: Array.isArray(body?.imageUrls || body?.image_urls)
            ? (body.imageUrls || body.image_urls) : undefined,
          videoUrls: Array.isArray(body?.videoUrls || body?.video_urls)
            ? (body.videoUrls || body.video_urls) : undefined,
          resolution: body?.resolution,
          duration: body?.duration,
          aspectRatio: body?.aspectRatio ?? body?.aspect_ratio,
          negativePrompt: body?.negativePrompt ?? body?.negative_prompt,
          nsfwChecker: body?.nsfwChecker ?? body?.nsfw_checker,
        })
        return res.status(200).json({
          code: 200, msg: 'success',
          data: {
            taskId: created.taskId,
            state: 'processing',
            model: created.model,
            provider: 'kie',
          },
        })
      } catch (err) {
        console.error('kie-wan-r2v submit', err?.detail || err)
        const status = err?.status && err.status >= 400 && err.status < 600 ? err.status : 502
        return res.status(status).json({
          error: String(err?.message || 'kie_wan_r2v_submit_failed'),
          detail: err?.detail || null,
        })
      }
    }

    const kiePrompt = String(body?.prompt || '').trim()
    if (!kiePrompt) return res.status(400).json({ error: 'missing_prompt' })
    try {
      const created = await kie.kieSeedanceCreateTask({
        prompt: kiePrompt,
        images: Array.isArray(body?.images) ? body.images : undefined,
        imageUrls: Array.isArray(body?.imageUrls || body?.image_urls)
          ? (body.imageUrls || body.image_urls)
          : undefined,
        videoUrls: Array.isArray(body?.videoUrls || body?.video_urls)
          ? (body.videoUrls || body.video_urls)
          : undefined,
        videos: Array.isArray(body?.videos) ? body.videos : undefined,
        resolution: body?.resolution,
        duration: body?.duration,
        aspectRatio: body?.aspectRatio ?? body?.aspect_ratio,
        generateAudio: body?.generateAudio ?? body?.generate_audio,
        fast: body?.fast,
        model: body?.model,   // optionaler Modell-Override (z. B. seedance-2-mini)
      })
      return res.status(200).json({
        code: 200,
        msg: 'success',
        data: {
          taskId: created.taskId,
          state: 'processing',
          model: created.model || 'seedance-2.0-fast',
          provider: 'kie',
        },
      })
    } catch (err) {
      console.error('kie-seedance submit', err?.detail || err)
      const status = err?.status && err.status >= 400 && err.status < 600 ? err.status : 502
      return res.status(status).json({
        error: String(err?.message || 'kie_seedance_submit_failed'),
        detail: err?.detail || null,
      })
    }
  }

  let seedance
  try {
    seedance = await loadSeedance()
  } catch (err) {
    console.error('seedance module load failed', err)
    return res.status(500).json({
      error: 'seedance_module_load_failed',
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
      const state = await seedance.seedanceTaskState({ statusUrl, responseUrl })
      return res.status(200).json({ code: 200, msg: 'success', data: state })
    } catch (err) {
      console.error('seedance status', err?.detail || err)
      const httpStatus = err?.status ?? err?.detail?.status
      if (isTransient(httpStatus)) {
        return res.status(200).json({
          code: 200,
          msg: 'success',
          data: { state: 'running', transient: true },
        })
      }
      return res.status(502).json({
        error: String(err?.message || 'seedance_status_failed'),
        detail: err?.detail || null,
      })
    }
  }

  // --- Job einreichen (Default / "submit" / "reference-to-video") ---
  const prompt = String(body?.prompt || '').trim()
  if (!prompt) return res.status(400).json({ error: 'missing_prompt' })

  try {
    const created = await seedance.seedanceCreateTask({
      prompt,
      images: Array.isArray(body?.images) ? body.images : undefined,
      imageUrls: Array.isArray(body?.imageUrls || body?.image_urls)
        ? (body.imageUrls || body.image_urls)
        : undefined,
      videoUrls: Array.isArray(body?.videoUrls || body?.video_urls)
        ? (body.videoUrls || body.video_urls)
        : undefined,
      resolution: body?.resolution,
      duration: body?.duration,
      aspectRatio: body?.aspectRatio ?? body?.aspect_ratio,
      generateAudio: body?.generateAudio ?? body?.generate_audio,
      seed: body?.seed,
    })

    return res.status(200).json({
      code: 200,
      msg: 'success',
      data: {
        taskId: created.taskId,
        statusUrl: created.statusUrl,
        responseUrl: created.responseUrl,
        state: 'processing',
        model: 'seedance-2.0-fast',
        provider: 'fal',
      },
    })
  } catch (err) {
    console.error('seedance submit', err?.detail || err)
    const status = err?.status && err.status >= 400 && err.status < 600 ? err.status : 502
    return res.status(status).json({
      error: String(err?.message || 'seedance_submit_failed'),
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
