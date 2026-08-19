import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from '@/domain'
import type { Path, Segment, TacticDocument, Track } from '@/domain/types'
import { compile } from './compile'
import { generateReaction, stripGenerated } from './opponent'
import { stateAt } from './stateAt'

const line = (...pts: [number, number][]): Path => ({
  waypoints: pts.map(([x, y], i) => ({ id: `w${i}`, p: { x, y } })),
})
const track = (entityId: string, entityKind: 'player' | 'ball', segments: Segment[]): Track => ({
  id: `t-${entityId}`,
  entityId,
  entityKind,
  segments,
})
const wps = (s: Segment) => (s as { path: Path }).path.waypoints

/** Blue keeps the ball and plays three quick passes (0.5s apart) so reactions overlap. */
function quickPassDoc(): TacticDocument {
  const doc = createEmptyDocument({ id: 'd', now: '2026-08-19T00:00:00.000Z' })
  doc.teams.push(
    { id: 'B', name: 'Blue', color: '#00f', side: 'left' },
    { id: 'R', name: 'Red', color: '#f00', side: 'right' },
  )
  doc.players.push(
    { id: 'b1', teamId: 'B', number: 1, home: { x: 40, y: 34 } },
    { id: 'b2', teamId: 'B', number: 2, home: { x: 50, y: 14 } },
    { id: 'b3', teamId: 'B', number: 3, home: { x: 50, y: 54 } },
    { id: 'r1', teamId: 'R', number: 1, home: { x: 62, y: 24 } },
    { id: 'r2', teamId: 'R', number: 2, home: { x: 62, y: 44 } },
    { id: 'r3', teamId: 'R', number: 3, home: { x: 75, y: 34 } },
  )
  doc.ball.initialHolderId = 'b1'
  doc.scenes[0]!.timeline.tracks.push(
    track('ball', 'ball', [
      {
        id: 'h1',
        kind: 'possessed',
        trigger: { type: 'at', t: 0 },
        timing: { duration: 0 },
        holderId: 'b1',
      },
      {
        id: 'p1',
        kind: 'travel',
        travelKind: 'pass',
        trigger: { type: 'at', t: 0.5 },
        timing: { speed: 20 },
        path: line([40, 34], [50, 14]),
        receiverId: 'b2',
      },
      {
        id: 'h2',
        kind: 'possessed',
        trigger: { type: 'afterSegment', segmentId: 'p1', anchor: 'end', offset: 0 },
        timing: { duration: 0 },
        holderId: 'b2',
      },
      {
        id: 'p2',
        kind: 'travel',
        travelKind: 'pass',
        trigger: { type: 'afterSegment', segmentId: 'p1', anchor: 'end', offset: 0.5 },
        timing: { speed: 20 },
        path: line([50, 14], [50, 54]),
        receiverId: 'b3',
      },
      {
        id: 'h3',
        kind: 'possessed',
        trigger: { type: 'afterSegment', segmentId: 'p2', anchor: 'end', offset: 0 },
        timing: { duration: 0 },
        holderId: 'b3',
      },
      {
        id: 'p3',
        kind: 'travel',
        travelKind: 'pass',
        trigger: { type: 'afterSegment', segmentId: 'p2', anchor: 'end', offset: 0.5 },
        timing: { speed: 20 },
        path: line([50, 54], [40, 34]),
        receiverId: 'b1',
      },
      {
        id: 'h4',
        kind: 'possessed',
        trigger: { type: 'afterSegment', segmentId: 'p3', anchor: 'end', offset: 0 },
        timing: { duration: 0 },
        holderId: 'b1',
      },
    ]),
  )
  return doc
}

function withGenerated(doc: TacticDocument) {
  const r = generateReaction(doc, { teamId: 'R', intensity: 0.7 })
  const out = structuredClone(doc)
  for (const [pid, segs] of Object.entries(r.segments))
    out.scenes[0]!.timeline.tracks.push(track(pid, 'player', structuredClone(segs)))
  return { r, out }
}

describe('generateReaction continuity', () => {
  it('starts the first generated move at the authored position at its actual start time', () => {
    const { r, out } = withGenerated(quickPassDoc())
    const c = compile(out)
    for (const [pid, segs] of Object.entries(r.segments)) {
      const first = segs[0]!
      const tm = c.segmentTimes[first.id]!
      const before = stateAt(c, out, Math.max(0, tm.start - 1e-3)).players[pid]!.pos
      const w0 = wps(first)[0]!.p
      expect(Math.hypot(before.x - w0.x, before.y - w0.y)).toBeLessThan(0.05)
    }
  })
  it('starts every later generated segment at the previous generated endpoint (no positional jump)', () => {
    const { r, out } = withGenerated(quickPassDoc())
    const c = compile(out)
    for (const [pid, segs] of Object.entries(r.segments)) {
      for (let i = 1; i < segs.length; i++) {
        const prev = wps(segs[i - 1]!)
        const cur = wps(segs[i]!)
        expect(cur[0]!.p).toEqual(prev[prev.length - 1]!.p)
        const tm = c.segmentTimes[segs[i]!.id]!
        const a = stateAt(c, out, tm.start - 1e-6).players[pid]!.pos
        const b = stateAt(c, out, tm.start + 1e-6).players[pid]!.pos
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(1e-3)
      }
    }
  })
})

describe('generateReaction anti-shuttle', () => {
  it('coalesces an obsolete reaction when the next event arrives before completion', () => {
    const { r } = withGenerated(quickPassDoc())
    // 7 moments (start + 3×released/received) but quick passes → far fewer surviving segments per player
    for (const segs of Object.values(r.segments)) expect(segs.length).toBeLessThanOrEqual(4)
  })
  it('does not produce a qualifying excessive out-and-back pair between adjacent events', () => {
    const { r } = withGenerated(quickPassDoc())
    for (const segs of Object.values(r.segments)) {
      for (let i = 1; i < segs.length; i++) {
        const a = wps(segs[i - 1]!)
        const b = wps(segs[i]!)
        const la = { x: a[1]!.p.x - a[0]!.p.x, y: a[1]!.p.y - a[0]!.p.y }
        const lb = { x: b[1]!.p.x - b[0]!.p.x, y: b[1]!.p.y - b[0]!.p.y }
        const ma = Math.hypot(la.x, la.y)
        const mb = Math.hypot(lb.x, lb.y)
        if (ma >= 5 && mb >= 5) {
          const cos = (la.x * lb.x + la.y * lb.y) / (ma * mb)
          expect(cos).toBeGreaterThan(-0.8)
        }
      }
    }
  })
  it('still changes presser when the challenger wins by the hysteresis margin', () => {
    const { r } = withGenerated(quickPassDoc())
    const pressers = new Set(r.summary.filter((s) => s.role === 'press').map((s) => s.playerId))
    expect(pressers.size).toBeGreaterThanOrEqual(2) // ball crosses the pitch → presser changes
  })
})

describe('generateReaction invariants', () => {
  it('is deterministic, idempotent after strip/regenerate, compiles without errors, and does not mutate input', () => {
    const doc = quickPassDoc()
    const before = JSON.stringify(doc)
    const a = generateReaction(doc, { teamId: 'R', intensity: 0.7 })
    const b = generateReaction(doc, { teamId: 'R', intensity: 0.7 })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    expect(JSON.stringify(doc)).toBe(before)
    const { out } = withGenerated(doc)
    expect(compile(out).issues.filter((i) => i.level === 'error')).toEqual([])
    const again = generateReaction(out, { teamId: 'R', intensity: 0.7 })
    expect(JSON.stringify(again)).toBe(JSON.stringify(a))
    expect(
      stripGenerated(out, 'R').scenes[0]!.timeline.tracks.some((t) => t.entityId.startsWith('r')),
    ).toBe(false)
  })
})
