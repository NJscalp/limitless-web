import type { CSSProperties } from 'react'
import type { FaceScanGeometry } from '../lib/faceScanGeometry'
import { smoothContourToSvgD } from '../lib/faceScanContourDraw'
import './FaceScanOverlay.css'

type Props = {
  geometry: FaceScanGeometry
  /** 0–1, wie Swift `AdaptiveFaceScanOverlay` */
  progress: number
  displayWidth: number
  displayHeight: number
}

const LANDMARKS_META: { id: number; label: string; key: keyof FaceScanGeometry }[] = [
  { id: 0, label: 'FOREHEAD', key: 'foreheadCenter' },
  { id: 1, label: '', key: 'leftEye' },
  { id: 2, label: '', key: 'rightEye' },
  { id: 3, label: 'NOSE', key: 'nose' },
  { id: 4, label: '', key: 'mouth' },
  { id: 5, label: 'CHIN', key: 'chin' },
]

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

function CornerBraces({ rect }: { rect: { x: number; y: number; width: number; height: number } }) {
  const pad = 10
  const L = 18
  const r = {
    x: rect.x - pad,
    y: rect.y - pad,
    w: rect.width + pad * 2,
    h: rect.height + pad * 2,
  }
  const cr = 6
  const x0 = r.x
  const y0 = r.y
  const x1 = r.x + r.w
  const y1 = r.y + r.h

  const paths = [
    `M ${x0} ${y0 + L} L ${x0} ${y0 + cr} Q ${x0} ${y0} ${x0 + cr} ${y0} L ${x0 + L} ${y0}`,
    `M ${x1 - L} ${y0} L ${x1 - cr} ${y0} Q ${x1} ${y0} ${x1} ${y0 + cr} L ${x1} ${y0 + L}`,
    `M ${x0} ${y1 - L} L ${x0} ${y1 - cr} Q ${x0} ${y1} ${x0 + cr} ${y1} L ${x0 + L} ${y1}`,
    `M ${x1} ${y1 - L} L ${x1} ${y1 - cr} Q ${x1} ${y1} ${x1 - cr} ${y1} L ${x1 - L} ${y1}`,
  ]

  return (
    <g className="face-scan-corners" aria-hidden>
      {paths.map((d, i) => (
        <path key={i} d={d} fill="none" className="face-scan-corner-path" />
      ))}
    </g>
  )
}

function regionClass(id: string): string {
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, '')
  return `face-scan-region face-scan-region-${safe}`
}

export function FaceScanOverlay({ geometry, progress, displayWidth, displayHeight }: Props) {
  const { faceRect, contours, leftEye, rightEye, foreheadCenter, chin, jawLeft, jawRight } = geometry

  const totalContours = contours.length
  const contourReveal = totalContours > 0 ? Math.min(totalContours, Math.max(0, Math.ceil(progress * totalContours))) : 0

  const lmCount = LANDMARKS_META.length

  const midX = faceRect.x + faceRect.width / 2
  const lineW = faceRect.width + 20

  return (
    <div
      className="face-scan-root"
      style={
        {
          width: displayWidth,
          height: displayHeight,
          '--face-midx': `${midX}px`,
          '--face-linew': `${lineW}px`,
          '--display-h': `${displayHeight}px`,
        } as CSSProperties
      }
    >
      <svg
        className="face-scan-svg"
        width={displayWidth}
        height={displayHeight}
        viewBox={`0 0 ${displayWidth} ${displayHeight}`}
        aria-hidden
      >
        <CornerBraces rect={faceRect} />

        {contours.slice(0, contourReveal).map((c, idx) => {
          const d = smoothContourToSvgD(c.points, c.closed)
          if (!d) return null
          return <path key={`${c.id}-${idx}`} d={d} fill="none" className={regionClass(c.id)} />
        })}

        {LANDMARKS_META.map((lm) => {
          if (progress <= lm.id / Math.max(lmCount, 1)) return null
          const p = geometry[lm.key]
          if (!p || typeof p !== 'object' || !('x' in p)) return null
          return (
            <g key={lm.id} className="face-scan-crosshair">
              <circle cx={p.x} cy={p.y} r={7} className="face-scan-crosshair-glow" />
              <line
                x1={p.x - 5}
                y1={p.y}
                x2={p.x + 5}
                y2={p.y}
                className="face-scan-crosshair-line"
              />
              <line
                x1={p.x}
                y1={p.y - 5}
                x2={p.x}
                y2={p.y + 5}
                className="face-scan-crosshair-line"
              />
              <circle cx={p.x} cy={p.y} r={1.25} className="face-scan-crosshair-dot" />
              {lm.label ? (
                <text x={p.x + 14} y={p.y + 2} className="face-scan-landmark-label">
                  {lm.label}
                </text>
              ) : null}
            </g>
          )
        })}

        {progress > 0.35 ? (
          <g className="face-scan-measure">
            <line
              x1={leftEye.x}
              y1={leftEye.y}
              x2={rightEye.x}
              y2={rightEye.y}
              className="face-scan-measure-line"
            />
            <text
              x={(leftEye.x + rightEye.x) / 2}
              y={(leftEye.y + rightEye.y) / 2 - 12}
              className="face-scan-measure-cap"
            >
              IPD {dist(leftEye, rightEye).toFixed(0)}px
            </text>
          </g>
        ) : null}

        {progress > 0.55 ? (
          <g className="face-scan-measure">
            <line
              x1={jawLeft.x}
              y1={jawLeft.y}
              x2={jawRight.x}
              y2={jawRight.y}
              className="face-scan-measure-line"
            />
            <text
              x={(jawLeft.x + jawRight.x) / 2}
              y={(jawLeft.y + jawRight.y) / 2 + 14}
              className="face-scan-measure-cap"
            >
              JAW {dist(jawLeft, jawRight).toFixed(0)}px
            </text>
          </g>
        ) : null}

        {progress > 0.75 ? (
          <g className="face-scan-measure">
            <line
              x1={foreheadCenter.x}
              y1={foreheadCenter.y}
              x2={chin.x}
              y2={chin.y}
              className="face-scan-measure-line"
            />
            <text
              x={(foreheadCenter.x + chin.x) / 2 + 14}
              y={(foreheadCenter.y + chin.y) / 2}
              className="face-scan-measure-cap"
            >
              FWHR {dist(foreheadCenter, chin).toFixed(0)}px
            </text>
          </g>
        ) : null}
      </svg>

      <div className="face-scan-sweep" aria-hidden />
    </div>
  )
}
