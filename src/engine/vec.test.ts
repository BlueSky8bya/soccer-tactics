import { describe, expect, it } from 'vitest'
import { distance, lerp } from './vec'

describe('vec', () => {
  it('lerp is deterministic and endpoint-exact', () => {
    const a = { x: 0, y: 0 }
    const b = { x: 10, y: 20 }
    expect(lerp(a, b, 0)).toEqual(a)
    expect(lerp(a, b, 1)).toEqual(b)
    expect(lerp(a, b, 0.5)).toEqual({ x: 5, y: 10 })
  })
  it('distance', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
  })
})
