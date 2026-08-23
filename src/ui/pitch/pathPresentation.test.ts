import { describe, expect, it } from 'vitest'
import { compile } from '@/engine/compile'
import { buildScenarioA } from '@/presets/scenarios'
import {
  deriveActiveSegmentIds,
  deriveFocusIds,
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
    const ballTrack = doc.scenes[0]!.timeline.tracks.find((track) => track.entityKind === 'ball')!
    const pass = ballTrack.segments.find((segment) => segment.kind === 'travel')!
    const compiledStart = { ...pass.path.waypoints[0]!.p }
    pass.path.waypoints[0]!.p = {
      x: compiledStart.x - 2,
      y: compiledStart.y + 1,
    }
    const a = deriveAttachedPathStart(doc, c, pass.id)
    expect(a).not.toBeNull()
    expect(a!.holderId).toBe('b1')
    expect(a!.p).toEqual(compiledStart)
    expect(a!.delta).toEqual({ x: 2, y: -1 })
  })
  it('returns null for a move, unresolved travel, or travel without preceding possession', () => {
    const doc = buildScenarioA()
    const c = compile(doc)
    const move = doc.scenes[0]!.timeline.tracks.flatMap((track) => track.segments).find(
      (segment) => segment.kind === 'move',
    )!
    expect(deriveAttachedPathStart(doc, c, move.id)).toBeNull()
    expect(deriveAttachedPathStart(doc, c, null)).toBeNull()
    // travel without preceding possession
    const doc2 = structuredClone(doc)
    const ball = doc2.scenes[0]!.timeline.tracks.find((t) => t.entityKind === 'ball')!
    const pass = ball.segments.find((segment) => segment.kind === 'travel')!
    const passIndex = ball.segments.indexOf(pass)
    ball.segments.splice(passIndex - 1, 1)
    expect(deriveAttachedPathStart(doc2, compile(doc2), pass.id)).toBeNull()
  })
  it('does not mutate the authored first waypoint', () => {
    const doc = buildScenarioA()
    const c = compile(doc)
    const before = JSON.stringify(doc)
    const seg = doc.scenes[0]!.timeline.tracks.find(
      (track) => track.entityKind === 'ball',
    )!.segments.find((segment) => segment.kind === 'travel')!
    const a = deriveAttachedPathStart(doc, c, seg.id)!
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

describe('deriveFocusIds — focus is movement-editing, not token selection', () => {
  it('no selected movement = no focus, so the whole board stays vivid', () => {
    // the regression: selecting/dragging a player used to dim every other entity
    expect(deriveFocusIds(null, null, 'ball')).toEqual(new Set())
    expect(deriveFocusIds(null, 'b1', 'ball')).toEqual(new Set())
  })
  it('a selected player movement focuses that player plus the ball', () => {
    expect(deriveFocusIds('seg-1', 'b1', 'ball')).toEqual(new Set(['b1', 'ball']))
  })
  it('a selected ball movement focuses the ball alone', () => {
    expect(deriveFocusIds('seg-1', 'ball', 'ball')).toEqual(new Set(['ball']))
  })
  it('a dangling segment reference yields no focus', () => {
    expect(deriveFocusIds('seg-gone', null, 'ball')).toEqual(new Set())
  })
  it('playback clears focus — the whole board belongs to the play', () => {
    // the regression: a movement left selected dimmed everything for the entire animation
    expect(deriveFocusIds('seg-1', 'b1', 'ball', true)).toEqual(new Set())
    // and it comes back when the play stops
    expect(deriveFocusIds('seg-1', 'b1', 'ball', false)).toEqual(new Set(['b1', 'ball']))
  })
})
