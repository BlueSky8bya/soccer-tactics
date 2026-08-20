import { describe, expect, it } from 'vitest'
import { DEFAULT_PITCH } from '@/domain'
import { truncateBallPathAtGoal, clampToPitch, fractionToPitch, pitchMarkings } from './geometry'

describe('geometry', () => {
  it('clamps to pitch with margin', () => {
    expect(clampToPitch({ x: -10, y: 200 }, DEFAULT_PITCH)).toEqual({ x: -2, y: 70 })
    expect(clampToPitch({ x: 50, y: 30 }, DEFAULT_PITCH)).toEqual({ x: 50, y: 30 })
  })
  it('mirrors fractions for the right side', () => {
    expect(fractionToPitch({ x: 0.1, y: 0.25 }, DEFAULT_PITCH, 'left')).toEqual({ x: 10.5, y: 17 })
    expect(fractionToPitch({ x: 0.1, y: 0.25 }, DEFAULT_PITCH, 'right')).toEqual({ x: 94.5, y: 51 })
  })
  it('derives landmarks from pitch size', () => {
    const m = pitchMarkings(DEFAULT_PITCH)
    expect(m.centre).toEqual({ x: 52.5, y: 34 })
    expect(m.landmarks.find((l) => l.id === 'pen-right')?.p).toEqual({ x: 94, y: 34 })
    expect(m.landmarks.length).toBeGreaterThan(10)
  })
})

describe('truncateBallPathAtGoal (2026-08-21: shots end IN the net, never through it)', () => {
  const PITCH = { length: 105, width: 68, unit: 'm', view: 'full' } as const
  it('a path through the right goal mouth is cut at the crossing and rests inside the net', () => {
    const pts = [
      { x: 80, y: 40 },
      { x: 100, y: 35 },
      { x: 106, y: 33 }, // crosses x=105 inside the mouth (y≈33.3)
      { x: 107, y: 20 }, // curls away outside — must be CUT
    ]
    const cut = truncateBallPathAtGoal(pts, PITCH)!
    expect(cut).not.toBeNull()
    const end = cut[cut.length - 1]!
    expect(end.x).toBeGreaterThan(105.1) // inside the net box…
    expect(end.x).toBeLessThan(106.9)
    expect(end.y).toBeGreaterThan(34 - 3.66) // …and inside the mouth
    expect(end.y).toBeLessThan(34 + 3.66)
    // the crossing point itself sits ON the goal line
    expect(cut[cut.length - 2]!.x).toBeCloseTo(105, 6)
    // nothing beyond the net survived
    expect(cut.every((q) => q.x <= 106.9)).toBe(true)
  })
  it('left goal works symmetrically', () => {
    const pts = [
      { x: 20, y: 33 },
      { x: -1.5, y: 34.5 },
      { x: -2, y: 45 },
    ]
    const cut = truncateBallPathAtGoal(pts, PITCH)!
    expect(cut).not.toBeNull()
    const end = cut[cut.length - 1]!
    expect(end.x).toBeLessThan(-0.1)
    expect(end.x).toBeGreaterThan(-1.9)
    expect(end.y).toBeGreaterThan(34 - 3.66)
    expect(end.y).toBeLessThan(34 + 3.66)
  })
  it('a wide shot (outside the mouth) is untouched', () => {
    expect(
      truncateBallPathAtGoal(
        [
          { x: 90, y: 20 },
          { x: 106, y: 15 },
        ],
        PITCH,
      ),
    ).toBeNull()
    // and a pass that stays on the pitch is untouched
    expect(
      truncateBallPathAtGoal(
        [
          { x: 10, y: 10 },
          { x: 50, y: 40 },
        ],
        PITCH,
      ),
    ).toBeNull()
  })
})
