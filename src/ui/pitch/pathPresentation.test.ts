import { describe, expect, it } from 'vitest'
import { compile } from '@/engine/compile'
import { buildScenarioA } from '@/presets/scenarios'
import { deriveAttachedPathStart, presentPathWithAttachedStart } from './pathPresentation'

describe('deriveAttachedPathStart', () => {
  it('returns the compiled holder release point for a selected possessed-to-travel pass', () => {
    const doc = buildScenarioA()
    const c = compile(doc)
    const a = deriveAttachedPathStart(doc, c, 'ball-pass')
    expect(a).not.toBeNull()
    expect(a!.holderId).toBe('b1')
    // compiled start = holder pos at 1.2s + ball offset; authored first waypoint is (40,34)
    expect(a!.p.x).toBeCloseTo(40 + 1.1, 3)
    expect(a!.p.y).toBeCloseTo(34 + 0.7, 3)
    expect(a!.delta.x).toBeCloseTo(1.1, 3)
  })
  it('returns null for a move, unresolved travel, or travel without preceding possession', () => {
    const doc = buildScenarioA()
    const c = compile(doc)
    expect(deriveAttachedPathStart(doc, c, 'b2-run')).toBeNull()
    expect(deriveAttachedPathStart(doc, c, null)).toBeNull()
    // travel without preceding possession
    const doc2 = structuredClone(doc)
    const ball = doc2.scenes[0]!.timeline.tracks.find((t) => t.entityKind === 'ball')!
    ball.segments = ball.segments.filter((s) => s.id !== 'ball-pos1')
    expect(deriveAttachedPathStart(doc2, compile(doc2), 'ball-pass')).toBeNull()
  })
  it('does not mutate the authored first waypoint', () => {
    const doc = buildScenarioA()
    const c = compile(doc)
    const before = JSON.stringify(doc)
    const a = deriveAttachedPathStart(doc, c, 'ball-pass')!
    const seg = doc.scenes[0]!.timeline.tracks.find((t) => t.entityKind === 'ball')!.segments.find(
      (s) => s.id === 'ball-pass',
    )!
    const shown = presentPathWithAttachedStart(
      (seg as { path: { waypoints: { id: string; p: { x: number; y: number } }[] } }).path,
      a,
    )
    expect(shown.waypoints[0]!.p.x).toBeCloseTo(a.p.x, 6)
    expect(JSON.stringify(doc)).toBe(before)
  })
})
