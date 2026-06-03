/**
 * Vercel Serverless — Face-Analyse via Anthropic Claude Opus (Vision).
 * Gleiche Logik wie `server/index.mjs /v1/face-analyze-full`.
 */
import { isAuthorized, rejectUnauthorized } from './_shared/auth.mjs'
import {
  anthropicKey,
  anthropicModel,
  anthropicVisionJSON,
  detectMediaType,
} from './_shared/anthropic.mjs'
import {
  FACE_ANALYZE_SYSTEM_PROMPT,
  FACE_ANALYZE_USER_PROMPT,
  FACE_ANALYZE_GLOW_UP_AFTER_SYSTEM_PROMPT,
  FACE_ANALYZE_GLOW_UP_AFTER_USER_PROMPT,
} from './_shared/face-analyze-prompts.mjs'

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

  const context = String(body?.context || 'standard').trim().toLowerCase()
  const isGlowUpAfter = context === 'glow_up_after' || context === 'glowup_after'
  const system = isGlowUpAfter ? FACE_ANALYZE_GLOW_UP_AFTER_SYSTEM_PROMPT : FACE_ANALYZE_SYSTEM_PROMPT
  const userText = isGlowUpAfter ? FACE_ANALYZE_GLOW_UP_AFTER_USER_PROMPT : FACE_ANALYZE_USER_PROMPT

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
      system,
      userText,
      imageBase64,
      mediaType: detectMediaType(imageBase64),
      max_tokens: 2800,
      temperature: 0.08,
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
