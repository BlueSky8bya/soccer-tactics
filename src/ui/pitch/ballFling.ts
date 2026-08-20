/**
 * Ball fling physics (user 2026-08-21: "공을 잡고 휙 던지면 날라가듯이").
 * Pure + deterministic: the UI samples the drag, this module integrates a rolling ball with
 * exponential drag and wall bounces, and ONLY the final resting spot is committed to the
 * document (engine/domain untouched — the roll itself is interface motion, ADR-0006 D1).
 */
import type { Vec2 } from '@/domain/types'

/** Release speed (m/s) below which a drop is just a drop. */
export const FLING_MIN_SPEED = 10
/** If the pointer rested longer than this before release, it is a PLACE, not a throw. */
export const FLING_STALE_MS = 120
/** Speed cap — a wild swipe still lands on the pitch, not in the car park. */
export const FLING_MAX_SPEED = 40
/** Two-phase drag (user 2026-08-21: 세게 던지면 또르륵 말고 쭉 날아가게):
 *  above the transition speed the ball CARRIES with little drag, below it the grass grabs it. */
export const FLING_FLIGHT_K = 1.2
export const FLING_ROLL_K = 3.2
export const FLING_TRANSITION_SPEED = 12
/** Net absorption drag once inside a goal — the catch. */
export const FLING_NET_K = 12
/** Rolling stops below this speed. */
export const FLING_STOP_SPEED = 1.5
/** Wall bounce energy retention (pitch boundary). */
export const FLING_RESTITUTION = 0.55
const DT = 1 / 120
const MAX_T = 4

export interface FlingSample {
  t: number
  x: number
  y: number
}

/**
 * Release velocity from the drag's recent samples (~last 110ms) — px-noise robust.
 * Returns null when the data cannot support an estimate.
 */
export function flingVelocity(samples: readonly FlingSample[], releaseT: number): Vec2 | null {
  if (samples.length < 2) return null
  const last = samples[samples.length - 1]!
  // held still before letting go → deliberate placement, never a throw
  if (releaseT - last.t > FLING_STALE_MS) return null
  let first = samples[0]!
  for (const s of samples) {
    if (last.t - s.t <= 110) {
      first = s
      break
    }
  }
  const dt = (last.t - first.t) / 1000
  if (dt <= 0.005) return null
  return { x: (last.x - first.x) / dt, y: (last.y - first.y) / dt }
}

export interface FlingPoint {
  x: number
  y: number
  /** Seconds since release. */
  t: number
  /** Cumulative rolled distance (metres) — drives ball spin. */
  d: number
}

export interface FlingResult {
  points: FlingPoint[]
  final: Vec2
  duration: number
  /** Set when the ball flew into a goal mouth — the net catch moment (FX hook). */
  goal?: {
    t: number
    pos: Vec2
    v: Vec2
    side: 'left' | 'right'
    /** Contacts with the actual NETTING (back panel AND side mesh), in order. The ripple fires
     *  at each, oriented along the net's surface normal (the direction the mesh bulges). */
    impacts: { t: number; pos: Vec2; normal: Vec2; speed: number }[]
  }
}

export interface GoalGeom {
  /** Goal mouth top/bottom (y, metres) and net depth behind the goal line. */
  top: number
  bot: number
  depth: number
}

/**
 * Integrate the roll: two-phase drag (flight → grass), boundary bounces, goal-net capture,
 * fixed 120Hz steps (deterministic). A ball crossing a goal line inside the mouth enters the
 * net box: the net absorbs it hard (k=12), the back/side netting barely rebounds, and the
 * catch moment is reported for the bulge FX.
 */
export function simulateFling(
  p0: Vec2,
  v0: Vec2,
  pitch: { length: number; width: number },
  goal?: GoalGeom,
): FlingResult {
  const L = pitch.length
  const W = pitch.width
  const speed0 = Math.hypot(v0.x, v0.y)
  const s = speed0 > FLING_MAX_SPEED ? FLING_MAX_SPEED / speed0 : 1
  const p = { x: p0.x, y: p0.y }
  const v = { x: v0.x * s, y: v0.y * s }
  const points: FlingPoint[] = [{ x: p.x, y: p.y, t: 0, d: 0 }]
  let t = 0
  let d = 0
  let goalHit: FlingResult['goal'] | undefined
  const impacts: NonNullable<FlingResult['goal']>['impacts'] = []
  let inNet = false
  const NET_REST = 0.05
  while (Math.hypot(v.x, v.y) > FLING_STOP_SPEED && t < MAX_T) {
    t += DT
    const px = p.x
    const py = p.y
    p.x += v.x * DT
    p.y += v.y * DT
    const inMouth = goal ? p.y > goal.top && p.y < goal.bot : false
    if (!inNet && goal && inMouth && ((p.x < 0 && v.x < 0) || (p.x > L && v.x > 0))) {
      // GOAL — the net takes over from here
      inNet = true
      const side = p.x < 0 ? 'left' : 'right'
      goalHit = {
        t,
        pos: { x: side === 'left' ? 0 : L, y: p.y },
        v: { x: v.x, y: v.y },
        side,
        impacts,
      }
    }
    if (inNet && goal) {
      // net box walls: back stanchion + side netting, nearly dead on impact
      const backL = -goal.depth + 0.15
      const backR = L + goal.depth - 0.15
      // each netting panel reports its contact with the SURFACE NORMAL (bulge direction)
      const hit = (cx: number, cy: number, nx: number, ny: number) => {
        const speed = Math.hypot(v.x, v.y)
        const prev = impacts[impacts.length - 1]
        if (impacts.length < 3 && (!prev || t - prev.t > 0.08))
          impacts.push({ t, pos: { x: cx, y: cy }, normal: { x: nx, y: ny }, speed })
      }
      if (p.x < backL) {
        hit(backL, p.y, -1, 0)
        p.x = 2 * backL - p.x
        v.x = -v.x * NET_REST
      } else if (p.x > backR) {
        hit(backR, p.y, 1, 0)
        p.x = 2 * backR - p.x
        v.x = -v.x * NET_REST
      }
      if (p.y < goal.top + 0.1) {
        hit(p.x, goal.top + 0.1, 0, -1)
        p.y = 2 * (goal.top + 0.1) - p.y
        v.y = -v.y * NET_REST
      } else if (p.y > goal.bot - 0.1) {
        hit(p.x, goal.bot - 0.1, 0, 1)
        p.y = 2 * (goal.bot - 0.1) - p.y
        v.y = -v.y * NET_REST
      }
    } else {
      // pitch boundary bounce (goal line / touch line)
      if (p.x < 0) {
        p.x = -p.x
        v.x = -v.x * FLING_RESTITUTION
      } else if (p.x > L) {
        p.x = 2 * L - p.x
        v.x = -v.x * FLING_RESTITUTION
      }
      if (p.y < 0) {
        p.y = -p.y
        v.y = -v.y * FLING_RESTITUTION
      } else if (p.y > W) {
        p.y = 2 * W - p.y
        v.y = -v.y * FLING_RESTITUTION
      }
    }
    const speed = Math.hypot(v.x, v.y)
    const k = inNet ? FLING_NET_K : speed > FLING_TRANSITION_SPEED ? FLING_FLIGHT_K : FLING_ROLL_K
    const decay = Math.exp(-k * DT)
    v.x *= decay
    v.y *= decay
    d += Math.hypot(p.x - px, p.y - py)
    points.push({ x: p.x, y: p.y, t, d })
  }
  if (goalHit && impacts.length === 0) {
    // soft shot that never reaches the mesh: the net still wraps it where it stops
    const sp = Math.hypot(goalHit.v.x, goalHit.v.y)
    impacts.push({
      t,
      pos: { x: p.x, y: p.y },
      normal: sp > 0 ? { x: goalHit.v.x / sp, y: goalHit.v.y / sp } : { x: -1, y: 0 },
      speed: sp,
    })
  }
  return { points, final: { x: p.x, y: p.y }, duration: t, ...(goalHit ? { goal: goalHit } : {}) }
}
