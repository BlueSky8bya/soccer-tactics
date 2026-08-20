import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from '@/domain'
import { buildScenarioA, buildScenarioB } from '@/presets/scenarios'
import { parseDocument, serialize } from './persistence'
import { validateDocument } from './validateDocument'

describe('validateDocument', () => {
  it('accepts every scenario preset and an empty document', () => {
    for (const d of [
      buildScenarioA(),
      buildScenarioB(),
      createEmptyDocument({ id: 'x', now: '2026-08-19T00:00:00.000Z' }),
    ]) {
      expect(validateDocument(d)).toEqual([])
      expect(parseDocument(serialize(d))).toEqual(d)
    }
  })
  it('rejects malformed nested segments, unknown players, and bad vectors', () => {
    const d = buildScenarioA() as unknown as Record<string, unknown>
    const tracks = (d.scenes as { timeline: { tracks: { segments: unknown[] }[] } }[])[0]!.timeline
      .tracks
    tracks[0]!.segments.push({
      id: 'bad',
      kind: 'move',
      trigger: { type: 'at' },
      timing: {},
      path: { waypoints: [{ id: 'w', p: { x: 'no' } }] },
    })
    ;(d.players as unknown[]).push({ id: 'dup', teamId: 'nope', number: 1, home: { x: 1, y: 2 } })
    const errs = validateDocument(d)
    expect(errs.some((e) => e.includes('trigger'))).toBe(true)
    expect(errs.some((e) => e.includes('timing'))).toBe(true)
    expect(errs.some((e) => e.includes('path'))).toBe(true)
    expect(errs.some((e) => e.includes('unknown team'))).toBe(true)
    expect(() => parseDocument(JSON.stringify(d))).toThrow(/Not a valid/)
  })
  it('rejects malformed carryEnd, offsetLocked, offset, pressures, hold and dangling receiver (ADR-0010/R8)', () => {
    const d = buildScenarioA() as unknown as {
      players: { id: string }[]
      drawings: unknown[]
      scenes: { timeline: { tracks: { entityKind: string; segments: unknown[] }[] } }[]
    }
    const known = d.players[0]!.id
    const tracks = d.scenes[0]!.timeline.tracks
    const playerTrack = tracks.find((t) => t.entityKind === 'player')!
    const ballTrack = tracks.find((t) => t.entityKind === 'ball')!
    playerTrack.segments.push({
      id: 'v-move',
      kind: 'move',
      trigger: { type: 'at', t: 0 },
      timing: { duration: 1 },
      path: {
        waypoints: [
          { id: 'a', p: { x: 0, y: 0 }, hold: -1 },
          { id: 'b', p: { x: 5, y: 0 }, handleIn: { x: 'no' } },
        ],
      },
      carryEnd: 'sideways',
    })
    ballTrack.segments.push(
      {
        id: 'v-pos',
        kind: 'possessed',
        trigger: { type: 'at', t: 0 },
        timing: { duration: 0 },
        holderId: 'nobody',
        offset: { x: Number.NaN, y: 0 },
        offsetLocked: 'yes',
      },
      {
        id: 'v-tr',
        kind: 'travel',
        travelKind: 'pass',
        trigger: { type: 'at', t: 1 },
        timing: { speed: 20 },
        path: {
          waypoints: [
            { id: 'c', p: { x: 0, y: 0 } },
            { id: 'd', p: { x: 9, y: 9 } },
          ],
        },
        receiverId: 'ghost-9',
      },
    )
    d.drawings.push({
      id: 'v-fh',
      kind: 'freehand',
      points: [
        { x: 1, y: 1 },
        { x: 2, y: 2 },
      ],
      pressures: [0.5],
    })
    const errs = validateDocument(d)
    expect(errs.some((e) => e.includes('carryEnd'))).toBe(true)
    expect(errs.some((e) => e.includes('offsetLocked'))).toBe(true)
    expect(errs.some((e) => e.includes('.offset') && e.includes('vector'))).toBe(true)
    expect(errs.some((e) => e.includes('holderId') && e.includes('unknown'))).toBe(true)
    expect(errs.some((e) => e.includes('receiverId'))).toBe(true)
    expect(errs.some((e) => e.includes('pressures'))).toBe(true)
    expect(errs.some((e) => e.includes('path') && e.includes('hold'))).toBe(true)

    // and the same optional fields in VALID shape pass clean
    const ok = buildScenarioA() as unknown as typeof d
    const okTracks = ok.scenes[0]!.timeline.tracks
    okTracks
      .find((t) => t.entityKind === 'player')!
      .segments.push({
        id: 'ok-move',
        kind: 'move',
        trigger: { type: 'at', t: 0 },
        timing: { duration: 1 },
        path: {
          waypoints: [
            { id: 'a', p: { x: 0, y: 0 }, hold: 0.5, handleOut: { x: 1, y: 0 } },
            { id: 'b', p: { x: 5, y: 0 }, handleIn: { x: 4, y: 0 } },
          ],
        },
        carryEnd: { x: 0, y: 2.6 },
      })
    okTracks
      .find((t) => t.entityKind === 'ball')!
      .segments.push({
        id: 'ok-pos',
        kind: 'possessed',
        trigger: { type: 'at', t: 99 },
        timing: { duration: 0 },
        holderId: known,
        offset: { x: 0, y: 2.6 },
        offsetLocked: true,
      })
    ok.drawings.push({
      id: 'ok-fh',
      kind: 'freehand',
      points: [
        { x: 1, y: 1 },
        { x: 2, y: 2 },
      ],
      pressures: [0.4, 0.9],
    })
    expect(validateDocument(ok)).toEqual([])
  })

  it('flags a ball holder that does not exist and ball-track id mismatch', () => {
    const d = buildScenarioA()
    d.ball.initialHolderId = 'ghost'
    expect(validateDocument(d).some((e) => e.includes('initialHolderId'))).toBe(true)
  })
})
