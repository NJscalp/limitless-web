import {
  limitlessScoreTierColor,
  scoreLabel,
} from '../lib/faceAnalysisShared'
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
  onNewScan: () => void
}

export function ResultsView({
  imageUrl,
  displayName,
  scanDateLabel,
  scores,
  onNewScan,
}: Props) {
  const { overall, potential } = scores
  const gap = Math.max(0, potential - overall)
  const tier = limitlessScoreTierColor(overall)
  const nowColors = [tier, `${tier}cc`]
  const peakColors = ['#33c759', '#59eb82', '#63e6be']

  const oFrac = Math.min(100, Math.max(0, overall)) / 100
  const pFrac = Math.min(100, Math.max(0, potential)) / 100

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
          <span className="results-lm-icon">▤</span>
          <span className="results-lm-title">Looksmax</span>
          <span className="results-lm-badge">0–100</span>
        </div>

        <div className="results-score-hero">
          <div className="results-sp-row">
            <div className="results-sp-col">
              <span className="results-sp-label">Score</span>
              <span
                className="results-sp-num"
                style={{
                  background: `linear-gradient(135deg, ${nowColors[0]}, ${nowColors[1]})`,
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                {overall}
              </span>
            </div>
            <span className="results-sp-chev">›</span>
            <div className="results-sp-col results-sp-right">
              <span className="results-sp-label potential">Potential</span>
              <span
                className="results-sp-num"
                style={{
                  background: `linear-gradient(135deg, ${peakColors[0]}, ${peakColors[1]})`,
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
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
                  width: `${oFrac * 100}%`,
                  background: `linear-gradient(90deg, ${nowColors[0]}, ${nowColors[1]})`,
                }}
              />
              <div
                className="results-traj-dot"
                style={{
                  left: `${pFrac * 100}%`,
                  borderColor: peakColors[0],
                  transform: 'translate(-50%, -50%)',
                }}
              />
            </div>
            <div className="results-traj-labels">
              <span>Now</span>
              <span>+{gap} pts</span>
              <span>Goal</span>
            </div>
          </div>
        </div>

        <div className="results-grid">
          {CATEGORIES.map((c) => {
            const sc = scores[c.key] as number
            const tc = limitlessScoreTierColor(sc)
            const frac = Math.min(100, Math.max(0, sc)) / 100
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
                      strokeDasharray={`${frac * 106.8} 106.8`}
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
        Web demo only — scores are simulated from your image file for layout preview. The iOS app uses
        full on-device + optional cloud analysis.
      </p>
    </div>
  )
}
