/**
 * Every shipped example must depict a continuous ball (invariant B1).
 *
 * These are the documents a first-time user sees play; a ball that jumps 2 m at a junction is a
 * defect they meet before they have drawn anything. `scenarios.test.ts` checks their structure —
 * this checks what they LOOK like when played.
 */
import { describe, expect, it } from 'vitest'
import { describeJump, maxBallJump } from '@/engine/ballContinuity'
import { SCENARIOS } from './scenarios'

describe('shipped scenarios — the ball never teleports', () => {
  for (const s of SCENARIOS) {
    it(`${s.id} is continuous`, () => {
      const jump = maxBallJump(s.build())
      expect(jump ? describeJump(jump) : 'continuous').toBe('continuous')
    })
  }
})
