import { describe, expect, it } from 'vitest'
import { compile } from '@/engine/compile'
import { buildScenarioA } from '@/presets/scenarios'
import {
  deriveActiveSegmentIds,
  deriveAttachedPathStart,
  derivePathPhase,
  ghostOpacityForStep,
  placeStepBadges,
  presentPathWithAttachedStart,
} from './pathPresentation'

describe('deriveAttachedPathStart', () => {
  it('returns the compiled holder release point for a selected possessed-to-travel pass', () => {
    const doc = buildScenarioA()
    const c = compile(doc)
    const a = deriveAttachedPathStart(doc, c, 'ball-pass')
    expect(a).not.toBeNull()
    expect(a!.holderId).toBe('b1')
    // compiled start = holder pos at 1.2s + ball offset; authored first waypoint is (40,34)
    expect(a!.p.x).toBeCloseTo(40 + 1.45, 3)
    expect(a!.p.y).toBeCloseTo(34 + 0.95, 3)
    expect(a!.delta.x).toBeCloseTo(1.45, 3)
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

describe('playback focus helpers (PLAN-005 M4)', () => {
  const times = {
    a: { start: 0, end: 2 },
    b: { start: 0, end: 2 },
    c: { start: 2, end: 5 },
  }

  it('simultaneous segments are both active; boundaries belong to both windows', () => {
    expect([...deriveActiveSegmentIds(times, 1)].sort()).toEqual(['a', 'b'])
    expect([...deriveActiveSegmentIds(times, 2)].sort()).toEqual(['a', 'b', 'c'])
    expect([...deriveActiveSegmentIds(times, 4)]).toEqual(['c'])
  })

  it('classifies past / active / future for one segment', () => {
    expect(derivePathPhase(times.c, 1)).toBe('future')
    expect(derivePathPhase(times.c, 3)).toBe('active')
    expect(derivePathPhase(times.a, 3)).toBe('past')
    expect(derivePathPhase(undefined, 3)).toBe('future')
  })

  it('ghost opacity decays with the global step rank but keeps a floor; selection boosts', () => {
    expect(ghostOpacityForStep(0, false)).toBeCloseTo(0.55, 5)
    expect(ghostOpacityForStep(2, false)).toBeCloseTo(0.33, 5)
    expect(ghostOpacityForStep(9, false)).toBeCloseTo(0.18, 5) // floor, never 0
    expect(ghostOpacityForStep(0, true)).toBeCloseTo(0.75, 5)
  })

  it('badge placement is deterministic and pushes overlapping badges apart (bounded)', () => {
    const anchors = [
      { id: 'x', at: { x: 10, y: 10 } },
      { id: 'y', at: { x: 10.5, y: 10 } }, // would collide with x
      { id: 'z', at: { x: 40, y: 10 } },
    ]
    const placed = placeStepBadges(anchors)
    expect(placed[0]!.at).toEqual({ x: 10, y: 8.1 }) // default lift
    expect(placed[1]!.at).not.toEqual({ x: 10.5, y: 8.1 }) // nudged away
    const d = Math.hypot(placed[1]!.at.x - placed[0]!.at.x, placed[1]!.at.y - placed[0]!.at.y)
    expect(d).toBeGreaterThanOrEqual(2.6)
    // deterministic: same input, same output
    expect(placeStepBadges(anchors)).toEqual(placed)
    // bounded: every badge stays within 4m of its anchor
    for (let i = 0; i < anchors.length; i++) {
      const dd = Math.hypot(placed[i]!.at.x - anchors[i]!.at.x, placed[i]!.at.y - anchors[i]!.at.y)
      expect(dd).toBeLessThanOrEqual(4)
    }
  })
})
