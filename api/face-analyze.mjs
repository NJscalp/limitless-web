/**
 * Vercel Serverless — Face-Analyse via Anthropic Claude Opus (Vision).
 * Gleiche Logik wie `server/index.mjs /v1/face-analyze-full`.
 *
 * ENV (Vercel → Project Settings → Environment Variables):
 *   ANTHROPIC_API_KEY  (required)
 *   MODEL              (optional — default claude-opus-4-6)
 *   APP_SHARED_SECRET  (optional — App muss Bearer mitsenden)
 */
import { isAuthorized, rejectUnauthorized } from './_shared/auth.mjs'
import {
  anthropicKey,
  anthropicModel,
  anthropicVisionJSON,
  detectMediaType,
} from './_shared/anthropic.mjs'

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
  if (!isAuthorized(req)) return rejectUnauthorized(res)

  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body
  const imageBase64 = body?.imageBase64
  if (typeof imageBase64 !== 'string' || !imageBase64.length) {
    return res.status(400).json({ error: 'missing_imageBase64' })
  }

  const apiKey = anthropicKey()
  if (!apiKey) {
    return res.status(501).json({
      error: 'ai_not_configured',
      hint: 'Set ANTHROPIC_API_KEY in Vercel project environment variables.',
    })
  }

  try {
    const analysis = await anthropicVisionJSON({
      apiKey,
      model: anthropicModel(),
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

function safeJson(s) {
  try {
    return JSON.parse(s)
  } catch {
    return {}
  }
}
