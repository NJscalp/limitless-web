import { deriveDemoScoresFromFile, mapFullAIAnalysis, type AnalysisMeta } from './mapFullAIAnalysis'
import { extractAnalysisRecord } from './normalizeAnalysis'
import type { DemoScores } from '../components/ResultsView'

export type { AnalysisMeta } from './mapFullAIAnalysis'

export type AnalysisOutcome = {
  source: 'ai' | 'demo'
  scores: DemoScores
  meta: AnalysisMeta
}

/** Thrown when real AI is required but the backend did not return a valid analysis. */
export class FaceAnalysisUnavailableError extends Error {
  override readonly name = 'FaceAnalysisUnavailableError'
  constructor(message = 'face_analysis_unavailable') {
    super(message)
  }
}

const MAX_ATTEMPTS = 4
const BASE_DELAY_MS = 500

function allowDemoFallback(): boolean {
  return import.meta.env.VITE_ALLOW_DEMO !== 'false'
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function shouldRetryHttpStatus(status: number): boolean {
  return status >= 500 || status === 429 || status === 408
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
 * Calls `/api/face-analyze` on Vercel (proxies to your face backend).
 * Retries transient failures so production behaves closer to the app when the backend is configured.
 * If all attempts fail: demo scores when `VITE_ALLOW_DEMO` is not `"false"`, otherwise throws {@link FaceAnalysisUnavailableError}.
 */
export async function analyzeImageFile(file: File): Promise<AnalysisOutcome> {
  let b64: string
  try {
    b64 = await readFileAsBase64Data(file)
  } catch {
    if (!allowDemoFallback()) throw new FaceAnalysisUnavailableError('read_failed')
    const d = await deriveDemoScoresFromFile(file)
    return { source: 'demo', scores: d.scores, meta: d.meta }
  }

  let lastFailure: 'http' | 'network' | 'empty' = 'network'

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch('/api/face-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: b64 }),
      })

      if (!res.ok) {
        lastFailure = 'http'
        if (shouldRetryHttpStatus(res.status) && attempt < MAX_ATTEMPTS - 1) {
          await sleep(BASE_DELAY_MS * 2 ** attempt)
          continue
        }
        break
      }

      const data: unknown = await res.json()
      const rec = extractAnalysisRecord(data)
      if (rec) {
        const { scores, meta } = mapFullAIAnalysis(rec)
        return { source: 'ai', scores, meta }
      }
      lastFailure = 'empty'
      if (attempt < MAX_ATTEMPTS - 1) {
        await sleep(BASE_DELAY_MS * 2 ** attempt)
        continue
      }
      break
    } catch {
      lastFailure = 'network'
      if (attempt < MAX_ATTEMPTS - 1) {
        await sleep(BASE_DELAY_MS * 2 ** attempt)
      }
    }
  }

  if (!allowDemoFallback()) {
    throw new FaceAnalysisUnavailableError(lastFailure)
  }

  const d = await deriveDemoScoresFromFile(file)
  return { source: 'demo', scores: d.scores, meta: d.meta }
}
