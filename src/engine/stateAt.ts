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
import { carryAheadFor, heldBallPos, type CarryAhead, type CarryMove } from './carry'

export interface ResolvedPlayer {
  pos: Vec2
  /** Heading in radians when moving; undefined when stationary. */
  heading?: number
  moving: boolean
  segmentId?: Id
  /** Dribble carry (see engine/carry.ts — the single resolver, ADR-0010). */
  carryAhead?: CarryAhead
}

export { DRIBBLE_AHEAD_M } from './carry'

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
  const carryMoves: CarryMove[] = segs
    .filter((x): x is Extract<CompiledSegment, { kind: 'move' }> => x.kind === 'move')
    .map((m) => ({
      start: m.start,
      end: m.end,
      lut: m.schedule.lut,
      ...(m.carryEnd ? { carryEnd: m.carryEnd } : {}),
    }))
  // ONE carry interpreter for playback, release anchors and editors (ADR-0010 D2): during a
  // run the ball rides out front (or blends to the junction pin), a chained run passes
  // EXACTLY through the previous end-carry, and after the last run it rests there forever.
  const carry = carryAheadFor(carryMoves, t)
  const withCarry = carry ? { carryAhead: carry } : {}
  if (seg) {
    if (seg.kind === 'move') {
      const lt = t - seg.start
      const pos = schedulePosAt(seg.schedule, lt)
      const s = distanceAlong(seg, lt)
      const heading = headingAtDistance(seg.schedule.lut, s)
      return { pos, moving: true, heading, segmentId: seg.id, ...withCarry }
    }
    // hold: stay where the previous segment ended
    const base = lastEnded ? endPos(lastEnded, home) : home
    return { pos: base, moving: false, segmentId: seg.id, ...withCarry }
  }
  if (lastEnded) return { pos: endPos(lastEnded, home), moving: false, ...withCarry }
  return { pos: home, moving: false, ...withCarry }
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
  const holderPos = (id: Id, offset: Vec2, offsetLocked?: boolean): Vec2 | undefined => {
    const p = players[id]
    if (!p) return undefined
    return heldBallPos({ pos: p.pos, moving: p.moving }, p.carryAhead, offset, offsetLocked)
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
        const pos = holderPos(seg.holderId, seg.offset, seg.offsetLocked)
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
    const pos = holderPos(lastEnded.holderId, lastEnded.offset, lastEnded.offsetLocked)
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
