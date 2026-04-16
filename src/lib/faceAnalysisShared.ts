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

/** Same RGB math as AppTheme.limitlessScoreTierColor (GlassModifiers.swift). */
export function limitlessScoreTierRgb(score: number): { r: number; g: number; b: number } {
  const t = Math.max(0, Math.min(100, score)) / 100
  const r = 1 * (1 - t) + 0 * t
  const g = 0.58 * (1 - t) + 0.48 * t
  const b = 0 * (1 - t) + 1 * t
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) }
}

/** Orange → blue tier color by score 0–100 (limitlessScoreTierColor) */
export function limitlessScoreTierColor(score: number): string {
  const { r, g, b } = limitlessScoreTierRgb(score)
  return `rgb(${r},${g},${b})`
}

/** FaceView.scoreGradientForOverall → diagonal text / bar first segment */
export function scoreGradientCssDiagonal(score: number): string {
  const { r, g, b } = limitlessScoreTierRgb(score)
  return `linear-gradient(135deg, rgb(${r},${g},${b}) 0%, rgba(${r},${g},${b},0.7) 100%)`
}

/** FaceView aiScorePotentialHero peakColors for Potential number */
export function potentialScoreGradientCss(): string {
  return 'linear-gradient(135deg, rgb(51, 199, 89) 0%, rgb(89, 235, 166) 45%, rgb(99, 230, 190) 100%)'
}

/** FaceScoreTrajectoryBar +gap label: accentGreen → teal */
export function gapLabelGradientCss(): string {
  return 'linear-gradient(90deg, rgb(51, 199, 89), rgb(48, 181, 199))'
}

export function scoreLabel(score: number): string {
  if (score >= 80) return 'Elite'
  if (score >= 65) return 'Great'
  if (score >= 50) return 'Good'
  if (score >= 35) return 'Low'
  return 'Improve'
}
