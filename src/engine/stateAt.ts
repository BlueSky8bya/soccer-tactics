/**
 * stateAt(compiled, doc, t) → ResolvedState. Pure, deterministic, O(tracks · log segments).
 */
import type { Id, TacticDocument, Vec2 } from '@/domain/types'
import {
  BALL_OFFSET,
  carryOffset,
  scheduleEndDistance,
  schedulePosAt,
  scheduleDuration,
  type CompiledSegment,
  type CompiledTimeline,
} from './compile'
import { headingAtDistance, pointAtDistance } from './path'

export interface ResolvedPlayer {
  pos: Vec2
  /** Heading in radians when moving; undefined when stationary. */
  heading?: number
  moving: boolean
  segmentId?: Id
  /** Dribble carry: the possessed ball rides ahead by ramp∈[0,1] along `heading`, blending
   *  from `from` (previous carry vector; authored side offset when absent). */
  carryAhead?: { heading: number; ramp: number; from?: Vec2 }
}

/** Dribbling: the ball rides AHEAD of the run (a touch in front of the feet), not on the hip. */
export const DRIBBLE_AHEAD_M = 1.9
/** Seconds to blend side-carry ↔ ahead at the start/end of a dribble CHAIN (deterministic). */
const DRIBBLE_RAMP_S = 0.35
/** Runs separated by at most this gap count as ONE continuous dribble — no side-dip between
 *  steps (user 2026-08-21: 같은 방향으로 이어 달리면 공은 계속 정면에). */
const DRIBBLE_CHAIN_GAP_S = 0.8

export type BallStatus = 'possessed' | 'travel' | 'loose'

export interface ResolvedBall {
  pos: Vec2
  status: BallStatus
  holderId?: Id
  segmentId?: Id
  /** Lofted flight height (m above ground), 0 when on the ground. Deterministic. */
  height: number
  /** Accumulated rolling rotation (radians) along the current travel; 0 otherwise. */
  spin: number
  /** Normalised progress 0..1 through the current travel segment (for UI cues). */
  progress?: number
}

export interface ResolvedState {
  t: number
  players: Record<Id, ResolvedPlayer>
  ball: ResolvedBall
}

function findSegment(
  segs: CompiledSegment[],
  t: number,
): { seg?: CompiledSegment; lastEnded?: CompiledSegment } {
  // segments sorted by start; find the one containing t, else the last one that ended before t
  let lastEnded: CompiledSegment | undefined
  for (const s of segs) {
    if (t < s.start) break
    if (t < s.end) return { seg: s, lastEnded }
    lastEnded = s
  }
  return { lastEnded }
}

function endPos(seg: CompiledSegment, fallback: Vec2): Vec2 {
  switch (seg.kind) {
    case 'move':
    case 'travel':
      return schedulePosAt(seg.schedule, scheduleDuration(seg.schedule))
    case 'loose':
      return seg.pos
    default:
      return fallback
  }
}

export function stateAt(compiled: CompiledTimeline, doc: TacticDocument, t: number): ResolvedState {
  const players: Record<Id, ResolvedPlayer> = {}

  for (const p of doc.players) {
    const track = compiled.tracks[p.id]
    if (!track || track.segments.length === 0) {
      players[p.id] = { pos: p.home, moving: false }
      continue
    }
    players[p.id] = resolvePlayer(track.segments, p.home, t)
  }

  const ball = resolveBall(compiled, doc, players, t)
  return { t, players, ball }
}

function resolvePlayer(segs: CompiledSegment[], home: Vec2, t: number): ResolvedPlayer {
  const { seg, lastEnded } = findSegment(segs, t)
  const moves = segs.filter(
    (x): x is Extract<CompiledSegment, { kind: 'move' }> => x.kind === 'move',
  )
  if (seg) {
    if (seg.kind === 'move') {
      const lt = t - seg.start
      const pos = schedulePosAt(seg.schedule, lt)
      const s = distanceAlong(seg, lt)
      const i = moves.findIndex((m) => m.id === seg.id)
      const prevM = moves[i - 1]
      // CHAIN RULES: a run that continues from / into another run keeps the ball out front
      // through the boundary — the side-dip only happens at the TRUE start and end of a dribble.
      const chainIn = !!prevM && seg.start - prevM.end <= DRIBBLE_CHAIN_GAP_S
      const heading = headingAtDistance(seg.schedule.lut, s)
      // The ball NEVER swings back to the hip at a run's end (user 2026-08-21 사진1) — it stays
      // out front where the dribble left it. Only the ramp INTO the dribble blends, and it
      // blends from wherever the ball was carried before (previous run's front, or the side).
      const edge = chainIn ? Infinity : lt
      const from = prevM
        ? aheadVec(headingAtDistance(prevM.schedule.lut, prevM.schedule.lut.length))
        : undefined
      return {
        pos,
        moving: true,
        heading,
        segmentId: seg.id,
        carryAhead: {
          heading,
          ramp: Math.max(0, Math.min(1, edge / DRIBBLE_RAMP_S)),
          ...(from ? { from } : {}),
        },
      }
    }
    // hold: stay where the previous segment ended
    const base = lastEnded ? endPos(lastEnded, home) : home
    return { pos: base, moving: false, segmentId: seg.id, ...standingCarry(moves, t) }
  }
  if (lastEnded) return { pos: endPos(lastEnded, home), moving: false, ...standingCarry(moves, t) }
  return { pos: home, moving: false }
}

/** Ahead-of-the-feet carry vector for a heading. */
function aheadVec(heading: number): Vec2 {
  return { x: Math.cos(heading) * DRIBBLE_AHEAD_M, y: Math.sin(heading) * DRIBBLE_AHEAD_M }
}

/** Standing AFTER any dribble: the ball rests out front where the last run pointed — for good
 *  (user 2026-08-21 사진1: 드리볼하던 그대로). It never swings back to the initial side. */
function standingCarry(
  moves: Extract<CompiledSegment, { kind: 'move' }>[],
  t: number,
): { carryAhead?: { heading: number; ramp: number; from?: Vec2 } } {
  let prevM: (typeof moves)[number] | undefined
  for (const m of moves) {
    if (m.end <= t + 1e-6) prevM = m
  }
  if (!prevM) return {}
  const heading = headingAtDistance(prevM.schedule.lut, prevM.schedule.lut.length)
  return { carryAhead: { heading, ramp: 1 } }
}

function distanceAlong(
  seg: Extract<CompiledSegment, { kind: 'move' | 'travel' }>,
  lt: number,
): number {
  // Recover arc-length distance from the position (cheap approximation via schedule keys)
  const sch = seg.schedule
  const dur = scheduleDuration(sch)
  if (dur <= 0) return 0
  const u = Math.max(0, Math.min(1, lt / dur))
  return u * sch.lut.length
}

function resolveBall(
  compiled: CompiledTimeline,
  doc: TacticDocument,
  players: Record<Id, ResolvedPlayer>,
  t: number,
): ResolvedBall {
  const track = compiled.tracks[doc.ball.id]
  /** Carry offset for the INITIAL holder, derived from where the ball rests around them. */
  const initialOffset = (): Vec2 => {
    const h = doc.players.find((p) => p.id === doc.ball.initialHolderId)
    if (!h) return BALL_OFFSET
    return carryOffset({ x: doc.ball.home.x - h.home.x, y: doc.ball.home.y - h.home.y })
  }
  const holderPos = (id: Id, offset: Vec2): Vec2 | undefined => {
    const p = players[id]
    if (!p) return undefined
    // DRIBBLE (user 2026-08-21): while the holder RUNS, the ball rides ahead of them in the
    // movement direction — like a real touch-and-go — blending back to the side-carry spot at
    // the start/end of the run so authored anchors (ghosts, pass origins) stay consistent.
    if (p.carryAhead) {
      const r = p.carryAhead.ramp
      const base = p.carryAhead.from ?? offset
      const ax = Math.cos(p.carryAhead.heading) * DRIBBLE_AHEAD_M
      const ay = Math.sin(p.carryAhead.heading) * DRIBBLE_AHEAD_M
      return {
        x: p.pos.x + base.x * (1 - r) + ax * r,
        y: p.pos.y + base.y * (1 - r) + ay * r,
      }
    }
    return { x: p.pos.x + offset.x, y: p.pos.y + offset.y }
  }

  if (!track || track.segments.length === 0) {
    if (doc.ball.initialHolderId) {
      const pos = holderPos(doc.ball.initialHolderId, initialOffset())
      if (pos)
        return { pos, status: 'possessed', holderId: doc.ball.initialHolderId, height: 0, spin: 0 }
    }
    return { pos: doc.ball.home, status: 'loose', height: 0, spin: 0 }
  }

  const { seg, lastEnded } = findSegment(track.segments, t)
  if (seg) {
    switch (seg.kind) {
      case 'possessed': {
        const pos = holderPos(seg.holderId, seg.offset)
        return {
          pos: pos ?? doc.ball.home,
          status: 'possessed',
          holderId: seg.holderId,
          segmentId: seg.id,
          height: 0,
          spin: 0,
        }
      }
      case 'travel': {
        const lt = t - seg.start
        const dur = Math.max(1e-6, seg.end - seg.start)
        const u = Math.max(0, Math.min(1, lt / dur))
        const dist = u * seg.schedule.lut.length
        const peak = seg.flight === 'lofted' ? Math.min(6, 0.18 * seg.schedule.lut.length) : 0
        return {
          pos: schedulePosAt(seg.schedule, lt),
          status: 'travel',
          segmentId: seg.id,
          height: peak * 4 * u * (1 - u),
          spin: seg.flight === 'lofted' ? dist / 0.7 : dist / 0.22,
          progress: u,
        }
      }
      case 'loose':
        return { pos: seg.pos, status: 'loose', segmentId: seg.id, height: 0, spin: 0 }
      default:
        break
    }
  }
  // Before the first ball segment
  if (!lastEnded) {
    if (doc.ball.initialHolderId) {
      const pos = holderPos(doc.ball.initialHolderId, initialOffset())
      if (pos)
        return { pos, status: 'possessed', holderId: doc.ball.initialHolderId, height: 0, spin: 0 }
    }
    return { pos: doc.ball.home, status: 'loose', height: 0, spin: 0 }
  }
  // After a finished travel with receiver → possessed by receiver; else loose at end
  if (lastEnded.kind === 'travel') {
    if (lastEnded.receiverId) {
      const pos = holderPos(lastEnded.receiverId, BALL_OFFSET)
      if (pos)
        return { pos, status: 'possessed', holderId: lastEnded.receiverId, height: 0, spin: 0 }
    }
    return {
      pos: pointAtDistance(lastEnded.schedule.lut, scheduleEndDistance(lastEnded.schedule)),
      status: 'loose',
      height: 0,
      spin: 0,
    }
  }
  if (lastEnded.kind === 'possessed') {
    const pos = holderPos(lastEnded.holderId, lastEnded.offset)
    return {
      pos: pos ?? doc.ball.home,
      status: 'possessed',
      holderId: lastEnded.holderId,
      height: 0,
      spin: 0,
    }
  }
  return { pos: endPos(lastEnded, doc.ball.home), status: 'loose', height: 0, spin: 0 }
}
