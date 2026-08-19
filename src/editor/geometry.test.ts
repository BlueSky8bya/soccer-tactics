import { describe, expect, it } from 'vitest'
import { DEFAULT_PITCH } from '@/domain'
import { clampToPitch, fractionToPitch, pitchMarkings } from './geometry'

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
