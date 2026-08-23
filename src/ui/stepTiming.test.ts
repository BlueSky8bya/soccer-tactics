/**
 * The step's clock (PLAN-015 v2). Scenario A is a real three-step play — 폭 확보(1) → 패스(2) →
 * 압박 탈출(3) — built through the same relayout pipeline a user's edits go through.
 */
import { describe, expect, it } from 'vitest'
import { compile } from '@/engine/compile'
import { buildScenarioA } from '@/presets/scenarios'
import { activeStepAt, completedStepAt, secs, stepOpensAt, stepTiming } from './stepTiming'

const doc = buildScenarioA()
const compiled = compile(doc)

describe('stepTiming', () => {
  it('reports a used step: its rank, its window and the whole play', () => {
    const s2 = stepTiming(doc, compiled, 2)
    expect(s2.used).toBe(true)
    expect(s2.index).toBe(2)
    expect(s2.total).toBe(3) // scenario A uses steps 1, 2, 3
    expect(s2.end).toBeGreaterThan(s2.start)
    expect(s2.playEnd).toBeGreaterThanOrEqual(s2.end)
    expect(s2.count).toBe(1) // one pass
  })

  it('steps run in clock order', () => {
    const [a, b, c] = [1, 2, 3].map((n) => stepTiming(doc, compiled, n))
    expect(a!.start).toBeLessThanOrEqual(b!.start)
    expect(b!.start).toBeLessThanOrEqual(c!.start)
  })

  it('an empty step reports where it WOULD start, not zero', () => {
    const s6 = stepTiming(doc, compiled, 6)
    expect(s6.used).toBe(false)
    expect(s6.index).toBeNull()
    expect(s6.count).toBe(0)
    expect(s6.start).toBe(stepOpensAt(doc, compiled, 6))
    expect(s6.start).toBeGreaterThan(stepTiming(doc, compiled, 3).start)
  })

  it('step 1 opens at kickoff', () => {
    expect(stepOpensAt(doc, compiled, 1)).toBe(0)
  })
})

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

describe('secs', () => {
  it('reads like a stopwatch', () => {
    expect(secs(0)).toBe('0.0')
    expect(secs(1.24)).toBe('1.2')
    expect(secs(1.26)).toBe('1.3')
  })
})

describe('completedStepAt', () => {
  it('is 0 at kickoff — nothing has happened yet where the ball stands', () => {
    expect(completedStepAt(doc, compiled, 0)).toBe(0)
  })

  it('reports the step just finished, so the next movement chains onto it', () => {
    const s2 = stepTiming(doc, compiled, 2)
    // parked at step 2's opening, step 1 is done and a new pass belongs on step 2
    expect(completedStepAt(doc, compiled, s2.start)).toBe(1)
    const s3 = stepTiming(doc, compiled, 3)
    expect(completedStepAt(doc, compiled, s3.start)).toBe(2)
  })

  it('past the end, every step is behind us', () => {
    expect(completedStepAt(doc, compiled, 9999)).toBe(3)
  })
})
