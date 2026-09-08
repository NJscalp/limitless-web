export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  let glowUpBootOk = false
  let glowUpBootError = null
  let glowUpRouteOk = false
  let glowUpRouteError = null
  try {
    const { buildGlowUpPrompt } = await import('./_shared/future-self-prompts.mjs')
    const prompt = buildGlowUpPrompt('front')
    glowUpBootOk = Boolean(prompt && prompt.length > 20)
  } catch (err) {
    glowUpBootError = String(err?.message || err)
  }

  try {
    await import('./kie/future-self.mjs')
    glowUpRouteOk = true
  } catch (err) {
    glowUpRouteError = String(err?.message || err)
  }

  let glowUpLimitGenerations = false
  let glowUpVisionEnabledFlag = false
  // Der Director ersetzt den alten Agenten. AGENT_PROVIDER, AGENT_MODEL und
  // AGENT_FAL_MODEL werden NICHT mehr ausgewertet — sie stehen als
  // `legacyEnvStillSet` nur noch da, damit man beim Aufräumen in Vercel sieht,
  // dass sie wirkungslos geworden sind.
  let directorBrain = 'claude-opus-5'
  let directorVision = 'google/gemini-3.5-flash'
  let directorProviderName = 'anthropic'
  try {
    const d = await import('./_shared/director-core.mjs')
    directorBrain = d.brainModel()
    directorVision = d.visionModel()
    directorProviderName = d.directorProvider()
  } catch { /* Modul fehlt → Vorgabewerte melden */ }
  const legacyEnvStillSet = [
    process.env.AGENT_PROVIDER ? 'AGENT_PROVIDER' : null,
    process.env.AGENT_MODEL ? 'AGENT_MODEL' : null,
    process.env.AGENT_FAL_MODEL ? 'AGENT_FAL_MODEL' : null,
  ].filter(Boolean)
  try {
    const { falGlowUpLimitGenerations, glowUpVisionEnabled } = await import('./_shared/fal.mjs')
    glowUpLimitGenerations = falGlowUpLimitGenerations()
    glowUpVisionEnabledFlag = glowUpVisionEnabled()
  } catch {
    glowUpLimitGenerations = String(process.env.FUTURE_SELF_FAL_LIMIT_GENERATIONS ?? '0').trim() === '1'
    glowUpVisionEnabledFlag = String(process.env.FUTURE_SELF_GLOW_UP_VISION ?? '1').trim() !== '0'
      && Boolean((process.env.ANTHROPIC_API_KEY || '').trim())
  }

  res.setHeader('Content-Type', 'application/json')
  return res.status(200).json({
    ok: true,
    service: 'day-one-face-api',
    platform: process.env.RAILWAY_ENVIRONMENT_NAME ? 'railway' : (process.env.VERCEL ? 'vercel' : 'self-hosted'),
    anthropicConfigured: Boolean((process.env.ANTHROPIC_API_KEY || '').trim()),
    agentConfigured: (
      Boolean((process.env.ANTHROPIC_API_KEY || '').trim())
      || Boolean((process.env.FAL_KEY || process.env.FAL_API_KEY || '').trim())
    ),
    directorProvider: directorProviderName,
    directorBrain,
    directorVision,
    wavespeedConfigured: Boolean((process.env.WAVESPEED_API_KEY || process.env.WAVESPEED || '').trim()),
    trendsSource: process.env.TRENDS_URL ? 'url' : (process.env.DIRECTOR_TRENDS ? 'env' : 'none'),
    legacyEnvStillSet,
    kieConfigured: Boolean((process.env.KIE_API_KEY || process.env.KIE || '').trim()),
    falConfigured: Boolean((process.env.FAL_KEY || process.env.FAL_API_KEY || '').trim()),
    clavicImageEditModel: (
      process.env.KIE_DEFAULT_IMAGE_EDIT_MODEL || 'nano-banana-2'
    ).trim(),
    glowUpProvider: 'fal',
    glowUpModel: (
      process.env.FAL_GLOW_UP_EDIT_MODEL
      || process.env.FAL_NANO_BANANA2_EDIT_MODEL
      || process.env.FAL_GPT_IMAGE2_EDIT_MODEL
      || 'fal-ai/nano-banana-2/edit'
    ).trim(),
    glowUpResolution: (process.env.FUTURE_SELF_FAL_RESOLUTION || '2K').trim(),
    glowUpPromptStyle: (process.env.FUTURE_SELF_GLOW_UP_PROMPT_STYLE || 'concise').trim(),
    glowUpVisionEnabled: glowUpVisionEnabledFlag,
    glowUpVisionModel: (
      process.env.FUTURE_SELF_GLOW_UP_VISION_MODEL
      || 'claude-sonnet-4-20250514'
    ).trim(),
    glowUpLimitGenerations,
    glowUpBootOk,
    glowUpBootError,
    glowUpRouteOk,
    glowUpRouteError,
    tiktokConfigured:
      Boolean((process.env.TIKTOK_ACCESS_TOKEN || '').trim()) &&
      Boolean((process.env.TIKTOK_PIXEL_CODE || '').trim()),
    blobConfigured: await (async () => {
      try {
        const { blobConfigured } = await import('./_shared/blob-store.mjs')
        return blobConfigured()
      } catch {
        return false
      }
    })(),
  })
}
