// WaveSpeed AI — dritter Inferenz-Provider neben kie und fal.
// Generischer Submit + Poll über die /api/v3-Schnittstelle. Nutzt den
// server-seitig hinterlegten WAVESPEED_API_KEY (Vercel-Env, NICHT hartkodiert).
//
// Ablauf:
//   1. (optional) Base64-Bilder → POST /api/v3/media/upload/binary  → data.url
//   2. POST /api/v3/{model}                       → data.id (+ data.urls.get)
//   3. GET  /api/v3/predictions/{id}/result       → data.status / data.outputs
//
// Statuswerte von WaveSpeed: created | processing | completed | failed
//
// Bewusst model-agnostisch: der Aufrufer gibt `model` (z. B.
// "bytedance/seedance-2.0/image-to-video") und entweder ein rohes `input`-Objekt
// (1:1 an WaveSpeed) ODER Convenience-Felder (prompt/images/duration/…). So
// lassen sich ALLE WaveSpeed-Modelle nutzen, ohne pro Modell Code zu schreiben.

const WAVESPEED_API_BASE = (
  process.env.WAVESPEED_API_BASE || 'https://api.wavespeed.ai'
).replace(/\/$/, '')

/** Vercel-Env darf `WAVESPEED_API_KEY` oder `WAVESPEED` heißen. */
export function wavespeedApiKey() {
  return (process.env.WAVESPEED_API_KEY || process.env.WAVESPEED || '').trim()
}

function wsError(code, detail, status) {
  const err = new Error(code)
  err.detail = detail
  err.status = status
  return err
}

function base64ToBuffer(raw) {
  const s = String(raw || '').trim().replace(/^data:[^;]+;base64,/, '')
  return Buffer.from(s, 'base64')
}

/**
 * Lädt ein Base64-Bild bei WaveSpeed hoch und gibt die öffentliche URL zurück.
 * Multipart form-data (`file`) an /api/v3/media/upload/binary.
 */
export async function wavespeedUploadBase64(base64, fileName = 'ref.jpg', mime = 'image/jpeg') {
  const key = wavespeedApiKey()
  if (!key) throw wsError('server_misconfigured_missing_wavespeed_key', null, 500)
  const buf = base64ToBuffer(base64)
  if (!buf.length) throw wsError('missing_image_base64', null, 400)

  const form = new FormData()
  form.append('file', new Blob([buf], { type: mime }), fileName)

  const response = await fetch(`${WAVESPEED_API_BASE}/api/v3/media/upload/binary`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw wsError('wavespeed_upload_failed', data, response.status)
  const url = data?.data?.url || data?.data?.download_url || data?.data?.downloadUrl
  if (!url || !String(url).startsWith('http')) throw wsError('wavespeed_upload_no_url', data, response.status)
  return String(url)
}

/**
 * Reicht einen WaveSpeed-Job ein.
 * @param {{ model:string, input?:object, prompt?:string, images?:string[], imageUrls?:string[], lastImage?:string, aspectRatio?:string, resolution?:string, duration?:number, generateAudio?:boolean, seed?:number }} params
 * @returns {Promise<{ taskId:string, model:string, getUrl:string|null }>}
 */
export async function wavespeedCreateTask(params = {}) {
  const key = wavespeedApiKey()
  if (!key) throw wsError('server_misconfigured_missing_wavespeed_key', null, 500)

  const model = String(params.model || '').trim().replace(/^\/+/, '')
  if (!model) throw wsError('missing_model', null, 400)

  // Bild-URLs auflösen: http-URLs durchreichen, Base64 hochladen.
  const imageUrls = []
  if (Array.isArray(params.imageUrls)) {
    for (const u of params.imageUrls) {
      const s = String(u || '').trim()
      if (s.startsWith('http')) imageUrls.push(s)
    }
  }
  if (Array.isArray(params.images)) {
    let i = 0
    for (const b of params.images) {
      const raw = String(b || '').trim()
      if (!raw) continue
      imageUrls.push(await wavespeedUploadBase64(raw, `ref-${Date.now()}-${i++}.jpg`))
    }
  }

  // Video-URLs auflösen (z. B. Kling Motion Control braucht `video`):
  // http-URLs durchreichen, Base64-Videos hochladen.
  const videoUrls = []
  if (Array.isArray(params.videoUrls)) {
    for (const u of params.videoUrls) {
      const s = String(u || '').trim()
      if (s.startsWith('http')) videoUrls.push(s)
    }
  }
  if (Array.isArray(params.videos)) {
    let v = 0
    for (const b of params.videos) {
      const raw = String(b || '').trim()
      if (!raw) continue
      videoUrls.push(await wavespeedUploadBase64(raw, `vid-${Date.now()}-${v++}.mp4`, 'video/mp4'))
    }
  }

  // Payload bauen: entweder rohes `input` (voller Kontrolle) oder aus Convenience-Feldern.
  let payload
  if (params.input && typeof params.input === 'object') {
    payload = { ...params.input }
    if (imageUrls.length && payload.image == null && payload.images == null) {
      // imagesField (z. B. "images" bei nano-banana-2/edit): Uploads als ARRAY.
      if (params.imagesField) {
        payload[String(params.imagesField)] = imageUrls
      } else {
        payload.image = imageUrls[0]
        if (imageUrls[1] && payload.last_image == null) payload.last_image = imageUrls[1]
      }
    }
    // videosField (z. B. "videos" bei gemini-omni-flash r2v): Uploads als ARRAY.
    if (params.videosField && videoUrls.length && payload[String(params.videosField)] == null) {
      payload[String(params.videosField)] = videoUrls
    } else if (videoUrls[0] && payload.video == null) {
      payload.video = videoUrls[0]
    }
  } else {
    payload = {}
    if (params.prompt != null) payload.prompt = String(params.prompt)
    if (params.imagesField && imageUrls.length) {
      // Modelle mit Array-Input (nano-banana-2/edit: `images`).
      payload[String(params.imagesField)] = imageUrls
    } else if (imageUrls[0]) {
      payload.image = imageUrls[0]
    }
    if (params.videosField && videoUrls.length) {
      payload[String(params.videosField)] = videoUrls
    } else if (videoUrls[0]) {
      payload.video = videoUrls[0]
    }
    // Zweites Bild = Endframe (Modelle wie seedance-2.0 i2v: `last_image`).
    const last = params.lastImage && String(params.lastImage).startsWith('http') ? String(params.lastImage) : (params.imagesField ? null : imageUrls[1])
    if (last) payload.last_image = last
    if (params.aspectRatio || params.aspect_ratio) payload.aspect_ratio = String(params.aspectRatio || params.aspect_ratio)
    if (params.resolution) payload.resolution = String(params.resolution).toLowerCase()
    // quality (z. B. gpt-image-2: "low"/"medium"/"high" — bestimmt dort den Preis).
    if (params.quality) payload.quality = String(params.quality).toLowerCase()
    if (params.duration != null && !Number.isNaN(Number(params.duration))) payload.duration = Math.round(Number(params.duration))
    if (params.generateAudio != null || params.generate_audio != null) {
      payload.generate_audio = (params.generateAudio ?? params.generate_audio) !== false
    }
    if (params.seed != null) payload.seed = params.seed
  }

  const response = await fetch(`${WAVESPEED_API_BASE}/api/v3/${model}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw wsError(data?.message || data?.error || 'wavespeed_submit_failed', data, response.status)
  }
  const d = data?.data || {}
  const taskId = d.id || d.taskId || d.task_id
  if (!taskId) throw wsError('wavespeed_missing_task_id', data, response.status)
  return { taskId: String(taskId), model, getUrl: d?.urls?.get || null }
}

/**
 * Fragt den Status eines WaveSpeed-Jobs ab.
 * @returns {Promise<{ state:'queued'|'running'|'succeeded'|'failed', outputUrl?:string, videoUrl?:string, imageUrl?:string, outputs?:string[], failMsg?:string }>}
 */
export async function wavespeedTaskState({ taskId, getUrl } = {}) {
  const key = wavespeedApiKey()
  if (!key) throw wsError('server_misconfigured_missing_wavespeed_key', null, 500)
  const id = String(taskId || '').trim()
  if (!id && !getUrl) throw wsError('missing_task_id', null, 400)

  const url = getUrl || `${WAVESPEED_API_BASE}/api/v3/predictions/${encodeURIComponent(id)}/result`
  const response = await fetch(url, { headers: { Authorization: `Bearer ${key}` } })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw wsError(data?.message || 'wavespeed_status_failed', data, response.status)

  const d = data?.data || {}
  const status = String(d.status || '').toLowerCase()

  if (status === 'created' || status === 'queued' || status === 'pending') return { state: 'queued' }
  if (status === 'processing' || status === 'running' || status === '') return { state: 'running' }
  if (status === 'completed' || status === 'succeeded' || status === 'success') {
    const outputs = Array.isArray(d.outputs) ? d.outputs.filter((u) => String(u || '').startsWith('http')) : []
    const out = outputs[0] || null
    if (!out) return { state: 'failed', failMsg: 'no_output_in_result' }
    // Gleiche URL unter allen gängigen Feldnamen ausliefern → App-Image- UND
    // Video-Poll-Pfad funktionieren ohne Sonderfall.
    return { state: 'succeeded', outputUrl: out, videoUrl: out, imageUrl: out, audioUrl: out, outputs }
  }
  return { state: 'failed', failMsg: d.error || d.failMsg || d.message || 'generation_failed' }
}
