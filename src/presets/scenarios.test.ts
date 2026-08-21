import { describe, expect, it } from 'vitest'
import { describeJump, maxBallJump } from '@/engine/ballContinuity'
import { ATTACH_RADIUS_M, compile } from '@/engine/compile'
import { stateAt } from '@/engine/stateAt'
import { isTacticDocument } from '@/editor/persistence'
import { relayoutStepsInDraft, stepCounts, stepOf, stepWindow } from '@/editor/stepCommands'
import { SCENARIOS } from './scenarios'

describe('scenario presets', () => {
  it('every preset is a valid document that compiles without errors', () => {
    for (const s of SCENARIOS) {
      const doc = s.build()
      expect(isTacticDocument(doc)).toBe(true)
      const c = compile(doc)
      expect(c.issues.filter((issue) => issue.level === 'error')).toEqual([])
      expect(c.duration).toBeGreaterThan(0)
      expect(JSON.parse(JSON.stringify(doc))).toEqual(doc)
    }
  })

  const expectedStepCounts: Record<string, number[]> = {
    'scenario-a': [2, 1, 3],
    'scenario-b': [2, 3],
    'scenario-third-man': [3, 3, 4],
    'scenario-overlap': [4, 5],
    'scenario-buildup': [4, 4, 4],
    'scenario-press-trigger': [1, 3, 1],
    'scenario-transition': [5, 7, 3],
    'scenario-cutback': [6, 6, 2],
  }

  it('uses explicit contiguous steps that survive the production relayout pipeline', () => {
    for (const preset of SCENARIOS) {
      const doc = preset.build()
      const paths = doc.scenes[0]!.timeline.tracks.flatMap((track) =>
        track.segments.filter((segment) => 'path' in segment),
      )
      expect(paths.every((segment) => segment.step !== undefined)).toBe(true)

      const counts = stepCounts(doc)
      while (counts[counts.length - 1] === 0) counts.pop()
      expect(counts, preset.id).toEqual(expectedStepCounts[preset.id])

      const before = JSON.stringify(doc)
      relayoutStepsInDraft(doc)
      expect(JSON.stringify(doc), `${preset.id} relayout must be byte-idempotent`).toBe(before)
    }
  })

  it('keeps every same-step action on one shared playback window', () => {
    for (const preset of SCENARIOS) {
      const doc = preset.build()
      const compiled = compile(doc)
      const paths = doc.scenes[0]!.timeline.tracks.flatMap((track) =>
        track.segments.filter((segment) => 'path' in segment),
      )
      for (const segment of paths) {
        const expected = stepWindow(doc, stepOf(segment))!
        const actual = compiled.segmentTimes[segment.id]!
        expect(actual.start, `${preset.id}/${segment.id} start`).toBeCloseTo(expected.start, 6)
        expect(actual.end, `${preset.id}/${segment.id} end`).toBeCloseTo(expected.end, 6)
      }
    }
  })

  it('anchors every pass at the live ball and meets its receiver at arrival', () => {
    for (const preset of SCENARIOS) {
      const doc = preset.build()
      const compiled = compile(doc)
      const ballTrack = doc.scenes[0]!.timeline.tracks.find(
        (track) => track.entityId === doc.ball.id,
      )
      for (const segment of ballTrack?.segments ?? []) {
        if (segment.kind !== 'travel') continue
        const timing = compiled.segmentTimes[segment.id]!
        const authoredStart = segment.path.waypoints[0]!.p
        const liveStart = stateAt(compiled, doc, timing.start).ball.pos
        expect(
          Math.hypot(authoredStart.x - liveStart.x, authoredStart.y - liveStart.y),
          `${preset.id}/${segment.id} release anchor`,
        ).toBeLessThan(0.05)

        if (!segment.receiverId) continue
        // The pass ends where the ball COMES TO REST on the receiver, not on their centre point.
        // This used to assert the endpoint sat exactly on the player (<0.05 m) — which guaranteed
        // the opposite of what it looked like it was protecting: the carry resolver then re-seated
        // the ball a dribble-length away the instant it landed, and all eight presets teleported
        // the ball by 2–7 m on every catch (invariant B1, user 2026-08-22).
        const endpoint = segment.path.waypoints[segment.path.waypoints.length - 1]!.p
        const restingBall = stateAt(compiled, doc, timing.end).ball.pos
        expect(
          Math.hypot(endpoint.x - restingBall.x, endpoint.y - restingBall.y),
          `${preset.id}/${segment.id} receiver arrival`,
        ).toBeLessThan(0.05)
        const receiver = stateAt(compiled, doc, timing.end).players[segment.receiverId]!.pos
        expect(
          Math.hypot(endpoint.x - receiver.x, endpoint.y - receiver.y),
          `${preset.id}/${segment.id} lands within a touch of the receiver`,
        ).toBeLessThan(ATTACH_RADIUS_M)
      }
    }
  })

  it('never teleports the ball (invariant B1)', () => {
    for (const preset of SCENARIOS) {
      const jump = maxBallJump(preset.build())
      expect(jump === null ? 'continuous' : `${preset.id}: ${describeJump(jump)}`).toBe(
        'continuous',
      )
    }
  })

  it('keeps every player and waypoint on the pitch with readable starting separation', () => {
    for (const preset of SCENARIOS) {
      const doc = preset.build()
      const inside = ({ x, y }: { x: number; y: number }) =>
        x >= 0 && x <= doc.pitch.length && y >= 0 && y <= doc.pitch.width
      expect(
        doc.players.every((player) => inside(player.home)),
        preset.id,
      ).toBe(true)
      for (const track of doc.scenes[0]!.timeline.tracks)
        for (const segment of track.segments)
          if ('path' in segment)
            expect(
              segment.path.waypoints.every((waypoint) => inside(waypoint.p)),
              `${preset.id}/${segment.id} pitch bounds`,
            ).toBe(true)

      for (let i = 0; i < doc.players.length; i++)
        for (let j = i + 1; j < doc.players.length; j++) {
          const a = doc.players[i]!
          const b = doc.players[j]!
          expect(
            Math.hypot(a.home.x - b.home.x, a.home.y - b.home.y),
            `${preset.id}/${a.id}/${b.id} starting separation`,
          ).toBeGreaterThan(3)
        }
    }
  })
})
