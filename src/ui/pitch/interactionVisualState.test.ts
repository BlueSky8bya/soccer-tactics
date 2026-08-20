import { describe, expect, it } from 'vitest'
import { nextVisualPhase } from './interactionVisualState'
import type { VisualPhase } from './interactionVisualState'

/** M4a: one visual truth for press/drag/settle decorations. Commands never pass through here. */
describe('interaction visual state', () => {
  it('walks press -> drag -> commit -> settle -> idle', () => {
    let p: VisualPhase = 'idle'
    p = nextVisualPhase(p, 'press')
    expect(p).toBe('pressed')
    p = nextVisualPhase(p, 'drag-start')
    expect(p).toBe('dragging')
    p = nextVisualPhase(p, 'release-commit')
    expect(p).toBe('settling')
    p = nextVisualPhase(p, 'settled')
    expect(p).toBe('idle')
  })
  it('a plain click returns straight to idle', () => {
    expect(nextVisualPhase(nextVisualPhase('idle', 'press'), 'release-click')).toBe('idle')
  })
  it('cancel interrupts both pressed and dragging, then settles to idle', () => {
    expect(nextVisualPhase('pressed', 'cancel')).toBe('cancelled')
    expect(nextVisualPhase('dragging', 'cancel')).toBe('cancelled')
    expect(nextVisualPhase('cancelled', 'settled')).toBe('idle')
  })
  it('ignores out-of-order events instead of corrupting the phase', () => {
    expect(nextVisualPhase('idle', 'drag-start')).toBe('idle')
    expect(nextVisualPhase('idle', 'release-commit')).toBe('idle')
    expect(nextVisualPhase('settling', 'press')).toBe('settling')
  })
})
