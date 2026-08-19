/**
 * UI-only presentation derived from compiled data (ISSUE-006).
 * A ball travel that follows a possession starts where the holder releases it — compile fixes that
 * point, but the authored first waypoint may sit elsewhere. We never mutate the document; we only
 * hand the renderer a presentation copy and lock the first waypoint against dragging.
 */
import type { Id, Path, TacticDocument, Vec2 } from '@/domain/types'
import type { CompiledTimeline } from '@/engine/compile'

export interface AttachedPathStart {
  segmentId: Id
  waypointId: Id
  holderId: Id
  /** Compiled release point (metres). */
  p: Vec2
  /** Delta applied to the authored first waypoint (presentation only). */
  delta: Vec2
}

export function deriveAttachedPathStart(
  doc: TacticDocument,
  compiled: CompiledTimeline,
  selectedSegmentId: Id | null,
): AttachedPathStart | null {
  if (!selectedSegmentId) return null
  const scene = doc.scenes[0]
  if (!scene) return null
  const track = scene.timeline.tracks.find((t) => t.entityKind === 'ball')
  if (!track) return null
  const idx = track.segments.findIndex((s) => s.id === selectedSegmentId)
  if (idx < 0) return null
  const seg = track.segments[idx]!
  if (seg.kind !== 'travel' || seg.path.waypoints.length === 0) return null
  const prev = track.segments[idx - 1]
  if (!prev || prev.kind !== 'possessed') return null
  const ct = compiled.tracks[track.entityId]?.segments.find((s) => s.id === seg.id)
  if (!ct || ct.kind !== 'travel') return null
  const p0 = ct.schedule.lut.pts[0]
  if (!p0) return null
  const w0 = seg.path.waypoints[0]!
  return {
    segmentId: seg.id,
    waypointId: w0.id,
    holderId: prev.holderId,
    p: p0,
    delta: { x: p0.x - w0.p.x, y: p0.y - w0.p.y },
  }
}

/** Presentation copy of a path with its first waypoint (and handle) shifted by `delta`. Pure. */
export function presentPathWithAttachedStart(path: Path, attached: AttachedPathStart | null): Path {
  if (!attached || path.waypoints.length === 0) return path
  const [w0, ...rest] = path.waypoints
  if (!w0 || w0.id !== attached.waypointId) return path
  const d = attached.delta
  return {
    waypoints: [
      {
        ...w0,
        p: { x: w0.p.x + d.x, y: w0.p.y + d.y },
        handleOut: w0.handleOut ? { x: w0.handleOut.x + d.x, y: w0.handleOut.y + d.y } : undefined,
      },
      ...rest,
    ],
  }
}
