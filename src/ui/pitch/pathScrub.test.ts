import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from '@/domain'
import type { Path, Segment, Track } from '@/domain/types'
import { compile } from '@/engine/compile'
import { buildScenarioA } from '@/presets/scenarios'
import { buildPathScrubIndex, findPathScrubHit } from './pathScrub'

const line = (...pts: [number, number][]): Path => ({
  waypoints: pts.map(([x, y], i) => ({ id: `w${i}`, p: { x, y } })),
})
const track = (entityId: string, entityKind: 'player' | 'ball', segments: Segment[]): Track => ({
  id: `t-${entityId}`,
  entityId,
  entityKind,
  segments,
})

function docWith(segments: Segment[]) {
  const doc = createEmptyDocument({ id: 'd', now: '2026-08-19T00:00:00.000Z' })
  doc.teams.push({ id: 'A', name: 'A', color: '#00f', side: 'left' })
  doc.players.push({ id: 'p', teamId: 'A', number: 1, home: { x: 10, y: 10 } })
  doc.scenes[0]!.timeline.tracks.push(track('p', 'player', segments))
  return doc
}

describe('buildPathScrubIndex / findPathScrubHit', () => {
  it('inverts a linear player move to absolute time within 0.05s', () => {
    const doc = docWith([
      {
        id: 'm',
        kind: 'move',
        trigger: { type: 'at', t: 1 },
        timing: { speed: 5 },
        path: line([10, 10], [30, 10]),
      },
    ])
    const idx = buildPathScrubIndex(doc, compile(doc), 'p')
    const hit = findPathScrubHit(idx, { x: 20, y: 10.2 }, 0)!
    expect(hit).not.toBeNull()
    expect(hit.t).toBeCloseTo(3, 1) // 10 m at 5 m/s after start 1s
    expect(Math.abs(hit.t - 3)).toBeLessThan(0.05)
  })
  it('uses stateAt positions for eased and decelerating schedules', () => {
    const doc = docWith([
      {
        id: 'm',
        kind: 'move',
        trigger: { type: 'at', t: 0 },
        timing: { duration: 4 },
        easing: 'easeInOut',
        path: line([10, 10], [30, 10]),
      },
    ])
    const c = compile(doc)
    const idx = buildPathScrubIndex(doc, c, 'p')
    const hit = findPathScrubHit(idx, { x: 12, y: 10 }, 0)!
    // easeInOut: 10% distance reached later than 10% time (≈ 0.9s+)
    expect(hit.t).toBeGreaterThan(0.8)
    expect(hit.t).toBeLessThan(1.4)
  })
  it('uses the compiled attached start for a possessed ball travel', () => {
    const doc = buildScenarioA()
    const c = compile(doc)
    const idx = buildPathScrubIndex(doc, c, 'ball')
    const first = idx.points.find((p) => p.segmentId === 'ball-pass')!
    expect(first.p.x).toBeCloseTo(41.1, 2) // holder + offset, not authored (40,34)
  })
  it('chooses the crossing candidate nearest the current playhead deterministically', () => {
    // out-and-back along the same line: x 10→30 (0..4s) then 30→10 (4..8s)
    const doc = docWith([
      {
        id: 'a',
        kind: 'move',
        trigger: { type: 'at', t: 0 },
        timing: { speed: 5 },
        path: line([10, 10], [30, 10]),
      },
      {
        id: 'b',
        kind: 'move',
        trigger: { type: 'afterSegment', segmentId: 'a', anchor: 'end', offset: 0 },
        timing: { speed: 5 },
        path: line([30, 10], [10, 10]),
      },
    ])
    const idx = buildPathScrubIndex(doc, compile(doc), 'p')
    const early = findPathScrubHit(idx, { x: 20, y: 10 }, 1.5)!
    const late = findPathScrubHit(idx, { x: 20, y: 10 }, 7)!
    expect(early.t).toBeCloseTo(2, 1)
    expect(late.t).toBeCloseTo(6, 1)
    expect(findPathScrubHit(idx, { x: 20, y: 10 }, 1.5)!.t).toBe(early.t) // deterministic
  })
  it('returns null outside tolerance and without a path', () => {
    const doc = docWith([
      {
        id: 'm',
        kind: 'move',
        trigger: { type: 'at', t: 0 },
        timing: { speed: 5 },
        path: line([10, 10], [30, 10]),
      },
    ])
    const idx = buildPathScrubIndex(doc, compile(doc), 'p')
    expect(findPathScrubHit(idx, { x: 20, y: 20 }, 0)).toBeNull()
    const none = buildPathScrubIndex(doc, compile(doc), 'nobody')
    expect(findPathScrubHit(none, { x: 20, y: 10 }, 0)).toBeNull()
  })
})
