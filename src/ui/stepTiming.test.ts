/**
 * Where a step sits on the clock (PLAN-015). Scenario A is a real three-step play — 폭 확보(1) → 패스(2) →
 * 압박 탈출(3) — built through the same relayout pipeline a user's edits go through.
 */
import { describe, expect, it } from 'vitest'
import { compile } from '@/engine/compile'
import { buildScenarioA } from '@/presets/scenarios'
import { activeStepAt, completedStepAt, stepOpensAt } from './stepTiming'

const doc = buildScenarioA()
const compiled = compile(doc)

describe('activeStepAt', () => {
  it('reports the step whose window contains the clock', () => {
    expect(activeStepAt(doc, compiled, 0)).toBe(1)
    const pass = compiled.segmentTimes['a-pass']!
    expect(activeStepAt(doc, compiled, (pass.start + pass.end) / 2)).toBe(2)
  })

  it('is null past the end of the play', () => {
    expect(activeStepAt(doc, compiled, 9999)).toBeNull()
  })
})

describe('completedStepAt', () => {
  it('is 0 at kickoff — nothing has happened yet where the ball stands', () => {
    expect(completedStepAt(doc, compiled, 0)).toBe(0)
  })

  it('reports the step just finished, so the next movement chains onto it', () => {
    // parked at step 2's opening, step 1 is done and a new pass belongs on step 2
    expect(completedStepAt(doc, compiled, stepOpensAt(doc, compiled, 2))).toBe(1)
    expect(completedStepAt(doc, compiled, stepOpensAt(doc, compiled, 3))).toBe(2)
  })

  it('past the end, every step is behind us', () => {
    expect(completedStepAt(doc, compiled, 9999)).toBe(3)
  })
})

describe('stepOpensAt', () => {
  it('step 1 opens at kickoff', () => {
    expect(stepOpensAt(doc, compiled, 1)).toBe(0)
  })

  it('steps open in clock order', () => {
    const [a, b, c] = [1, 2, 3].map((n) => stepOpensAt(doc, compiled, n))
    expect(a!).toBeLessThan(b!)
    expect(b!).toBeLessThan(c!)
  })

  it('an empty step opens where the play actually got to, not at kickoff', () => {
    expect(stepOpensAt(doc, compiled, 6)).toBeGreaterThan(stepOpensAt(doc, compiled, 3))
  })
})
