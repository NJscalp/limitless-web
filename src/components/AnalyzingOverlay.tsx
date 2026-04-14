import { useEffect, useRef, useState } from 'react'
import {
  GALLERY_ANALYSIS_STEPS,
  indeterminateProgress,
  stepIndex,
} from '../lib/faceAnalysisShared'
import './AnalyzingOverlay.css'

type Props = {
  imageUrl: string
  onComplete: () => void
  minDurationMs?: number
}

export function AnalyzingOverlay({ imageUrl, onComplete, minDurationMs = 3200 }: Props) {
  const [progress, setProgress] = useState(0)
  const [stepIdx, setStepIdx] = useState(0)
  const onCompleteRef = useRef(onComplete)
  const finishedRef = useRef(false)

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    finishedRef.current = false
    const start = Date.now()
    let rafId = 0
    let timeoutId = 0

    const finish = () => {
      if (finishedRef.current) return
      finishedRef.current = true
      setProgress(1)
      setStepIdx(GALLERY_ANALYSIS_STEPS.length - 1)
      timeoutId = window.setTimeout(() => {
        onCompleteRef.current()
      }, 450)
    }

    const loop = () => {
      const elapsed = (Date.now() - start) / 1000
      const p = indeterminateProgress(elapsed)
      const idx = stepIndex(elapsed, GALLERY_ANALYSIS_STEPS.length)
      setProgress(p)
      setStepIdx(idx)

      if (Date.now() - start >= minDurationMs) {
        finish()
        return
      }
      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafId)
      clearTimeout(timeoutId)
    }
  }, [imageUrl, minDurationMs])

  const pct = Math.min(100, Math.floor(progress * 100))
  const stepText = GALLERY_ANALYSIS_STEPS[Math.min(stepIdx, GALLERY_ANALYSIS_STEPS.length - 1)]

  return (
    <div className="analyze-overlay">
      <div className="analyze-inner">
        <p className="analyze-limitless">LIMITLESS</p>
        <h1 className="analyze-title">Face Scan</h1>

        <div className="analyze-frame-wrap">
          <div className="analyze-image-box">
            <img src={imageUrl} alt="" className="analyze-img" />
          </div>
        </div>

        <div className="analyze-pct">{pct}%</div>
        <p className="analyze-step">{stepText}</p>

        <div className="analyze-bar-track">
          <div className="analyze-bar-fill" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
    </div>
  )
}
