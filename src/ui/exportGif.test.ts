import { describe, expect, it } from 'vitest'
import { sampleTimes } from './exportGif'

describe('GIF time sampling (time compression)', () => {
  it('samples at fps with the speed multiplier and always ends on the final frame', () => {
    const ts = sampleTimes(6, 12, 2) // 6s play, 2x -> 3s gif at 12fps
    expect(ts[0]).toBe(0)
    expect(ts[ts.length - 1]).toBe(6)
    // step = speed/fps = 1/6 s of tactical time per frame
    expect(ts[1]).toBeCloseTo(1 / 6, 3)
    expect(ts.length).toBe(Math.ceil(6 / (2 / 12)) + 1)
  })
  it('short plays still produce at least two frames', () => {
    const ts = sampleTimes(0.1, 12, 2)
    expect(ts.length).toBeGreaterThanOrEqual(2)
    expect(ts[ts.length - 1]).toBe(0.1)
  })
})
