import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SPRINGS, springLinearEasing, springSettleTime } from './spring'

/**
 * The CSS spring easings are generated, not hand-written. This locks them to the JS springs so a
 * CSS transition and a SpringAnimator can never drift apart — change SPRINGS and this test tells
 * you exactly what each token must become.
 */
describe('CSS spring easings match the JS springs', () => {
  const css = readFileSync(new URL('../tokens.css', import.meta.url), 'utf8')
  const read = (name: string) =>
    new RegExp('--st-spring-' + name + ':\\s*([^;]+);').exec(css)?.[1]?.trim()
  const readMs = (name: string) =>
    new RegExp('--st-spring-' + name + '-ms:\\s*(\\d+)ms;').exec(css)?.[1]

  for (const role of ['press', 'pickup', 'drop', 'overlay'] as const) {
    it(`${role} easing and duration are the generated ones`, () => {
      expect(read(role)).toBe(springLinearEasing(SPRINGS[role], 20))
      expect(readMs(role)).toBe(String(Math.round(springSettleTime(SPRINGS[role]) * 1000)))
    })
  }

  it('a bouncy role really overshoots, a press role never does', () => {
    const nums = (s: string) =>
      s
        .slice('linear('.length, -1)
        .split(',')
        .map((n) => Number(n.trim()))
    expect(Math.max(...nums(read('drop')!))).toBeGreaterThan(1)
    expect(Math.max(...nums(read('press')!))).toBeLessThanOrEqual(1)
  })
})
