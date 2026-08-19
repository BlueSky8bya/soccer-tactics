import { memo } from 'react'
import type { Pitch } from '@/domain/types'
import { pitchMarkings } from '@/editor/geometry'
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
      </defs>
      <rect x={-6} y={-6} width={L + 12} height={W + 12} className={styles.surround} />
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
      {/* goals */}
      <rect
        x={-m.goalDepth}
        y={goalTop}
        width={m.goalDepth}
        height={m.goalWidth}
        className={styles.goal}
      />
      <rect x={L} y={goalTop} width={m.goalDepth} height={m.goalWidth} className={styles.goal} />
    </g>
  )
})
