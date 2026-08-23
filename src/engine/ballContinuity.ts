/**
 * Ball continuity — invariant B1 (ADR-0010 D7).
 *
 * The ball is one physical object: between two adjacent instants it can only move as far as its
 * own speed carries it. Every "the pass left from the wrong place" defect this project has
 * shipped is, at bottom, a discontinuity — the document says the ball is at A, some other
 * resolver puts it at B, and whichever one a call site happens to read decides what the user
 * sees. Checking the RESULT rather than any particular resolver is the point: this file has no
 * opinion about carry offsets, junction radii or sampling epsilons, so it keeps catching the bug
 * after the next refactor moves all of those around.
 *
 * Pure: compile + stateAt only.
 */
import type { TacticDocument, Vec2 } from '@/domain/types'
import { DRIBBLE_AHEAD_M, DRIBBLE_RAMP_S } from './carry'
import { compile, type CompiledTimeline } from './compile'
import { stateAt } from './stateAt'

export interface BallJump {
  /** Instant AFTER the jump (the sample that moved too far). */
  t: number
  dist: number
  from: Vec2
  to: Vec2
  /** How far the ball was allowed to move over this interval. */
  allowed: number
  /** Ball segment ids either side — names the joint that tore. */
  fromSegmentId?: string
  toSegmentId?: string
}

export interface ContinuityOptions {
  /** Sampling interval (s). Smaller = tighter bound on a real move, more samples. */
  dt?: number
  /** Extra slack (m) on top of speed·dt, absorbing schedule easing and rounding. */
  slack?: number
}

const DEFAULT_DT = 0.02
/**
 * 0.3 m ≈ a third of the ball's own carry radius: below what anyone can see on a 105 m pitch,
 * far below the metres a torn joint produces.
 */
const DEFAULT_SLACK = 0.3

/**
 * Fastest the ball can LEGITIMATELY move (m/s): flying a pass, or riding a runner while the carry
 * vector swings from one side of them to the other.
 *
 * The swing term is the model's own worst case: `heldBallPos` blends between two carry vectors
 * over DRIBBLE_RAMP_S, and each is bounded by the dribble-ahead distance or the side offset, so
 * the ball can cross ~2·(carry radius) in one ramp. Without this term the check flags the first
 * 20 ms of every run as a tear (fuzz seeds 27/43/78) — a false positive that would have trained
 * us to loosen the real bound.
 */
const CARRY_SWING_M = 2 * DRIBBLE_AHEAD_M + 1.0

/**
 * How fast the ball may move AT ONE INSTANT (m/s).
 *
 * This used to be one number for the whole document: the fastest pass anywhere, plus a carry-swing
 * term derived from the SHORTEST run on the board. One brief run by an uninvolved player therefore
 * raised the allowance at every junction — a measured 0.06 s segment more than doubled it and hid a
 * 1.2 m tear on the other side of the pitch (audit F-M1-02). The budget now asks what is happening
 * to THIS ball at THIS moment:
 *
 *   · carried  — the holder's own run speed, plus the swing their own shortest run can produce
 *   · in flight / loose — the fastest authored ball travel, which is a property of the ball itself
 *
 * A junction sample straddles both states, so the caller takes the larger of the two ends.
 */
function ballSpeedBudget(compiled: CompiledTimeline, doc: TacticDocument) {
  let travelTop = 0
  for (const seg of compiled.tracks[doc.ball.id]?.segments ?? []) {
    if (seg.kind !== 'travel') continue
    const dur = seg.end - seg.start
    if (dur > 1e-6) travelTop = Math.max(travelTop, seg.schedule.lut.length / dur)
  }
  const carryCache = new Map<string, number>()
  const carryTop = (holderId: string): number => {
    const hit = carryCache.get(holderId)
    if (hit !== undefined) return hit
    let runner = 0
    // The carry blend finishes inside its own run (`carryAheadFor`), so a run SHORTER than the
    // ramp swings the ball proportionally faster — but only that holder's runs can swing it.
    let shortest = DRIBBLE_RAMP_S
    for (const seg of compiled.tracks[holderId]?.segments ?? []) {
      if (seg.kind !== 'move') continue
      const dur = seg.end - seg.start
      if (dur > 1e-6) {
        runner = Math.max(runner, seg.schedule.lut.length / dur)
        shortest = Math.min(shortest, dur)
      }
    }
    const v = runner + CARRY_SWING_M / Math.max(0.05, shortest)
    carryCache.set(holderId, v)
    return v
  }
  return (holderId: string | undefined): number =>
    holderId ? Math.max(carryTop(holderId), travelTop) : travelTop
}

/**
 * Every instant where the ball moved further than its speed allows. A torn joint (pass origin
 * that disagrees with where the ball rests, catch point that disagrees with the carry resolver)
 * shows up as one entry, metres wide, at the joint's own time.
 */
export function ballJumps(doc: TacticDocument, opts: ContinuityOptions = {}): BallJump[] {
  const dt = opts.dt ?? DEFAULT_DT
  const slack = opts.slack ?? DEFAULT_SLACK
  const compiled = compile(doc)
  const budget = ballSpeedBudget(compiled, doc)
  const out: BallJump[] = []
  let prev = stateAt(compiled, doc, 0)
  for (let t = dt; t <= compiled.duration + 1e-9; t += dt) {
    const now = stateAt(compiled, doc, t)
    const d = Math.hypot(now.ball.pos.x - prev.ball.pos.x, now.ball.pos.y - prev.ball.pos.y)
    // the interval straddles both states, so whichever end allows more sets the bar
    const allowed = Math.max(budget(prev.ball.holderId), budget(now.ball.holderId)) * dt + slack
    if (d > allowed) {
      out.push({
        t: Math.round(t * 1000) / 1000,
        dist: Math.round(d * 100) / 100,
        from: prev.ball.pos,
        to: now.ball.pos,
        allowed: Math.round(allowed * 100) / 100,
        fromSegmentId: prev.ball.segmentId,
        toSegmentId: now.ball.segmentId,
      })
    }
    prev = now
  }
  return out
}

/** The worst discontinuity, or null when the ball path is continuous. */
export function maxBallJump(doc: TacticDocument, opts: ContinuityOptions = {}): BallJump | null {
  const jumps = ballJumps(doc, opts)
  if (jumps.length === 0) return null
  return jumps.reduce((a, b) => (b.dist > a.dist ? b : a))
}

/** One-line description for test failures and dev assertions. */
export function describeJump(j: BallJump): string {
  const p = (v: Vec2) => `(${v.x.toFixed(2)}, ${v.y.toFixed(2)})`
  return `ball jumped ${j.dist}m at t=${j.t}s (allowed ${j.allowed}m): ${p(j.from)} → ${p(j.to)} [${j.fromSegmentId ?? 'none'} → ${j.toSegmentId ?? 'none'}]`
}
