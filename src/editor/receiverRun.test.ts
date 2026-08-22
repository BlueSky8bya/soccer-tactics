/**
 * A RECEIVER'S NEXT RUN COMES AFTER THE CATCH, and the pass endpoint belongs to its author.
 *
 * The photographed defect (2026-08-22): #5 receives at step 3, then draws a run — the run was
 * auto-numbered step 1 (before the pass even left), and the arrival anchor dragged the pass 20 m
 * to the run's end. Two rules pin it:
 *
 *  · receiving counts as an engagement (like carrying does for the ball): the catch's step is a
 *    floor for the receiver's next movement;
 *  · the arrival anchor places the catch on the carry ring — centimetres. If the receiver is not
 *    within the receive radius of the DRAWN end at arrival, they are simply not there: the pass
 *    un-receives and lands where it was aimed, it never follows them.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from '@/domain'
import type { Id, TacticDocument } from '@/domain/types'
import { describeJump, maxBallJump } from '@/engine/ballContinuity'
import { compile } from '@/engine/compile'
import { seedDefaultTeams } from './commands'
import { EditorCore } from './editorCore'
import { makePath, moveBallStartInDraft } from './segmentCommands'
import {
  addStepPass as addStepPassRaw,
  addStepRun as addStepRunRaw,
  lastReceivedStep,
  relayoutStepsInDraft,
  setSegmentStep,
} from './stepCommands'

/** These commands refuse past step 9; every case here stays well inside, so assert non-null once. */
const addStepRun = (...a: Parameters<typeof addStepRunRaw>): Id => addStepRunRaw(...a)!
const addStepPass = (...a: Parameters<typeof addStepPassRaw>): Id => addStepPassRaw(...a)!

/** The photographed board: #1 carries through step 2, passes step 3 to #5 standing at home. */
function board() {
  const core = new EditorCore(
    seedDefaultTeams(createEmptyDocument({ id: 'r', now: '2026-08-22T00:00:00.000Z' })),
  )
  core.transaction('setup', (d) => {
    const doc = d as TacticDocument
    doc.players.push(
      { id: 'p1', teamId: doc.teams[0]!.id, number: 1, home: { x: 14, y: 40 } },
      { id: 'p5', teamId: doc.teams[0]!.id, number: 5, home: { x: 85, y: 30 } },
    )
    moveBallStartInDraft(doc, { x: 15.7, y: 41 }, 'p1')
  })
  addStepRun(core, 'p1', makePath([{ x: 14, y: 40 }, { x: 45, y: 44 }]).waypoints, 2)
  const passId = addStepPass(core, makePath([{ x: 46.9, y: 44.5 }, { x: 85, y: 30 }]).waypoints, 3, 'p1')
  return { core, passId }
}

const passOf = (core: EditorCore, id: Id) => {
  const doc = core.getDocument()
  const seg = doc.scenes[0]!.timeline.tracks.flatMap((t) => t.segments).find((s) => s.id === id)
  if (!seg || seg.kind !== 'travel') throw new Error('no pass')
  const w = seg.path.waypoints
  return { seg, end: w[w.length - 1]!.p, doc }
}

const continuous = (doc: TacticDocument) => {
  const j = maxBallJump(doc)
  expect(j === null || j.dist <= j.allowed, j ? describeJump(j) : '').toBe(true)
}

describe('the receiver runs AFTER the catch', () => {
  it('receiving at step 3 makes the next run step 4 — never step 1', () => {
    const { core, passId } = board()
    expect(lastReceivedStep(core.getDocument(), 'p5')).toBe(3)
    const runId = addStepRun(core, 'p5', makePath([{ x: 85, y: 30 }, { x: 100, y: 20 }]).waypoints, 1)
    const doc = core.getDocument()
    const run = doc.scenes[0]!.timeline.tracks.flatMap((t) => t.segments).find((s) => s.id === runId)!
    expect((run as { step?: number }).step).toBe(4)
    // …and the pass still lands where it was aimed (the catch ring around #5's home)
    const p = passOf(core, passId)
    expect(Math.hypot(p.end.x - 85, p.end.y - 30)).toBeLessThan(3)
    expect(p.seg.receiverId).toBe('p5')
    // the run fires after the pass arrives
    const cm = compile(doc)
    expect(cm.segmentTimes[runId]!.start).toBeGreaterThanOrEqual(cm.segmentTimes[passId]!.end - 1e-6)
    continuous(doc)
  })

  it('an EXPLICIT re-step below the catch un-receives instead of re-routing the pass', () => {
    const { core, passId } = board()
    const runId = addStepRun(core, 'p5', makePath([{ x: 85, y: 30 }, { x: 100, y: 20 }]).waypoints, 1)
    // the author insists: the run happens FIRST (a deliberate pre-catch run)
    setSegmentStep(core, runId!, 1)
    const p = passOf(core, passId)
    // #5 is long gone when the ball lands — the pass keeps ITS endpoint and loses its receiver
    expect(Math.hypot(p.end.x - 85, p.end.y - 30)).toBeLessThan(3)
    expect(p.seg.receiverId).toBeUndefined()
    continuous(p.doc)
  })

  it('the un-receive is byte-idempotent', () => {
    const { core } = board()
    const runId = addStepRun(core, 'p5', makePath([{ x: 85, y: 30 }, { x: 100, y: 20 }]).waypoints, 1)
    setSegmentStep(core, runId!, 1)
    const doc = core.getDocument()
    const clone = JSON.parse(JSON.stringify(doc)) as TacticDocument
    relayoutStepsInDraft(clone)
    expect(JSON.stringify(clone)).toBe(JSON.stringify(doc))
  })

  it('a receiver whose run starts only AFTER the catch keeps receiving', () => {
    const { core, passId } = board()
    addStepRun(core, 'p5', makePath([{ x: 85, y: 30 }, { x: 100, y: 20 }]).waypoints, 5)
    const p = passOf(core, passId)
    expect(p.seg.receiverId).toBe('p5')
    continuous(p.doc)
  })
})
