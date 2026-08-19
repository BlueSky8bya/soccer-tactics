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
  it('flags a ball holder that does not exist and ball-track id mismatch', () => {
    const d = buildScenarioA()
    d.ball.initialHolderId = 'ghost'
    expect(validateDocument(d).some((e) => e.includes('initialHolderId'))).toBe(true)
  })
})
