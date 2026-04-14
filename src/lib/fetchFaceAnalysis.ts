import { deriveDemoScoresFromFile, mapFullAIAnalysis, type AnalysisMeta } from './mapFullAIAnalysis'
import type { DemoScores } from '../components/ResultsView'

export type { AnalysisMeta } from './mapFullAIAnalysis'

export type AnalysisOutcome = {
  source: 'ai' | 'demo'
  scores: DemoScores
  meta: AnalysisMeta
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

/**
 * Calls `/api/face-analyze` on Vercel (proxies to your face backend). Falls back to deterministic demo scores.
 */
export async function analyzeImageFile(file: File): Promise<AnalysisOutcome> {
  let b64: string
  try {
    b64 = await readFileAsBase64Data(file)
  } catch {
    const d = await deriveDemoScoresFromFile(file)
    return { source: 'demo', scores: d.scores, meta: d.meta }
  }

  try {
    const res = await fetch('/api/face-analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: b64 }),
    })

    if (!res.ok) {
      const d = await deriveDemoScoresFromFile(file)
      return { source: 'demo', scores: d.scores, meta: d.meta }
    }

    const data = (await res.json()) as { analysis?: Record<string, unknown> }
    if (data?.analysis && typeof data.analysis === 'object') {
      const { scores, meta } = mapFullAIAnalysis(data.analysis)
      return { source: 'ai', scores, meta }
    }
  } catch {
    /* network / no API in dev */
  }

  const d = await deriveDemoScoresFromFile(file)
  return { source: 'demo', scores: d.scores, meta: d.meta }
}
