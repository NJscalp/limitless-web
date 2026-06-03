/** Front glow-up image prompt. Empty = front glow-up disabled. */
export const FUTURE_SELF_GLOW_UP_PROMPT_FRONT = `[TASK: INTENSIFIED LOOKSMAXXING TRANSFORMATION - MAXIMUM DE-BLOAT & HIGH DEFINITION]
Perform an intensified, highly attractive, and striking lifestyle glow-up of the exact person in the input image. The transformation must showcase a maximum realistic reduction in facial water retention and soft tissue volume, making the face look significantly leaner, sharper, and more defined while preserving 100% of the original identity, lighting, and color.

1. INTENSIFIED JAWLINE & CHIN SHARPNESS:
- Maximally tighten and deeply lean down the lower face tissue. The jawline must appear razor-sharp, ultra-clean, and highly defined against the neck.
- Completely strip away any soft tissue volume along the jaw and under the chin, forcing the skin to tightly hug the native bone architecture in a powerful, highly visible way. Do not widen or mutate the bone.

2. HIGH-DEFINITION CHEEKBONES & BUCCAL LEANING:
- Apply maximum leaning to the lower cheeks (buccal fat area) to completely eliminate facial bloating and puffiness. This must make the native cheekbones look strikingly prominent, sculpted, and elegant.
- The definition must look like the result of an elite body fat percentage—strictly forbid fake, muddy makeup shadows.

3. OPTIMIZED & PIERCING EYE AREA:
- Completely eliminate all under-eye bags, dark shadows, and morning swelling. The skin around the entire eye area must look perfectly taut, smooth, and refreshed.
- Maximize the visual clarity and natural brightness of the eyes for an intense, healthy, and highly attractive awake gaze. Eyebrows are flawlessly sharp and groomed.

4. FLAWLESS SKINCARE & ABSOLUTE VISUAL LOCK:
- The skin must be exceptionally clean, clear, and radiant, erasing all blemishes, acne, or redness, while strictly maintaining raw camera micro-pores, natural skin grain, and stubble.
- ABSOLUTE LOCK: The dim, moody low-light atmosphere, the specific native skin tone, the background, clothing, and framing must remain 100% identical to the source photo. No artificial brightening, no gray shifts, and no tan.

Preserve identical image dimensions, framing, crop, face position, scale, and the exact background as the input photo.`

/** Side profile glow-up image prompt. Empty = side glow-up disabled. */
export const FUTURE_SELF_GLOW_UP_PROMPT_SIDE = `[TASK: VISIBLE SIDE PROFILE LOOKSMAXXING - DE-BLOAT & SILHOUETTE REFINEMENT]
Perform a distinct, highly attractive, and realistic side-profile glow-up of the exact person in the input image. The transformation must focus entirely on sharpening the silhouette, reducing submental fullness, and maximizing facial leaning from the side view, while preserving 100% of the original identity, lighting, and color.

1. ROCKET-SHARP JAWLINE & SUBMENTAL AREA (SIDE VIEW):
- Visibly tighten and lift the skin under the jaw (the submental area) to completely eliminate any softness, sagging, or water retention between the chin and the neck.
- The jawline contour running from the ear lobe down to the chin must appear razor-sharp, clean, and athletically defined. Do NOT artificially elongate the jawbone or mutate the native chin projection.

2. CHEEKBONE & MID-FACE SIDE PROFILE:
- Distinctly lean down the cheek area visible from the side, highlighting the natural, prominent curve of the native cheekbone projection.
- Ensure the transition from the cheek to the jaw looks exceptionally fit, toned, and model-like without adding fake geometric bone structures or muddy makeup shadows.

3. PROFILE INTEGRITY (EYES, NOSE, LIPS):
- Keep the exact original profile silhouette of the nose bridge, lips, and forehead completely unaltered—do NOT perform digital rhinoplasty or change native lip size.
- Smooth the skin transitions along the profile line. Cleanly refresh the eye area visible from the side, eliminating any lateral puffiness, dark circles, or tiredness. Eyebrows must look sharp and perfectly groomed from the side view.

4. SKINCARE & TOTAL ENVIRONMENT LOCK:
- The skin must look flawlessly clean, clear, and highly hydrated from the side view, removing all minor blemishes, acne, or redness, while strictly retaining raw camera micro-pores, natural skin grain, and stubble.
- ABSOLUTE LOCK: The dim, moody low-light atmosphere, the specific native skin tone, the background, clothing, and the exact profile framing must remain 100% identical to the source photo. No artificial brightening or color shifts.

Preserve identical image dimensions, framing, crop, face position, scale, and the exact background as the input photo.`

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

export function assertFutureSelfGlowUpPrompt(mode = 'front') {
  const key = normalizeFutureSelfMode(mode)
  const prompt = futureSelfCombinedPrompt(key)
  if (!prompt) {
    const err = new Error('missing_glow_up_prompt')
    err.detail =
      `No glow-up prompt configured for mode "${key}". Set FUTURE_SELF_GLOW_UP_PROMPT_${key === 'side' ? 'SIDE' : 'FRONT'} in api/_shared/future-self-prompts.mjs and redeploy.`
    throw err
  }
  return prompt
}

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
