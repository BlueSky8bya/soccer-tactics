import { describe, expect, it } from 'vitest'
import { GIF_MAX_BYTES, GIF_TIERS, sampleTimes } from './exportGif'

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

describe('GIF quality tiers', () => {
  it('descend in both axes so each tier is unambiguously cheaper', () => {
    for (let i = 1; i < GIF_TIERS.length; i++) {
      expect(GIF_TIERS[i]!.width).toBeLessThan(GIF_TIERS[i - 1]!.width)
      expect(GIF_TIERS[i]!.fps).toBeLessThan(GIF_TIERS[i - 1]!.fps)
    }
  })

  it('start well above the old fixed export and leave the 10MB limit real headroom', () => {
    // the old export was pinned at 640px / 12fps and landed around 1MB — two orders of magnitude
    // under the upload ceiling it was sized for (user 2026-08-22)
    expect(GIF_TIERS[0]!.width).toBeGreaterThanOrEqual(1280)
    expect(GIF_TIERS[0]!.fps).toBeGreaterThanOrEqual(25)
    expect(GIF_TIERS[GIF_TIERS.length - 1]!.width).toBe(640)
    expect(GIF_MAX_BYTES).toBeLessThan(10 * 1024 * 1024)
    expect(GIF_MAX_BYTES).toBeGreaterThan(8 * 1024 * 1024)
  })

  it('every tier delay lands on a whole centisecond (GIF stores 1/100s)', () => {
    // a delay that does not divide evenly is silently rounded by the decoder, which is one way a
    // "smooth" fps still plays uneven
    for (const { fps } of GIF_TIERS) expect(Math.round(1000 / fps) % 10).toBe(0)
  })
})
