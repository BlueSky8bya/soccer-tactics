/**
 * compile(doc) → CompiledTimeline (ADR-0003).
 * Resolves triggers to absolute times, builds path LUTs and move schedules, derives ball events.
 * Pure & deterministic. Errors (cycles, dangling refs) are reported, never silently fixed.
 */
import type {
  BallTravelKind,
  Id,
  Path,
  Segment,
  TacticDocument,
  Trigger,
  Vec2,
  Waypoint,
} from '@/domain/types'
import { EASINGS, buildPathLUT, pointAtDistance, type PathLUT } from './path'
import { carryAheadFor, heldBallPos, type CarryMove } from './carry'

export const DEFAULT_SPEED = 4.5 // m/s (jog/run) when a move has speed timing but no value
export const MIN_SCENE_DURATION = 5 // seconds shown when the timeline is empty
export const BALL_OFFSET: Vec2 = { x: 1.75, y: 1.15 } // possessed ball just clear of the holder (m)

/** Carry ring — where a held ball may rest around its holder (ADR-0010 D5, one source). */
export const CARRY_RING_MIN_M = 2.0
export const CARRY_RING_MAX_M = 2.6
/** Drop-commit / attach radius: ring max + float headroom, so a ball released exactly ON the
 *  ring ALWAYS attaches (the 2.6-vs-2.6 float equality bug of CHG-105 can never return). */
export const ATTACH_RADIUS_M = CARRY_RING_MAX_M + 0.1

/**
 * Carry direction: clamp a holder→ball vector to a natural dribbling radius. The holder can carry
 * the ball at ANY angle (user 2026-08-20) — direction is preserved, distance stays in [0.8, 1.6] m.
 * Degenerate vectors fall back to the classic right-foot offset.
 */
export function carryOffset(v: Vec2): Vec2 {
  const len = Math.hypot(v.x, v.y)
  if (len < 0.05) return BALL_OFFSET
  // Foot distance: far enough that the ball never sits ON the player disc (r 1.7 + ball 0.75),
  // close enough to read as "held" (user 2026-08-20: 공이 선수를 가리면 클릭을 뺏는다).
  const r = Math.max(CARRY_RING_MIN_M, Math.min(CARRY_RING_MAX_M, len))
  return { x: (v.x / len) * r, y: (v.y / len) * r }
}

export interface MoveSchedule {
  lut: PathLUT
  /** Travel time excluding holds. */
  travel: number
  /** Launch speed + constant deceleration (m/s, m/s²) — position via kinematics instead of easing. */
  decel?: { v0: number; a: number }
  /** Piecewise (time → distance) breakpoints: [t, s] sorted by t. Includes holds as flat pieces. */
  keys: { t: number; s: number }[]
  easing: keyof typeof EASINGS
  /** Time offset (from segment start) at which each waypoint is reached. */
  waypointT: number[]
}

export type CompiledSegment =
  | { id: Id; kind: 'move'; start: number; end: number; schedule: MoveSchedule; carryEnd?: Vec2 }
  | { id: Id; kind: 'hold'; start: number; end: number }
  | {
      id: Id
      kind: 'possessed'
      start: number
      end: number
      holderId: Id
      offset: Vec2
      offsetLocked?: boolean
    }
  | {
      id: Id
      kind: 'travel'
      start: number
      end: number
      schedule: MoveSchedule
      travelKind: BallTravelKind
      receiverId?: Id
      flight: 'ground' | 'lofted'
    }
  | { id: Id; kind: 'loose'; start: number; end: number; pos: Vec2 }

export interface CompiledTrack {
  entityId: Id
  entityKind: 'player' | 'ball'
  segments: CompiledSegment[] // sorted by start
}

export interface CompiledEvent {
  kind: 'ball.released' | 'ball.received' | 'segment.start' | 'segment.end'
  t: number
  segmentId: Id
  entityId: Id
}

export interface CompileIssue {
  level: 'error' | 'warning'
  segmentId?: Id
  message: string
}

export interface CompiledTimeline {
  sceneId: Id
  duration: number
  tracks: Record<Id, CompiledTrack>
  events: CompiledEvent[]
  issues: CompileIssue[]
  /** Segment id → [start, end] for quick lookup (UI). */
  segmentTimes: Record<Id, { start: number; end: number; entityId: Id }>
}

// ---------- schedule ----------

function buildSchedule(
  path: Path,
  timing: Segment['timing'],
  easing: Segment['easing'],
  holds: number[],
): MoveSchedule {
  const lut = buildPathLUT(path)
  const totalHold = holds.reduce((a, b) => a + b, 0)
  let travel: number
  let decel: MoveSchedule['decel']
  if ('duration' in timing) travel = Math.max(0, timing.duration - totalHold)
  else if ('decel' in timing && timing.decel > 0 && timing.speed > 0) {
    // distance to stop = v0²/(2a); if the path is shorter, it arrives early (still decelerating).
    const v0 = timing.speed
    const a = timing.decel
    const stopDist = (v0 * v0) / (2 * a)
    if (lut.length >= stopDist) travel = v0 / a
    else travel = (v0 - Math.sqrt(Math.max(0, v0 * v0 - 2 * a * lut.length))) / a
    decel = { v0, a }
  } else travel = lut.length / (timing.speed > 0 ? timing.speed : DEFAULT_SPEED)
  const keys: { t: number; s: number }[] = [{ t: 0, s: 0 }]
  const waypointT: number[] = [0]
  let t = 0
  const wS = lut.waypointS
  for (let i = 1; i < wS.length; i++) {
    const ds = wS[i]! - wS[i - 1]!
    const dt = lut.length > 0 ? (ds / lut.length) * travel : 0
    t += dt
    keys.push({ t, s: wS[i]! })
    const hold = holds[i] ?? 0
    if (hold > 0) {
      t += hold
      keys.push({ t, s: wS[i]! })
    }
    waypointT.push(t)
  }
  return { lut, travel, keys, easing: easing ?? 'linear', waypointT, decel }
}

/** Arc-length distance reached at the end of the schedule (shorter than the path for a stopping ball). */
export function scheduleEndDistance(s: MoveSchedule): number {
  if (s.decel) return Math.min(s.lut.length, (s.decel.v0 * s.decel.v0) / (2 * s.decel.a))
  return s.lut.length
}

export function scheduleDuration(s: MoveSchedule): number {
  return s.keys[s.keys.length - 1]?.t ?? 0
}

/** Position along a move schedule at local time `lt` (0..duration). */
export function schedulePosAt(s: MoveSchedule, lt: number): Vec2 {
  const dur = scheduleDuration(s)
  if (dur <= 0 || lt <= 0) return pointAtDistance(s.lut, 0)
  if (lt >= dur) return pointAtDistance(s.lut, scheduleEndDistance(s))
  const hasHolds = s.keys.length > s.lut.waypointS.length
  if (s.decel && !hasHolds) {
    const { v0, a } = s.decel
    const dist = Math.max(0, v0 * lt - 0.5 * a * lt * lt)
    return pointAtDistance(s.lut, Math.min(s.lut.length, dist))
  }
  if (!hasHolds) {
    const u = EASINGS[s.easing](lt / dur)
    return pointAtDistance(s.lut, u * s.lut.length)
  }
  // piecewise linear between keys (holds → flat)
  let i = 0
  while (i < s.keys.length - 1 && s.keys[i + 1]!.t <= lt) i++
  const a = s.keys[i]!
  const b = s.keys[Math.min(i + 1, s.keys.length - 1)]!
  const span = b.t - a.t
  const u = span <= 0 ? 0 : (lt - a.t) / span
  return pointAtDistance(s.lut, a.s + (b.s - a.s) * u)
}

// ---------- compile ----------

interface Pending {
  trackId: Id
  entityId: Id
  entityKind: 'player' | 'ball'
  indexInTrack: number
  seg: Segment
  start?: number
  end?: number
  schedule?: MoveSchedule
}

export function compile(doc: TacticDocument, sceneIndex = 0): CompiledTimeline {
  const scene = doc.scenes[sceneIndex] ?? doc.scenes[0]
  const issues: CompileIssue[] = []
  if (!scene) {
    return {
      sceneId: 'none',
      duration: MIN_SCENE_DURATION,
      tracks: {},
      events: [],
      issues: [{ level: 'error', message: 'no scene' }],
      segmentTimes: {},
    }
  }

  const pend = new Map<Id, Pending>()
  const byTrack: Pending[][] = []
  const playerHome = new Map<Id, Vec2>(doc.players.map((p) => [p.id, p.home]))

  for (const track of scene.timeline.tracks) {
    const list: Pending[] = []
    track.segments.forEach((seg, i) => {
      if (pend.has(seg.id))
        issues.push({
          level: 'error',
          segmentId: seg.id,
          message: `duplicate segment id ${seg.id}`,
        })
      const p: Pending = {
        trackId: track.id,
        entityId: track.entityId,
        entityKind: track.entityKind,
        indexInTrack: i,
        seg,
      }
      pend.set(seg.id, p)
      list.push(p)
    })
    byTrack.push(list)
  }

  const markers = new Map(scene.timeline.markers.map((m) => [m.id, m]))

  // Player move/hold durations are intrinsic; build schedules up front.
  for (const p of pend.values()) {
    const seg = p.seg
    if (seg.kind === 'move') {
      p.schedule = buildSchedule(
        seg.path,
        seg.timing,
        seg.easing,
        seg.path.waypoints.map((w) => w.hold ?? 0),
      )
    }
  }

  // Resolve triggers iteratively.
  const resolveTrigger = (tr: Trigger, depth = 0): number | null => {
    if (depth > 50) return null
    switch (tr.type) {
      case 'at':
        return tr.t
      case 'afterSegment': {
        const ref = pend.get(tr.segmentId)
        if (!ref) return null
        const base = tr.anchor === 'start' ? ref.start : ref.end
        return base === undefined ? null : base + tr.offset
      }
      case 'atWaypoint': {
        const ref = pend.get(tr.segmentId)
        if (!ref || ref.start === undefined) return null
        const wT = ref.schedule?.waypointT[tr.waypointIndex]
        return wT === undefined ? null : ref.start + wT + tr.offset
      }
      case 'onEvent': {
        const ref = pend.get(tr.event.segmentId)
        if (!ref) return null
        switch (tr.event.kind) {
          case 'ball.released':
          case 'segment.start':
            return ref.start === undefined ? null : ref.start + tr.offset
          case 'ball.received':
          case 'segment.end':
            return ref.end === undefined ? null : ref.end + tr.offset
        }
        return null
      }
      case 'atMarker': {
        const m = markers.get(tr.markerId)
        if (!m) return null
        const t = resolveTrigger(m.trigger, depth + 1)
        return t === null ? null : t + tr.offset
      }
    }
  }

  const ballTrackList = byTrack.find((l) => l[0]?.entityKind === 'ball') ?? []

  /**
   * Is every segment of this player's track placed on the clock yet? A travel's release anchor
   * asks `heldBallPosAt` where the holder IS at launch, and a schedule is built ONCE and never
   * revisited. Tracks resolve in document order, so a ball track created BEFORE the holder's
   * (draw a pass, then give that player their first run) reaches the travel branch while the
   * holder's moves still have no start — `playerPosAt` answers with their HOME, and the pass
   * launches from the player's starting spot for the rest of the document's life. Order-dependent,
   * so it looked intermittent and outlived several fixes (user 2026-08-22, screenshots). Wait for
   * the holder instead; `ballContinuity` guards the result.
   */
  const holderSettled = (holderId: Id): boolean => {
    const l = byTrack.find((q) => q[0]?.entityId === holderId)
    if (!l) return true
    return l.every((q) => q.start !== undefined && (q.seg.kind !== 'move' || q.end !== undefined))
  }
  /** Dropped once a whole pass makes no progress, so a cycle can never deadlock the compile. */
  let waitForHolders = true
  let progress = true
  let guard = 0
  while (guard++ < 1000) {
    progress = false
    for (const list of byTrack) {
      for (const p of list) {
        if (p.start !== undefined && p.end !== undefined) continue
        const seg = p.seg
        // start
        if (p.start === undefined) {
          let t = resolveTrigger(seg.trigger)
          if (t === null) continue
          // no overlap within a track: clamp to previous end
          const prev = list[p.indexInTrack - 1]
          if (prev && (prev.seg.kind === 'possessed' || prev.seg.kind === 'loose')) {
            // open-ended predecessor: its end is defined by this start; only forbid going before its start
            if (prev.start === undefined) continue
            if (t < prev.start) t = prev.start
          } else if (prev) {
            if (prev.end === undefined) continue
            if (t < prev.end) {
              issues.push({
                level: 'warning',
                segmentId: seg.id,
                message: `start ${t.toFixed(2)}s < previous end ${prev.end.toFixed(2)}s; clamped`,
              })
              t = prev.end
            }
          }
          p.start = Math.max(0, t)
          progress = true
        }
        // end
        if (p.end === undefined && p.start !== undefined) {
          if (seg.kind === 'move') {
            p.end = p.start + scheduleDuration(p.schedule!)
            progress = true
          } else if (seg.kind === 'hold') {
            p.end = p.start + ('duration' in seg.timing ? Math.max(0, seg.timing.duration) : 0)
            progress = true
          } else if (seg.kind === 'travel') {
            // Travel start position = holder position at release (if previously possessed), else path start.
            const prev = list[p.indexInTrack - 1]
            let path = seg.path
            if (
              waitForHolders &&
              prev &&
              prev.seg.kind === 'possessed' &&
              !holderSettled(prev.seg.holderId)
            )
              continue
            if (prev && prev.seg.kind === 'possessed') {
              // Shared carry resolver (ADR-0010 D2): the release anchor is wherever stateAt
              // says the held ball IS at launch — front carry, junction pin and lock included.
              const release = heldBallPosAt(
                prev.seg.holderId,
                p.start,
                prev.seg.offset ?? BALL_OFFSET,
                prev.seg.offsetLocked,
                prev.start,
              )
              if (release && path.waypoints.length >= 1) {
                const first = path.waypoints[0]!
                path = { waypoints: [{ ...first, p: release }, ...path.waypoints.slice(1)] }
              }
            }
            p.schedule = buildSchedule(path, seg.timing, seg.easing, [])
            p.end = p.start + scheduleDuration(p.schedule)
            progress = true
          } else {
            // possessed / loose: lasts until the next segment in the track starts (resolved later) or scene end.
            const next = list[p.indexInTrack + 1]
            if (!next) {
              p.end = Number.POSITIVE_INFINITY
              progress = true
            } else if (next.start !== undefined) {
              p.end = next.start
              progress = true
            }
          }
        }
      }
    }
    if (progress) continue
    // Stalled. Release the holder deferral once and try again, so a trigger cycle degrades to the
    // old behaviour (and its own error issue) instead of leaving travels unscheduled.
    if (waitForHolders) {
      waitForHolders = false
      continue
    }
    break
  }

  // Helper: player position at absolute t from already-resolved player segments (used for ball release).
  function playerPosAt(playerId: Id, t: number): Vec2 | undefined {
    const list = byTrack.find((l) => l[0]?.entityId === playerId)
    let pos = playerHome.get(playerId)
    if (!list) return pos
    for (const p of list) {
      if (p.start === undefined) break
      if (p.seg.kind !== 'move' || !p.schedule) continue
      if (t < p.start) break
      if (p.end !== undefined && t >= p.end) {
        pos = schedulePosAt(p.schedule, scheduleDuration(p.schedule))
        continue
      }
      pos = schedulePosAt(p.schedule, t - p.start)
      break
    }
    return pos
  }

  // Helper: carry-aware held-ball position at absolute t — same resolver as stateAt
  // (ADR-0010 D2), so compiled release anchors and playback can never disagree.
  function heldBallPosAt(
    playerId: Id,
    t: number,
    offset: Vec2,
    offsetLocked?: boolean,
    since?: number,
  ): Vec2 | undefined {
    const pos = playerPosAt(playerId, t)
    if (!pos) return undefined
    const list = byTrack.find((l) => l[0]?.entityId === playerId)
    const moves: CarryMove[] = []
    let moving = false
    if (list) {
      for (const q of list) {
        if (q.seg.kind !== 'move' || !q.schedule || q.start === undefined || q.end === undefined)
          continue
        moves.push({
          start: q.start,
          end: q.end,
          lut: q.schedule.lut,
          ...(q.seg.carryEnd ? { carryEnd: q.seg.carryEnd } : {}),
        })
        if (t >= q.start && t < q.end) moving = true
      }
    }
    return heldBallPos({ pos, moving }, carryAheadFor(moves, t), offset, offsetLocked, since)
  }

  // Unresolved → errors (cycle or dangling reference)
  for (const p of pend.values()) {
    if (p.start === undefined) {
      issues.push({
        level: 'error',
        segmentId: p.seg.id,
        message: 'unresolvable trigger (cycle or missing reference)',
      })
    }
  }

  // Compose
  const tracks: Record<Id, CompiledTrack> = {}
  const events: CompiledEvent[] = []
  const segmentTimes: CompiledTimeline['segmentTimes'] = {}
  let duration = 0
  for (const list of byTrack) {
    if (!list.length) continue
    const { entityId, entityKind } = list[0]!
    const segs: CompiledSegment[] = []
    for (const p of list) {
      if (p.start === undefined || p.end === undefined) continue
      const seg = p.seg
      const start = p.start
      const end = p.end
      let cs: CompiledSegment
      switch (seg.kind) {
        case 'move':
          cs = {
            id: seg.id,
            kind: 'move',
            start,
            end,
            schedule: p.schedule!,
            ...(seg.carryEnd ? { carryEnd: seg.carryEnd } : {}),
          }
          break
        case 'hold':
          cs = { id: seg.id, kind: 'hold', start, end }
          break
        case 'possessed':
          cs = {
            id: seg.id,
            kind: 'possessed',
            start,
            end,
            holderId: seg.holderId,
            offset: seg.offset ?? BALL_OFFSET,
            ...(seg.offsetLocked ? { offsetLocked: true } : {}),
          }
          events.push({ kind: 'segment.start', t: start, segmentId: seg.id, entityId })
          break
        case 'travel':
          cs = {
            id: seg.id,
            kind: 'travel',
            start,
            end,
            schedule: p.schedule!,
            travelKind: seg.travelKind,
            receiverId: seg.receiverId,
            flight:
              seg.flight ??
              (seg.travelKind === 'cross' || seg.travelKind === 'clearance' ? 'lofted' : 'ground'),
          }
          events.push({ kind: 'ball.released', t: start, segmentId: seg.id, entityId })
          if (seg.receiverId)
            events.push({ kind: 'ball.received', t: end, segmentId: seg.id, entityId })
          break
        case 'loose': {
          const prevSeg = segs[segs.length - 1]
          const fallback =
            prevSeg && prevSeg.kind === 'travel'
              ? pointAtDistance(prevSeg.schedule.lut, scheduleEndDistance(prevSeg.schedule))
              : doc.ball.home
          cs = { id: seg.id, kind: 'loose', start, end, pos: seg.position ?? fallback }
          break
        }
      }
      segs.push(cs)
      if (seg.kind === 'move' || seg.kind === 'hold' || seg.kind === 'travel') {
        events.push({ kind: 'segment.start', t: start, segmentId: seg.id, entityId })
        events.push({ kind: 'segment.end', t: end, segmentId: seg.id, entityId })
      }
      segmentTimes[seg.id] = { start, end: Number.isFinite(end) ? end : start, entityId }
      if (Number.isFinite(end)) duration = Math.max(duration, end)
      else duration = Math.max(duration, start)
    }
    tracks[entityId] = { entityId, entityKind, segments: segs }
  }
  void ballTrackList
  events.sort((a, b) => a.t - b.t)

  return {
    sceneId: scene.id,
    duration: Math.max(MIN_SCENE_DURATION, Math.ceil(duration * 10) / 10),
    tracks,
    events,
    issues,
    segmentTimes,
  }
}

/** Waypoint helper for callers that need the LUT of an arbitrary path (e.g. the editor's path tool). */
export function pathLength(path: Path): number {
  return buildPathLUT(path).length
}

export type { Waypoint }
