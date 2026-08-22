/**
 * IMPLICIT consequence rolls (user 2026-08-22: Alt 없이 경로가 그려져) — a takeaway writes a
 * loose travel so playback stays continuous, but the user placed a ball, they did not draw a
 * path. The flag must survive the document lifecycle, stay out of the authored-movement counts,
 * and dissolve the moment a receiver makes the roll a real pass.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from '@/domain'
import type { TacticDocument } from '@/domain/types'
import { applyFormations, seedDefaultTeams } from './commands'
import { EditorCore } from './editorCore'
import { ensureTrack, makePath, newIdFor, moveBallStartInDraft } from './segmentCommands'
import {
  addStepRun as addStepRunRaw,
  relayoutStepsInDraft,
  resolvePassReceiverInDraft,
  stepCounts,
  truncateBallFromStepInDraft,
} from './stepCommands'
import { validateDocument } from './validateDocument'

function filled() {
  const core = new EditorCore(
    seedDefaultTeams(createEmptyDocument({ id: 'r', now: '2026-08-22T00:00:00.000Z' })),
  )
  const [home, away] = core.getDocument().teams
  applyFormations(core, [
    { teamId: home!.id, formationId: '4-3-3' },
    { teamId: away!.id, formationId: '4-4-2' },
  ])
  return core
}

/** The exact shape the takeaway commit writes: carry one run, then rob at the junction. */
function docWithRoll(dropAt: { x: number; y: number }): TacticDocument {
  const core = filled()
  const p = core.getDocument().players[0]!
  core.transaction('setup', (d) => {
    const doc = d as TacticDocument
    moveBallStartInDraft(doc, p.home, p.id)
    relayoutStepsInDraft(doc)
  })
  const runEnd = { x: p.home.x + 14, y: p.home.y + 3 }
  addStepRunRaw(core, p.id, makePath([p.home, runEnd]).waypoints, 1)
  const doc = JSON.parse(JSON.stringify(core.getDocument())) as TacticDocument
  truncateBallFromStepInDraft(doc, 2)
  ensureTrack(doc, doc.ball.id, 'ball').segments.push({
    id: newIdFor('seg'),
    kind: 'travel',
    travelKind: 'loose',
    implicit: true,
    trigger: { type: 'at', t: 0 },
    timing: { speed: 14 },
    path: {
      waypoints: [
        { id: newIdFor('w'), p: runEnd },
        { id: newIdFor('w'), p: dropAt },
      ],
    },
    step: 2,
  })
  relayoutStepsInDraft(doc)
  return doc
}

const roll = (doc: TacticDocument) =>
  doc.scenes[0]!.timeline.tracks
    .flatMap((t) => t.segments)
    .find((s) => s.kind === 'travel' && s.implicit)

describe('implicit consequence rolls', () => {
  it('validates, survives a save/load round-trip, and rejects a non-boolean flag', () => {
    const doc = docWithRoll({ x: 40, y: 60 })
    expect(validateDocument(doc)).toHaveLength(0)
    const back = JSON.parse(JSON.stringify(doc)) as TacticDocument
    expect(validateDocument(back)).toHaveLength(0)
    expect(roll(back)?.kind).toBe('travel')
    const bad = JSON.parse(JSON.stringify(doc)) as TacticDocument
    ;(roll(bad) as { implicit: unknown }).implicit = 'yes'
    expect(validateDocument(bad).some((e) => e.includes('implicit'))).toBe(true)
  })

  it('shows in the step counts like any other movement (user 2026-08-22: 배지도 나오게)', () => {
    const doc = docWithRoll({ x: 40, y: 60 })
    // step 1 has the run; step 2 holds the roll — it plays there, so the bar says so
    expect(stepCounts(doc)[1]).toBe(1)
  })

  it('dies with its cause: no possession before it fires → the roll is removed', () => {
    const doc = docWithRoll({ x: 40, y: 60 })
    expect(roll(doc)).toBeTruthy()
    // the user then takes the INITIAL ball away too — the carry that caused the roll is gone
    moveBallStartInDraft(doc, { x: 44, y: 60 }, null)
    relayoutStepsInDraft(doc)
    expect(roll(doc)).toBeUndefined()
    expect(validateDocument(doc)).toHaveLength(0)
  })

  it('turns into a REAL (visible) pass the moment a receiver takes it', () => {
    const other = filled().getDocument().players[1]!
    const doc = docWithRoll({ x: other.home.x, y: other.home.y })
    const rl = roll(doc)!
    resolvePassReceiverInDraft(doc, rl.id)
    relayoutStepsInDraft(doc)
    const after = doc.scenes[0]!.timeline.tracks
      .flatMap((t) => t.segments)
      .find((s) => s.id === rl.id)
    expect(after && 'receiverId' in after && after.receiverId).toBeTruthy()
    expect(after && 'implicit' in after && after.implicit).toBeFalsy()
  })
})
