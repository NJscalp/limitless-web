/** Front glow-up — hybrid builder in future-self-prompt-builder.mjs (gate check only). */
import {
  buildHybridGlowUpPrompt,
  buildConciseGlowUpPrompt,
  buildGlowUpPrompt,
  buildGlowUpDeBloatPromptLead,
  glowUpPromptMeta,
  parseGlowUpMetrics,
  parseFaceProfile,
  classifyFacialComposition,
  resolveGlowUpPlan,
} from './future-self-prompt-builder.mjs'

export const FUTURE_SELF_GLOW_UP_PROMPT_FRONT = 'natural-realistic-glow-up'

/** Side glow-up — hybrid builder (gate check only). */
export const FUTURE_SELF_GLOW_UP_PROMPT_SIDE = 'natural-realistic-glow-up-side'

/** @deprecated Use mode-specific prompts — kept for imports only. */
export const FUTURE_SELF_GLOW_UP_PROMPT = FUTURE_SELF_GLOW_UP_PROMPT_FRONT

export const FUTURE_SELF_MODES = {
  front: { prompt: FUTURE_SELF_GLOW_UP_PROMPT_FRONT },
  side: { prompt: FUTURE_SELF_GLOW_UP_PROMPT_SIDE },
}

export function normalizeFutureSelfMode(raw) {
  const m = String(raw || 'front').trim().toLowerCase()
  if (m === 'side' || m === 'side_profile' || m === 'sideprofile') return 'side'
  return 'front'
}

export function futureSelfCombinedPrompt(mode = 'front') {
  const key = normalizeFutureSelfMode(mode)
  const prompt = key === 'side' ? FUTURE_SELF_GLOW_UP_PROMPT_SIDE : FUTURE_SELF_GLOW_UP_PROMPT_FRONT
  return String(prompt || '').trim()
}

export function assertFutureSelfGlowUpPrompt(mode = 'front', metrics = null) {
  const key = normalizeFutureSelfMode(mode)
  const prompt = buildHybridGlowUpPrompt(key, metrics)
  if (!prompt) {
    const err = new Error('missing_glow_up_prompt')
    err.detail =
      `No glow-up prompt configured for mode "${key}". Set FUTURE_SELF_GLOW_UP_PROMPT_${key === 'side' ? 'SIDE' : 'FRONT'} in api/_shared/future-self-prompts.mjs and redeploy.`
    throw err
  }
  return prompt
}

export {
  buildHybridGlowUpPrompt,
  buildConciseGlowUpPrompt,
  buildGlowUpPrompt,
  buildGlowUpDeBloatPromptLead,
  buildShortDeBloatUserPrompt,
  buildUnifiedGlowUpUserPrompt,
  buildSecondPassDeBloatUserPrompt,
  buildCheekFocusRetryUserPrompt,
  buildDeBloatRetryUserPrompt,
  getGlowUpDeBloatTargets,
  glowUpPromptMeta,
  parseGlowUpMetrics,
  parseFaceProfile,
  classifyFacialComposition,
  resolveGlowUpPlan,
  buildVisionPersonalizationBlock,
  buildConciseHeadHairLine,
} from './future-self-prompt-builder.mjs'

/** Prefix for Fal queue request IDs returned to the iOS client. */
export const FAL_TASK_PREFIX = 'fal:'

export function isFalTaskId(taskId) {
  return String(taskId || '').startsWith(FAL_TASK_PREFIX)
}

export function stripFalTaskPrefix(taskId) {
  const id = String(taskId || '')
  return id.startsWith(FAL_TASK_PREFIX) ? id.slice(FAL_TASK_PREFIX.length) : id
}

export function toFalTaskId(requestId) {
  return `${FAL_TASK_PREFIX}${String(requestId || '').trim()}`
}
