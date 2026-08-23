/**
 * The step, told in words (PLAN-015 M4). Scenario A is a real three-step play — 폭 확보(1) →
 * 패스(2) → 압박 탈출(3) — so the narrative is checked against a document that was built the same
 * way a user's is (every builder finishes through relayoutStepsInDraft).
 */
import { describe, expect, it } from 'vitest'
import { compile } from '@/engine/compile'
import { buildScenarioA } from '@/presets/scenarios'
import { actionSummary, activeStepAt, describeStep, stepOpensAt } from './stepNarrative'

const doc = buildScenarioA()
const compiled = compile(doc)

describe('describeStep', () => {
  it('names the holder as the situation and the pass as the plan', () => {
    const n = describeStep(doc, compiled, 2)
    expect(n.used).toBe(true)
    expect(n.situation).toBe('6번 보유') // b1 still has it when step 2 opens
    expect(n.actions).toEqual(['6번→7번 패스'])
  })

  it('calls a run by the ball carrier a dribble, and lists movements in clock order', () => {
    const n = describeStep(doc, compiled, 3)
    expect(n.situation).toBe('7번 보유') // the pass has been received
    expect(n.actions).toContain('7번 드리블') // b2 escapes WITH the ball
    expect(n.actions.filter((a) => a.endsWith('이동')).length).toBe(2) // r1 cover + r2 press
  })

  it('an empty step opens where the play actually got to, not at kickoff', () => {
    const n = describeStep(doc, compiled, 6)
    expect(n.used).toBe(false)
    expect(n.actions).toEqual([])
    // step 3 ends with b2 carrying, so that is the situation a new step 6 would start from
    expect(n.situation).toBe('7번 보유')
    expect(stepOpensAt(doc, compiled, 6)).toBeGreaterThan(stepOpensAt(doc, compiled, 3))
  })

  it('step 1 opens at the kickoff frame', () => {
    expect(stepOpensAt(doc, compiled, 1)).toBe(0)
    expect(describeStep(doc, compiled, 1).situation).toBe('6번 보유')
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

describe('actionSummary', () => {
  it('says so when the step is still empty', () => {
    expect(actionSummary([])).toContain('아직 없음')
  })

  it('spells a few out and counts the tail', () => {
    expect(actionSummary(['a', 'b'])).toBe('a · b')
    expect(actionSummary(['a', 'b', 'c', 'd', 'e'])).toBe('a · b · c 외 2개')
  })
})
