import { describe, expect, it } from 'vitest'
import { applyInverseAffine } from './pointer'

describe('applyInverseAffine', () => {
  it('maps client px back to pitch metres for a uniform scale + translate', () => {
    // 10 px per metre, origin at (100, 50) px
    const m = { a: 10, b: 0, c: 0, d: 10, e: 100, f: 50 }
    expect(applyInverseAffine(m, 100, 50)).toEqual({ x: 0, y: 0 })
    expect(applyInverseAffine(m, 625, 390)).toEqual({ x: 52.5, y: 34 })
  })
  it('returns origin for singular matrix', () => {
    expect(applyInverseAffine({ a: 0, b: 0, c: 0, d: 0, e: 1, f: 1 }, 5, 5)).toEqual({ x: 0, y: 0 })
  })
})
