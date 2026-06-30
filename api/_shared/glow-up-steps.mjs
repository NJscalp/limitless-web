/** Sequential glow-up steps — personalized realistic lean-face (fat loss + facial training). */

import { deriveGlowUpVisionFlags } from './glow-up-vision-utils.mjs'

/** Mid-face first (leaner cheeks), then periorbital, then skin — balanced on THIS face only. */
export const DEFAULT_GLOW_UP_STEPS = ['midface', 'undereye', 'skin']

const REALISM = `REALISTIC PERSONALIZED GLOW-UP — edit ONLY this input person. NO reference face, NO model look, NO celebrity template, NO face swap.
Simulate believable 8–12 weeks of fat loss + facial training + hydration/skincare: thinner soft-tissue face, defined cheeks, rested eyes — same bones, same identity, same lighting.`

const NO_REFERENCE = `⛔ NO REFERENCE IMAGE: do NOT copy any external face, ideal jaw, or stock "hunter eye" template. Every change must be derived ONLY from reducing THIS person's own soft tissue vs the input photo.`

const EYE_GOAL = `Periorbital (THIS face only): reduce under-eye fat + water retention so eyes look more open and rested — a natural "hunter-eye" READ from de-bloat only.
Same iris color, same eye size, same eye shape, same eyelid crease. Do NOT lift, reshape, or redraw eyebrows — brow shape/arch/position stay identical.`

const BROW_GOAL = `Eyebrows: appear slightly fuller and healthier (less sparse, groomed, rested) — but EXACT same shape, arch, thickness category, position, and color as input. No block brows, no lamination lift, no redrawn arches.`

const HEAD_HAIR_LOCK = `⛔ HEAD HAIR FROZEN: copy exact scalp hair color, length, style, texture, volume, and hairline from input — no restyle, trim, or recolor.`

function unwrapVision(raw) {
  if (!raw) return null
  return raw?.analysis ?? raw
}

export function glowUpStepPipelineEnabled() {
  const raw = String(process.env.FUTURE_SELF_GLOW_UP_STEP_PIPELINE ?? '0').trim().toLowerCase()
  if (raw === '0' || raw === 'false' || raw === 'off' || raw === 'no') return false
  return true
}

export function glowUpPipelineSteps() {
  const raw = String(process.env.FUTURE_SELF_GLOW_UP_STEPS || '').trim()
  if (raw) {
    const steps = raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
    if (steps.length) return steps
  }
  return [...DEFAULT_GLOW_UP_STEPS]
}

/** Off by default — caused over-sharpened lower jaw. */
export function glowUpCheeksBoostEnabled() {
  const raw = String(process.env.FUTURE_SELF_GLOW_UP_CHEEKS_BOOST ?? '0').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes'
}

function viewLabel(mode) {
  return String(mode || 'front').toLowerCase().includes('side') ? 'Side profile' : 'Front'
}

function marksNoteForVision(vision) {
  const { hasInputMoles } = deriveGlowUpVisionFlags(vision || {})
  return hasInputMoles
    ? 'Keep existing moles exactly.'
    : 'No new moles — fade redness only.'
}

/** Step 1 — leaner cheeks / mid-face (fat loss + training look). */
export function buildMidfaceStepPrompt(mode = 'front', stepIndex = 1, stepTotal = 3) {
  return `${viewLabel(mode)} STEP ${stepIndex}/${stepTotal} — LEANER FACE + DEFINED CHEEKS (THIS PERSON ONLY):

${REALISM}
${NO_REFERENCE}

Simulate moderate facial fat loss + mewing/chewing-hypertrophy training on THIS exact face:
• Reduce buccal + mid-face soft fat — cheeks visibly leaner, less round mid-face width
• Cheekbones read clearer through tissue loss — same bone width/position as input
• Even, natural balance — NOT jaw-only sculpt; mandible/chin bones unchanged

${BROW_GOAL}
⛔ Same person/pose/lighting. ${HEAD_HAIR_LOCK} Skin color unchanged.`
}

export function buildCheeksStepPrompt(mode = 'front', stepIndex = 1, stepTotal = 3) {
  return buildMidfaceStepPrompt(mode, stepIndex, stepTotal)
}

/** Step 2 — periorbital de-bloat for rested, open eyes (no brow reshape). */
export function buildUndereyeStepPrompt(mode = 'front', stepIndex = 2, stepTotal = 3) {
  return `${viewLabel(mode)} STEP ${stepIndex}/${stepTotal} — RESTED OPEN EYES (THIS PERSON ONLY):

${REALISM}
${EYE_GOAL}

Build on leaner cheeks from step 1 — periorbital soft tissue only:
• Flatten tear trough + under-eye bags — less periorbital fat and water retention
• Eyes look more open, alert, rested — natural hunter-eye effect from de-bloat ONLY
• Upper lid slightly less heavy if puffy — same eye shape and iris

${BROW_GOAL}
⛔ Do NOT reshape brows or eyes. Do NOT touch jaw/chin bones. Same person/pose/lighting. ${HEAD_HAIR_LOCK}`
}

/** Step 3 — cleaner skin, frozen undertone. */
export function buildSkinStepPrompt(mode = 'front', visionRaw = null, stepIndex = 3, stepTotal = 3) {
  const vision = unwrapVision(visionRaw)
  const zones = vision?.blemishAreas?.length
    ? vision.blemishAreas.join(', ')
    : 'chin, cheeks, forehead, nose'
  const marks = marksNoteForVision(vision)

  return `${viewLabel(mode)} STEP ${stepIndex}/${stepTotal} — CLEANER SKIN (SAME SKIN COLOR):

Fade active acne, pimples, redness in ${zones} — cleaner, clearer skin.
EXACT same skin color, undertone, melanin, warmth as input — match neck/ears. NO lightening, darkening, or tan shift.
${marks}
⛔ Do NOT change face shape, cheeks, under-eyes, jaw, or brows. Same person/pose/lighting. ${HEAD_HAIR_LOCK}`
}

export function buildGlowUpStepPrompt(step, mode = 'front', _m = null, _p = null, visionRaw = null, stepIndex = 1, stepTotal = 3) {
  const key = String(step || '').trim().toLowerCase()
  switch (key) {
    case 'midface':
    case 'mid-face':
      return buildMidfaceStepPrompt(mode, stepIndex, stepTotal)
    case 'cheeks_boost':
    case 'boost':
      return buildMidfaceStepPrompt(mode, stepIndex, stepTotal)
    case 'cheeks':
    case 'cheek':
    case 'buccal':
      return buildMidfaceStepPrompt(mode, stepIndex, stepTotal)
    case 'undereye':
    case 'under-eye':
    case 'eyes':
    case 'infraorbital':
      return buildUndereyeStepPrompt(mode, stepIndex, stepTotal)
    case 'face':
      return `${buildMidfaceStepPrompt(mode, stepIndex, stepTotal)}\n${buildUndereyeStepPrompt(mode, stepIndex, stepTotal)}`
    case 'skin':
    case 'blemish':
    case 'acne':
      return buildSkinStepPrompt(mode, visionRaw, stepIndex, stepTotal)
    default:
      return buildMidfaceStepPrompt(mode, stepIndex, stepTotal)
  }
}

export const STEP_SYSTEM_SUFFIX = {
  midface: '\nTHIS FACE ONLY: leaner cheeks via soft-tissue fat loss — realistic training look. No reference template. Bones frozen.',
  cheeks: '\nTHIS FACE ONLY: leaner buccal cheeks — fat loss look. Bones frozen.',
  undereye: '\nTHIS FACE ONLY: open rested eyes via under-eye de-bloat — same eye/brow shape. No brow reshape.',
  skin: '\nSkin cleanup only — same skin color/undertone. Zero new moles.',
}

export function stepSystemSuffix(step) {
  const key = String(step || '').trim().toLowerCase()
  if (key === 'midface' || key === 'mid-face') return STEP_SYSTEM_SUFFIX.midface
  if (key === 'cheek' || key === 'buccal' || key === 'cheeks' || key === 'boost' || key === 'cheeks_boost') {
    return STEP_SYSTEM_SUFFIX.midface
  }
  if (key === 'under-eye' || key === 'eyes' || key === 'infraorbital') return STEP_SYSTEM_SUFFIX.undereye
  if (key === 'blemish' || key === 'acne' || key === 'skin') return STEP_SYSTEM_SUFFIX.skin
  return STEP_SYSTEM_SUFFIX.midface
}

export { REALISM as GLOW_UP_REALISM_BLOCK }
