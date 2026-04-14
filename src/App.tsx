import { useCallback, useRef, useState } from 'react'
import { AnalyzingOverlay } from './components/AnalyzingOverlay'
import { ResultsView, type DemoScores } from './components/ResultsView'
import { deriveDemoScoresFromFile } from './lib/faceAnalysisShared'
import './App.css'

type Phase = 'pick' | 'analyzing' | 'results'

export default function App() {
  const [phase, setPhase] = useState<Phase>('pick')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [scores, setScores] = useState<DemoScores | null>(null)
  const [displayName, setDisplayName] = useState('Face')
  const fileRef = useRef<File | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const cleanupUrl = useCallback(() => {
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl)
    }
  }, [imageUrl])

  const handleFile = (f: File | null) => {
    if (!f || !f.type.startsWith('image/')) return
    cleanupUrl()
    fileRef.current = f
    const url = URL.createObjectURL(f)
    setImageUrl(url)
    setPhase('analyzing')
  }

  const handleAnalyzeComplete = useCallback(async () => {
    const file = fileRef.current
    if (!file) return
    const s = await deriveDemoScoresFromFile(file)
    setScores(s)
    setPhase('results')
  }, [])

  const handleNewScan = () => {
    cleanupUrl()
    setImageUrl(null)
    setScores(null)
    fileRef.current = null
    setPhase('pick')
    if (inputRef.current) inputRef.current.value = ''
  }

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
          <p className="pick-sub">Clipper web preview — same layout as the iOS Face tab.</p>

          <label className="pick-name-label">
            Display name
            <input
              type="text"
              className="pick-name-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value || 'Face')}
              placeholder="Face"
              maxLength={32}
            />
          </label>

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
        <AnalyzingOverlay imageUrl={imageUrl} onComplete={handleAnalyzeComplete} />
      )}

      {phase === 'results' && imageUrl && scores && (
        <ResultsView
          imageUrl={imageUrl}
          displayName={displayName.trim() || 'Face'}
          scanDateLabel={scanDateLabel}
          scores={scores}
          onNewScan={handleNewScan}
        />
      )}
    </div>
  )
}
