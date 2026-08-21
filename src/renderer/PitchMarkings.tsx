import { memo } from 'react'
import type { Pitch } from '@/domain/types'
import { pitchMarkings } from '@/engine/geometry'
import styles from './pitch.module.css'

/** Static pitch: grass stripes + IFAB markings. Re-renders only when pitch size changes. */
export const PitchMarkings = memo(function PitchMarkings({ pitch }: { pitch: Pitch }) {
  const m = pitchMarkings(pitch)
  const { length: L, width: W } = m
  const cy = W / 2
  const stripes = 10
  const sw = L / stripes
  const paTop = cy - m.penaltyAreaWidth / 2
  const gaTop = cy - m.goalAreaWidth / 2
  const goalTop = cy - m.goalWidth / 2
  // D arc: part of circle r=9.15 around penalty spot, clipped outside the box
  const r = m.centreCircleR
  const dx = m.penaltyAreaDepth - m.penaltySpotDist // 5.5
  const dy = Math.sqrt(r * r - dx * dx)
  const line = styles.line

  return (
    <g className={styles.pitch}>
      <defs>
        <clipPath id="pitch-clip">
          <rect x={0} y={0} width={L} height={W} />
        </clipPath>
        {/* goal net mesh — 0.4m diagonal weave, scales with the pitch (real net look) */}
        <pattern id="goal-net" width={0.4} height={0.4} patternUnits="userSpaceOnUse">
          <path d="M 0 0 L 0.4 0.4 M 0.4 0 L 0 0.4" className={styles.netMesh} />
        </pattern>
      </defs>
      {/* The surround has to outrun the viewBox, which now grows to the element's aspect so the
          board fills its box instead of letterboxing (usePitchView). Oversizing is free — the SVG
          clips it — and a short rect would leave bare page showing beside a wide board. */}
      <rect x={-L} y={-W} width={L * 3} height={W * 3} className={styles.surround} />
      <g clipPath="url(#pitch-clip)">
        {Array.from({ length: stripes }, (_, i) => (
          <rect
            key={i}
            x={i * sw}
            y={0}
            width={sw}
            height={W}
            className={i % 2 === 0 ? styles.grass : styles.grassAlt}
          />
        ))}
      </g>
      {/* outline + halfway */}
      <rect x={0} y={0} width={L} height={W} className={line} />
      <line x1={L / 2} y1={0} x2={L / 2} y2={W} className={line} />
      <circle cx={L / 2} cy={cy} r={r} className={line} />
      <circle cx={L / 2} cy={cy} r={0.25} className={styles.spot} />
      {/* penalty areas */}
      <rect
        x={0}
        y={paTop}
        width={m.penaltyAreaDepth}
        height={m.penaltyAreaWidth}
        className={line}
      />
      <rect
        x={L - m.penaltyAreaDepth}
        y={paTop}
        width={m.penaltyAreaDepth}
        height={m.penaltyAreaWidth}
        className={line}
      />
      {/* goal areas */}
      <rect x={0} y={gaTop} width={m.goalAreaDepth} height={m.goalAreaWidth} className={line} />
      <rect
        x={L - m.goalAreaDepth}
        y={gaTop}
        width={m.goalAreaDepth}
        height={m.goalAreaWidth}
        className={line}
      />
      {/* penalty spots */}
      <circle cx={m.penaltySpotDist} cy={cy} r={0.25} className={styles.spot} />
      <circle cx={L - m.penaltySpotDist} cy={cy} r={0.25} className={styles.spot} />
      {/* D arcs */}
      <path
        d={`M ${m.penaltyAreaDepth} ${cy - dy} A ${r} ${r} 0 0 1 ${m.penaltyAreaDepth} ${cy + dy}`}
        className={line}
      />
      <path
        d={`M ${L - m.penaltyAreaDepth} ${cy - dy} A ${r} ${r} 0 0 0 ${L - m.penaltyAreaDepth} ${cy + dy}`}
        className={line}
      />
      {/* corner arcs */}
      <path
        d={`M ${m.cornerR} 0 A ${m.cornerR} ${m.cornerR} 0 0 1 0 ${m.cornerR}`}
        className={line}
      />
      <path
        d={`M ${L - m.cornerR} 0 A ${m.cornerR} ${m.cornerR} 0 0 0 ${L} ${m.cornerR}`}
        className={line}
      />
      <path
        d={`M 0 ${W - m.cornerR} A ${m.cornerR} ${m.cornerR} 0 0 1 ${m.cornerR} ${W}`}
        className={line}
      />
      <path
        d={`M ${L} ${W - m.cornerR} A ${m.cornerR} ${m.cornerR} 0 0 0 ${L - m.cornerR} ${W}`}
        className={line}
      />
      {/* goals: posts + crossbar + rectangular net box (top-down, IFAB 7.32m mouth, 2m deep) */}
      <GoalNet x={0} dir={-1} top={goalTop} w={m.goalWidth} d={m.goalDepth} />
      <GoalNet x={L} dir={1} top={goalTop} w={m.goalWidth} d={m.goalDepth} />
    </g>
  )
})

/** One goal seen from above: meshed net box, side/back frame, crossbar. */
function GoalNet({
  x,
  dir,
  top,
  w,
  d,
}: {
  x: number
  dir: -1 | 1
  top: number
  w: number
  d: number
}) {
  const bot = top + w
  const back = x + dir * d
  // straight rectangular net box (user 2026-08-21: 사다리꼴 X)
  const outline = `M ${x} ${top} L ${back} ${top} L ${back} ${bot} L ${x} ${bot}`
  return (
    <g>
      <path d={`${outline} Z`} fill="url(#goal-net)" stroke="none" />
      <path d={outline} className={styles.goalFrame} />
      <line x1={x} y1={top} x2={x} y2={bot} className={styles.goalBar} />
    </g>
  )
}
