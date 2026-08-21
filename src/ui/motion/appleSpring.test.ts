import { describe, expect, it } from 'vitest'
import { SPRINGS, springParams, type SpringConfig } from './spring'

/**
 * Our spring is parameterised like Apple's `Spring(duration:bounce:)`, so it should reproduce
 * Apple's own documented worked example. From https://developer.apple.com/documentation/swiftui/spring
 *
 *   Spring(duration: 0.5, bounce: 0.3) -> (mass, stiffness, damping) = (1.0, 157.9, 17.6)
 *
 * The formula that reproduces it:
 *   stiffness = (2π / duration)²
 *   damping   = (1 − bounce) × 4π / duration
 *
 * Worth knowing: Apple's WWDC23 slide states this as `damping = 1 − 4π × bounce ÷ duration`, which
 * returns −6.54 for the case above — a negative damping, i.e. a spring that gains energy and
 * diverges. Implementing from the video rather than the docs produces subtly wrong springs for
 * bounce > 0 and broken ones for bounce < 0. This test pins us to the documented behaviour.
 */
describe('spring model matches Apple Spring(duration:bounce:)', () => {
  it("reproduces Apple's documented (0.5, 0.3) example", () => {
    const { stiffness, damping } = springParams({ duration: 0.5, bounce: 0.3 })
    expect(stiffness).toBeCloseTo(157.9, 1)
    expect(damping).toBeCloseTo(17.6, 1)
  })

  it('agrees with the closed form across the useful range', () => {
    const closedForm = ({ duration, bounce }: SpringConfig) => ({
      stiffness: (2 * Math.PI / duration) ** 2,
      damping: ((1 - bounce) * 4 * Math.PI) / duration,
    })
    for (const duration of [0.15, 0.18, 0.3, 0.5, 0.63]) {
      for (const bounce of [0, 0.15, 0.25, 0.3]) {
        const mine = springParams({ duration, bounce })
        const theirs = closedForm({ duration, bounce })
        expect(mine.stiffness).toBeCloseTo(theirs.stiffness, 6)
        expect(mine.damping).toBeCloseTo(theirs.damping, 6)
      }
    }
  })

  it('never produces the negative damping the WWDC slide would', () => {
    for (const role of Object.values(SPRINGS)) {
      expect(springParams(role).damping).toBeGreaterThan(0)
    }
  })

  it('keeps every role under the bounce Apple calls exaggerated', () => {
    // WWDC23 10158: 0 = smooth, 0.15 = brisk tail, 0.3 = noticeably bouncy,
    // "> 0.4 may feel too exaggerated for a UI element".
    for (const [name, role] of Object.entries(SPRINGS)) {
      expect(role.bounce, `${name} bounce`).toBeLessThanOrEqual(0.3)
      expect(role.bounce, `${name} bounce`).toBeGreaterThanOrEqual(0)
    }
  })

  it('reserves bounce for rare events and keeps frequent ones flat', () => {
    // Kao 2020 (N=3018) found juiciness is an inverted U: Extreme is as damaging as None, on
    // performance as well as preference. So the frequent, every-click roles carry no bounce and
    // only the occasional ones do. https://doi.org/10.1016/j.entcom.2020.100359
    expect(SPRINGS.press.bounce).toBe(0)
    expect(SPRINGS.drop.bounce).toBeGreaterThan(SPRINGS.pickup.bounce)
  })
})
