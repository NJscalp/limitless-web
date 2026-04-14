import { deriveDemoScoresFromFile } from './faceAnalysisShared'
import type { DemoScores } from '../components/ResultsView'

/** Map backend `analysis` object (same shape as server/index.mjs + FullAIFaceAnalysis) to UI scores */
export function mapAnalysisToDemoScores(a: Record<string, unknown>): DemoScores {
  const n = (v: unknown, fallback: number) => {
    if (typeof v === 'number' && !Number.isNaN(v)) return Math.round(Math.max(0, Math.min(100, v)))
    if (typeof v === 'string' && v.trim() !== '') {
      const x = Number(v)
      if (!Number.isNaN(x)) return Math.round(Math.max(0, Math.min(100, x)))
    }
    return fallback
  }

  const skin =
    a.skinQuality30to90 != null
      ? n(a.skinQuality30to90, 60)
      : n(a.foreheadSmoothness, 60)

  return {
    overall: n(a.overallScore, 60),
    potential: n(a.potentialScore, 70),
    jawline: n(a.jawlineDefinition, 60),
    symmetry: n(a.facialSymmetry, 60),
    classicalIdeal: n(a.classicalIdealScore, 60),
    eyeArea: n(a.eyeArea, 60),
    cheekbones: n(a.cheekboneDefinition, 60),
    definition: n(a.facialDefinition, 60),
    bloat: n(a.waterRetention, 60),
    skin,
    nose: n(a.noseScore, 60),
    lips: n(a.lipScore, 60),
    midface: n(a.midfaceFullness, 60),
  }
}

function readFileAsBase64Data(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => {
      const x = r.result
      if (typeof x !== 'string') {
        reject(new Error('read_failed'))
        return
      }
      const comma = x.indexOf(',')
      resolve(comma >= 0 ? x.slice(comma + 1) : x)
    }
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}

export type AnalysisOutcome = { source: 'ai'; scores: DemoScores } | { source: 'demo'; scores: DemoScores }

/**
 * Calls `/api/face-analyze` on Vercel (proxies to your face backend). Falls back to deterministic demo scores.
 */
export async function analyzeImageFile(file: File): Promise<AnalysisOutcome> {
  let b64: string
  try {
    b64 = await readFileAsBase64Data(file)
  } catch {
    const scores = await deriveDemoScoresFromFile(file)
    return { source: 'demo', scores }
  }

  try {
    const res = await fetch('/api/face-analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: b64 }),
    })

    if (!res.ok) {
      const scores = await deriveDemoScoresFromFile(file)
      return { source: 'demo', scores }
    }

    const data = (await res.json()) as { analysis?: Record<string, unknown> }
    if (data?.analysis && typeof data.analysis === 'object') {
      return { source: 'ai', scores: mapAnalysisToDemoScores(data.analysis) }
    }
  } catch {
    /* network / no API in dev */
  }

  const scores = await deriveDemoScoresFromFile(file)
  return { source: 'demo', scores }
}
