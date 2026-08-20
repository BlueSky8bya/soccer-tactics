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
import { VISUAL } from '@/renderer/visualDefaults'

export interface GifOptions {
  /** Tactical seconds per real second in the GIF (time compression). */
  speed?: number
  fps?: number
  /** Output pixel width (height follows the pitch ratio). */
  width?: number
  onProgress?: (done: number, total: number) => void
}

const GRASS = VISUAL.pitchGrass
const GRASS_ALT = VISUAL.pitchGrassAlt
const LINE = VISUAL.pitchLine
const TOKEN_R = VISUAL.tokenRadiusM
const BALL_R = VISUAL.ballRadiusM

function drawPitch(ctx: CanvasRenderingContext2D, doc: TacticDocument, k: number): void {
  const m = pitchMarkings(doc.pitch)
  const { length: L, width: W } = m
  const cy = W / 2
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
}

/** Render one tactical frame (playback look: tokens + ball only). */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  doc: TacticDocument,
  compiled: ReturnType<typeof compile>,
  t: number,
  k: number,
): void {
  drawPitch(ctx, doc, k)
  const rs = stateAt(compiled, doc, t)
  const teamColor = new Map(doc.teams.map((tm) => [tm.id, tm.color]))
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
      ctx.arc(pos.x * k, pos.y * k, (TOKEN_R - 0.42) * k, 0, Math.PI * 2)
      ctx.lineWidth = Math.max(1, 0.14 * k)
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'
      ctx.stroke()
    }
    ctx.fillStyle = '#fff'
    ctx.font = `700 ${Math.round(1.6 * k)}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(p.number), pos.x * k, pos.y * k + 0.1 * k)
  }
  // ball on top
  const b = rs.ball.pos
  ctx.beginPath()
  ctx.arc(b.x * k, b.y * k, BALL_R * k, 0, Math.PI * 2)
  ctx.fillStyle = VISUAL.ballFill
  ctx.fill()
  ctx.lineWidth = Math.max(1, 0.12 * k)
  ctx.strokeStyle = 'rgba(20,24,32,0.7)'
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(b.x * k, b.y * k, BALL_R * 0.35 * k, 0, Math.PI * 2)
  ctx.fillStyle = VISUAL.ballDetail
  ctx.fill()
}

/** Sample times for the whole play at `fps`, compressed by `speed`. Pure (unit-tested). */
export function sampleTimes(duration: number, fps: number, speed: number): number[] {
  const out: number[] = []
  const step = speed / fps
  for (let t = 0; t < duration; t += step) out.push(Math.round(t * 1000) / 1000)
  out.push(duration) // always land exactly on the final frame
  return out
}

export async function exportGif(doc: TacticDocument, opts: GifOptions = {}): Promise<Blob> {
  const { speed = 2, fps = 12, width = 640, onProgress } = opts
  const compiled = compile(doc)
  const duration = Math.max(0.1, compiled.duration)
  const m = pitchMarkings(doc.pitch)
  const k = width / m.length
  const height = Math.round(m.width * k)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('canvas 2d unavailable')

  const times = sampleTimes(duration, fps, speed)
  const gif = GIFEncoder()
  const delay = Math.round(1000 / fps)
  for (let i = 0; i < times.length; i++) {
    drawFrame(ctx, doc, compiled, times[i]!, k)
    const { data } = ctx.getImageData(0, 0, width, height)
    const palette = quantize(data, 256)
    const index = applyPalette(data, palette)
    gif.writeFrame(index, width, height, { palette, delay })
    onProgress?.(i + 1, times.length)
    // keep the UI thread breathing on long plays
    if (i % 8 === 7) await new Promise((r) => setTimeout(r, 0))
  }
  gif.finish()
  const view = gif.bytesView()
  const copy = new Uint8Array(view.length)
  copy.set(view)
  return new Blob([copy], { type: 'image/gif' })
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
