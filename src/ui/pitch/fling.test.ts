import { describe, expect, it } from 'vitest'
import { FLING } from '@/editor/segmentCommands'
import { FLING_STALE_MS, releaseVelocity } from './fling'

const run = (speed: number, n = 6, stepMs = 16) =>
  Array.from({ length: n }, (_, i) => ({
    p: { x: (speed * stepMs * i) / 1000, y: 0 },
    at: stepMs * i,
  }))

describe('releaseVelocity (fling detection)', () => {
  it('fast release while still moving → fling velocity', () => {
    const s = run(FLING.minCursorSpeed * 2)
    const v = releaseVelocity(s, s[s.length - 1]!.at + 5)
    expect(v).not.toBeNull()
    expect(v!.x).toBeGreaterThan(FLING.minCursorSpeed)
  })
  it('pausing before release is a plain move, never a fling (stale samples)', () => {
    const s = run(FLING.minCursorSpeed * 4)
    expect(releaseVelocity(s, s[s.length - 1]!.at + FLING_STALE_MS + 1)).toBeNull()
  })
  it('ordinary reposition speed is below the threshold', () => {
    const s = run(FLING.minCursorSpeed * 0.6)
    expect(releaseVelocity(s, s[s.length - 1]!.at + 5)).toBeNull()
  })
  it('needs at least two samples', () => {
    expect(releaseVelocity([{ p: { x: 0, y: 0 }, at: 0 }], 1)).toBeNull()
  })
})
