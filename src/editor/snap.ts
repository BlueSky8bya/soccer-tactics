/**
 * Snapping (ADR-0006 D3): alignment with same-team players (h/v lines) and pitch landmarks.
 * Pure function: returns snapped point + guides. No grid.
 */
import type { Pitch, Player, Vec2, Id } from '@/domain/types'
import { pitchMarkings } from './geometry'
import type { SnapGuide } from './uiStore'

export interface SnapOptions {
  /** Max distance (metres) to snap to an alignment line. */
  alignThreshold?: number
  /** Max distance (metres) to snap to a landmark point. */
  landmarkThreshold?: number
}

export interface SnapResult {
  p: Vec2
  guides: SnapGuide[]
  snapped: boolean
}

export function snapPosition(
  raw: Vec2,
  movingId: Id,
  players: readonly Player[],
  pitch: Pitch,
  opts: SnapOptions = {},
): SnapResult {
  const alignT = opts.alignThreshold ?? 0.8
  const landT = opts.landmarkThreshold ?? 1.2
  const guides: SnapGuide[] = []
  const p: Vec2 = { ...raw }
  let snapped = false

  // 1. Landmarks (points) win if close.
  const m = pitchMarkings(pitch)
  let bestLand: { d: number; id: string; p: Vec2 } | null = null
  for (const l of m.landmarks) {
    const d = Math.hypot(l.p.x - raw.x, l.p.y - raw.y)
    if (d <= landT && (!bestLand || d < bestLand.d)) bestLand = { d, id: l.id, p: l.p }
  }
  if (bestLand) {
    return {
      p: { ...bestLand.p },
      guides: [{ kind: 'point', x: bestLand.p.x, y: bestLand.p.y, label: bestLand.id }],
      snapped: true,
    }
  }

  // 2. Alignment with other players on the same team (closest on each axis).
  const mover = players.find((pl) => pl.id === movingId)
  const peers = players.filter((pl) => pl.id !== movingId && (!mover || pl.teamId === mover.teamId))
  let bestX: { d: number; x: number } | null = null
  let bestY: { d: number; y: number } | null = null
  for (const pl of peers) {
    const dx = Math.abs(pl.home.x - raw.x)
    const dy = Math.abs(pl.home.y - raw.y)
    if (dx <= alignT && (!bestX || dx < bestX.d)) bestX = { d: dx, x: pl.home.x }
    if (dy <= alignT && (!bestY || dy < bestY.d)) bestY = { d: dy, y: pl.home.y }
  }
  if (bestX) {
    p.x = bestX.x
    guides.push({ kind: 'v', x: bestX.x })
    snapped = true
  }
  if (bestY) {
    p.y = bestY.y
    guides.push({ kind: 'h', y: bestY.y })
    snapped = true
  }
  return { p, guides, snapped }
}
