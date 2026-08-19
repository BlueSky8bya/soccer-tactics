import { describe, expect, it } from 'vitest'
import { DEFAULT_PITCH } from '@/domain'
import type { Player } from '@/domain/types'
import { snapPosition } from './snap'

const players: Player[] = [
  { id: 'a1', teamId: 'A', number: 1, home: { x: 20, y: 20 } },
  { id: 'a2', teamId: 'A', number: 2, home: { x: 20, y: 40 } },
  { id: 'b1', teamId: 'B', number: 1, home: { x: 30, y: 30 } },
]

describe('snapPosition', () => {
  it('snaps to same-team vertical alignment within threshold', () => {
    const r = snapPosition({ x: 20.5, y: 55 }, 'a2', players, DEFAULT_PITCH)
    expect(r.p.x).toBe(20)
    expect(r.p.y).toBe(55)
    expect(r.guides).toEqual([{ kind: 'v', x: 20 }])
    expect(r.snapped).toBe(true)
  })
  it('does not snap to the other team', () => {
    const r = snapPosition({ x: 30.3, y: 60 }, 'a2', players, DEFAULT_PITCH)
    expect(r.snapped).toBe(false)
    expect(r.p).toEqual({ x: 30.3, y: 60 })
  })
  it('landmark beats alignment', () => {
    const r = snapPosition({ x: 52, y: 34.5 }, 'a1', players, DEFAULT_PITCH)
    expect(r.p).toEqual({ x: 52.5, y: 34 })
    expect(r.guides[0]?.kind).toBe('point')
  })
  it('returns raw when nothing is near', () => {
    const r = snapPosition({ x: 70, y: 10 }, 'a1', players, DEFAULT_PITCH)
    expect(r.snapped).toBe(false)
    expect(r.guides).toEqual([])
  })
})
