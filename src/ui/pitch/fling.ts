import type { Vec2 } from '@/domain/types'
import { FLING } from '@/editor/segmentCommands'

export interface PointerSample {
  p: Vec2
  at: number
}

/** Release later than this after the last move = the user stopped before letting go → not a fling. */
export const FLING_STALE_MS = 100
/** Velocity window: average over the last ~90 ms of movement. */
const WINDOW_MS = 90

/**
 * Average velocity (m/s) over the last ~90 ms of samples at release time `now`.
 * Returns null when the pointer had stopped (stale) or was too slow for a fling.
 * [WH-CHANGE 2026-08-20] Stale check added — a plain drag that pauses before release is a move, never a fling.
 */
export function releaseVelocity(samples: readonly PointerSample[], now: number): Vec2 | null {
  if (samples.length < 2) return null
  const last = samples[samples.length - 1]!
  if (now - last.at > FLING_STALE_MS) return null
  let i = samples.length - 2
  while (i > 0 && last.at - samples[i]!.at < WINDOW_MS) i--
  const first = samples[i]!
  const dt = (last.at - first.at) / 1000
  if (dt <= 0) return null
  const v = { x: (last.p.x - first.p.x) / dt, y: (last.p.y - first.p.y) / dt }
  return Math.hypot(v.x, v.y) >= FLING.minCursorSpeed ? v : null
}
