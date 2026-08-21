import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * Drag latency guard.
 *
 * Latency sensitivity is governed by the visible gap between the pointer and an object that is
 * supposed to be stuck to it. Dragging creates that gap; tapping does not — which is why dragging
 * is roughly six times more latency-sensitive. For an indirect (mouse) drag the just-noticeable
 * difference is only ~55-65ms:
 *
 *   Deber, Jota, Forlines & Wigdor, CHI 2015 — indirect dragging JND 55ms vs tapping 96ms
 *     https://dl.acm.org/doi/10.1145/2702123.2702300
 *   Forch, Franke, Rauh & Krems, EPCE 2017 — mouse dragging threshold mean 65ms / median 54ms
 *     https://link.springer.com/chapter/10.1007/978-3-319-58475-1_4
 *   MacKenzie & Ware, INTERCHI 1993 — lag is MULTIPLICATIVE on Fitts' index of difficulty
 *     (MT = 230 + (169 + LAG)·IDe, R² 93.5%), so it costs time continuously, with no safe floor
 *     https://www.yorku.ca/mack/CHI93b.html
 *
 * A CSS transition on a positional property IS added latency, spent exactly where the eye is most
 * sensitive. So the pitch renders position directly every frame and animates only opacity; springs
 * decorate scale and the drop settle, never the tracked position. This test keeps it that way.
 */
describe('the pitch never animates position (drag latency)', () => {
  const css = readFileSync(new URL('../../renderer/pitch.module.css', import.meta.url), 'utf8')

  /** Properties whose animation would make a dragged object trail the pointer. */
  const POSITIONAL = [
    'transform',
    'translate',
    'all',
    'x',
    'y',
    'cx',
    'cy',
    'left',
    'top',
    'd',
    'points',
  ]

  const declarations = [...css.matchAll(/transition:\s*([^;}]+)[;}]/g)].map((m) => m[1]!)

  it('has transition declarations to check (guard is not vacuous)', () => {
    expect(declarations.length).toBeGreaterThan(0)
  })

  it('transitions only non-positional properties', () => {
    const offenders: string[] = []
    for (const decl of declarations) {
      for (const part of decl.split(',')) {
        const prop = part.trim().split(/\s+/)[0]
        if (prop && POSITIONAL.includes(prop)) offenders.push(part.trim())
      }
    }
    expect(offenders).toEqual([])
  })

  it('token motion comes from React state, not a stylesheet animation', () => {
    // an @keyframes that moves a token would reintroduce the same lag through the back door
    const animatesTransform = /@keyframes[^{]*\{[^]*?\}\s*\}/g
    const blocks = css.match(animatesTransform) ?? []
    const moving = blocks.filter((b) => /\btransform:\s*translate/.test(b))
    expect(moving).toEqual([])
  })
})
