import { isAuthorized, rejectUnauthorized } from './_shared/auth.mjs'
import {
  anthropicKey,
  anthropicModel,
  anthropicVisionJSON,
  detectMediaType,
} from './_shared/anthropic.mjs'

const SYSTEM_PROMPT = `You are a concise computer vision assistant for a wellness app. You only output valid minified JSON objects.`

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method_not_allowed' })
  }
  if (!isAuthorized(req)) return rejectUnauthorized(res)

  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body
  const imageBase64 = body?.imageBase64
  const localScoresJson = body?.localScoresJson

  if (typeof imageBase64 !== 'string' || !imageBase64.length) {
    return res.status(400).json({ error: 'missing_imageBase64' })
  }
  if (typeof localScoresJson !== 'string') {
    return res.status(400).json({ error: 'missing_localScoresJson' })
  }

  const apiKey = anthropicKey()
  if (!apiKey) {
    return res.status(500).json({ error: 'server_misconfigured_missing_anthropic_key' })
  }

  const userText = `The fitness app computed these preliminary face scores (each 30–90) from on-device face geometry and texture:
${localScoresJson}

Look at the attached selfie. Refine the integer scores for visible leanness vs. fullness, jaw and neck definition, perceived water retention / puffiness, facial definition and shadows, symmetry, eyes, cheekbones, chin–neck, forehead, midface, nose and lips. Respect poor lighting: do not over-penalize when the image is dark or flatly lit.

Output ONLY one JSON object with these keys (all integers 30–90): overallScore, potentialScore, landmarkStructuralOverall, jawlineDefinition, waterRetention, facialDefinition, facialSymmetry, classicalIdealScore, eyeArea, cheekboneDefinition, chinNeckDefinition, foreheadSmoothness, midfaceFullness, noseScore, lipScore.
Rules: potentialScore must be >= overallScore. No markdown, no code fences, no explanation — only raw JSON.`

  try {
    const refinement = await anthropicVisionJSON({
      apiKey,
      model: anthropicModel(),
      system: SYSTEM_PROMPT,
      userText,
      imageBase64,
      mediaType: detectMediaType(imageBase64),
      max_tokens: 1600,
      temperature: 0.2,
    })
    return res.status(200).json({ refinement })
  } catch (err) {
    console.error('face-refine', err)
    if (err?.status) {
      return res.status(502).json({ error: 'anthropic_error', detail: err.detail })
    }
    return res.status(502).json({ error: 'invalid_model_json', message: String(err?.message || err) })
  }
}

function safeJson(s) {
  try {
    return JSON.parse(s)
  } catch {
    return {}
  }
}
