/**
 * UI-only presentation derived from compiled data (ISSUE-006).
 * A ball travel that follows a possession starts where the holder releases it — compile fixes that
 * point, but the authored first waypoint may sit elsewhere. We never mutate the document; we only
 * hand the renderer a presentation copy and lock the first waypoint against dragging.
 */
import type { Id, Path, TacticDocument, Vec2 } from '@/domain/types'
import { buildPathLUT, pointAtDistance } from '@/engine/path'
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

// ---------------------------------------------------------------------------
// PLAN-005 M4: crowded-pitch focus. All pure, document never mutated (RULE-01).

export type PathPhase = 'past' | 'active' | 'future'

/** Segments whose compiled window contains `t` (the movements happening NOW). */
export function deriveActiveSegmentIds(
  segmentTimes: Record<Id, { start: number; end: number }>,
  t: number,
): Set<Id> {
  const out = new Set<Id>()
  for (const [id, w] of Object.entries(segmentTimes)) {
    if (t >= w.start - 1e-9 && t <= w.end + 1e-9) out.add(id)
  }
  return out
}

/** past / active / future for one segment at time `t`. */
export function derivePathPhase(
  w: { start: number; end: number } | undefined,
  t: number,
): PathPhase {
  if (!w) return 'future'
  if (t > w.end + 1e-9) return 'past'
  if (t < w.start - 1e-9) return 'future'
  return 'active'
}

/**
 * Ghost opacity from the GLOBAL step order (A-05a): the further a movement's step is from the
 * step being authored, the fainter its ghost — with a floor so context never fully disappears.
 * `stepRank` is the movement step's index in the sorted list of used steps.
 */
export function ghostOpacityForStep(stepRank: number, boosted: boolean): number {
  const base = Math.max(0.18, 0.55 - stepRank * 0.11)
  return boosted ? Math.min(0.85, base + 0.2) : base
}

/**
 * Deterministic, bounded step-badge placement (B-03): anchor at the path midpoint, lifted; when a
 * badge would land within `minGap` of an already placed one, try a fixed candidate ring instead.
 */
export function placeStepBadges(
  anchors: { id: Id; at: Vec2 }[],
  minGap = 2.6,
): { id: Id; at: Vec2 }[] {
  const placed: Vec2[] = []
  const CANDIDATES: Vec2[] = [
    { x: 0, y: -1.9 },
    { x: 0, y: 1.9 },
    { x: 2.4, y: -1.9 },
    { x: -2.4, y: -1.9 },
    { x: 2.4, y: 1.9 },
  ]
  return anchors.map((a) => {
    let best: Vec2 = { x: a.at.x, y: a.at.y - 1.9 }
    for (const c of CANDIDATES) {
      const cand = { x: a.at.x + c.x, y: a.at.y + c.y }
      const clash = placed.some((q) => Math.hypot(q.x - cand.x, q.y - cand.y) < minGap)
      if (!clash) {
        best = cand
        break
      }
    }
    placed.push(best)
    return { id: a.id, at: best }
  })
}

/**
 * Rest-view hierarchy (A-05a): every authored path stays visible, but paths OUTSIDE the current
 * authoring step recede. The selected segment never mutes. Pure and deterministic.
 */
export function deriveRestMutedIds(
  segs: { id: Id; step: number }[],
  currentStep: number,
  selectedSegmentId: Id | null,
): Record<Id, boolean> {
  const out: Record<Id, boolean> = {}
  for (const s of segs) {
    if (s.id === selectedSegmentId) continue
    if (s.step !== currentStep) out[s.id] = true
  }
  return out
}

/**
 * Display-only path with its END pulled back by `trimM` metres, so the arrowhead floats clear of
 * the entity/ghost sitting on the endpoint (user 2026-08-20: 화살촉이 가려짐). Returns an SVG
 * polyline `d`; null when the path is too short to trim. Hit-testing keeps the full path.
 */
export function trimPathEndD(path: Path, trimM: number): string | null {
  const lut = buildPathLUT(path)
  const usable = lut.length - trimM
  if (usable < 1.2) return null
  const step = 0.35
  const pts: string[] = []
  for (let d = 0; d <= usable + 1e-6; d += step) {
    const p = pointAtDistance(lut, Math.min(d, usable))
    pts.push(`${Math.round(p.x * 100) / 100} ${Math.round(p.y * 100) / 100}`)
  }
  const endP = pointAtDistance(lut, usable)
  pts.push(`${Math.round(endP.x * 100) / 100} ${Math.round(endP.y * 100) / 100}`)
  return `M ${pts.join(' L ')}`
}
