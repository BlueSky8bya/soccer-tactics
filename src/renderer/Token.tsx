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
  /**
   * Heading and moving are still passed for the caller's own decoration (the run trail, the bob).
   * The token itself no longer draws a direction wedge: a solid triangle at the disc's edge read as
   * a stray arrowhead that had come loose from a path — two independent reviewers called it debris
   * (2026-08-24). Motion is said the same way for players as for the ball now: a fading trail
   * behind the thing, drawn by the board.
   */
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

/**
 * The ball, in ball-local units (r = 1).
 *
 * ONE pentagon, centred, and nothing else. The first version added five more pentagons at
 * two-thirds radius and the second added seams out to the rim; both were drawn for a ball the size
 * of a thumbnail, and the ball renders at about fourteen pixels. At that size every extra mark is
 * ink, and enough ink turns a white ball into a dark blob — which is what the pattern actually
 * looked like on the board (user 2026-08-24: 오각형이 필요없는 부분에 끼어있음).
 *
 * A white disc, a dark keyline, one black pentagon. It is the smallest drawing that is unmistakably
 * a football, and it stays clean when the board is zoomed all the way in.
 */
function BallPattern() {
  const R = 0.33
  const pts = [0, 1, 2, 3, 4].map((i) => {
    const a = (i * 2 * Math.PI) / 5 - Math.PI / 2
    return `${R * Math.cos(a)},${R * Math.sin(a)}`
  })
  return (
    <g className={styles.ballPattern}>
      <polygon points={pts.join(' ')} />
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
