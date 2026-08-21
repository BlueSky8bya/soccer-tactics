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
export const FLING_NET_K = 16
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

/** Pass-like travel speed (m/s) for a released ball that has open ground to cross. */
export const BALL_TRAVEL_SPEED = 15
/**
 * Below this the release is a nudge or an attach snap — the settle spring already covers it.
 * Above ATTACH_RADIUS_M (2.7) so snapping to a holder keeps its existing pop.
 */
export const BALL_TRAVEL_MIN_M = 3

/**
 * Straight travel from where the ball is DRAWN to where it ends up, eased out so it leaves fast
 * and settles into the target the way a pass arrives. Dropping a held ball across the pitch used
 * to teleport it: possession pins the render to the holder, so the commit moved it in one frame
 * (user 2026-08-21: 순간이동 되거든 … 슛이나 패스처럼). Same FlingPoint shape as `simulateFling`,
 * so the existing roll driver replays it unchanged. Pure and deterministic.
 */
export function ballTravelPoints(
  from: Vec2,
  to: Vec2,
  speed: number = BALL_TRAVEL_SPEED,
): FlingPoint[] {
  const dist = Math.hypot(to.x - from.x, to.y - from.y)
  if (!(dist > 0)) return [{ x: from.x, y: from.y, t: 0, d: 0 }]
  const duration = Math.max(0.12, Math.min(1.4, dist / Math.max(1, speed)))
  const steps = Math.max(2, Math.round(duration / DT))
  const pts: FlingPoint[] = []
  for (let i = 0; i <= steps; i++) {
    const u = i / steps
    const e = 1 - Math.pow(1 - u, 3)
    pts.push({
      x: from.x + (to.x - from.x) * e,
      y: from.y + (to.y - from.y) * e,
      t: u * duration,
      d: dist * e,
    })
  }
  return pts
}

/**
 * Slingshot pull (user 2026-08-21): dragging BACK from a loose ball aims it the opposite way.
 * `SLING_GAIN` turns pull metres into launch speed; the result is clamped to the same envelope a
 * hand-thrown fling uses, so a pull can never do something a throw cannot.
 */
export const SLING_GAIN = 4.5
export const SLING_MIN_PULL_M = 0.8

/**
 * Where the aim line ENDS. It mirrors the pull, so its length is the POWER behind the throw, not
 * the distance the ball will cover (user 2026-08-21: 이동거리라고 하지 말고 힘의 세기라고 …
 * 저것보다 더 나가는거지) — the ball always carries past this tip, and a throw aimed at the goal
 * still reaches the net. Scaled down along its own ray when it would leave the pitch, so the line
 * stays on the board without ever bending the direction it promises.
 */
export function slingAimEnd(
  ballAt: Vec2,
  pointerAt: Vec2,
  pitch: { length: number; width: number },
): Vec2 {
  const dx = ballAt.x - pointerAt.x
  const dy = ballAt.y - pointerAt.y
  const limit = (from: number, d: number, max: number): number => {
    if (d > 0) return (max - from) / d
    if (d < 0) return -from / d
    return Infinity
  }
  const s = Math.max(
    0,
    Math.min(1, limit(ballAt.x, dx, pitch.length), limit(ballAt.y, dy, pitch.width)),
  )
  return { x: ballAt.x + dx * s, y: ballAt.y + dy * s }
}

/** Launch velocity for a pull of `pullFrom` → `pullTo`; null when the pull is too short to aim. */
export function slingVelocity(ballAt: Vec2, pointerAt: Vec2): Vec2 | null {
  const bx = ballAt.x - pointerAt.x
  const by = ballAt.y - pointerAt.y
  const pull = Math.hypot(bx, by)
  if (pull < SLING_MIN_PULL_M) return null
  const speed = Math.min(FLING_MAX_SPEED, Math.max(FLING_MIN_SPEED, pull * SLING_GAIN))
  return { x: (bx / pull) * speed, y: (by / pull) * speed }
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
      // the mesh WRAPS the ball (user 2026-08-21): once caught it can never rebound back onto
      // the field — the mouth plane only lets the ball in, never out
      if (goalHit!.side === 'left' && p.x > -0.05) {
        p.x = -0.05
        v.x = -Math.abs(v.x) * NET_REST
      } else if (goalHit!.side === 'right' && p.x < L + 0.05) {
        p.x = L + 0.05
        v.x = Math.abs(v.x) * NET_REST
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
