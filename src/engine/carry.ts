/**
 * Shared carry resolver (ADR-0010 D2) — THE single interpreter of "where is the held ball".
 * Both `compile` (travel release anchor) and `stateAt` (playback) call this, so the static
 * view, the animation and the editor can never disagree about a junction again.
 *
 * Precedence: active run's `carryEnd` (blended over the final ramp) > standing `offsetLocked`
 * offset > front-of-feet carry (DRIBBLE_AHEAD_M) > side offset default.
 *
 * Boundary continuity: at a run→run junction the ball passes EXACTLY through the previous
 * run's end-carry (the pin when set, else out front), then blends to the next vector over
 * DRIBBLE_RAMP_S — never teleports (audit S5/R12-A).
 *
 * Pure module: imports only `path` helpers. Inputs are a minimal structural shape so neither
 * compile nor stateAt creates an import cycle.
 */
import type { Vec2 } from '@/domain/types'
import { pointAtDistance, type PathLUT } from './path'

/** Dribbling: the ball rides AHEAD of the run (a touch in front of the feet), not on the hip. */
export const DRIBBLE_AHEAD_M = 1.9
/** Seconds to blend between carry vectors at run starts/junctions (deterministic). */
export const DRIBBLE_RAMP_S = 0.35

/** Minimal shape of a compiled move segment the resolver needs. */
export interface CarryMove {
  start: number
  end: number
  lut: PathLUT
  carryEnd?: Vec2
}

/** Target carry vector blended in by ramp∈[0,1] from `from` (side offset when absent). */
export interface CarryAhead {
  vec: Vec2
  ramp: number
  from?: Vec2
  /** When the run that `from` comes from ended — lets a caller ask "was that during this hold?". */
  prevEnd?: number
}

/** Ahead-of-the-feet carry vector for a heading. */
export function aheadVec(heading: number): Vec2 {
  return { x: Math.cos(heading) * DRIBBLE_AHEAD_M, y: Math.sin(heading) * DRIBBLE_AHEAD_M }
}

/**
 * Where the ball rides during a run: out front along the ground the player has ACTUALLY covered
 * over the last DRIBBLE_RAMP_S, not along the instantaneous tangent.
 *
 * On a straight or gently curving run the two are the same vector — 0.35 s at running pace covers
 * 3.5 m, well past the 1.9 m carry — so ordinary dribbling is untouched. They differ exactly where
 * the tangent stops being a physical quantity. At a HAIRPIN the tangent reverses between one frame
 * and the next, and a ball held 1.9 m out front snapped ~3.8 m across its holder in 20 ms (tactic
 * fuzz seed 21: 3.71 m at t=0.62 s, on a run whose waypoints double back). The covered chord
 * instead shortens toward the feet as the player turns and grows out again on the way out —
 * continuous by construction, and what a player actually does with the ball when they turn.
 */
export function carryVecAt(m: CarryMove, t: number): Vec2 {
  const dur = Math.max(1e-6, m.end - m.start)
  const sAt = (tt: number) => Math.max(0, Math.min(1, (tt - m.start) / dur)) * m.lut.length
  const now = pointAtDistance(m.lut, sAt(t))
  const back = pointAtDistance(m.lut, sAt(t - DRIBBLE_RAMP_S))
  const d = { x: now.x - back.x, y: now.y - back.y }
  const len = Math.hypot(d.x, d.y)
  if (len < 1e-6) return { x: 0, y: 0 }
  const k = Math.min(DRIBBLE_AHEAD_M, len) / len
  return { x: d.x * k, y: d.y * k }
}

/** Carry vector AT a move's end: the pinned junction side when set, else out front. */
export function endCarryVec(m: CarryMove): Vec2 {
  if (m.carryEnd) return m.carryEnd
  return carryVecAt(m, m.end)
}

/**
 * Carry state of a player at absolute time t, given their moves sorted by start.
 * - During a run: front carry (or carryEnd blend near the end), ramping in from the previous
 *   run's end-carry so the junction is position-continuous.
 * - Standing after any run: the ball rests where the last run left it, forever.
 * - Before any run: undefined (side-offset default applies).
 */
export function carryAheadFor(moves: readonly CarryMove[], t: number): CarryAhead | undefined {
  let active: CarryMove | undefined
  let prev: CarryMove | undefined
  for (const m of moves) {
    if (t >= m.start && t < m.end) {
      active = m
      break
    }
    if (m.end <= t + 1e-6) prev = m
  }
  if (active) {
    const lt = t - active.start
    const dur = Math.max(1e-6, active.end - active.start)
    let vec = carryVecAt(active, t)
    // junction-local pin: near THIS run's end, blend the front carry toward carryEnd
    if (active.carryEnd) {
      const w = Math.max(0, Math.min(1, (DRIBBLE_RAMP_S - (dur - lt)) / DRIBBLE_RAMP_S))
      vec = {
        x: vec.x * (1 - w) + active.carryEnd.x * w,
        y: vec.y * (1 - w) + active.carryEnd.y * w,
      }
    }
    // Continuity (ADR-0010 D2): ramp ALWAYS starts at the previous end-carry (pin included)
    // and blends to the new vector — a chained run passes through the junction, it never jumps.
    return {
      vec,
      ramp: Math.max(0, Math.min(1, lt / DRIBBLE_RAMP_S)),
      ...(prev ? { from: endCarryVec(prev), prevEnd: prev.end } : {}),
    }
  }
  if (prev) return { vec: endCarryVec(prev), ramp: 1, prevEnd: prev.end }
  return undefined
}

/**
 * Held-ball position for a holder (ADR-0010 D2 precedence). `offset` is the authored side
 * offset; `offsetLocked` (user pinned via ball-ghost orbit) wins while STANDING only.
 */
export function heldBallPos(
  holder: { pos: Vec2; moving: boolean },
  carry: CarryAhead | undefined,
  offset: Vec2,
  offsetLocked?: boolean,
  /** When this possession began — a pin is spent once its holder has dribbled inside it. */
  since = Number.POSITIVE_INFINITY,
): Vec2 {
  /*
   * A PINNED side (the user dragged the arrival ghost) says where the ball RESTS on this holder.
   * It is the truth from the catch until they set off with it — and no longer, because once they
   * have dribbled the ball is wherever that run left it. Re-asserting the pin the instant they
   * stopped threw the ball back across them by the width of the carry ring, every time, on the
   * shipped examples as well as on anything the user draws (tactic fuzz: 1.3–3.8 m).
   *
   * "Inside this possession" is the whole distinction: a run they made BEFORE the catch says
   * nothing about a ball they did not have.
   */
  const dribbled = carry?.prevEnd !== undefined && carry.prevEnd > since
  const pinned = !!offsetLocked && !dribbled
  if (pinned && !holder.moving) return { x: holder.pos.x + offset.x, y: holder.pos.y + offset.y }
  if (carry) {
    const r = carry.ramp
    // The ramp leaves from where the ball actually is: the pin while it still stands, otherwise the
    // previous run's end-carry, which is what makes a chained run pass exactly through its junction.
    const base = pinned ? offset : (carry.from ?? offset)
    return {
      x: holder.pos.x + base.x * (1 - r) + carry.vec.x * r,
      y: holder.pos.y + base.y * (1 - r) + carry.vec.y * r,
    }
  }
  return { x: holder.pos.x + offset.x, y: holder.pos.y + offset.y }
}
