/**
 * Mirrors FaceAnalyzer.faceAnalysisResultFromFullAI + FaceView category rows.
 * API / model uses 30–90 integer scales; Looksmax 1–10 → ×10 for merged tiles when present.
 */

import type { DemoScores } from '../components/ResultsView'

export type AnalysisMeta = {
  definitionLevel: string | null
  looksmaxPosePassed: boolean
  /** 1–10 from API (LooksmaxScores1to10) — only keys that were present */
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

/** Same as FaceView.categoryScoreMergingLooksmax — when looksmax set, display is round(lm×10), capped 0–100 */
export function categoryScoreMergingLooksmax(base: number, looksmax: number | undefined | null): number {
  if (looksmax == null || Number.isNaN(looksmax)) {
    return Math.min(100, Math.max(0, Math.round(base)))
  }
  return Math.min(100, Math.max(0, Math.round(looksmax * 10)))
}

function parseInt30_90(v: unknown, fallback: number): number {
  let x: number
  if (typeof v === 'number' && !Number.isNaN(v)) x = v
  else if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    x = Number.isNaN(n) ? fallback : n
  } else x = fallback
  return scoreClamp30_90(x)
}

function parseLooksmax1to10(v: unknown): number | undefined {
  if (v == null) return undefined
  const x = typeof v === 'number' ? v : Number(v)
  if (Number.isNaN(x)) return undefined
  return Math.min(10, Math.max(1, x))
}

/**
 * Full mapping from `/v1/face-analyze-full` `analysis` JSON (same keys as FullAIFaceAnalysisPayload).
 */
export function mapFullAIAnalysis(a: Record<string, unknown>): {
  scores: DemoScores
  meta: AnalysisMeta
} {
  const overall = parseInt30_90(a.overallScore, 55)

  let potential = parseInt30_90(a.potentialScore, Math.max(overall, 58))
  potential = scoreClamp30_90(Math.max(potential, overall))

  const jawBase = parseInt30_90(a.jawlineDefinition, 55)
  const sym = parseInt30_90(a.facialSymmetry, 55)
  const classicalBase = parseInt30_90(a.classicalIdealScore, 55)
  const eyeBase = parseInt30_90(a.eyeArea, 55)
  const cheek = parseInt30_90(a.cheekboneDefinition, 55)
  const defn = parseInt30_90(a.facialDefinition, 55)
  const water = parseInt30_90(a.waterRetention, 55)
  const fhRaw = parseInt30_90(a.foreheadSmoothness, 60)
  const skinQ = parseInt30_90(a.skinQuality30to90, 60)
  const forehead = scoreClamp30_90(Math.round((fhRaw + skinQ) / 2))
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
    skin: forehead,
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

/** Deterministic demo (no API) — same 30–90 scale + potential ≥ overall */
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

  const overall = rnd(0)
  let potential = scoreClamp30_90(overall + 2 + ((h >>> 4) & 0x0f))
  potential = scoreClamp30_90(Math.max(potential, overall))

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

  return {
    scores,
    meta: {
      definitionLevel: null,
      looksmaxPosePassed: true,
    },
  }
}
