import { describe, expect, it } from 'vitest'
import { DEFAULT_PITCH } from '@/domain'
import { fractionToPitch } from '@/editor/geometry'
import {
  FORMATIONS,
  INVALID_FORMATION_IDS,
  formationSlots,
  searchFormations,
  validateFormation,
} from './formations'

describe('formations.json', () => {
  it('all presets are valid and have exactly 11 slots', () => {
    expect(INVALID_FORMATION_IDS).toEqual([])
    expect(FORMATIONS.length).toBeGreaterThanOrEqual(12)
    for (const f of FORMATIONS) {
      const slots = formationSlots(f)
      expect(slots).toHaveLength(11)
      expect(slots[0]!.role).toBe('GK')
      expect(slots.map((s) => s.number)).toEqual(Array.from({ length: 11 }, (_, i) => i + 1))
    }
  })
  it('slots stay in own half and inside the pitch when converted to metres (both sides)', () => {
    for (const f of FORMATIONS) {
      for (const s of formationSlots(f)) {
        const l = fractionToPitch(s.frac, DEFAULT_PITCH, 'left')
        const r = fractionToPitch(s.frac, DEFAULT_PITCH, 'right')
        expect(l.x).toBeGreaterThan(0)
        expect(l.x).toBeLessThan(DEFAULT_PITCH.length / 2)
        expect(r.x).toBeGreaterThan(DEFAULT_PITCH.length / 2)
        expect(l.y).toBeGreaterThan(0)
        expect(l.y).toBeLessThan(DEFAULT_PITCH.width)
      }
    }
  })
  it('ids are unique', () => {
    expect(new Set(FORMATIONS.map((f) => f.id)).size).toBe(FORMATIONS.length)
  })
  it('validateFormation rejects wrong slot counts / bad fractions', () => {
    expect(
      validateFormation({ id: 'x', name: 'x', lines: [{ role: 'GK', x: 0.1, y: [0.5] }] }),
    ).toBe(false)
    expect(
      validateFormation({
        id: 'x',
        name: 'x',
        lines: [{ role: 'GK', x: 1.5, y: new Array(11).fill(0.5) }],
      }),
    ).toBe(false)
    expect(
      validateFormation({
        id: 'x',
        name: 'x',
        lines: [{ role: 'GK', x: 0.5, y: new Array(11).fill(0.5) }],
      }),
    ).toBe(true)
  })
  it('search matches id without dashes and tags', () => {
    expect(searchFormations('442').map((f) => f.id)).toContain('4-4-2')
    expect(searchFormations('back-three').length).toBeGreaterThanOrEqual(3)
    expect(searchFormations('').length).toBe(FORMATIONS.length)
  })
})
