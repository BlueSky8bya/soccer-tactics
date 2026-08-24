/**
 * GIF export of the whole play (user 2026-08-20): time-compressed, playback view only —
 * grass + tokens + ball, exactly like watching the animation (routes stay hidden).
 * Pure client side: engine stateAt() drives a small canvas renderer, gifenc encodes.
 * The downloaded FILE is the archive — nothing is persisted in the app (clean-board rule).
 */
import { GIFEncoder, applyPalette, quantize } from 'gifenc'
import type { TacticDocument } from '@/domain/types'
import { compile } from '@/engine/compile'
import { pitchMarkings } from '@/engine/geometry'
import { stateAt } from '@/engine/stateAt'
import { penSegments } from '@/ui/pitch/inking'
import { VISUAL } from '@/renderer/visualDefaults'
import {
  BALL_FILL,
  BALL_INK,
  BALL_SPECULAR,
  ballPanels,
  pentagonPoints,
} from '@/renderer/ballMark'

export interface GifOptions {
  /** Tactical seconds per real second in the GIF (1 = real time). */
  speed?: number
  fps?: number
  /** Output pixel width (height follows the pitch ratio). */
  width?: number
  /** Size ceiling. The encoder steps DOWN the quality tiers until it fits. */
  maxBytes?: number
  onProgress?: (done: number, total: number) => void
}

/**
 * Quality tiers, best first. The old fixed 640px / 12fps / 2× export produced ~0.5–1MB files that
 * were both soft and visibly stuttery (user 2026-08-22), while the target upload limit is 10MB —
 * two orders of magnitude of headroom left unused. Rather than pick a bigger fixed setting and
 * hope, the encoder starts at the top and drops a tier whenever the file it is building projects
 * over budget, so a short play gets the full 1280p/25fps and a long one degrades on its own.
 *
 * Every rate divides 100 exactly. A GIF frame delay is stored in CENTISECONDS, so a rate that does
 * not — 12fps is 83.3ms, written as 8cs = 80ms — plays back at a different speed than the one it
 * was sampled at, and unevenly. The old export was pinned at "12fps" and actually ran at 12.5.
 */
export const GIF_TIERS = [
  { width: 1280, fps: 25 }, // 4 cs
  { width: 1024, fps: 20 }, // 5 cs
  { width: 800, fps: 12.5 }, // 8 cs
  { width: 640, fps: 10 }, // 10 cs
] as const

/** 9.5MB — under a 10MB limit with room for the multipart overhead of an upload form. */
export const GIF_MAX_BYTES = 9.5 * 1024 * 1024

const GRASS = VISUAL.pitchGrass
const GRASS_ALT = VISUAL.pitchGrassAlt
const LINE = VISUAL.pitchLine
const TOKEN_R = VISUAL.tokenRadiusM
const BALL_R = VISUAL.ballRadiusM

/** Metres of surround kept around the pitch in the GIF — the goals + nets live there. */
export const GIF_PAD_M = 3

function drawPitch(ctx: CanvasRenderingContext2D, doc: TacticDocument, k: number): void {
  const m = pitchMarkings(doc.pitch)
  const { length: L, width: W } = m
  const cy = W / 2
  ctx.fillStyle = VISUAL.pitchSurround
  ctx.fillRect(-GIF_PAD_M * k, -GIF_PAD_M * k, (L + GIF_PAD_M * 2) * k, (W + GIF_PAD_M * 2) * k)
  ctx.fillStyle = GRASS
  ctx.fillRect(0, 0, L * k, W * k)
  const stripes = 10
  const sw = L / stripes
  ctx.fillStyle = GRASS_ALT
  for (let i = 1; i < stripes; i += 2) ctx.fillRect(i * sw * k, 0, sw * k, W * k)
  ctx.strokeStyle = LINE
  ctx.lineWidth = Math.max(1, 0.18 * k)
  const rect = (x: number, y: number, w: number, h: number) =>
    ctx.strokeRect(x * k, y * k, w * k, h * k)
  rect(0, 0, L, W)
  ctx.beginPath()
  ctx.moveTo((L / 2) * k, 0)
  ctx.lineTo((L / 2) * k, W * k)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc((L / 2) * k, cy * k, m.centreCircleR * k, 0, Math.PI * 2)
  ctx.stroke()
  const paTop = cy - m.penaltyAreaWidth / 2
  const gaTop = cy - m.goalAreaWidth / 2
  rect(0, paTop, m.penaltyAreaDepth, m.penaltyAreaWidth)
  rect(L - m.penaltyAreaDepth, paTop, m.penaltyAreaDepth, m.penaltyAreaWidth)
  rect(0, gaTop, m.goalAreaDepth, m.goalAreaWidth)
  rect(L - m.goalAreaDepth, gaTop, m.goalAreaDepth, m.goalAreaWidth)
  ctx.fillStyle = LINE
  for (const sx of [m.penaltySpotDist, L - m.penaltySpotDist, L / 2]) {
    ctx.beginPath()
    ctx.arc(sx * k, cy * k, 0.3 * k, 0, Math.PI * 2)
    ctx.fill()
  }
  // goals: net trapezoid with a diagonal mesh + crossbar + posts (same look as the board)
  const goalTop = cy - m.goalWidth / 2
  const goalBot = cy + m.goalWidth / 2
  for (const dir of [-1, 1] as const) {
    const x = dir === -1 ? 0 : L
    const back = x + dir * m.goalDepth
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(x * k, goalTop * k)
    ctx.lineTo(back * k, goalTop * k)
    ctx.lineTo(back * k, goalBot * k)
    ctx.lineTo(x * k, goalBot * k)
    ctx.closePath()
    ctx.clip()
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'
    ctx.lineWidth = Math.max(0.5, 0.045 * k)
    ctx.beginPath()
    const x0 = Math.min(x, back)
    const x1 = Math.max(x, back)
    const h = goalBot - goalTop
    for (let s = x0 - h; s <= x1; s += 0.4) {
      ctx.moveTo(s * k, goalBot * k)
      ctx.lineTo((s + h) * k, goalTop * k)
      ctx.moveTo(s * k, goalTop * k)
      ctx.lineTo((s + h) * k, goalBot * k)
    }
    ctx.stroke()
    ctx.restore()
    ctx.strokeStyle = LINE
    ctx.lineWidth = Math.max(1, 0.2 * k)
    ctx.beginPath()
    ctx.moveTo(x * k, goalTop * k)
    ctx.lineTo(back * k, goalTop * k)
    ctx.lineTo(back * k, goalBot * k)
    ctx.lineTo(x * k, goalBot * k)
    ctx.stroke()
    // crossbar + posts on the goal line
    ctx.lineWidth = Math.max(1.5, 0.3 * k)
    ctx.beginPath()
    ctx.moveTo(x * k, goalTop * k)
    ctx.lineTo(x * k, goalBot * k)
    ctx.stroke()
  }
}

/** Canvas can't resolve CSS var() colors (SVG can) — read the computed value instead. */
function resolveColor(c: string | undefined, fallback: string): string {
  if (!c) return fallback
  const m = c.match(/^var\((--[\w-]+)\s*(?:,\s*([^)]+))?\)$/)
  if (!m) return c
  const computed =
    typeof document !== 'undefined'
      ? getComputedStyle(document.documentElement).getPropertyValue(m[1]!).trim()
      : ''
  return computed || m[2]?.trim() || fallback
}

/** Render one tactical frame (playback look: tokens + ball only). */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  doc: TacticDocument,
  compiled: ReturnType<typeof compile>,
  t: number,
  k: number,
): void {
  // shift the whole metre space so the goal nets (negative x) fit in frame
  ctx.save()
  ctx.translate(GIF_PAD_M * k, GIF_PAD_M * k)
  drawPitch(ctx, doc, k)
  // annotations under the tokens (PLAN-008): pen strokes belong to the board, not the play.
  // Freehand renders with the VIC pen geometry (midpoint quadratics, pressure widths).
  for (const dr of doc.drawings) {
    if (dr.visible && (t < dr.visible.from || t > dr.visible.to)) continue
    if (dr.kind !== 'freehand' && dr.kind !== 'line') continue
    if (dr.points.length < 2) continue
    ctx.strokeStyle = resolveColor(dr.style?.color, '#000000')
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.globalAlpha = dr.style?.opacity ?? 1
    const baseW = ((dr.style?.width ?? 5) / 10) * k // ≈ screen px at ~10px/m layout
    if (dr.kind === 'freehand') {
      for (const seg of penSegments(dr.points, dr.pressures)) {
        // penSegments emits pitch-metre coordinates — scale via transform
        const path = new Path2D(seg.d)
        ctx.save()
        ctx.scale(k, k)
        ctx.lineWidth = Math.max(1 / k, (baseW * seg.f) / k)
        ctx.stroke(path)
        ctx.restore()
      }
    } else {
      ctx.beginPath()
      ctx.moveTo(dr.points[0]!.x * k, dr.points[0]!.y * k)
      for (let i = 1; i < dr.points.length; i++)
        ctx.lineTo(dr.points[i]!.x * k, dr.points[i]!.y * k)
      ctx.lineWidth = Math.max(1, baseW)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }
  const rs = stateAt(compiled, doc, t)
  const teamColor = new Map(
    doc.teams.map((tm, i) => [
      tm.id,
      resolveColor(tm.color, i === 0 ? VISUAL.teamHome : VISUAL.teamAway),
    ]),
  )
  const awayTeamId = doc.teams[1]?.id
  for (const p of doc.players) {
    const pos = rs.players[p.id]?.pos ?? p.home
    ctx.beginPath()
    ctx.arc(pos.x * k, pos.y * k, TOKEN_R * k, 0, Math.PI * 2)
    ctx.fillStyle = teamColor.get(p.teamId) ?? '#666'
    ctx.fill()
    ctx.lineWidth = Math.max(1, 0.16 * k)
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'
    ctx.stroke()
    if (p.teamId === awayTeamId) {
      // away inner keyline (A-02a) — same cue as on screen
      ctx.beginPath()
      ctx.arc(pos.x * k, pos.y * k, (TOKEN_R - 0.34) * k, 0, Math.PI * 2)
      ctx.lineWidth = Math.max(1, 0.14 * k)
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'
      ctx.stroke()
    }
    ctx.fillStyle = '#fff'
    ctx.font = `700 ${Math.round(1.45 * k)}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(p.number), pos.x * k, pos.y * k + 0.1 * k)
  }
  /*
   * The ball on top — the SAME ball the board draws.
   *
   * This used to be a white disc with one dark dot in the middle, which is not what anyone sees in
   * the app, so an exported GIF showed a different product (user 2026-08-25: gif 내보내기의
   * 축구공 디자인이 사이트랑 달라). The panel geometry is shared (`renderer/ballMark`); only
   * the stroking differs, because canvas has no CSS.
   */
  const b = rs.ball.pos
  const bx = b.x * k
  const by = b.y * k
  const br = BALL_R * k
  ctx.beginPath()
  ctx.arc(bx, by, br, 0, Math.PI * 2)
  ctx.fillStyle = BALL_FILL
  ctx.fill()
  // the board's keyline is 0.9 CSS px whatever the zoom; here the frame is the zoom, so scale it
  ctx.lineWidth = Math.max(1, 0.075 * k)
  ctx.strokeStyle = BALL_INK
  ctx.stroke()
  ctx.fillStyle = BALL_INK
  for (const panel of ballPanels()) {
    const pts = pentagonPoints(panel)
    ctx.globalAlpha = panel.opacity
    ctx.beginPath()
    for (const [px, py] of pts) ctx.lineTo(bx + px * br, by + py * br)
    ctx.closePath()
    ctx.fill()
  }
  ctx.globalAlpha = 1
  ctx.beginPath()
  ctx.arc(bx + BALL_SPECULAR.cx * br, by + BALL_SPECULAR.cy * br, BALL_SPECULAR.r * br, 0, Math.PI * 2)
  ctx.fillStyle = BALL_SPECULAR.fill
  ctx.fill()
  ctx.restore()
}

/** Sample times for the whole play at `fps`, compressed by `speed`. Pure (unit-tested). */
export function sampleTimes(duration: number, fps: number, speed: number): number[] {
  const out: number[] = []
  const step = speed / fps
  for (let t = 0; t < duration; t += step) out.push(Math.round(t * 1000) / 1000)
  out.push(duration) // always land exactly on the final frame
  return out
}

/**
 * ONE palette for the whole GIF, built from frames spread across the play.
 *
 * Quantising every frame separately writes a 768-byte local colour table per frame AND lets the
 * palette drift, so flat grass shimmers between frames — the "choppy" look is partly this, not
 * just the frame rate. A palette sampled at low resolution is just as good (colour statistics do
 * not need pixels) and costs a fraction of the time.
 */
function globalPalette(
  doc: TacticDocument,
  compiled: ReturnType<typeof compile>,
  times: readonly number[],
): number[][] {
  const m = pitchMarkings(doc.pitch)
  const w = 320
  const k = w / (m.length + GIF_PAD_M * 2)
  const h = Math.max(1, Math.round((m.width + GIF_PAD_M * 2) * k))
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const cx = c.getContext('2d', { willReadFrequently: true })
  if (!cx) return []
  const picks = [0, 0.25, 0.5, 0.75, 1].map(
    (f) => times[Math.min(times.length - 1, Math.round(f * (times.length - 1)))]!,
  )
  const merged = new Uint8Array(w * h * 4 * picks.length)
  picks.forEach((t, i) => {
    drawFrame(cx, doc, compiled, t, k)
    merged.set(cx.getImageData(0, 0, w, h).data, i * w * h * 4)
  })
  return quantize(merged, 256, { format: 'rgb565' })
}

export async function exportGif(doc: TacticDocument, opts: GifOptions = {}): Promise<Blob> {
  const { speed = 1, maxBytes = GIF_MAX_BYTES, onProgress } = opts
  const compiled = compile(doc)
  // real end of the play, not the engine's 5s empty-board padding
  let lastEnd = 0
  for (const t of Object.values(compiled.segmentTimes)) if (t.end > lastEnd) lastEnd = t.end
  const duration = Math.max(0.1, lastEnd)
  const m = pitchMarkings(doc.pitch)

  // An explicit width/fps pins the export to exactly that; otherwise walk the tiers down.
  const tiers =
    opts.width || opts.fps ? [{ width: opts.width ?? 1280, fps: opts.fps ?? 25 }] : [...GIF_TIERS]

  let last: Blob | null = null
  for (let tier = 0; tier < tiers.length; tier++) {
    const { width, fps } = tiers[tier]!
    const k = width / (m.length + GIF_PAD_M * 2)
    const height = Math.round((m.width + GIF_PAD_M * 2) * k)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('canvas 2d unavailable')

    const times = sampleTimes(duration, fps, speed)
    const palette = globalPalette(doc, compiled, times)
    const gif = GIFEncoder()
    const delay = Math.round(1000 / fps)
    let overBudget = false
    for (let i = 0; i < times.length; i++) {
      drawFrame(ctx, doc, compiled, times[i]!, k)
      const { data } = ctx.getImageData(0, 0, width, height)
      const index = applyPalette(data, palette, 'rgb565')
      // palette on the FIRST frame only → one global colour table, no per-frame drift
      gif.writeFrame(index, width, height, i === 0 ? { palette, delay, repeat: 0 } : { delay })
      onProgress?.(i + 1, times.length)
      // Project the finished size from what is on disk so far and bail early rather than spend a
      // minute encoding something that will not fit.
      if (i >= 5 && tier < tiers.length - 1) {
        const projected = (gif.bytesView().length / (i + 1)) * times.length
        if (projected > maxBytes) {
          overBudget = true
          break
        }
      }
      // keep the UI thread breathing on long plays
      if (i % 8 === 7) await new Promise((r) => setTimeout(r, 0))
    }
    if (overBudget) continue
    gif.finish()
    const view = gif.bytesView()
    const copy = new Uint8Array(view.length)
    copy.set(view)
    last = new Blob([copy], { type: 'image/gif' })
    // The projection is an estimate; if the finished file still overshoots, take the next tier.
    if (last.size <= maxBytes || tier === tiers.length - 1) return last
  }
  if (!last) throw new Error('gif encode produced nothing')
  return last
}

/** Trigger a browser download for the encoded GIF. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
