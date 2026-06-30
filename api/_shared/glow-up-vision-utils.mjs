/** Shared glow-up vision helpers (no imports — safe for prompt-builder + fal). */

/** @returns {{ needsDeBloat: boolean, hasInputMoles: boolean, leanFace: boolean }} */
export function deriveGlowUpVisionFlags(vision) {
  if (!vision) {
    return { needsDeBloat: true, hasInputMoles: false, leanFace: false }
  }

  const fullness = String(vision.faceFullness || 'unknown').toLowerCase()
  const waterLevel = String(vision.waterRetentionLevel || 'unknown').toLowerCase()
  const buccalLevel = String(vision.buccalFatLevel || 'unknown').toLowerCase()
  const jawState = String(vision.jawDefinitionState || 'unknown').toLowerCase()
  const explicitlyLean = fullness === 'lean'
    && waterLevel === 'none'
    && buccalLevel === 'lean'
    && jawState === 'sharp'
    && (vision.puffinessAreas?.length ?? 0) === 0

  // Glow-up app: assume de-bloat needed unless face is explicitly lean with zero puffiness.
  const needsDeBloat = !explicitlyLean
    || (vision.puffinessAreas?.length ?? 0) > 0
    || fullness === 'average' || fullness === 'puffy' || fullness === 'moon_face'
    || waterLevel === 'mild' || waterLevel === 'moderate' || waterLevel === 'heavy'
    || buccalLevel === 'moderate' || buccalLevel === 'full'
    || jawState === 'soft' || jawState === 'hidden'
    || (Number(vision.waterDrainRealisticPct) >= 30)
    || (Number(vision.fatReductionRealisticPct) >= 22)

  const hasInputMoles = Boolean(vision.skinMarks?.hasMoles)
    && (vision.skinMarks?.moleCount ?? 0) > 0

  const leanFace = explicitlyLean

  return { needsDeBloat, hasInputMoles, leanFace }
}
