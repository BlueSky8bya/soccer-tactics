import { describe, expect, it } from 'vitest'
import {
  PEN_COLORS,
  PEN_WIDTHS,
  mapPenPressure,
  mouseSpeedPressure,
  penSegments,
  penWidthFactor,
  smoothPressure,
} from './inking'

describe('VIC pen grammar (reference-verbatim golden numbers)', () => {
  it('palette and widths match the reference, with the one authored deviation', () => {
    // 17 slots and the widths are the reference's. The single departure is white in slot 1,
    // trading one of three near-identical pinks for the most legible pen on a green pitch
    // (user 2026-08-22). Pinned here so the deviation stays deliberate rather than drifting.
    expect(PEN_COLORS).toHaveLength(17)
    expect(PEN_COLORS[0]).toBe('#000000')
    expect(PEN_COLORS[1]).toBe('#ffffff')
    expect(PEN_COLORS).not.toContain('#f472b6')
    expect(PEN_COLORS[16]).toBe('#e879f9')
    expect(PEN_WIDTHS).toEqual([2, 3, 5, 8, 12, 18])
  })

  it('stylus pressure: gamma 0.65 with a 0.12 floor', () => {
    expect(mapPenPressure(0)).toBe(0.12)
    expect(mapPenPressure(1)).toBe(1)
    expect(mapPenPressure(0.5)).toBeCloseTo(0.5 ** 0.65, 10)
  })

  it('smoothing: equal elapsed time → equal response; dt<=0 returns previous', () => {
    const a = smoothPressure(0.5, 1, 12) // one tau → 1-1/e of the gap
    expect(a).toBeCloseTo(0.5 + 0.5 * (1 - Math.exp(-1)), 10)
    expect(smoothPressure(0.5, 1, 0)).toBe(0.5)
  })

  it('mouse speed inverse: fast → thin (0.3 floor), slow → thick, EMA 0.65/0.35', () => {
    // stationary: target 1
    expect(mouseSpeedPressure(0.8, 0, 16)).toBeCloseTo(0.8 * 0.65 + 1 * 0.35, 10)
    // very fast: target floors at 0.3
    expect(mouseSpeedPressure(0.8, 100, 10)).toBeCloseTo(0.8 * 0.65 + 0.3 * 0.35, 10)
  })

  it('width factor: w × (0.45 + p × 0.85), neutral 0.7 → 1.045', () => {
    expect(penWidthFactor(undefined)).toBeCloseTo(1.045, 10)
    expect(penWidthFactor(0)).toBeCloseTo(0.45, 10)
    expect(penWidthFactor(1)).toBeCloseTo(1.3, 10)
  })

  it('penSegments: head + body quadratics + tail, per-point factors', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 10 },
    ]
    const segs = penSegments(pts, [0.2, 0.6, 1])
    expect(segs).toHaveLength(3) // head, one body, tail
    expect(segs[0]!.d.startsWith('M 0 0 L 5 0')).toBe(true) // start → first midpoint
    expect(segs[1]!.d).toContain('Q 10 0 15 5') // control = the point, ends at midpoints
    expect(segs[2]!.f).toBeCloseTo(penWidthFactor(1), 10)
    // single point → stamp dot
    expect(penSegments([{ x: 1, y: 1 }])).toHaveLength(1)
  })
})
