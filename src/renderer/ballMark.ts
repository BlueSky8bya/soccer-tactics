/**
 * The football's panels, in UNIT space (radius 1) — one geometry for every surface that draws a ball.
 *
 * The board draws it as SVG polygons and the GIF exporter draws it on a canvas, and CSS custom
 * properties cannot reach a <canvas> (AUD-06), so the two are separate renderers by necessity.
 * They were also separate DESIGNS by accident: the export drew a white disc with a single dark dot
 * while the board drew a real ball, so the file you sent someone did not show the app they saw
 * (user 2026-08-25: gif 내보내기의 축구공 디자인이 사이트랑 달라). The shape lives here now; the two
 * renderers only choose how to stroke it.
 *
 * Pure: numbers in, numbers out. No DOM, no CSS.
 */
export const BALL_INK = '#1d1d1f'
export const BALL_FILL = '#ffffff'
/** Highlight: same offset and size the board uses, so the ball catches light the same way. */
export const BALL_SPECULAR = { cx: -0.35, cy: -0.35, r: 0.22, fill: 'rgba(255,255,255,0.75)' }

export interface BallPanel {
  cx: number
  cy: number
  r: number
  rot: number
  opacity: number
}

/** Centre pentagon plus the five that ring it — the classic Telstar face-on. */
export function ballPanels(): BallPanel[] {
  const out: BallPanel[] = [{ cx: 0, cy: 0, r: 0.3, rot: 0, opacity: 1 }]
  for (let i = 0; i < 5; i++) {
    const a = (i * 2 * Math.PI) / 5 - Math.PI / 2
    // rot + π points each satellite's flat side at the centre panel, which is what reads as a seam
    out.push({ cx: 0.66 * Math.cos(a), cy: 0.66 * Math.sin(a), r: 0.26, rot: a + Math.PI, opacity: 0.85 })
  }
  return out
}

/** A regular pentagon's corners, first corner pointing "up" before `rot`. */
export function pentagonPoints(p: BallPanel): [number, number][] {
  return Array.from({ length: 5 }, (_, i) => {
    const a = p.rot + (i * 2 * Math.PI) / 5 - Math.PI / 2
    return [p.cx + p.r * Math.cos(a), p.cy + p.r * Math.sin(a)] as [number, number]
  })
}
