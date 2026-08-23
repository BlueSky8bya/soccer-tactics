/**
 * Step isolation (PLAN-015). The rules these lock are the two that a naive "show step N only"
 * gets wrong: an invisible path must not stay grabbable (so 'hidden' has to be a real state the
 * pick input can read), and hiding old steps must not erase where the players currently STAND.
 */
import { describe, expect, it } from 'vitest'
import { deriveGhostLayers, deriveStepLayers } from './pathPresentation'

const segs = [
  { id: 's1', step: 1 },
  { id: 's2', step: 2 },
  { id: 's3', step: 3 },
  { id: 's4', step: 4 },
]

describe('deriveStepLayers', () => {
  it('isolating: this step, a trace of the one before, nothing else', () => {
    const l = deriveStepLayers(segs, 3, null, true)
    expect(l).toEqual({ s1: 'hidden', s2: 'trace', s3: 'focus', s4: 'hidden' })
  })

  it('not isolating: the old rest hierarchy, nothing hidden', () => {
    const l = deriveStepLayers(segs, 3, null, false)
    expect(l).toEqual({ s1: 'muted', s2: 'muted', s3: 'focus', s4: 'muted' })
    expect(Object.values(l)).not.toContain('hidden')
  })

  it('never hides the selected movement — the user just clicked it', () => {
    expect(deriveStepLayers(segs, 3, 's1', true).s1).toBe('focus')
    expect(deriveStepLayers(segs, 1, 's4', true).s4).toBe('focus')
  })

  it('step 1 has no predecessor to trace', () => {
    expect(deriveStepLayers(segs, 1, null, true)).toEqual({
      s1: 'focus',
      s2: 'hidden',
      s3: 'hidden',
      s4: 'hidden',
    })
  })
})

const ghosts = [
  { id: 'g-a1', entityId: 'a', segId: 'a1', step: 1 },
  { id: 'g-a2', entityId: 'a', segId: 'a2', step: 4 },
  { id: 'g-b1', entityId: 'b', segId: 'b1', step: 1 },
  { id: 'g-b2', entityId: 'b', segId: 'b2', step: 2 },
  { id: 'g-c1', entityId: 'c', segId: 'c1', step: 3 },
]

describe('deriveGhostLayers', () => {
  it("keeps each entity's LAST position before this step, however old that step is", () => {
    // Authoring step 3: a moved only in step 1 — that ghost is where a stands right now, and
    // dropping it with the rest of step 1 would leave a's position unmarked on the board.
    const l = deriveGhostLayers(ghosts, 3, null, true)
    expect(l['g-a1']).toBe('trace')
    expect(l['g-b2']).toBe('trace') // b's newest earlier ghost
    expect(l['g-b1']).toBe('hidden') // b's older one is superseded
    expect(l['g-c1']).toBe('focus') // this step's destination
    expect(l['g-a2']).toBe('hidden') // a later step's destination
  })

  it('a ghost belonging to the selected movement stays visible', () => {
    expect(deriveGhostLayers(ghosts, 3, 'a2', true)['g-a2']).toBe('focus')
  })

  it('not isolating: every ghost keeps its own rank-based fade', () => {
    const l = deriveGhostLayers(ghosts, 3, null, false)
    expect(Object.values(l).every((v) => v === 'focus')).toBe(true)
  })
})
