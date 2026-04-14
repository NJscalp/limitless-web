/**
 * Unwraps and normalizes face-analyze JSON so keys match FullAIFaceAnalysisPayload (camelCase).
 */

const SNAKE_TO_CAMEL: Record<string, string> = {
  overall_score: 'overallScore',
  potential_score: 'potentialScore',
  landmark_structural_overall: 'landmarkStructuralOverall',
  jawline_definition: 'jawlineDefinition',
  water_retention: 'waterRetention',
  facial_definition: 'facialDefinition',
  facial_symmetry: 'facialSymmetry',
  classical_ideal_score: 'classicalIdealScore',
  eye_area: 'eyeArea',
  cheekbone_definition: 'cheekboneDefinition',
  chin_neck_definition: 'chinNeckDefinition',
  forehead_smoothness: 'foreheadSmoothness',
  midface_fullness: 'midfaceFullness',
  nose_score: 'noseScore',
  lip_score: 'lipScore',
  jaw_shadow_index01: 'jawShadowIndex01',
  cheek_shadow_index01: 'cheekShadowIndex01',
  lighting_confidence01: 'lightingConfidence01',
  definition_level: 'definitionLevel',
  bloat_severity0to100: 'bloatSeverity0to100',
  skin_quality30to90: 'skinQuality30to90',
  looksmax_eye: 'looksmaxEye',
  looksmax_jawline: 'looksmaxJawline',
  looksmax_harmony: 'looksmaxHarmony',
  looksmax_overall: 'looksmaxOverall',
  looksmax_potential: 'looksmaxPotential',
  pose_passed: 'posePassed',
  yaw_deg: 'yawDeg',
  pitch_deg: 'pitchDeg',
  roll_deg: 'rollDeg',
}

function camelizeKey(k: string): string {
  return SNAKE_TO_CAMEL[k] ?? k
}

function flattenKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    const ck = camelizeKey(k)
    out[ck] = v
  }
  return out
}

/** Accepts API body: `{ analysis: {...} }`, `{ analysis: "{...}" }`, or flat analysis object */
export function extractAnalysisRecord(raw: unknown): Record<string, unknown> | null {
  if (raw == null || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>

  let inner: unknown = o.analysis
  if (inner == null && o.data != null && typeof o.data === 'object') {
    inner = (o.data as Record<string, unknown>).analysis
  }

  if (typeof inner === 'string') {
    try {
      inner = JSON.parse(inner)
    } catch {
      inner = null
    }
  }

  if (inner && typeof inner === 'object') {
    return flattenKeys(inner as Record<string, unknown>)
  }

  if (
    numLike(o.overallScore) ||
    numLike(o.potentialScore) ||
    numLike(o.jawlineDefinition)
  ) {
    return flattenKeys(o)
  }

  return null
}

function numLike(v: unknown): boolean {
  if (typeof v === 'number' && !Number.isNaN(v)) return true
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return true
  return false
}
