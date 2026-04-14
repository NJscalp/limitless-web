import { useCallback, useRef, useState } from 'react'
import { AnalyzingOverlay } from './components/AnalyzingOverlay'
import { ResultsView, type DemoScores } from './components/ResultsView'
import { analyzeImageFile, type AnalysisMeta, type AnalysisOutcome } from './lib/fetchFaceAnalysis'
import './App.css'

type Phase = 'pick' | 'analyzing' | 'results'

const MIN_SCAN_MS = 3200

export default function App() {
  const [phase, setPhase] = useState<Phase>('pick')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [scores, setScores] = useState<DemoScores | null>(null)
  const [analysisMeta, setAnalysisMeta] = useState<AnalysisMeta | null>(null)
  const [analysisSource, setAnalysisSource] = useState<'ai' | 'demo'>('demo')
  const [displayName, setDisplayName] = useState('')
  const fileRef = useRef<File | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const analysisPromiseRef = useRef<Promise<AnalysisOutcome> | null>(null)

  const cleanupUrl = useCallback(() => {
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl)
    }
  }, [imageUrl])

  const handleFile = (f: File | null) => {
    if (!f || !f.type.startsWith('image/')) return
    cleanupUrl()
    fileRef.current = f
    analysisPromiseRef.current = analyzeImageFile(f)
    const url = URL.createObjectURL(f)
    setImageUrl(url)
    setPhase('analyzing')
  }

  const handleAnalyzeComplete = useCallback(async () => {
    const p = analysisPromiseRef.current
    if (!p) return
    try {
      const outcome = await p
      setScores(outcome.scores)
      setAnalysisMeta(outcome.meta)
      setAnalysisSource(outcome.source)
      setPhase('results')
    } catch {
      setPhase('pick')
    }
  }, [])

  const handleNewScan = () => {
    cleanupUrl()
    setImageUrl(null)
    setScores(null)
    setAnalysisMeta(null)
    analysisPromiseRef.current = null
    fileRef.current = null
    setPhase('pick')
    if (inputRef.current) inputRef.current.value = ''
  }

  const resolvedName = displayName.trim() || 'Face'

  const scanDateLabel = scores
    ? new Date().toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : ''

  return (
    <div className="app-shell">
      {phase === 'pick' && (
        <div className="pick-screen">
          <p className="pick-limitless">LIMITLESS</p>
          <h1 className="pick-title">Face</h1>
          <p className="pick-sub">Same Face-tab layout as the iOS app. AI scores use your backend when configured on Vercel.</p>

          <label className="pick-name-label" htmlFor="display-name-input">
            Display name
          </label>
          <input
            id="display-name-input"
            type="text"
            className="pick-name-input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Face"
            maxLength={32}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
          />

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="pick-hidden-input"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />

          <button
            type="button"
            className="pick-gallery-btn"
            onClick={() => inputRef.current?.click()}
          >
            <span className="pick-gallery-icon">🖼</span>
            Choose from Gallery
          </button>
        </div>
      )}

      {phase === 'analyzing' && imageUrl && (
        <AnalyzingOverlay imageUrl={imageUrl} onComplete={handleAnalyzeComplete} minDurationMs={MIN_SCAN_MS} />
      )}

      {phase === 'results' && imageUrl && scores && analysisMeta && (
        <ResultsView
          imageUrl={imageUrl}
          displayName={resolvedName}
          scanDateLabel={scanDateLabel}
          scores={scores}
          analysisMeta={analysisMeta}
          analysisSource={analysisSource}
          onNewScan={handleNewScan}
        />
      )}
    </div>
  )
}
