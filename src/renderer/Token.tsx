import { memo, type CSSProperties, type ReactNode } from 'react'
import type { Id, Vec2 } from '@/domain/types'
import styles from './pitch.module.css'

export const TOKEN_R = 1.35 // metres (visual) — user 2026-08-21: 축소 후 재보정 (1.5→1.2→1.35)
export const TOKEN_HIT_R = 2.2 // metres (hit area ≥ visual; ≥28px at typical sizes)
export const BALL_R = 0.68

export interface TokenProps {
  id: Id
  kind: 'player' | 'ball'
  /** Truth position (metres) from the document / ResolvedState. */
  pos: Vec2
  color?: string
  number?: number
  label?: string
  selected: boolean
  hovered: boolean
  dragging: boolean
  /** Player heading (radians) while moving — draws a subtle direction wedge. */
  heading?: number
  moving?: boolean
  /** Ball: lofted flight height (m) and rolling spin (rad). Deterministic from the engine. */
  height?: number
  spin?: number
  ballStatus?: 'possessed' | 'travel' | 'loose'
  /** Away players wear an inner keyline (A-02a): team identity survives CVD/grayscale. */
  awayKeyline?: boolean
  /** Team color of the holder while possessed — the "attached" ring (user 2026-08-20). */
  holderColor?: string
  /**
   * Optional wrapper around the token body (e.g. the UI layer's interface-motion group).
   * The renderer itself never animates positions (ADR-0006 D1).
   */
  wrap?: (body: ReactNode) => ReactNode
}

/** Classic 32-panel look, simplified: centre pentagon + 5 satellites. Drawn in ball-local units (r = 1). */
function BallPattern() {
  const pent = (cx: number, cy: number, r: number, rot = 0) => {
    const pts: string[] = []
    for (let i = 0; i < 5; i++) {
      const a = rot + (i * 2 * Math.PI) / 5 - Math.PI / 2
      pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`)
    }
    return pts.join(' ')
  }
  const sats = Array.from({ length: 5 }, (_, i) => {
    const a = (i * 2 * Math.PI) / 5 - Math.PI / 2
    return { x: 0.66 * Math.cos(a), y: 0.66 * Math.sin(a), rot: a + Math.PI }
  })
  return (
    <g className={styles.ballPattern}>
      <polygon points={pent(0, 0, 0.3)} />
      {sats.map((s, i) => (
        <polygon key={i} points={pent(s.x, s.y, 0.26, s.rot)} opacity={0.85} />
      ))}
    </g>
  )
}

/**
 * THE BALL, drawn once. The live token and every faded moment share this mark, so a ball is a
 * ball wherever it appears (user 2026-08-22: 초기 단계 축구공이랑 그 이외가 디자인이 달라 — the
 * ghosts used to be a plain white disc with three dots). Ghosts simply inherit their parent
 * group's opacity.
 */
export function BallMark(p: { r?: number; spin?: number; className?: string }) {
  const r = p.r ?? BALL_R
  return (
    <>
      <circle r={r} className={`${styles.ball} ${p.className ?? ''}`} />
      <g transform={`rotate(${((p.spin ?? 0) * 180) / Math.PI}) scale(${r})`}>
        <BallPattern />
      </g>
      <circle cx={-r * 0.35} cy={-r * 0.35} r={r * 0.22} className={styles.ballSpecular} />
    </>
  )
}

/** Pure token renderer: position in, SVG out. */
export const Token = memo(function Token(p: TokenProps) {
  const r = p.kind === 'ball' ? BALL_R : TOKEN_R
  const hitR = p.kind === 'ball' ? TOKEN_HIT_R * 0.8 : TOKEN_HIT_R

  let body: ReactNode
  if (p.kind === 'player') {
    body = (
      <>
        {/* soft ground shadow — lifts the piece off the grass (design polish 2026-08-20) */}
        <ellipse cx={0.22} cy={0.3} rx={r * 1.02} ry={r * 0.62} className={styles.tokenShadow} />
        {p.hovered && <circle r={r + 0.62} className={styles.hoverHalo} />}
        {p.moving && p.heading !== undefined && (
          <path
            d={`M ${r + 0.2} -0.55 L ${r + 1.1} 0 L ${r + 0.2} 0.55 Z`}
            className={styles.headingWedge}
            transform={`rotate(${(p.heading * 180) / Math.PI})`}
            style={{ fill: p.color }}
          />
        )}
        {/* selection = the token's own border thickens (no extra outer ring — user 2026-08-21) */}
        <circle
          r={r}
          className={`${styles.tokenBody} ${p.selected ? styles.tokenBodySelected : ''}`}
          style={{ fill: p.color }}
        />
        {p.awayKeyline && <circle r={r - 0.34} className={styles.awayKeyline} />}
        <text className={styles.tokenNumber}>{p.number}</text>
        {p.label && (
          <text className={styles.tokenLabel} y={r + 1.6}>
            {p.label}
          </text>
        )}
        <circle r={hitR} className={styles.tokenHit} />
      </>
    )
  } else {
    const h = p.height ?? 0
    const scale = 1 + Math.min(0.9, h * 0.14) // bigger when higher (closer to the camera)
    const shadowDx = 0.35 + h * 0.22
    const shadowDy = 0.3 + h * 0.18
    body = (
      <>
        {/* ground shadow: drifts away and softens with height */}
        <ellipse
          cx={shadowDx}
          cy={shadowDy}
          rx={r * (0.95 + h * 0.1)}
          ry={r * (0.6 + h * 0.06)}
          className={styles.ballShadow}
          style={{ opacity: Math.max(0.12, 0.42 - h * 0.05) }}
        />
        {p.hovered && <circle r={r + 0.55} className={styles.hoverHalo} />}
        <g transform={`scale(${scale})`}>
          <BallMark r={r} spin={p.spin} className={p.selected ? styles.ballSelected : ''} />
        </g>
        <circle r={hitR} className={styles.tokenHit} />
      </>
    )
  }

  return (
    <g
      className={p.dragging ? `${styles.token} ${styles.tokenDragging}` : styles.token}
      transform={`translate(${p.pos.x} ${p.pos.y})`}
      data-entity={p.id}
      data-kind={p.kind}
      /* the hover halo (and anything else that depicts THIS piece) reads its colour from here */
      style={{ '--st-entity': p.kind === 'ball' ? '#fff' : p.color } as CSSProperties}
    >
      {p.wrap ? p.wrap(body) : body}
    </g>
  )
})
