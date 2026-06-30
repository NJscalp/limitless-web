import { isAuthorized, rejectUnauthorized } from './_shared/auth.mjs'
import { analyzeGlowUpImage, extractGlowUpCoachingPlan, glowUpVisionEnabled } from './_shared/glow-up-vision.mjs'
import { validateImageBase64Length } from './_shared/request-limits.mjs'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method_not_allowed' })
  }
  if (!isAuthorized(req)) return rejectUnauthorized(res)

  if (!glowUpVisionEnabled()) {
    return res.status(503).json({
      error: 'glow_up_vision_disabled',
      message: 'Claude Vision is not configured on the server.',
    })
  }

  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body
  const imageBase64 = String(body?.imageBase64 || body?.init_image || '').trim()
  const mode = body?.mode || 'front'
  if (!imageBase64) {
    return res.status(400).json({ error: 'missing_image_base64' })
  }
  const sizeCheck = validateImageBase64Length(imageBase64)
  if (!sizeCheck.ok) {
    return res.status(sizeCheck.status).json({
      error: sizeCheck.error,
      message: sizeCheck.message,
    })
  }

  try {
    const visionResult = await analyzeGlowUpImage(imageBase64, mode)
    if (!visionResult?.analysis) {
      return res.status(503).json({
        error: 'glow_up_vision_failed',
        message: 'Could not analyze this photo. Use a clear, front-facing selfie and retry.',
        visionError: visionResult?.error ?? 'no_analysis',
      })
    }

    const metrics = body?.metrics ?? null
    const faceProfile = body?.faceProfile ?? null
    const { buildGlowUpPrompt } = await import('./_shared/future-self-prompts.mjs')
    const promptPreview = buildGlowUpPrompt(
      mode,
      metrics,
      faceProfile,
      'concise',
      visionResult,
    )

    return res.status(200).json({
      code: 200,
      msg: 'success',
      data: {
        analysis: visionResult.analysis,
        coaching: extractGlowUpCoachingPlan(visionResult.analysis),
        model: visionResult.model,
        keywords: visionResult.analysis.personalizedKeywords ?? [],
        priorityZones: visionResult.analysis.priorityZones ?? [],
        promptLength: promptPreview.length,
        promptPreview: promptPreview.slice(0, 480),
      },
    })
  } catch (err) {
    console.error('glow-up-analyze', err)
    return res.status(502).json({
      error: 'glow_up_analyze_failed',
      message: String(err?.message || err),
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
