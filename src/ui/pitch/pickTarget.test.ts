import { describe, expect, it } from 'vitest'
import {
  BALL_HIT_M,
  GHOST_YIELD_BALL_M,
  GHOST_YIELD_PLAYER_M,
  PLAYER_HIT_M,
  ghostYieldTarget,
  pickTargets,
  resolvePossessionPair,
} from './pickTarget'
import type { PickInput } from './pickTarget'

const base = (over: Partial<PickInput> = {}): PickInput => ({
  players: [],
  ball: { id: 'ball', pos: { x: 100, y: 100 } }, // far away by default
  ghosts: [],
  segments: [],
  pt: { x: 0, y: 0 },
  metresPerPixel: 0.1135, // golden capture value (1440x900)
  currentStep: 1,
  selection: [],
  selectedSegmentId: null,
  ...over,
})

describe('pickTargets (PLAN-007 M1 golden)', () => {
  it('G1: possession comparator keeps the historical .9/1.8 boundary (2s/3 from the holder)', () => {
    const holder = { x: 0, y: 0 }
    const ball = { x: 2.3, y: 0 } // separation inside the carry range
    const boundary = (2 * 2.3) / 3
    expect(resolvePossessionPair({ x: boundary - 0.1, y: 0 }, ball, holder)).toBe('holder')
    expect(resolvePossessionPair({ x: boundary + 0.1, y: 0 }, ball, holder)).toBe('ball')
  })

  it('G2: ghost yields to a live player within 1.2m / live ball within 0.9m — and only then', () => {
    const players = [{ id: 'p1', pos: { x: GHOST_YIELD_PLAYER_M - 0.01, y: 0 } }]
    const farBall = { id: 'ball', pos: { x: 50, y: 50 } }
    expect(ghostYieldTarget({ x: 0, y: 0 }, players, farBall)).toBe('p1')
    const playersFar = [{ id: 'p1', pos: { x: GHOST_YIELD_PLAYER_M + 0.01, y: 0 } }]
    expect(ghostYieldTarget({ x: 0, y: 0 }, playersFar, farBall)).toBeNull()
    const nearBall = { id: 'ball', pos: { x: GHOST_YIELD_BALL_M - 0.01, y: 0 } }
    expect(ghostYieldTarget({ x: 0, y: 0 }, players, nearBall)).toBe('ball') // ball outranks
  })

  it('hit radii: player 2.2m, ball 1.76m, in-range only', () => {
    const r = pickTargets(
      base({
        players: [
          { id: 'in', pos: { x: PLAYER_HIT_M - 0.05, y: 0 } },
          { id: 'out', pos: { x: PLAYER_HIT_M + 0.05, y: 0 } },
        ],
        ball: { id: 'ball', pos: { x: 0, y: BALL_HIT_M - 0.05 } },
      }),
    )
    const keys = r.ordered.map((c) => ('id' in c ? c.id : ''))
    expect(keys).toContain('in')
    expect(keys).toContain('ball')
    expect(keys).not.toContain('out')
  })

  it('rank: sticky selection first, then same-kind current-step, then distance, then stable key', () => {
    const r = pickTargets(
      base({
        currentStep: 2,
        selection: ['p2'],
        players: [
          { id: 'p1', pos: { x: 0.5, y: 0 } }, // closer
          { id: 'p2', pos: { x: 1.0, y: 0 } }, // selected → sticky wins anyway
        ],
        ghosts: [
          { entityId: 'a', segId: 's1', kind: 'player', pos: { x: 1.0, y: 0 }, step: 1 },
          { entityId: 'b', segId: 's2', kind: 'player', pos: { x: 1.0, y: 0 }, step: 2 },
        ],
      }),
    )
    const keys = r.ordered.map((c) => (c.kind === 'ghost' ? `g:${c.segId}` : 'id' in c ? c.id : ''))
    expect(keys[0]).toBe('p2') // sticky
    // current-step ghost (s2) outranks the other-step ghost (s1) at IDENTICAL distance
    expect(keys.indexOf('g:s2')).toBeLessThan(keys.indexOf('g:s1'))
    // deterministic: identical call → identical order
    expect(
      pickTargets(
        base({
          currentStep: 2,
          selection: ['p2'],
          players: [
            { id: 'p1', pos: { x: 0.5, y: 0 } },
            { id: 'p2', pos: { x: 1.0, y: 0 } },
          ],
          ghosts: [
            { entityId: 'a', segId: 's1', kind: 'player', pos: { x: 1.0, y: 0 }, step: 1 },
            { entityId: 'b', segId: 's2', kind: 'player', pos: { x: 1.0, y: 0 }, step: 2 },
          ],
        }),
      ).ordered,
    ).toEqual(r.ordered)
  })

  it('segments: screen-px tolerance scales with metresPerPixel (CR-04)', () => {
    const seg = {
      segId: 's',
      entityId: 'p',
      step: 1,
      pts: [
        { x: -5, y: 0.6 },
        { x: 5, y: 0.6 },
      ],
    }
    // 0.6m from the line; at mpp=0.1135 the 7px tolerance is ~0.79m → in range
    expect(pickTargets(base({ segments: [seg] })).overlaps.segments).toHaveLength(1)
    // zoomed in (smaller mpp): 7px is only ~0.35m → out of range
    expect(
      pickTargets(base({ segments: [seg], metresPerPixel: 0.05 })).overlaps.segments,
    ).toHaveLength(0)
  })

  it('fingerprint identifies the ordered list for cycle invalidation (CR-09)', () => {
    const a = pickTargets(base({ players: [{ id: 'p1', pos: { x: 1, y: 0 } }] }))
    const b = pickTargets(base({ players: [{ id: 'p1', pos: { x: 1, y: 0 } }] }))
    const c = pickTargets(base({ players: [{ id: 'p2', pos: { x: 1, y: 0 } }] }))
    expect(a.fingerprint).toBe(b.fingerprint)
    expect(a.fingerprint).not.toBe(c.fingerprint)
  })
})
