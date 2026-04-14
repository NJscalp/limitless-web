/** Same strings + math as FaceAnalysisShared in FaceView.swift */
export const GALLERY_ANALYSIS_STEPS = [
  'Detecting face...',
  'Mapping 76+ landmarks...',
  'Analyzing jawline...',
  'Measuring symmetry...',
  'Evaluating eye area...',
  'Checking bloat level...',
  'Scoring cheekbones...',
  'Computing AI score...',
] as const

export const ANALYSIS_PROGRESS_CAP = 0.92

export function indeterminateProgress(
  elapsedSec: number,
  cap = ANALYSIS_PROGRESS_CAP,
  timeConstant = 6.5,
): number {
  return Math.min(cap * (1 - Math.exp(-elapsedSec / timeConstant)), cap)
}

export function stepIndex(
  elapsedSec: number,
  stepCount: number,
  secondsPerStep = 1.35,
): number {
  if (stepCount <= 0) return 0
  return Math.min(stepCount - 1, Math.max(0, Math.floor(elapsedSec / secondsPerStep)))
}

/** Orange → blue tier color by score 0–100 (limitlessScoreTierColor) */
export function limitlessScoreTierColor(score: number): string {
  const t = Math.max(0, Math.min(100, score)) / 100
  const r = 1 * (1 - t) + 0 * t
  const g = 0.58 * (1 - t) + 0.48 * t
  const b = 0 * (1 - t) + 1 * t
  return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`
}

export function scoreLabel(score: number): string {
  if (score >= 80) return 'Elite'
  if (score >= 65) return 'Great'
  if (score >= 50) return 'Good'
  if (score >= 35) return 'Low'
  return 'Improve'
}

/** Deterministic pseudo-scores from image bytes (demo — not real ML) */
export async function deriveDemoScoresFromFile(file: File): Promise<{
  overall: number
  potential: number
  jawline: number
  symmetry: number
  classicalIdeal: number
  eyeArea: number
  cheekbones: number
  definition: number
  bloat: number
  skin: number
  nose: number
  lips: number
  midface: number
}> {
  const buf = await file.slice(0, 65536).arrayBuffer()
  const u8 = new Uint8Array(buf)
  let h = 2166136261
  for (let i = 0; i < u8.length; i++) {
    h ^= u8[i]
    h = Math.imul(h, 16777619)
  }
  const r = (n: number) => 35 + ((h >>> (n % 24)) & 0xff) % 50

  const overall = Math.min(94, Math.max(38, r(0) + r(1) % 15))
  const potential = Math.min(99, overall + 8 + (r(2) % 12))

  return {
    overall,
    potential,
    jawline: r(3),
    symmetry: r(4),
    classicalIdeal: r(5),
    eyeArea: r(6),
    cheekbones: r(7),
    definition: r(8),
    bloat: r(9),
    skin: r(10),
    nose: r(11),
    lips: r(12),
    midface: r(13),
  }
}
