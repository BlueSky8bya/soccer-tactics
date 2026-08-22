/**
 * THE DESTINATION IS A MOMENT, AND IT IS STORED (ADR-0010 D9).
 *
 * The reported defect (사진 1·2, 2026-08-22): the clicked point was never stored, so the endpoint
 * was DERIVED — receiver guessed by distance (including players whose HOME was merely near), pass
 * duration coupled to the step window, endpoint re-anchored to "wherever the receiver is at
 * arrival". The fixed point of that feedback was the receiver's rest, not the user's click: aiming
 * at a step-1 ghost landed on the step-2 spot; aiming at a player's START slid a full leg.
 *
 * Now: an endpoint on a future spot writes `target` (the moment), the arrival is synced to that
 * exact time, and an endpoint anywhere else is a plain flight — received only by whoever is
 * PHYSICALLY there when it arrives.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from '@/domain'
import type { Id, TacticDocument } from '@/domain/types'
import { describeJump, maxBallJump } from '@/engine/ballContinuity'
import { compile } from '@/engine/compile'
import { stateAt } from '@/engine/stateAt'
import { seedDefaultTeams } from './commands'
import { EditorCore } from './editorCore'
import { makePath, moveBallStartInDraft, removeSegmentInDraft } from './segmentCommands'
import {
  addStepPass as addStepPassRaw,
  addStepRun as addStepRunRaw,
  momentSpotAt,
  relayoutStepsInDraft,
} from './stepCommands'

/** These commands refuse past step 9; every case here stays well inside, so assert non-null once. */
const addStepRun = (...a: Parameters<typeof addStepRunRaw>): Id => addStepRunRaw(...a)!
const addStepPass = (...a: Parameters<typeof addStepPassRaw>): Id => addStepPassRaw(...a)!

/** The photographed board: #2 holds the ball; both players run two legs. */
function board() {
  const core = new EditorCore(
    seedDefaultTeams(createEmptyDocument({ id: 'r', now: '2026-08-22T00:00:00.000Z' })),
  )
  core.transaction('setup', (d) => {
    const doc = d as TacticDocument
    doc.players.push(
      { id: 'p1', teamId: doc.teams[0]!.id, number: 1, home: { x: 16, y: 46 } },
      { id: 'p2', teamId: doc.teams[0]!.id, number: 2, home: { x: 16, y: 12 } },
    )
    moveBallStartInDraft(doc, { x: 17.7, y: 13.2 }, 'p2')
  })
  addStepRun(core, 'p2', makePath([{ x: 16, y: 12 }, { x: 40, y: 10 }]).waypoints, 1)
  addStepRun(core, 'p2', makePath([{ x: 40, y: 10 }, { x: 70, y: 10 }]).waypoints, 2)
  addStepRun(core, 'p1', makePath([{ x: 16, y: 46 }, { x: 32, y: 30 }]).waypoints, 1)
  addStepRun(core, 'p1', makePath([{ x: 32, y: 30 }, { x: 56, y: 26 }]).waypoints, 2)
  return core
}

const thePass = (core: EditorCore, id: Id) => {
  const doc = core.getDocument()
  const seg = doc.scenes[0]!.timeline.tracks
    .flatMap((t) => t.segments)
    .find((s) => s.id === id)
  if (!seg || seg.kind !== 'travel') throw new Error('no pass')
  const cm = compile(doc)
  const w = seg.path.waypoints
  return {
    seg,
    end: w[w.length - 1]!.p,
    times: cm.segmentTimes[id]!,
    doc,
    cm,
  }
}

const continuous = (doc: TacticDocument) => {
  const j = maxBallJump(doc)
  expect(j === null || j.dist <= j.allowed, j ? describeJump(j) : '').toBe(true)
}

describe('destination moment — the pass goes where the click pointed', () => {
  it('사진 1: aiming at the step-1 ghost arrives AT the step-1 moment, not a leg later', () => {
    const core = board()
    const id = addStepPass(core, makePath([{ x: 17.7, y: 13.2 }, { x: 32, y: 30 }]).waypoints, 1, 'p2', {
      exactStep: true,
    })
    const p = thePass(core, id)
    expect(p.seg.target).toEqual({ entityId: 'p1', step: 1 })
    // arrives exactly when #1's step-1 run ends…
    const run1 = p.cm.segmentTimes[
      p.doc.scenes[0]!.timeline.tracks
        .find((t) => t.entityId === 'p1')!
        .segments.find((s) => 'path' in s && s.step === 1)!.id
    ]!
    expect(p.times.end).toBeCloseTo(run1.end, 1)
    // …at that junction (catch ring), nowhere near the step-2 end (56,26)
    expect(Math.hypot(p.end.x - 32, p.end.y - 30)).toBeLessThan(3)
    expect(Math.hypot(p.end.x - 56, p.end.y - 26)).toBeGreaterThan(15)
    expect(p.seg.receiverId).toBe('p1')
    continuous(p.doc)
  })

  it('사진 2: aiming at a player\'s START is a plain flight to that spot — no receiver teleport', () => {
    const core = board()
    const id = addStepPass(core, makePath([{ x: 17.7, y: 13.2 }, { x: 16, y: 46 }]).waypoints, 1, 'p2', {
      exactStep: true,
    })
    const p = thePass(core, id)
    // the start is not a future spot, so no moment is written…
    expect(p.seg.target).toBeUndefined()
    // …the endpoint stays where the user pointed (the old code slid it 22m to run-1's end)
    expect(Math.hypot(p.end.x - 16, p.end.y - 46)).toBeLessThan(1)
    // …and #1 has left by the time it lands, so nobody receives it
    expect(p.seg.receiverId).toBeUndefined()
    continuous(p.doc)
  })

  it('a pass to where a player actually STANDS at arrival still finds them', () => {
    const core = new EditorCore(
      seedDefaultTeams(createEmptyDocument({ id: 'r', now: '2026-08-22T00:00:00.000Z' })),
    )
    core.transaction('setup', (d) => {
      const doc = d as TacticDocument
      doc.players.push(
        { id: 'p1', teamId: doc.teams[0]!.id, number: 1, home: { x: 60, y: 40 } },
        { id: 'p2', teamId: doc.teams[0]!.id, number: 2, home: { x: 16, y: 12 } },
      )
      moveBallStartInDraft(doc, { x: 17.7, y: 13.2 }, 'p2')
    })
    const id = addStepPass(core, makePath([{ x: 17.7, y: 13.2 }, { x: 60, y: 40 }]).waypoints, 1, 'p2')
    const p = thePass(core, id)
    expect(p.seg.receiverId).toBe('p1')
    continuous(p.doc)
  })

  it('the moment survives byte-idempotent relayout', () => {
    const core = board()
    addStepPass(core, makePath([{ x: 17.7, y: 13.2 }, { x: 32, y: 30 }]).waypoints, 1, 'p2', {
      exactStep: true,
    })
    const doc = core.getDocument()
    const clone = JSON.parse(JSON.stringify(doc)) as TacticDocument
    relayoutStepsInDraft(clone)
    expect(JSON.stringify(clone)).toBe(JSON.stringify(doc))
  })

  it('deleting the targeted run reverts the pass to a plain flight', () => {
    const core = board()
    const id = addStepPass(core, makePath([{ x: 17.7, y: 13.2 }, { x: 32, y: 30 }]).waypoints, 1, 'p2', {
      exactStep: true,
    })
    const runId = core
      .getDocument()
      .scenes[0]!.timeline.tracks.find((t) => t.entityId === 'p1')!
      .segments.find((s) => 'path' in s && s.step === 1)!.id
    core.transaction('delete run', (d) => {
      removeSegmentInDraft(d as TacticDocument, runId)
      relayoutStepsInDraft(d as TacticDocument)
    })
    const p = thePass(core, id)
    expect(p.seg.target).toBeUndefined()
    continuous(p.doc)
  })

  it('a run drawn AFTER a loose pass adopts it via the same moment', () => {
    const core = new EditorCore(
      seedDefaultTeams(createEmptyDocument({ id: 'r', now: '2026-08-22T00:00:00.000Z' })),
    )
    core.transaction('setup', (d) => {
      const doc = d as TacticDocument
      doc.players.push(
        { id: 'p1', teamId: doc.teams[0]!.id, number: 1, home: { x: 16, y: 46 } },
        { id: 'p2', teamId: doc.teams[0]!.id, number: 2, home: { x: 16, y: 12 } },
      )
      moveBallStartInDraft(doc, { x: 17.7, y: 13.2 }, 'p2')
    })
    // pass into empty space first…
    const id = addStepPass(core, makePath([{ x: 17.7, y: 13.2 }, { x: 44, y: 30 }]).waypoints, 1, 'p2')
    expect(thePass(core, id).seg.receiverId).toBeUndefined()
    // …then #1 runs onto it
    addStepRun(core, 'p1', makePath([{ x: 16, y: 46 }, { x: 44, y: 30 }]).waypoints, 1)
    const p = thePass(core, id)
    expect(p.seg.target).toEqual({ entityId: 'p1', step: 1 })
    expect(p.seg.receiverId).toBe('p1')
    continuous(p.doc)
  })

  it('momentSpotAt reads future spots only — never the ball, never a start', () => {
    const core = board()
    const doc = core.getDocument()
    expect(momentSpotAt(doc, { x: 32, y: 30 })).toEqual({ entityId: 'p1', step: 1 })
    expect(momentSpotAt(doc, { x: 70, y: 10 })).toEqual({ entityId: 'p2', step: 2 })
    expect(momentSpotAt(doc, { x: 16, y: 46 })).toBeNull() // a START is not a future spot
    expect(momentSpotAt(doc, { x: 90, y: 60 })).toBeNull()
  })

  it('the ball leaving late for an already-passed moment still flies sanely', () => {
    const core = board()
    // ball leaves after #2's second carry (exact step 3), aimed at #1's step-1 spot — that moment
    // is long gone, so this is a plain flight there; #1 has moved on, nobody receives
    const id = addStepPass(core, makePath([{ x: 72, y: 11 }, { x: 32, y: 30 }]).waypoints, 3, 'p2', {
      exactStep: true,
    })
    const p = thePass(core, id)
    expect(p.times.start).toBeGreaterThan(0.5)
    expect(Math.hypot(p.end.x - 32, p.end.y - 30)).toBeLessThan(3)
    const rs = stateAt(p.cm, p.doc, p.times.end)
    // #1 finished at (56,26); the ball rests loose at the old spot
    expect(rs.ball.holderId).toBeUndefined()
    continuous(p.doc)
  })
})
