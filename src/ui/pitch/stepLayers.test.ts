/**
 * Step isolation (PLAN-015 v2). Two rules matter here and both are about hiding done RIGHT:
 * 'hidden' has to be a real state the hit-testing input can read (a transparent element still
 * catches presses), and the movement the user has selected must never disappear under them.
 */
import { describe, expect, it } from 'vitest'
import { deriveGhostLayers, deriveStepLayers } from './pathPresentation'

const segs = [
  { id: 'a', step: 1 },
  { id: 'b', step: 2 },
  { id: 'c', step: 3 },
  { id: 'd', step: 4 },
]

describe('deriveStepLayers', () => {
  it('isolating: this step and nothing else — the rest is already standing on the board', () => {
    expect(deriveStepLayers(segs, 3, null, true)).toEqual({
      a: 'hidden',
      b: 'hidden',
      c: 'focus',
      d: 'hidden',
    })
  })

  it('not isolating: the old rest hierarchy, nothing hidden', () => {
    const l = deriveStepLayers(segs, 3, null, false)
    expect(l).toEqual({ a: 'muted', b: 'muted', c: 'focus', d: 'muted' })
    expect(Object.values(l)).not.toContain('hidden')
  })

  it('never hides the selected movement — the user just clicked it', () => {
    expect(deriveStepLayers(segs, 3, 'a', true).a).toBe('focus')
    expect(deriveStepLayers(segs, 1, 'd', true).d).toBe('focus')
  })

  it('step 1 isolated shows only step 1', () => {
    expect(deriveStepLayers(segs, 1, null, true)).toEqual({
      a: 'focus',
      b: 'hidden',
      c: 'hidden',
      d: 'hidden',
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
  it('isolating: only this step’s destinations — earlier positions are the live tokens now', () => {
    const l = deriveGhostLayers(ghosts, 3, null, true)
    expect(l['g-c1']).toBe('focus')
    for (const id of ['g-a1', 'g-a2', 'g-b1', 'g-b2']) expect(l[id]).toBe('hidden')
  })

  it('a ghost belonging to the selected movement stays visible', () => {
    expect(deriveGhostLayers(ghosts, 3, 'a2', true)['g-a2']).toBe('focus')
  })

  it('not isolating: nothing is hidden, so the rank fade still does the work', () => {
    const l = deriveGhostLayers(ghosts, 3, null, false)
    expect(Object.values(l)).not.toContain('hidden')
    expect(l['g-c1']).toBe('focus')
  })
})
