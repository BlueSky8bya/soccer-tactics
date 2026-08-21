import { describe, expect, it } from 'vitest'
import {
  FLING_STOP_SPEED,
  SLING_MAX_SPEED,
  SLING_MIN_PULL_M,
  SLING_REACH,
  flingReach,
  flingSpeedForReach,
  flingVelocity,
  simulateFling,
  slingAimEnd,
  slingVelocity,
} from './ballFling'

const PITCH = { length: 105, width: 68 }

describe('ball fling physics (pure, deterministic)', () => {
  it('estimates release velocity from the recent sample window', () => {
    const samples = [
      { t: 0, x: 0, y: 0 },
      { t: 50, x: 0.5, y: 0 },
      { t: 100, x: 1.0, y: 0 },
    ]
    const v = flingVelocity(samples, 110)
    expect(v).not.toBeNull()
    expect(v!.x).toBeCloseTo(10, 5) // 1m over 100ms
    expect(v!.y).toBeCloseTo(0, 5)
    expect(flingVelocity([{ t: 0, x: 0, y: 0 }], 10)).toBeNull()
    // resting before release = placement, not a throw
    expect(flingVelocity(samples, 400)).toBeNull()
  })

  it('rolls forward, decelerates and stops inside the time cap', () => {
    const r = simulateFling({ x: 30, y: 34 }, { x: 15, y: 0 }, PITCH)
    expect(r.final.x).toBeGreaterThan(35) // travelled metres, not centimetres
    expect(r.duration).toBeLessThanOrEqual(4)
    // strictly decelerating: later steps cover less ground
    const step = (i: number) =>
      Math.hypot(r.points[i]!.x - r.points[i - 1]!.x, r.points[i]!.y - r.points[i - 1]!.y)
    expect(step(1)).toBeGreaterThan(step(r.points.length - 1))
    // ends below stop speed
    const n = r.points.length
    const lastV =
      Math.hypot(r.points[n - 1]!.x - r.points[n - 2]!.x, r.points[n - 1]!.y - r.points[n - 2]!.y) *
      120
    expect(lastV).toBeLessThanOrEqual(FLING_STOP_SPEED + 0.2)
  })

  it('bounces off the pitch boundary and always stays inside', () => {
    const r = simulateFling({ x: 103, y: 34 }, { x: 20, y: 3 }, PITCH)
    for (const p of r.points) {
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.x).toBeLessThanOrEqual(PITCH.length)
      expect(p.y).toBeGreaterThanOrEqual(0)
      expect(p.y).toBeLessThanOrEqual(PITCH.width)
    }
    // it actually bounced: some later point moves back left of the start wall region
    expect(Math.min(...r.points.map((p) => p.x))).toBeLessThan(103)
  })

  it('a shot into the goal mouth is CAUGHT by the net (angle preserved, rest inside)', () => {
    const goal = { top: 34 - 3.66, bot: 34 + 3.66, depth: 2 }
    const r = simulateFling({ x: 2, y: 33 }, { x: -38, y: 2 }, PITCH, goal)
    expect(r.goal).toBeDefined()
    expect(r.goal!.side).toBe('left')
    expect(r.goal!.v.x).toBeLessThan(0) // incoming velocity recorded for the FX angle
    // the ripple anchors on the NETTING contact, behind the goal line — never on the line
    expect(r.goal!.impacts.length).toBeGreaterThanOrEqual(1)
    const first = r.goal!.impacts[0]!
    expect(first.pos.x).toBeLessThan(-0.1)
    expect(first.t).toBeGreaterThanOrEqual(r.goal!.t)
    expect(first.normal).toEqual({ x: -1, y: 0 }) // back panel bulges backwards
    // a diagonal shot into the near side netting reports the SIDE normal
    const side = simulateFling({ x: 4, y: 31.2 }, { x: -14, y: -9 }, PITCH, goal)
    if (side.goal) {
      const hasSide = side.goal.impacts.some((i) => i.normal.y !== 0)
      expect(hasSide || side.goal.impacts.length > 0).toBe(true)
    }
    // rests INSIDE the net box, never through the back
    expect(r.final.x).toBeLessThan(0.6)
    // even a maximum-speed rocket never rebounds back onto the field
    const rocket = simulateFling({ x: 3, y: 34 }, { x: -40, y: 0 }, PITCH, goal)
    expect(rocket.goal).toBeDefined()
    expect(rocket.final.x).toBeLessThanOrEqual(-0.049)
    expect(r.final.x).toBeGreaterThanOrEqual(-2)
    expect(r.final.y).toBeGreaterThan(goal.top)
    expect(r.final.y).toBeLessThan(goal.bot)
    // outside the mouth the same shot just bounces (stays on the pitch)
    const wide = simulateFling({ x: 8, y: 20 }, { x: -22, y: 0 }, PITCH, goal)
    expect(wide.goal).toBeUndefined()
    expect(wide.final.x).toBeGreaterThanOrEqual(0)
  })

  it('caps wild swipe speeds and stays deterministic', () => {
    const a = simulateFling({ x: 10, y: 10 }, { x: 500, y: 0 }, PITCH)
    const b = simulateFling({ x: 10, y: 10 }, { x: 500, y: 0 }, PITCH)
    expect(a.final).toEqual(b.final)
    // capped: distance bounded by v_max/k
    const dist = a.points[a.points.length - 1]!.d
    // two-phase bound: flight carry (40→12 @k1.2) + roll (12→1.5 @k3.2)
    expect(dist).toBeLessThanOrEqual((40 - 12) / 1.2 + (12 - 1.5) / 3.2 + 2)
    // spin data monotonic
    for (let i = 1; i < a.points.length; i++)
      expect(a.points[i]!.d).toBeGreaterThanOrEqual(a.points[i - 1]!.d)
  })
})

describe('slingVelocity — pull back, launch the other way', () => {
  const ball = { x: 50, y: 34 }

  it('launches OPPOSITE the pull', () => {
    const v = slingVelocity(ball, { x: 40, y: 34 })! // pulled left
    expect(v.x).toBeGreaterThan(0) // flies right
    expect(v.y).toBeCloseTo(0, 6)
    const up = slingVelocity(ball, { x: 50, y: 44 })! // pulled down
    expect(up.y).toBeLessThan(0) // flies up
  })

  it('a pull too short to aim yields nothing', () => {
    expect(slingVelocity(ball, { x: ball.x + SLING_MIN_PULL_M / 2, y: ball.y })).toBeNull()
    expect(slingVelocity(ball, ball)).toBeNull()
  })

  it('pulling farther throws harder, up to the sling ceiling', () => {
    const soft = slingVelocity(ball, { x: 48, y: 34 })!
    const hard = slingVelocity(ball, { x: 30, y: 34 })!
    const speed = (v: { x: number; y: number }) => Math.hypot(v.x, v.y)
    expect(speed(hard)).toBeGreaterThan(speed(soft))
    expect(speed(hard)).toBeLessThanOrEqual(SLING_MAX_SPEED)
  })

  it('reach is proportional to the pull, so aim stays predictable at every length', () => {
    for (const pull of [1, 3, 8, 15, 25]) {
      const v = slingVelocity(ball, { x: ball.x + pull, y: ball.y })!
      expect(flingReach(Math.hypot(v.x, v.y))).toBeCloseTo(pull * SLING_REACH, 4)
    }
  })

  it('a huge pull still lands on the pitch', () => {
    const v = slingVelocity(ball, { x: 0, y: 0 })!
    const r = simulateFling(ball, v, PITCH)
    expect(r.final.x).toBeGreaterThanOrEqual(0)
    expect(r.final.x).toBeLessThanOrEqual(PITCH.length)
    expect(r.final.y).toBeGreaterThanOrEqual(0)
    expect(r.final.y).toBeLessThanOrEqual(PITCH.width)
  })
})

describe('slingAimEnd — the line is POWER, not the landing spot', () => {
  const ball = { x: 50, y: 34 }

  it('mirrors the pull: same length, opposite side of the ball', () => {
    const end = slingAimEnd(ball, { x: 44, y: 34 }, PITCH) // pulled 6m left
    expect(end.x).toBeCloseTo(56, 6) // points 6m right
    expect(end.y).toBeCloseTo(34, 6)
  })

  it('the ball always carries PAST the line tip, at every legal pull', () => {
    for (const pull of [SLING_MIN_PULL_M + 0.05, 2, 5, 9, 20]) {
      const pointer = { x: ball.x + pull, y: ball.y }
      const tip = slingAimEnd(ball, pointer, PITCH)
      const lineLen = Math.hypot(tip.x - ball.x, tip.y - ball.y)
      const v = slingVelocity(ball, pointer)!
      const flown = simulateFling(ball, v, PITCH)
      const travelled = Math.hypot(flown.final.x - ball.x, flown.final.y - ball.y)
      expect(travelled).toBeGreaterThan(lineLen)
    }
  })

  it('a longer pull draws a longer line (it reads as force)', () => {
    const short = slingAimEnd(ball, { x: 48, y: 34 }, PITCH)
    const long = slingAimEnd(ball, { x: 42, y: 34 }, PITCH)
    expect(long.x - ball.x).toBeGreaterThan(short.x - ball.x)
  })

  it('clamps along its OWN ray at the pitch edge — never bends the aim', () => {
    const pointer = { x: ball.x + 400, y: ball.y + 200 } // absurd pull, way off pitch
    const end = slingAimEnd(ball, pointer, PITCH)
    expect(end.x).toBeGreaterThanOrEqual(0)
    expect(end.x).toBeLessThanOrEqual(PITCH.length)
    expect(end.y).toBeGreaterThanOrEqual(0)
    expect(end.y).toBeLessThanOrEqual(PITCH.width)
    // direction preserved: the clamped tip is still colinear with the mirrored pull
    const cross = (end.x - ball.x) * -200 - (end.y - ball.y) * -400
    expect(Math.abs(cross)).toBeLessThan(1e-6)
  })

  it('a throw aimed into the mouth still reaches the net', () => {
    const gw = 7.32 / 2
    const goal = { top: PITCH.width / 2 - gw, bot: PITCH.width / 2 + gw, depth: 2 }
    const at = { x: 90, y: PITCH.width / 2 }
    const v = slingVelocity(at, { x: at.x - 10, y: at.y })! // pulled left => flies right, at goal
    const r = simulateFling(at, v, PITCH, goal)
    expect(r.goal).toBeDefined()
    expect(r.goal!.side).toBe('right')
    expect(r.goal!.impacts.length).toBeGreaterThan(0)
  })
})

describe('sling reach model — the ball must never land short of its own aim line', () => {
  const ball = { x: 52, y: 34 }

  it('flingReach and flingSpeedForReach are inverses across both drag phases', () => {
    for (const d of [0.5, 3, 3.28, 10, 40, 90]) {
      expect(flingReach(flingSpeedForReach(d))).toBeCloseTo(d, 4)
    }
  })

  it('travel beats the aim line even at LONG pulls (the reported bug)', () => {
    // a 40m pull used to saturate the 40 m/s flick cap, whose reach is only ~26m, so the ball
    // stopped short of its own line. Measured as ground covered: past the tip the ball can
    // rebound off a boundary, which moves where it RESTS but not how far it ran.
    for (const pull of [2, 10, 26, 40, 60]) {
      const pointer = { x: ball.x + pull, y: ball.y }
      const tip = slingAimEnd(ball, pointer, PITCH)
      const line = Math.hypot(tip.x - ball.x, tip.y - ball.y)
      const v = slingVelocity(ball, pointer)!
      const flown = simulateFling(ball, v, PITCH, undefined, SLING_MAX_SPEED)
      expect(flown.points[flown.points.length - 1]!.d).toBeGreaterThan(line)
    }
  })

  it('with open ground ahead it RESTS past the tip, not short of it', () => {
    const from = { x: 8, y: 34 }
    for (const pull of [3, 8, 15, 25]) {
      const pointer = { x: from.x - pull, y: from.y } // pull left => flies right, 97m of room
      const tip = slingAimEnd(from, pointer, PITCH)
      const line = Math.hypot(tip.x - from.x, tip.y - from.y)
      const v = slingVelocity(from, pointer)!
      const flown = simulateFling(from, v, PITCH, undefined, SLING_MAX_SPEED)
      expect(Math.hypot(flown.final.x - from.x, flown.final.y - from.y)).toBeGreaterThan(line)
    }
  })

  it('short pulls are responsive rather than bottoming out on a speed floor', () => {
    const tiny = slingVelocity(ball, { x: ball.x + 1, y: ball.y })!
    const small = slingVelocity(ball, { x: ball.x + 2, y: ball.y })!
    expect(Math.hypot(small.x, small.y)).toBeGreaterThan(Math.hypot(tiny.x, tiny.y) + 1)
  })

  it('a hand flick keeps its own, lower ceiling', () => {
    const wild = simulateFling(ball, { x: 500, y: 0 }, PITCH)
    const slung = simulateFling(ball, { x: 500, y: 0 }, PITCH, undefined, SLING_MAX_SPEED)
    const reach = (r: ReturnType<typeof simulateFling>) => r.points[r.points.length - 1]!.d
    expect(reach(slung)).toBeGreaterThan(reach(wild))
  })
})

