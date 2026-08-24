import { memo, type CSSProperties, type ReactNode } from 'react'
import type { Id, Vec2 } from '@/domain/types'
import styles from './pitch.module.css'
import { ballPanels, pentagonPoints } from './ballMark'

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
 * The ball, in ball-local units (r = 1) — the ordinary football everyone draws: a black pentagon in
 * the middle and five more around it, white between.
 *
 * This is the shipped drawing, restored. Two passes trimmed it down chasing a mark that looked like
 * a dark blob on the board, and the pattern was never the cause: the specular highlight had lost
 * its CSS rule and was painting BLACK, so the ball carried an extra dark disc off-centre — which is
 * exactly the shape that read as a pentagon wedged where none belongs (user 2026-08-24). A third
 * pass pushed the outer panels out to the rim, where they merged with the keyline into a black band
 * and inverted the whole thing: black ball, white panels. They sit inside the rim, as they always
 * did, so the ball stays white and the panels stay panels.
 */
function BallPattern() {
  // Geometry from `ballMark` — the GIF exporter draws the same panels on a canvas, and the two
  // used to be different balls (user 2026-08-25: gif 내보내기의 축구공 디자인이 사이트랑 달라).
  return (
    <g className={styles.ballPattern}>
      {ballPanels().map((panel, i) => (
        <polygon
          key={i}
          points={pentagonPoints(panel)
            .map(([x, y]) => `${x},${y}`)
            .join(' ')}
          opacity={panel.opacity}
        />
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
