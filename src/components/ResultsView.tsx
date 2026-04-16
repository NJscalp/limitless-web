import type { CSSProperties } from 'react'
import {
  gapLabelGradientCss,
  limitlessScoreTierColor,
  potentialScoreGradientCss,
  scoreGradientCssDiagonal,
  scoreLabel,
} from '../lib/faceAnalysisShared'
import { trajectoryDotLeftPercent, type AnalysisMeta } from '../lib/mapFullAIAnalysis'
import './ResultsView.css'

export type DemoScores = {
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
}

const CATEGORIES: { name: string; key: keyof DemoScores; color: string }[] = [
  { name: 'Jawline', key: 'jawline', color: '#ff9500' },
  { name: 'Symmetry', key: 'symmetry', color: '#007aff' },
  { name: 'Classical Ideal', key: 'classicalIdeal', color: '#ffcc00' },
  { name: 'Eye Area', key: 'eyeArea', color: '#5856d6' },
  { name: 'Cheekbones', key: 'cheekbones', color: '#ff2d55' },
  { name: 'Definition', key: 'definition', color: '#5ac8fa' },
  { name: 'Bloat', key: 'bloat', color: '#63e6e2' },
  { name: 'Skin', key: 'skin', color: '#a2845e' },
  { name: 'Nose', key: 'nose', color: '#af52de' },
  { name: 'Lips', key: 'lips', color: '#ff3b30' },
  { name: 'Midface Length', key: 'midface', color: '#64d2ff' },
]

type Props = {
  imageUrl: string
  displayName: string
  scanDateLabel: string
  scores: DemoScores
  analysisMeta: AnalysisMeta
  /** `ai` when Vercel proxy returned backend analysis; `demo` otherwise */
  analysisSource: 'ai' | 'demo'
  onNewScan: () => void
}

export function ResultsView({
  imageUrl,
  displayName,
  scanDateLabel,
  scores,
  analysisMeta,
  analysisSource,
  onNewScan,
}: Props) {
  const { overall, potential } = scores
  const gap = Math.max(0, potential - overall)
  const tier = limitlessScoreTierColor(overall)
  const nowBarGradient = scoreGradientCssDiagonal(overall)
  const peakRingGradient =
    'linear-gradient(135deg, rgb(51, 199, 89) 0%, rgb(89, 235, 166) 50%, rgb(99, 230, 190) 100%)'

  const oFrac = Math.min(100, Math.max(0, overall)) / 100
  const dotLeftPct = trajectoryDotLeftPercent(potential)

  const clipGradText: CSSProperties = {
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
  }

  return (
    <div className="results-root">
      <div className="results-card">
        <div className="results-hero-top">
          <div className="results-avatar-row">
            <div
              className="results-ring"
              style={{
                background: `conic-gradient(from 0deg, #ff9500, ${tier}, #007aff, ${tier}, #ff9500)`,
              }}
            >
              <div className="results-avatar-inner">
                <img src={imageUrl} alt="" className="results-avatar-img" />
              </div>
            </div>
          </div>
          <div className="results-name-row">
            <span className="results-name">{displayName}</span>
            <span className="results-dot">·</span>
            <span className="results-date">{scanDateLabel}</span>
          </div>
        </div>

        <div className="results-divider" />

        <div className="results-looks-header">
          <LooksmaxHeaderIcon className="results-lm-icon" accent={tier} />
          <span className="results-lm-title">Looksmax</span>
          <span className="results-lm-badge">0–100</span>
          {analysisMeta.definitionLevel && (
            <span
              className={`results-chip results-chip-def ${defLevelClass(analysisMeta.definitionLevel)}`}
            >
              {analysisMeta.definitionLevel}
            </span>
          )}
          {!analysisMeta.looksmaxPosePassed && (
            <span className="results-chip results-chip-frontal">Frontal</span>
          )}
        </div>

        <div className="results-score-hero">
          <div className="results-sp-row">
            <div className="results-sp-col">
              <span className="results-sp-label">Score</span>
              <span
                className="results-sp-num results-sp-num-gradient"
                style={{
                  ...clipGradText,
                  backgroundImage: scoreGradientCssDiagonal(overall),
                }}
              >
                {overall}
              </span>
            </div>
            <ChevronBetween className="results-sp-chev" />
            <div className="results-sp-col results-sp-right">
              <span className="results-sp-label potential">Potential</span>
              <span
                className="results-sp-num results-sp-num-gradient"
                style={{
                  ...clipGradText,
                  backgroundImage: potentialScoreGradientCss(),
                }}
              >
                {potential}
              </span>
            </div>
          </div>

          <div className="results-traj">
            <div className="results-traj-track">
              <div
                className="results-traj-fill"
                style={{
                  width: `${Math.max(oFrac * 100, oFrac > 0 ? 2 : 0)}%`,
                  background: nowBarGradient,
                }}
              />
              <div
                className="results-traj-dot"
                style={{
                  left: `${dotLeftPct}%`,
                  transform: 'translate(-50%, -50%)',
                  ['--peak-ring' as string]: peakRingGradient,
                }}
              />
            </div>
            <div className="results-traj-labels">
              <span>Now</span>
              <span
                className="results-traj-gap"
                style={{
                  ...clipGradText,
                  backgroundImage: gapLabelGradientCss(),
                }}
              >
                +{gap}
              </span>
              <span>Goal</span>
            </div>
          </div>
        </div>

        <div className="results-grid">
          {CATEGORIES.map((c) => {
            const sc = scores[c.key] as number
            const tc = limitlessScoreTierColor(Math.min(100, sc))
            const frac = Math.min(1, Math.max(0, sc / 100))
            return (
              <div key={c.name} className="stat-cell">
                <div className="stat-ring-wrap">
                  <svg className="stat-ring-svg" viewBox="0 0 40 40">
                    <circle
                      cx="20"
                      cy="20"
                      r="17"
                      fill="none"
                      stroke="rgba(0,0,0,0.07)"
                      strokeWidth="3"
                    />
                    <circle
                      cx="20"
                      cy="20"
                      r="17"
                      fill="none"
                      stroke={tc}
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray={`${frac * 106.8} ${106.8}`}
                      transform="rotate(-90 20 20)"
                      style={{ filter: `drop-shadow(0 0 3px ${tc}4d)` }}
                    />
                  </svg>
                  <span className="stat-ring-num">{sc}</span>
                </div>
                <div className="stat-text">
                  <span className="stat-name">{c.name}</span>
                  <span
                    className="stat-pill"
                    style={{ color: tc, background: `${tc}1a` }}
                  >
                    {scoreLabel(sc)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <button type="button" className="results-new-scan" onClick={onNewScan}>
        <span className="results-new-icon">◎</span>
        New AI Scan
      </button>

      <p className="results-disclaimer">
        {analysisSource === 'ai'
          ? 'Gleiche Felder wie in der App (Face-Tab / KI-Analyse). Backend über FACE_BACKEND_URL auf Vercel.'
          : 'Demo: kein Backend oder API-Fehler — Zahlen deterministisch aus der Datei wie App-Layout (Looksmax-Werte in Jawline / Classical Ideal / Eye Area gemerged).'}
      </p>
    </div>
  )
}

function defLevelClass(dl: string): string {
  const u = dl.trim().toLowerCase()
  if (u === 'lean') return 'is-lean'
  if (u === 'bloated') return 'is-bloated'
  return 'is-avg'
}

/** chart.bar.doc.horizontal — FaceView.looksmaxHeroHeaderRow */
function LooksmaxHeaderIcon({ className, accent }: { className?: string; accent: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M5 4h14v4H5V4zm0 6h10v4H5v-4zm0 6h7v4H5v-4z"
        fill={accent}
        opacity="0.95"
      />
      <path d="M17 10h4v10h-4V10z" fill={accent} />
    </svg>
  )
}

function ChevronBetween({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="10"
      height="14"
      viewBox="0 0 10 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M3.5 2L7 7l-3.5 5"
        stroke="rgba(173,173,177,0.35)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
