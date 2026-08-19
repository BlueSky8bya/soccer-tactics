import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from '@/domain'
import type { Path, Segment, TacticDocument, Track } from '@/domain/types'
import { compile } from './compile'
import { buildPathLUT, pointAtDistance, simplifyPolyline, smoothWaypoints } from './path'
import { stateAt } from './stateAt'

const line = (...pts: [number, number][]): Path => ({
  waypoints: pts.map(([x, y], i) => ({ id: `w${i}`, p: { x, y } })),
})

function baseDoc(): TacticDocument {
  const doc = createEmptyDocument({ id: 'd', now: '2026-08-19T00:00:00.000Z' })
  doc.teams.push({ id: 'B', name: 'Blue', color: '#00f', side: 'left' })
  doc.teams.push({ id: 'R', name: 'Red', color: '#f00', side: 'right' })
  doc.players.push(
    { id: 'b1', teamId: 'B', number: 1, home: { x: 40, y: 34 } },
    { id: 'b2', teamId: 'B', number: 2, home: { x: 50, y: 20 } },
    { id: 'r1', teamId: 'R', number: 1, home: { x: 60, y: 24 } },
    { id: 'r2', teamId: 'R', number: 2, home: { x: 62, y: 40 } },
  )
  return doc
}

function track(entityId: string, entityKind: 'player' | 'ball', segments: Segment[]): Track {
  return { id: `t-${entityId}`, entityId, entityKind, segments }
}

describe('path', () => {
  it('polyline LUT length and sampling are exact', () => {
    const lut = buildPathLUT(line([0, 0], [3, 4], [3, 10]))
    expect(lut.length).toBeCloseTo(11, 6)
    expect(pointAtDistance(lut, 5).x).toBeCloseTo(3, 6)
    expect(pointAtDistance(lut, 5).y).toBeCloseTo(4, 6)
    expect(pointAtDistance(lut, 8).y).toBeCloseTo(7, 6)
    expect(lut.waypointS.map((v) => Math.round(v * 1e6) / 1e6)).toEqual([0, 5, 11])
  })
  it('bezier LUT is monotone and ends at the last waypoint', () => {
    const wps = smoothWaypoints(
      [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 20, y: 0 },
      ],
      ['a', 'b', 'c'],
    )
    const lut = buildPathLUT({ waypoints: wps })
    for (let i = 1; i < lut.cum.length; i++)
      expect(lut.cum[i]).toBeGreaterThanOrEqual(lut.cum[i - 1]!)
    const end = pointAtDistance(lut, lut.length)
    expect(end.x).toBeCloseTo(20, 6)
    expect(end.y).toBeCloseTo(0, 6)
    expect(lut.length).toBeGreaterThan(28) // longer than straight 28.28? curve bulges → ≥ polyline chord
  })
  it('simplifyPolyline keeps corners, drops collinear points', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 1, y: 0.01 },
      { x: 2, y: 0 },
      { x: 3, y: 0.02 },
      { x: 4, y: 0 },
      { x: 4, y: 2 },
      { x: 4, y: 4 },
    ]
    const s = simplifyPolyline(pts, 0.5)
    expect(s).toEqual([
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
    ])
  })
})

describe('compile + stateAt', () => {
  it('speed timing → duration = length / speed; stateAt interpolates; determinism', () => {
    const doc = baseDoc()
    doc.scenes[0]!.timeline.tracks.push(
      track('b2', 'player', [
        {
          id: 's1',
          kind: 'move',
          trigger: { type: 'at', t: 1 },
          timing: { speed: 5 },
          path: line([50, 20], [60, 20]),
        },
      ]),
    )
    const c = compile(doc)
    expect(c.issues.filter((i) => i.level === 'error')).toEqual([])
    expect(c.segmentTimes.s1).toEqual({ start: 1, end: 3, entityId: 'b2' })
    expect(stateAt(c, doc, 0.5).players.b2!.pos).toEqual({ x: 50, y: 20 })
    expect(stateAt(c, doc, 2).players.b2!.pos.x).toBeCloseTo(55, 6)
    expect(stateAt(c, doc, 10).players.b2!.pos).toEqual({ x: 60, y: 20 })
    const a = JSON.stringify(stateAt(c, doc, 1.37))
    const b = JSON.stringify(stateAt(compile(doc), doc, 1.37))
    expect(a).toBe(b)
  })

  it('waypoint hold pauses the mover', () => {
    const doc = baseDoc()
    const path: Path = {
      waypoints: [
        { id: 'a', p: { x: 0, y: 0 } },
        { id: 'b', p: { x: 10, y: 0 }, hold: 2 },
        { id: 'c', p: { x: 20, y: 0 } },
      ],
    }
    doc.scenes[0]!.timeline.tracks.push(
      track('b1', 'player', [
        { id: 's', kind: 'move', trigger: { type: 'at', t: 0 }, timing: { duration: 6 }, path },
      ]),
    )
    const c = compile(doc)
    expect(c.segmentTimes.s!.end).toBeCloseTo(6, 6)
    // travel 4s over 20m → 5 m/s; reach b at 2s, hold until 4s, end at 6s
    expect(stateAt(c, doc, 2).players.b1!.pos.x).toBeCloseTo(10, 6)
    expect(stateAt(c, doc, 3).players.b1!.pos.x).toBeCloseTo(10, 6)
    expect(stateAt(c, doc, 5).players.b1!.pos.x).toBeCloseTo(15, 6)
  })

  it('trigger cycle → error, not hang', () => {
    const doc = baseDoc()
    doc.scenes[0]!.timeline.tracks.push(
      track('b1', 'player', [
        {
          id: 'x',
          kind: 'move',
          trigger: { type: 'afterSegment', segmentId: 'y', anchor: 'end', offset: 0 },
          timing: { speed: 5 },
          path: line([0, 0], [5, 0]),
        },
      ]),
      track('b2', 'player', [
        {
          id: 'y',
          kind: 'move',
          trigger: { type: 'afterSegment', segmentId: 'x', anchor: 'end', offset: 0 },
          timing: { speed: 5 },
          path: line([0, 0], [5, 0]),
        },
      ]),
    )
    const c = compile(doc)
    expect(c.issues.filter((i) => i.level === 'error').length).toBe(2)
  })

  it('Scenario A — 2v2: delay, reaction, pass detach/receive, event-triggered press', () => {
    const doc = baseDoc()
    doc.ball.initialHolderId = 'b1'
    const tl = doc.scenes[0]!.timeline
    // Blue 2 waits 0.4s then runs wide (10 m at 5 m/s → 2 s, ends 2.4)
    tl.tracks.push(
      track('b2', 'player', [
        {
          id: 'b2-run',
          kind: 'move',
          trigger: { type: 'at', t: 0.4 },
          timing: { speed: 5 },
          path: line([50, 20], [60, 12]),
        },
      ]),
    )
    // Red 1 reacts 0.2s after Blue 2 starts
    tl.tracks.push(
      track('r1', 'player', [
        {
          id: 'r1-track',
          kind: 'move',
          trigger: { type: 'afterSegment', segmentId: 'b2-run', anchor: 'start', offset: 0.2 },
          timing: { speed: 5 },
          path: line([60, 24], [64, 16]),
        },
      ]),
    )
    // Ball: possessed by b1 → pass at 1.2 to b2 (arrives where b2 will be) → possessed by b2
    tl.tracks.push(
      track('ball', 'ball', [
        {
          id: 'ball-pos1',
          kind: 'possessed',
          trigger: { type: 'at', t: 0 },
          timing: { duration: 0 },
          holderId: 'b1',
        },
        {
          id: 'ball-pass',
          kind: 'travel',
          travelKind: 'pass',
          trigger: { type: 'at', t: 1.2 },
          timing: { speed: 15 },
          path: line([40, 34], [58, 13]),
          receiverId: 'b2',
        },
        {
          id: 'ball-pos2',
          kind: 'possessed',
          trigger: { type: 'afterSegment', segmentId: 'ball-pass', anchor: 'end', offset: 0 },
          timing: { duration: 0 },
          holderId: 'b2',
        },
      ]),
    )
    // Red 2 presses when the ball is received
    tl.tracks.push(
      track('r2', 'player', [
        {
          id: 'r2-press',
          kind: 'move',
          trigger: {
            type: 'onEvent',
            event: { kind: 'ball.received', segmentId: 'ball-pass' },
            offset: 0,
          },
          timing: { speed: 6 },
          path: line([62, 40], [60, 16]),
        },
      ]),
    )

    const c = compile(doc)
    expect(c.issues.filter((i) => i.level === 'error')).toEqual([])

    // timings
    expect(c.segmentTimes['b2-run']!.start).toBeCloseTo(0.4)
    expect(c.segmentTimes['r1-track']!.start).toBeCloseTo(0.6)
    const pass = c.segmentTimes['ball-pass']!
    expect(pass.start).toBeCloseTo(1.2)
    expect(pass.end).toBeGreaterThan(pass.start)
    expect(c.segmentTimes['r2-press']!.start).toBeCloseTo(pass.end, 6)
    const received = c.events.find((e) => e.kind === 'ball.received')!
    expect(received.t).toBeCloseTo(pass.end, 6)

    // states
    const s03 = stateAt(c, doc, 0.3)
    expect(s03.players.b2!.pos).toEqual({ x: 50, y: 20 }) // not yet moving
    expect(s03.ball.status).toBe('possessed')
    expect(s03.ball.holderId).toBe('b1')

    const s13 = stateAt(c, doc, 1.3)
    expect(s13.ball.status).toBe('travel') // detached
    expect(s13.players.r1!.moving).toBe(true)

    const sEnd = stateAt(c, doc, pass.end + 0.05)
    expect(sEnd.ball.status).toBe('possessed')
    expect(sEnd.ball.holderId).toBe('b2')
    expect(sEnd.players.r2!.moving).toBe(true)

    const sBefore = stateAt(c, doc, pass.end - 0.05)
    expect(sBefore.players.r2!.moving).toBe(false)
  })

  it('travel start snaps to holder release position when preceded by possession', () => {
    const doc = baseDoc()
    doc.scenes[0]!.timeline.tracks.push(
      track('b1', 'player', [
        {
          id: 'm',
          kind: 'move',
          trigger: { type: 'at', t: 0 },
          timing: { speed: 10 },
          path: line([40, 34], [50, 34]),
        },
      ]),
      track('ball', 'ball', [
        {
          id: 'p1',
          kind: 'possessed',
          trigger: { type: 'at', t: 0 },
          timing: { duration: 0 },
          holderId: 'b1',
        },
        {
          id: 'tr',
          kind: 'travel',
          travelKind: 'pass',
          trigger: { type: 'at', t: 0.5 },
          timing: { speed: 10 },
          path: line([0, 0], [60, 34]),
        },
      ]),
    )
    const c = compile(doc)
    const s = stateAt(c, doc, 0.5)
    // holder at x=45 at t=0.5 → ball starts at 45+offset
    expect(s.ball.pos.x).toBeCloseTo(45 + 1.1, 3)
    expect(s.ball.status).toBe('travel')
  })
})

describe('Scenario B — user sequence (2026-08-20)', () => {
  it('B1→B2 pass; R1 runs at B2 during the pass; B1 makes a run; B2 passes back to B1 BEFORE R2 arrives to press', () => {
    const doc = baseDoc()
    doc.ball.initialHolderId = 'b1'
    const tl = doc.scenes[0]!.timeline
    // Ball: b1 holds → pass to b2 at 0.5 (18m/15m/s ≈ 1.2s → arrives ~1.7) → b2 holds → pass back to b1 at receive+0.8 → b1 holds
    tl.tracks.push(
      track('ball', 'ball', [
        {
          id: 'hold1',
          kind: 'possessed',
          trigger: { type: 'at', t: 0 },
          timing: { duration: 0 },
          holderId: 'b1',
        },
        {
          id: 'pass1',
          kind: 'travel',
          travelKind: 'pass',
          trigger: { type: 'at', t: 0.5 },
          timing: { speed: 15 },
          path: line([40, 34], [50, 20]),
          receiverId: 'b2',
        },
        {
          id: 'hold2',
          kind: 'possessed',
          trigger: { type: 'afterSegment', segmentId: 'pass1', anchor: 'end', offset: 0 },
          timing: { duration: 0 },
          holderId: 'b2',
        },
        {
          id: 'pass2',
          kind: 'travel',
          travelKind: 'pass',
          trigger: {
            type: 'onEvent',
            event: { kind: 'ball.received', segmentId: 'pass1' },
            offset: 0.8,
          },
          timing: { speed: 15 },
          path: line([50, 20], [58, 30]),
          receiverId: 'b1',
        },
        {
          id: 'hold3',
          kind: 'possessed',
          trigger: { type: 'afterSegment', segmentId: 'pass2', anchor: 'end', offset: 0 },
          timing: { duration: 0 },
          holderId: 'b1',
        },
      ]),
    )
    // R1 closes down b2 as soon as the first pass is released
    tl.tracks.push(
      track('r1', 'player', [
        {
          id: 'r1-close',
          kind: 'move',
          trigger: {
            type: 'onEvent',
            event: { kind: 'ball.released', segmentId: 'pass1' },
            offset: 0,
          },
          timing: { speed: 6 },
          path: line([60, 24], [52, 21]),
        },
      ]),
    )
    // B1 makes a run after releasing the ball (third-man style)
    tl.tracks.push(
      track('b1', 'player', [
        {
          id: 'b1-run',
          kind: 'move',
          trigger: {
            type: 'onEvent',
            event: { kind: 'ball.released', segmentId: 'pass1' },
            offset: 0.3,
          },
          timing: { speed: 5 },
          path: line([40, 34], [58, 30]),
        },
      ]),
    )
    // R2 presses the new carrier 0.4s after b2 receives — takes ~4s to arrive (24m at 6m/s)
    tl.tracks.push(
      track('r2', 'player', [
        {
          id: 'r2-press',
          kind: 'move',
          trigger: {
            type: 'onEvent',
            event: { kind: 'ball.received', segmentId: 'pass1' },
            offset: 0.4,
          },
          timing: { speed: 6 },
          path: line([62, 40], [51, 21]),
        },
      ]),
    )

    const c = compile(doc)
    expect(c.issues.filter((i) => i.level === 'error')).toEqual([])
    const p1 = c.segmentTimes.pass1!
    const p2 = c.segmentTimes.pass2!
    const r2 = c.segmentTimes['r2-press']!
    // order: pass1 released → r1 starts at same time → b1 run +0.3 → pass1 arrives → r2 starts +0.4 → pass2 leaves +0.8 (before r2 arrives)
    expect(c.segmentTimes['r1-close']!.start).toBeCloseTo(p1.start)
    expect(c.segmentTimes['b1-run']!.start).toBeCloseTo(p1.start + 0.3)
    expect(r2.start).toBeCloseTo(p1.end + 0.4)
    expect(p2.start).toBeCloseTo(p1.end + 0.8)
    expect(p2.start).toBeLessThan(r2.end) // pass back happens before the press arrives
    // ball ownership through the sequence
    expect(stateAt(c, doc, p1.start - 0.01).ball.holderId).toBe('b1')
    expect(stateAt(c, doc, (p1.start + p1.end) / 2).ball.status).toBe('travel')
    expect(stateAt(c, doc, p1.end + 0.1).ball.holderId).toBe('b2')
    expect(stateAt(c, doc, p2.end + 0.1).ball.holderId).toBe('b1')
    // r1 is moving during the first pass
    expect(stateAt(c, doc, (p1.start + p1.end) / 2).players.r1!.moving).toBe(true)
    // lofted pass has height, ground pass none
    expect(stateAt(c, doc, (p1.start + p1.end) / 2).ball.height).toBe(0)
  })
})

describe('reactive opponent (ADR-0007 Phase 1)', () => {
  it('generates press/cover/shape segments for the defending team, anchored to ball events; deterministic & idempotent', async () => {
    const { generateReaction, stripGenerated } = await import('./opponent')
    const doc = baseDoc()
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
          trigger: { type: 'at', t: 1 },
          timing: { speed: 15 },
          path: line([40, 34], [50, 20]),
          receiverId: 'b2',
        },
        {
          id: 'h2',
          kind: 'possessed',
          trigger: { type: 'afterSegment', segmentId: 'p1', anchor: 'end', offset: 0 },
          timing: { duration: 0 },
          holderId: 'b2',
        },
      ]),
    )
    const r1 = generateReaction(doc, { teamId: 'R', intensity: 0.6 })
    const r2 = generateReaction(doc, { teamId: 'R', intensity: 0.6 })
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2))
    expect(Object.keys(r1.segments).sort()).toEqual(['r1', 'r2'])
    const all = Object.values(r1.segments).flat()
    expect(all.length).toBeGreaterThanOrEqual(3)
    expect(all.some((s) => s.trigger.type === 'onEvent')).toBe(true)
    expect(r1.summary.some((s) => s.role === 'press')).toBe(true)
    // Inserting them compiles without errors and the pressers move toward the ball carrier
    const doc2 = structuredClone(doc)
    for (const [pid, segs] of Object.entries(r1.segments))
      doc2.scenes[0]!.timeline.tracks.push(track(pid, 'player', segs))
    const c = compile(doc2)
    expect(c.issues.filter((i) => i.level === 'error')).toEqual([])
    const passEnd = c.segmentTimes.p1!.end
    const s = stateAt(c, doc2, passEnd + 2.5)
    const dR1 = Math.hypot(
      s.players.r1!.pos.x - s.players.b2!.pos.x,
      s.players.r1!.pos.y - s.players.b2!.pos.y,
    )
    const dR1Home = Math.hypot(60 - 50, 24 - 20)
    expect(dR1).toBeLessThan(dR1Home)
    // strip removes generated segments
    const stripped = stripGenerated(doc2, 'R')
    expect(stripped.scenes[0]!.timeline.tracks.some((t) => t.entityId === 'r1')).toBe(false)
  })
})

describe('stroke beautify + decel timing (round 4)', () => {
  it('nearly straight jittery stroke → exactly 2 waypoints, axis-snapped', async () => {
    const { beautifyStroke } = await import('./path')
    const raw = Array.from({ length: 40 }, (_, i) => ({
      x: 10 + i * 0.5,
      y: 20 + Math.sin(i) * 0.3,
    }))
    const w = beautifyStroke(raw, (i) => `w${i}`)
    expect(w).toHaveLength(2)
    expect(w[1]!.p.y).toBeCloseTo(20, 6) // snapped horizontal
    expect(w[1]!.p.x).toBeCloseTo(10 + 39 * 0.5, 1)
  })
  it('curved stroke → ≤ 6 smooth waypoints with handles, endpoints preserved', async () => {
    const { beautifyStroke } = await import('./path')
    const raw = Array.from({ length: 80 }, (_, i) => {
      const a = (i / 79) * Math.PI
      return { x: 30 + 20 * Math.cos(a) + (i % 3) * 0.15, y: 30 + 12 * Math.sin(a) }
    })
    const w = beautifyStroke(raw, (i) => `w${i}`)
    expect(w.length).toBeGreaterThanOrEqual(3)
    expect(w.length).toBeLessThanOrEqual(6)
    expect(w.some((x) => x.handleOut || x.handleIn)).toBe(true)
    expect(w[0]!.p).toEqual(raw[0])
    expect(w[w.length - 1]!.p.x).toBeCloseTo(raw[79]!.x, 6)
  })
  it('decel timing: flung ball slows to a stop; duration = v0/a when path is long enough', () => {
    const doc = baseDoc()
    doc.scenes[0]!.timeline.tracks.push(
      track('ball', 'ball', [
        {
          id: 'fl',
          kind: 'travel',
          travelKind: 'loose',
          trigger: { type: 'at', t: 0 },
          timing: { speed: 10, decel: 5 },
          path: line([0, 0], [20, 0]),
        },
      ]),
    )
    const c = compile(doc)
    const tm = c.segmentTimes.fl!
    expect(tm.end - tm.start).toBeCloseTo(2, 6) // 10/5
    // stop distance = 100/10 = 10 m  → ends at x=10 although path is 20 m long
    expect(stateAt(c, doc, 2.5).ball.pos.x).toBeCloseTo(10, 3)
    // decelerating: first half covers more distance than the second half
    const x1 = stateAt(c, doc, 1).ball.pos.x
    expect(x1).toBeCloseTo(7.5, 3)
  })
})
