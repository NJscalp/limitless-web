// GPT Image 1 — Edit (image-to-image).
// Eine Serverless Function für beide Schritte (Hobby-Plan-Limit schonen):
//   /v1/gpt-image/edit   → action "submit"
//   /v1/gpt-image/status → action "status"
// Läuft über die fal-Queue mit dem server-seitig hinterlegten FAL_KEY.

import { isAuthorized, rejectUnauthorized } from '../_shared/auth.mjs'
import { validateImagesPayload } from '../_shared/request-limits.mjs'

async function loadGptImage() {
  return import('../_shared/gpt-image-edit.mjs')
}

async function loadKieImageEdit() {
  return import('../_shared/kie-image-edit.mjs')
}

async function loadKieImagen() {
  return import('../_shared/kie-imagen.mjs')
}

async function loadWavespeed() {
  return import('../_shared/wavespeed.mjs')
}

function wantsKie(body) {
  return String(body?.provider || '').trim().toLowerCase() === 'kie'
}

function wantsWavespeed(body) {
  return String(body?.provider || '').trim().toLowerCase() === 'wavespeed'
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

  // --- Clavic Agent (Claude Tool-Use) — hier eingefaltet, damit es keine
  //     zusätzliche Serverless-Funktion belegt (Hobby-Limit 12). ---
  // Der neue, vollständige Vertrag: id, mode, Bildlesung, Trends.
  if (action === 'director') {
    let director
    try { director = await import('../_shared/director-core.mjs') }
    catch (err) { return res.status(500).json({ error: 'director_module_load_failed', message: String(err?.message || err) }) }
    try {
      // Was der Nutzer gewaehlt hat. Kein Modellaufruf, nur eine Logzeile —
      // und ausdruecklich VOR der Bildlesung, damit dafuer nichts analysiert
      // wird.
      if (body?.intent === 'trend_choice') {
        const ack = director.recordTrendChoice({
          selectionId: body?.selectionId, chosenId: body?.chosenId,
          bestId: body?.bestId, source: body?.source,
        })
        return res.status(ack.status).json(ack.json)
      }
      const images = Array.isArray(body?.images)
        ? body.images.filter((i) => typeof i === 'string' && i.length > 32).slice(0, 6)
        : []
      // Die Lesung darf der Client mitschicken, wenn er sie beim Anhängen des
      // Fotos schon geholt hat — dann entfällt hier die Wartezeit ganz.
      const reading = body?.reading && typeof body.reading === 'object'
        ? body.reading
        : (images.length ? await director.readPhoto(images[0]).catch(() => null) : null)
      // EIGENE ABSICHT: Trend-Auswahl. Nicht der normale Zug — siehe
      // `runTrendSelection`. Nutzt die bereits vorhandene Lesung und rendert
      // nichts.
      if (body?.intent === 'trend_selection') {
        const sel = await director.runTrendSelection({
          reading, offered: body?.trends, provider: body?.provider,
        })
        return res.status(sel.status).json(sel.json)
      }
      const out = await director.runDirector({
        message: body?.message, history: body?.history, images, reading,
        // Nur zum Messen: erlaubt es, denselben Zug einmal direkt und einmal
        // über WaveSpeed zu fahren und die Ergebnisse zu vergleichen.
        provider: body?.provider,
        debug: body?.debug === true,
      })
      return res.status(out.status).json(out.json)
    } catch (err) {
      return res.status(502).json({ error: 'director_failed', message: String(err?.message || err) })
    }
  }

  // Nur die Bildlesung. Die App holt sie, sobald ein Foto angehängt wird —
  // dann ist die Wartezeit von Stufe 1 durch, bevor überhaupt gesendet wird.
  if (action === 'read') {
    let director
    try { director = await import('../_shared/director-core.mjs') }
    catch (err) { return res.status(500).json({ error: 'director_module_load_failed', message: String(err?.message || err) }) }
    const image = Array.isArray(body?.images) && typeof body.images[0] === 'string' ? body.images[0] : null
    if (!image || image.length < 32) return res.status(400).json({ error: 'no_image' })
    const reading = await director.readPhoto(image).catch(() => null)
    // Kein Fehler, wenn es nicht klappt: der Zug läuft auch ohne Lesung, dann
    // sieht der Director das Foto eben selbst.
    return res.status(200).json({ reading })
  }

  // Fremder Endpunkt, hier nur mit untergebracht: Vercel Hobby erlaubt
  // höchstens 12 Serverless-Funktionen, und das Projekt lag mit 13 darüber.
  // Statt ihn zu löschen — ihn ruft vielleicht ein anderes Produkt auf — läuft
  // er jetzt über diesen Router und belegt keinen eigenen Platz.
  if (action === 'meals') {
    const { default: meals } = await import('../_shared/looksmax-meals-chat.mjs')
    return meals(req, res)
  }

  // Die drei Karten beim Start. Reine Leseoperation, kein Modell, kostet
  // nichts — deshalb darf die App sie beim Öffnen holen.
  if (action === 'showcase') {
    try {
      const { loadShowcase } = await import('../_shared/director-showcase.mjs')
      return res.status(200).json({ cards: await loadShowcase() })
    } catch (err) {
      // Die App hat einen eigenen Vorrat — lieber leer als kaputt.
      return res.status(200).json({ cards: [] })
    }
  }

  // Der Director prüft sein eigenes Ergebnis, mit den Regeln des jeweiligen
  // Modus. Ersetzt die alte, modusblinde Prüfung.
  if (action === 'review') {
    let review
    try { review = await import('../_shared/director-review.mjs') }
    catch (err) { return res.status(500).json({ error: 'review_module_load_failed', message: String(err?.message || err) }) }
    try {
      const out = await review.runReview(body)
      return res.status(out.status).json(out.json)
    } catch (err) {
      // Eine gescheiterte Prüfung darf ein gutes Bild nicht aufhalten.
      return res.status(200).json({ ok: true, issues: [], severity: 'minor', correctedPrompt: null })
    }
  }

  if (action === 'qa') {
    let qa
    try { qa = await import('../_shared/agent-qa.mjs') }
    catch (err) { return res.status(500).json({ error: 'qa_module_load_failed', message: String(err?.message || err) }) }
    try {
      const out = await qa.runQA(body)
      return res.status(out.status).json(out.json)
    } catch (err) {
      return res.status(502).json({ error: 'qa_failed', message: String(err?.message || err) })
    }
  }

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

  // --- WaveSpeed AI (dritter Provider): generischer Bild-Model-Pfad ---
  //   submit: { provider:"wavespeed", model, prompt, images?/imageUrls?, input?, aspectRatio? } → { taskId }
  //   status: { provider:"wavespeed", taskId } → { state, imageUrl }
  if (wantsWavespeed(body)) {
    const imageCheck = validateImagesPayload(body?.images)
    if (!imageCheck.ok) return res.status(imageCheck.status).json({ error: imageCheck.error, message: imageCheck.message })

    let ws
    try { ws = await loadWavespeed() }
    catch (err) { return res.status(500).json({ error: 'wavespeed_module_load_failed', message: String(err?.message || err) }) }

    if (action === 'status') {
      const taskId = String(body?.taskId || body?.responseUrl || body?.response_url || '').trim()
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

    try {
      const created = await ws.wavespeedCreateTask({
        model: body?.model,
        input: (body?.input && typeof body.input === 'object') ? body.input : undefined,
        prompt: body?.prompt,
        images: Array.isArray(body?.images) ? body.images : undefined,
        imageUrls: Array.isArray(body?.imageUrls || body?.image_urls) ? (body.imageUrls || body.image_urls) : undefined,
        imagesField: body?.imagesField || body?.images_field,   // z. B. "images" (nano-banana-2/edit)
        aspectRatio: body?.aspectRatio ?? body?.aspect_ratio,
        resolution: body?.resolution,
        quality: body?.quality,   // gpt-image-2: "low"/"medium"/"high"
        seed: body?.seed,
      })
      return res.status(200).json({
        code: 200, msg: 'success',
        data: { taskId: created.taskId, responseUrl: created.taskId, getUrl: created.getUrl, state: 'processing', model: created.model, provider: 'wavespeed' },
      })
    } catch (err) {
      console.error('wavespeed image submit', err?.detail || err)
      const status = err?.status && err.status >= 400 && err.status < 600 ? err.status : 502
      return res.status(status).json({ error: String(err?.message || 'wavespeed_submit_failed'), detail: err?.detail || null })
    }
  }

  // --- Nano Banana 2 (kie.ai) ---
  if (wantsKie(body)) {
    const imageCheck = validateImagesPayload(body?.images)
    if (!imageCheck.ok) {
      return res.status(imageCheck.status).json({ error: imageCheck.error, message: imageCheck.message })
    }

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
          // Tatsächlich genutztes kie-Modell (Default Nano Banana 2).
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
