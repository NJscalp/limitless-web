/**
 * Mirrors FaceAnalyzer.faceAnalysisResultFromFullAI + FaceView category rows + applyAnalysis (bonus 0).
 */

import type { DemoScores } from '../components/ResultsView'

export type AnalysisMeta = {
  definitionLevel: string | null
  looksmaxPosePassed: boolean
  looksmax?: Partial<{
    eye: number
    jawline: number
    harmony: number
    overall: number
    potential: number
  }>
}

export function scoreClamp30_90(v: number): number {
  return Math.max(30, Math.min(90, Math.round(v)))
}

/** Same as FaceView.categoryScoreMergingLooksmax */
export function categoryScoreMergingLooksmax(base: number, looksmax: number | undefined | null): number {
  if (looksmax == null || Number.isNaN(looksmax)) {
    return Math.min(100, Math.max(0, Math.round(base)))
  }
  return Math.min(100, Math.max(0, Math.round(looksmax * 10)))
}

/** Parse number from JSON (handles string decimals) */
function num(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const x = Number(v)
    return Number.isNaN(x) ? null : x
  }
  return null
}

function parseInt30_90(v: unknown, fallback: number): number {
  const x = num(v)
  if (x == null) return scoreClamp30_90(fallback)
  return scoreClamp30_90(x)
}

function parseLooksmax1to10(v: unknown): number | undefined {
  const x = num(v)
  if (x == null) return undefined
  return Math.min(10, Math.max(1, x))
}

/** Like applyAnalysis with weeklyTrainingBonus == 0 */
function applyDisplayCaps(overallRaw: number, potentialRaw: number): { overall: number; potential: number } {
  const overall = Math.min(99, Math.max(0, Math.round(overallRaw)))
  let potential = Math.min(100, Math.max(0, Math.round(potentialRaw)))
  potential = Math.max(potential, overall)
  return { overall, potential }
}

/**
 * Full mapping from normalized `/v1/face-analyze-full` analysis object.
 */
export function mapFullAIAnalysis(a: Record<string, unknown>): {
  scores: DemoScores
  meta: AnalysisMeta
} {
  let overallRaw = num(a.overallScore)
  if (overallRaw == null) {
    const lm = num(a.looksmaxOverall)
    if (lm != null) overallRaw = lm * 10
    else overallRaw = num(a.landmarkStructuralOverall) ?? 55
  }
  overallRaw = scoreClamp30_90(overallRaw)

  let potentialRaw = num(a.potentialScore)
  if (potentialRaw == null) {
    const lmp = num(a.looksmaxPotential)
    if (lmp != null) {
      potentialRaw = scoreClamp30_90(Math.round(lmp * 10))
    } else {
      potentialRaw = scoreClamp30_90(Math.max(overallRaw + 4, 58))
    }
  } else {
    potentialRaw = scoreClamp30_90(potentialRaw)
  }
  potentialRaw = scoreClamp30_90(Math.max(potentialRaw, overallRaw))

  const { overall, potential } = applyDisplayCaps(overallRaw, potentialRaw)

  const jawBase = parseInt30_90(a.jawlineDefinition, 55)
  const sym = parseInt30_90(a.facialSymmetry, 55)
  const classicalBase = parseInt30_90(a.classicalIdealScore, 55)
  const eyeBase = parseInt30_90(a.eyeArea, 55)
  const cheek = parseInt30_90(a.cheekboneDefinition, 55)
  const defn = parseInt30_90(a.facialDefinition, 55)
  const water = parseInt30_90(a.waterRetention, 55)

  const fhRaw = num(a.foreheadSmoothness)
  const skinQ = num(a.skinQuality30to90)
  let skinForehead: number
  if (fhRaw != null && skinQ != null) {
    skinForehead = scoreClamp30_90(Math.round((scoreClamp30_90(fhRaw) + scoreClamp30_90(skinQ)) / 2))
  } else if (skinQ != null) {
    skinForehead = scoreClamp30_90(skinQ)
  } else if (fhRaw != null) {
    skinForehead = scoreClamp30_90(fhRaw)
  } else {
    skinForehead = 60
  }

  const mid = parseInt30_90(a.midfaceFullness, 55)
  const nose = parseInt30_90(a.noseScore, 55)
  const lips = parseInt30_90(a.lipScore, 55)

  const lmEye = parseLooksmax1to10(a.looksmaxEye)
  const lmJaw = parseLooksmax1to10(a.looksmaxJawline)
  const lmHarm = parseLooksmax1to10(a.looksmaxHarmony)
  const lmOverall = parseLooksmax1to10(a.looksmaxOverall)
  const lmPotential = parseLooksmax1to10(a.looksmaxPotential)

  const jawline = categoryScoreMergingLooksmax(jawBase, lmJaw ?? undefined)
  const classicalIdeal = categoryScoreMergingLooksmax(classicalBase, lmHarm ?? undefined)
  const eyeArea = categoryScoreMergingLooksmax(eyeBase, lmEye ?? undefined)

  let defLevel: string | null = null
  if (typeof a.definitionLevel === 'string' && a.definitionLevel.trim()) {
    defLevel = a.definitionLevel.trim()
  }

  const posePassed = typeof a.posePassed === 'boolean' ? a.posePassed : true

  const scores: DemoScores = {
    overall,
    potential,
    jawline,
    symmetry: sym,
    classicalIdeal,
    eyeArea,
    cheekbones: cheek,
    definition: defn,
    bloat: water,
    skin: skinForehead,
    nose,
    lips,
    midface: mid,
  }

  const lm: NonNullable<AnalysisMeta['looksmax']> = {}
  if (lmEye != null) lm.eye = lmEye
  if (lmJaw != null) lm.jawline = lmJaw
  if (lmHarm != null) lm.harmony = lmHarm
  if (lmOverall != null) lm.overall = lmOverall
  if (lmPotential != null) lm.potential = lmPotential

  const meta: AnalysisMeta = {
    definitionLevel: defLevel,
    looksmaxPosePassed: posePassed,
    looksmax: Object.keys(lm).length ? lm : undefined,
  }

  return { scores, meta }
}

/** Deterministic demo (no API) — mirrors caps + potential ≥ overall */
export async function deriveDemoScoresFromFile(file: File): Promise<{
  scores: DemoScores
  meta: AnalysisMeta
}> {
  const buf = await file.slice(0, 65536).arrayBuffer()
  const u8 = new Uint8Array(buf)
  let h = 2166136261
  for (let i = 0; i < u8.length; i++) {
    h ^= u8[i]
    h = Math.imul(h, 16777619)
  }

  const rnd = (shift: number) => scoreClamp30_90(32 + (((h >>> shift) & 0xff) % 52))

  const overallRaw = rnd(0)
  let potentialRaw = scoreClamp30_90(overallRaw + 2 + ((h >>> 4) & 0x0f))
  potentialRaw = scoreClamp30_90(Math.max(potentialRaw, overallRaw))
  const { overall, potential } = applyDisplayCaps(overallRaw, potentialRaw)

  const scores: DemoScores = {
    overall,
    potential,
    jawline: rnd(3),
    symmetry: rnd(5),
    classicalIdeal: rnd(6),
    eyeArea: rnd(7),
    cheekbones: rnd(9),
    definition: rnd(10),
    bloat: rnd(11),
    skin: rnd(12),
    nose: rnd(13),
    lips: rnd(14),
    midface: rnd(15),
  }

  /** Demo Looksmax-Zeile (1–10) + Definition — gleiche UI wie bei KI, deterministisch aus Datei-Hash */
  const fLm = (shift: number) =>
    Math.round((1 + ((h >>> shift) & 127) / 127 * 9) * 10) / 10
  const defLevels: Array<'Lean' | 'Average' | 'Bloated'> = ['Lean', 'Average', 'Bloated']

  return {
    scores,
    meta: {
      definitionLevel: defLevels[h % 3],
      looksmaxPosePassed: true,
      looksmax: {
        eye: fLm(2),
        jawline: fLm(4),
        harmony: fLm(6),
        overall: fLm(8),
        potential: fLm(10),
      },
    },
  }
}

/** Dot center on track — same clamp as FaceScoreTrajectoryBar (Swift) */
export function trajectoryDotLeftPercent(potential: number): number {
  const pFrac = Math.min(100, Math.max(0, potential)) / 100
  const halfDotPct = 1.5
  return Math.min(100 - halfDotPct, Math.max(halfDotPct, pFrac * 100))
}
