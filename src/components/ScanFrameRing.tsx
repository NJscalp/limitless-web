import { useId } from 'react'
import './ScanFrameRing.css'

type Props = {
  /** 0–1 — sichtbarer Anteil des Rahmens (wie Swift `.trim(from: 0, to: progress)`) */
  progress: number
  width: number
  height: number
  radius: number
}

/** Abgerundetes Rechteck als Pfad für stroke-dashoffset-Animation */
function roundedRectPath(w: number, h: number, r: number): string {
  const rr = Math.min(r, w / 2, h / 2)
  return [
    `M ${rr} 0`,
    `L ${w - rr} 0`,
    `Q ${w} 0 ${w} ${rr}`,
    `L ${w} ${h - rr}`,
    `Q ${w} ${h} ${w - rr} ${h}`,
    `L ${rr} ${h}`,
    `Q 0 ${h} 0 ${h - rr}`,
    `L 0 ${rr}`,
    `Q 0 0 ${rr} 0`,
    'Z',
  ].join(' ')
}

export function ScanFrameRing({ progress, width, height, radius }: Props) {
  const uid = useId().replace(/:/g, '')
  const gradId = `scan-ring-grad-${uid}`
  const p = Math.min(1, Math.max(0, progress))
  /** Innenliegender Pfad, damit der Stroke nicht von `overflow:hidden` am Foto abgeschnitten wird */
  const inset = 3
  const iw = width - inset * 2
  const ih = height - inset * 2
  const ir = Math.min(radius - 1, iw / 2, ih / 2)
  const d = roundedRectPath(iw, ih, ir)

  return (
    <svg
      className="scan-frame-ring"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#007aff" />
          <stop offset="55%" stopColor="#af52de" />
          <stop offset="100%" stopColor="#007aff" />
        </linearGradient>
      </defs>
      <g transform={`translate(${inset}, ${inset})`}>
        <path
          className="scan-frame-ring-path"
          d={d}
          pathLength={100}
          stroke={`url(#${gradId})`}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          strokeDasharray={100}
          strokeDashoffset={100 * (1 - p)}
        />
      </g>
    </svg>
  )
}
