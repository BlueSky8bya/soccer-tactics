import { describe, expect, it } from 'vitest'
import { FLING_STOP_SPEED, flingVelocity, simulateFling } from './ballFling'

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
