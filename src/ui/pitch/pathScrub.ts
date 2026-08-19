/**
 * Path-scrub (ADR-0006 D4-1, plan M3): drag a path-bearing token along its trajectory → playhead.
 * Pure helpers. Positions come from stateAt (so easing/holds/decel/attached ball start are honoured).
 * No document or history changes — this is UI playback state only.
 */
import type { Id, TacticDocument, Vec2 } from '@/domain/types'
import type { CompiledTimeline } from '@/engine/compile'
import { stateAt } from '@/engine/stateAt'

export interface ScrubTracePoint {
  t: number
  p: Vec2
  segmentId: Id
}

export interface PathScrubIndex {
  entityId: Id
  points: ScrubTracePoint[]
}

export interface PathScrubHit {
  t: number
  p: Vec2
  segmentId: Id
  distance: number
}

/** Default max pointer distance from the trajectory (metres) — A-04 (a). */
export const SCRUB_TOLERANCE_M = 1.2

function entityPos(
  doc: TacticDocument,
  compiled: CompiledTimeline,
  entityId: Id,
  t: number,
): Vec2 | null {
  const s = stateAt(compiled, doc, t)
  if (entityId === doc.ball.id) return s.ball.pos
  return s.players[entityId]?.pos ?? null
}

/** Sample every path segment of the entity at ~0.4 m spacing (≥ 8 samples). Memoize per revision+entity. */
export function buildPathScrubIndex(
  doc: TacticDocument,
  compiled: CompiledTimeline,
  entityId: Id,
): PathScrubIndex {
  const track = compiled.tracks[entityId]
  const points: ScrubTracePoint[] = []
  if (!track) return { entityId, points }
  for (const seg of track.segments) {
    if (seg.kind !== 'move' && seg.kind !== 'travel') continue
    const start = seg.start
    const end = Number.isFinite(seg.end) ? seg.end : seg.start
    if (end <= start) continue
    const length = seg.schedule.lut.length
    const n = Math.max(8, Math.min(400, Math.ceil(length / 0.4)))
    for (let i = 0; i <= n; i++) {
      const t = start + ((end - start) * i) / n
      const p = entityPos(doc, compiled, entityId, t)
      if (p) points.push({ t, p, segmentId: seg.id })
    }
  }
  return { entityId, points }
}

/**
 * Nearest trajectory point to `pointer`. Candidates within `tolerance` are ranked by distance;
 * near-ties (within 0.1 m — crossings/overlaps) resolve to the time closest to `currentT`,
 * then by source order. Returns null when nothing is within tolerance.
 */
export function findPathScrubHit(
  index: PathScrubIndex,
  pointer: Vec2,
  currentT: number,
  tolerance = SCRUB_TOLERANCE_M,
): PathScrubHit | null {
  const pts = index.points
  if (pts.length < 2) return null
  const hits: PathScrubHit[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!
    const b = pts[i + 1]!
    if (a.segmentId !== b.segmentId) continue
    const dx = b.p.x - a.p.x
    const dy = b.p.y - a.p.y
    const len2 = dx * dx + dy * dy
    const u =
      len2 === 0
        ? 0
        : Math.max(0, Math.min(1, ((pointer.x - a.p.x) * dx + (pointer.y - a.p.y) * dy) / len2))
    const px = a.p.x + dx * u
    const py = a.p.y + dy * u
    const d = Math.hypot(pointer.x - px, pointer.y - py)
    if (d <= tolerance)
      hits.push({
        t: a.t + (b.t - a.t) * u,
        p: { x: px, y: py },
        segmentId: a.segmentId,
        distance: d,
      })
  }
  if (!hits.length) return null
  let best = hits[0]!
  for (const h of hits) if (h.distance < best.distance) best = h
  const tied = hits.filter((h) => h.distance <= best.distance + 0.1)
  tied.sort((x, y) => Math.abs(x.t - currentT) - Math.abs(y.t - currentT) || x.t - y.t)
  return tied[0]!
}
