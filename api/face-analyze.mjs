/**
 * Vercel Serverless — echte Face-Analyse via Anthropic Claude Opus (Vision).
 * Selbe Prompt-Logik wie `server/index.mjs /v1/face-analyze-full`, damit Web und
 * iOS-App identische Ratings bekommen.
 *
 * ENV (Vercel → Project Settings → Environment Variables):
 *   ANTHROPIC_API_KEY  (required) — Anthropic API Key
 *   MODEL              (optional) — default "claude-opus-4-6"
 *   FACE_BACKEND_URL   (optional) — falls gesetzt, wird stattdessen dieser Proxy verwendet
 *   FACE_BACKEND_SECRET (optional) — Bearer-Token für FACE_BACKEND_URL
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'

const SYSTEM_PROMPT = `You are an expert facial aesthetics analyst for a looksmaxing / facial wellness app.
You must analyze the visible face in the selfie and output ONE JSON object only. No markdown, no code fences.
Scales: category scores 30–90 integers (higher = better for that trait), except where noted.
Be consistent: lighting and angle limit certainty — set lightingConfidence01 lower for harsh flash, motion blur, or extreme angles.
bloatSeverity0to100: 0 = very lean defined, 100 = very soft / bloated appearance.
skinQuality30to90: skin clarity / texture / evenness visible in the photo.
midfaceFullness: use the app's UI label "Midface Length" semantics — score how compact vs vertically elongated the midface reads (higher = more compact / favorable for typical ideals, lower = longer midface appearance).
potentialScore must be >= overallScore. looksmax fields are 1.0–10.0 decimals.`

const USER_PROMPT = `Analyze this face for a looksmaxing report. Estimate head pose from the image (yawDeg, pitchDeg, rollDeg in degrees; frontal = small values).
Return exactly one JSON object with these keys:
overallScore (30-90 int), potentialScore (30-90 int), landmarkStructuralOverall (30-90 int),
jawlineDefinition (30-90), facialSymmetry (30-90), eyeArea (30-90), cheekboneDefinition (30-90), chinNeckDefinition (30-90),
facialDefinition (30-90), classicalIdealScore (30-90), foreheadSmoothness (30-90), midfaceFullness (30-90),
noseScore (30-90), lipScore (30-90), waterRetention (30-90 — puffiness / water appearance),
jawShadowIndex01 (0-1 number), cheekShadowIndex01 (0-1), lightingConfidence01 (0-1),
definitionLevel (string: exactly one of Lean, Average, Bloated),
bloatSeverity0to100 (0-100 integer), skinQuality30to90 (30-90 integer),
looksmaxEye (1-10), looksmaxJawline (1-10), looksmaxHarmony (1-10), looksmaxOverall (1-10), looksmaxPotential (1-10),
posePassed (boolean), yawDeg (number), pitchDeg (number), rollDeg (number).
No other keys. No explanation.`

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body
  const imageBase64 = body?.imageBase64

  if (typeof imageBase64 !== 'string' || !imageBase64.length) {
    return res.status(400).json({ error: 'missing_imageBase64' })
  }

  const proxyBase = (process.env.FACE_BACKEND_URL || '').replace(/\/$/, '')
  if (proxyBase) {
    return proxyToBackend(proxyBase, imageBase64, res)
  }

  const anthropicKey = (process.env.ANTHROPIC_API_KEY || '').trim()
  if (!anthropicKey) {
    return res.status(501).json({
      error: 'ai_not_configured',
      hint: 'Set ANTHROPIC_API_KEY in Vercel env — or set FACE_BACKEND_URL to your Node proxy.',
    })
  }

  try {
    const analysis = await anthropicVisionJSON({
      apiKey: anthropicKey,
      model: (process.env.MODEL || 'claude-opus-4-6').trim(),
      system: SYSTEM_PROMPT,
      userText: USER_PROMPT,
      imageBase64,
      mediaType: detectMediaType(imageBase64),
      max_tokens: 2200,
      temperature: 0.22,
    })
    return res.status(200).json({ analysis })
  } catch (err) {
    console.error('face-analyze', err)
    if (err?.status) {
      return res.status(502).json({ error: 'anthropic_error', detail: err.detail, message: err.message })
    }
    return res.status(502).json({ error: 'parse_or_model_error', message: String(err?.message || err) })
  }
}

async function proxyToBackend(base, imageBase64, res) {
  const secret = (process.env.FACE_BACKEND_SECRET || '').trim()
  const headers = { 'Content-Type': 'application/json' }
  if (secret) headers.Authorization = `Bearer ${secret}`
  try {
    const r = await fetch(`${base}/v1/face-analyze-full`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ imageBase64 }),
    })
    const data = await r.json().catch(() => ({}))
    return res.status(r.status).json(data)
  } catch (e) {
    return res.status(502).json({ error: 'proxy_failed', message: String(e?.message || e) })
  }
}

async function anthropicVisionJSON({
  apiKey,
  model,
  system,
  userText,
  imageBase64,
  mediaType,
  max_tokens = 2000,
  temperature = 0.22,
}) {
  const payload = {
    model,
    max_tokens,
    temperature,
    system,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: imageBase64,
            },
          },
          { type: 'text', text: userText },
        ],
      },
    ],
  }

  const headers = {
    'content-type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  }

  const r = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })
  const data = await r.json().catch(() => ({}))

  if (!r.ok) {
    const err = new Error('anthropic_http')
    err.status = r.status
    err.detail = data
    throw err
  }

  const textBlock = Array.isArray(data?.content) ? data.content.find((c) => c.type === 'text') : null
  const text = textBlock?.text
  if (!text) {
    const err = new Error('no_text_in_response')
    err.detail = data
    throw err
  }

  const jsonStr = extractJSONObject(text)
  try {
    return JSON.parse(jsonStr)
  } catch (e) {
    const err = new Error('invalid_json_from_model')
    err.detail = { raw: text.slice(0, 600) }
    throw err
  }
}

function extractJSONObject(text) {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) return text
  return text.slice(start, end + 1)
}

function safeJson(s) {
  try {
    return JSON.parse(s)
  } catch {
    return {}
  }
}

/**
 * Best-effort media-type sniff aus Base64-Header (data-URL prefixes werden
 * im Client bereits gestrippt). Fallback jpeg.
 */
function detectMediaType(b64) {
  if (typeof b64 !== 'string' || b64.length < 16) return 'image/jpeg'
  const head = b64.slice(0, 16)
  if (head.startsWith('iVBOR')) return 'image/png'
  if (head.startsWith('/9j/')) return 'image/jpeg'
  if (head.startsWith('UklGR')) return 'image/webp'
  if (head.startsWith('R0lGO')) return 'image/gif'
  return 'image/jpeg'
}
