import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from '@/domain'
import { carryOffset, compile } from '@/engine/compile'
import { applyFormations, seedDefaultTeams } from './commands'
import { EditorCore } from './editorCore'
import { findTrack, makePath } from './segmentCommands'
import {
  addStepPass,
  addStepRun,
  clearAllMovements,
  clearEntityMovements,
  clearStep,
  removeStepSegment,
  setSegmentStep,
  stepCounts,
  stepStart,
  stepWindow,
} from './stepCommands'

function filled() {
  const core = new EditorCore(
    seedDefaultTeams(createEmptyDocument({ id: 'd', now: '2026-08-19T00:00:00.000Z' })),
  )
  const [home, away] = core.getDocument().teams
  applyFormations(core, [
    { teamId: home!.id, formationId: '4-3-3' },
    { teamId: away!.id, formationId: '4-4-2' },
  ])
  return core
}

describe('step model (ADR-0009)', () => {
  it('same step starts together; the next step starts when the slowest one ends', () => {
    const core = filled()
    const d = core.getDocument()
    const [a, b, c] = d.players
    const r1 = addStepRun(
      core,
      a!.id,
      makePath([a!.home, { x: a!.home.x + 5, y: a!.home.y }]).waypoints,
      1,
    )
    const r2 = addStepRun(
      core,
      b!.id,
      makePath([b!.home, { x: b!.home.x + 20, y: b!.home.y }]).waypoints,
      1,
    )
    const r3 = addStepRun(
      core,
      c!.id,
      makePath([c!.home, { x: c!.home.x + 5, y: c!.home.y }]).waypoints,
      2,
    )
    const cm = compile(core.getDocument())
    expect(cm.issues.filter((i) => i.level === 'error')).toHaveLength(0)
    expect(cm.segmentTimes[r1]!.start).toBe(0)
    expect(cm.segmentTimes[r2]!.start).toBe(0)
    // step 2 starts when the 20m run (slowest of step 1) ends
    expect(cm.segmentTimes[r3]!.start).toBeCloseTo(cm.segmentTimes[r2]!.end, 1)
  })

  it('a pass gets holder + receiver and participates in the step order; renumbering relayouts', () => {
    const core = filled()
    const d = core.getDocument()
    const holder = d.players.find((p) => p.id === d.ball.initialHolderId)!
    const mate = d.players.find((p) => p.teamId === holder.teamId && p.id !== holder.id)!
    const runId = addStepRun(
      core,
      mate.id,
      makePath([mate.home, { x: mate.home.x + 10, y: mate.home.y }]).waypoints,
      1,
    )
    const passId = addStepPass(
      core,
      makePath([d.ball.home, { x: mate.home.x + 10, y: mate.home.y }]).waypoints,
      2,
      holder.id,
    )
    let cm = compile(core.getDocument())
    expect(cm.issues.filter((i) => i.level === 'error')).toHaveLength(0)
    expect(cm.segmentTimes[passId]!.start).toBeCloseTo(cm.segmentTimes[runId]!.end, 1)
    const track = findTrack(core.getDocument(), core.getDocument().ball.id)!
    const pass = track.segments.find((s) => s.id === passId)!
    expect(pass.kind === 'travel' && pass.receiverId).toBe(mate.id) // runner stands at the end
    // renumber the pass into step 1 → starts at 0 with the run
    setSegmentStep(core, passId, 1)
    cm = compile(core.getDocument())
    expect(cm.segmentTimes[passId]!.start).toBe(0)
    expect(stepCounts(core.getDocument())[0]).toBe(2)
    expect(stepStart(core.getDocument(), 1)).toBe(0)
  })

  it('deleting a movement relayouts the remaining steps in one undo step', () => {
    const core = filled()
    const d = core.getDocument()
    const [a, b] = d.players
    const r1 = addStepRun(
      core,
      a!.id,
      makePath([a!.home, { x: a!.home.x + 20, y: a!.home.y }]).waypoints,
      1,
    )
    const r2 = addStepRun(
      core,
      b!.id,
      makePath([b!.home, { x: b!.home.x + 5, y: b!.home.y }]).waypoints,
      2,
    )
    const before = compile(core.getDocument()).segmentTimes[r2]!.start
    expect(before).toBeGreaterThan(0)
    const undoDepth = core.historyLength
    removeStepSegment(core, r1)
    const cm = compile(core.getDocument())
    expect(cm.segmentTimes[r2]!.start).toBe(0) // step 1 empty → step 2 starts immediately
    expect(core.historyLength).toBe(undoDepth + 1)
    core.undo()
    expect(compile(core.getDocument()).segmentTimes[r2]!.start).toBeCloseTo(before, 5)
  })

  it('auto-generated (gen-) reactions keep their event anchors through a relayout', async () => {
    const core = filled()
    const d = core.getDocument()
    const holder = d.players.find((p) => p.id === d.ball.initialHolderId)!
    const mate = d.players.find((p) => p.teamId === holder.teamId && p.id !== holder.id)!
    addStepPass(core, makePath([d.ball.home, mate.home]).waypoints, 1, holder.id)
    const { applyReaction } = await import('./moreCommands')
    const away = core.getDocument().teams[1]!
    const n = applyReaction(core, { teamId: away.id, intensity: 0.6, reactionDelay: 0.3 })
    expect(n).toBeGreaterThan(0)
    const gen = core
      .getDocument()
      .scenes[0]!.timeline.tracks.flatMap((t) => t.segments)
      .filter((s) => s.id.startsWith('gen-'))
    // add another authored run (relayout runs) → gen triggers untouched
    const [p] = core.getDocument().players
    addStepRun(core, p!.id, makePath([p!.home, { x: p!.home.x + 6, y: p!.home.y }]).waypoints, 2)
    const genAfter = core
      .getDocument()
      .scenes[0]!.timeline.tracks.flatMap((t) => t.segments)
      .filter((s) => s.id.startsWith('gen-'))
    expect(genAfter.map((s) => s.trigger)).toEqual(gen.map((s) => s.trigger))
    expect(compile(core.getDocument()).issues.filter((i) => i.level === 'error')).toHaveLength(0)
  })
})

describe('stepWindow (PLAN-005 M1)', () => {
  it('parallel segments share the start; the window ends with the slowest member', () => {
    const core = filled()
    const d = core.getDocument()
    const [a, b, c] = d.players
    addStepRun(core, a!.id, makePath([a!.home, { x: a!.home.x + 5, y: a!.home.y }]).waypoints, 1)
    addStepRun(core, b!.id, makePath([b!.home, { x: b!.home.x + 20, y: b!.home.y }]).waypoints, 1)
    const r3 = addStepRun(
      core,
      c!.id,
      makePath([c!.home, { x: c!.home.x + 5, y: c!.home.y }]).waypoints,
      2,
    )
    const doc = core.getDocument()
    const w1 = stepWindow(doc, 1)!
    expect(w1.start).toBe(0)
    const cm = compile(doc)
    // step 1 ends with its slowest (= step 2's start), same-end rule included
    expect(w1.end).toBeCloseTo(cm.segmentTimes[r3]!.start, 5)
    const w2 = stepWindow(doc, 2)!
    expect(w2.start).toBeCloseTo(w1.end, 5)
    expect(w2.end).toBeGreaterThan(w2.start)
    expect(stepStart(doc, 2)).toBeCloseTo(w2.start, 5)
  })

  it('an unused step has no window; relayout keeps windows contiguous', () => {
    const core = filled()
    const d = core.getDocument()
    const [a, b] = d.players
    expect(stepWindow(core.getDocument(), 3)).toBeNull()
    const r1 = addStepRun(
      core,
      a!.id,
      makePath([a!.home, { x: a!.home.x + 8, y: a!.home.y }]).waypoints,
      1,
    )
    addStepRun(core, b!.id, makePath([b!.home, { x: b!.home.x + 8, y: b!.home.y }]).waypoints, 2)
    // renumber step 1 -> 4: windows re-derive, still contiguous from 0
    setSegmentStep(core, r1, 4)
    const doc = core.getDocument()
    const w2 = stepWindow(doc, 2)!
    const w4 = stepWindow(doc, 4)!
    expect(w2.start).toBe(0)
    expect(w4.start).toBeCloseTo(w2.end, 5)
    expect(stepWindow(doc, 1)).toBeNull()
  })
})

describe('partial clears (PLAN-005 M2, A-06)', () => {
  it('clearStep removes one step in ONE undo entry and relayouts the rest', () => {
    const core = filled()
    const d = core.getDocument()
    const [a, b, c] = d.players
    addStepRun(core, a!.id, makePath([a!.home, { x: a!.home.x + 8, y: a!.home.y }]).waypoints, 1)
    addStepRun(core, b!.id, makePath([b!.home, { x: b!.home.x + 8, y: b!.home.y }]).waypoints, 1)
    const r3 = addStepRun(
      core,
      c!.id,
      makePath([c!.home, { x: c!.home.x + 8, y: c!.home.y }]).waypoints,
      2,
    )
    const before = core.getDocument()
    const n = clearStep(core, 1)
    expect(n).toBe(2)
    const after = core.getDocument()
    expect(stepCounts(after)[0]).toBe(0)
    // remaining step-2 run relayouts to start at 0
    const cm = compile(after)
    expect(cm.segmentTimes[r3]!.start).toBe(0)
    core.undo() // ONE undo restores both removed movements
    expect(core.getDocument().scenes[0]!.timeline.tracks).toEqual(before.scenes[0]!.timeline.tracks)
    expect(stepCounts(core.getDocument())[0]).toBe(2)
  })

  it('clearEntityMovements removes only that entity; clearStep(3) on empty step is a no-op', () => {
    const core = filled()
    const d = core.getDocument()
    const [a, b] = d.players
    addStepRun(core, a!.id, makePath([a!.home, { x: a!.home.x + 8, y: a!.home.y }]).waypoints, 1)
    addStepRun(core, b!.id, makePath([b!.home, { x: b!.home.x + 8, y: b!.home.y }]).waypoints, 1)
    const rev = core.getRevision()
    expect(clearStep(core, 3)).toBe(0)
    expect(core.getRevision()).toBe(rev) // no empty undo entry
    expect(clearEntityMovements(core, a!.id)).toBe(1)
    expect(stepCounts(core.getDocument())[0]).toBe(1) // b's run survives
  })

  it('clearAllMovements keeps formation and ball but drops passes + follower possession', () => {
    const core = filled()
    const d0 = core.getDocument()
    const holder = d0.players.find((p) => p.id === d0.ball.initialHolderId)!
    const mate = d0.players.find((p) => p.teamId === holder.teamId && p.id !== holder.id)!
    addStepRun(
      core,
      mate.id,
      makePath([mate.home, { x: mate.home.x + 10, y: mate.home.y }]).waypoints,
      1,
    )
    addStepPass(core, makePath([d0.ball.home, mate.home]).waypoints, 2, holder.id)
    const players = core.getDocument().players.length
    const n = clearAllMovements(core)
    expect(n).toBeGreaterThanOrEqual(2)
    const after = core.getDocument()
    expect(after.players.length).toBe(players) // formation untouched
    const ballTrack = findTrack(after, after.ball.id)
    // no dangling travel/possession pair left behind
    expect(ballTrack?.segments.filter((s) => 'path' in s) ?? []).toHaveLength(0)
    const cm = compile(after)
    expect(cm.issues.filter((i) => i.level === 'error')).toHaveLength(0)
    core.undo()
    expect(stepCounts(core.getDocument()).reduce((x, y) => x + y, 0)).toBe(2)
  })
})

describe('360-degree carry direction (user 2026-08-20)', () => {
  it('carryOffset keeps the direction and clamps the distance to [2.0, 2.6]m', () => {
    expect(carryOffset({ x: -3, y: 0 })).toEqual({ x: -2.6, y: 0 })
    expect(carryOffset({ x: 0, y: 0.2 })).toEqual({ x: 0, y: 2 })
    expect(carryOffset({ x: 0, y: 0 })).toEqual({ x: 1.75, y: 1.15 }) // degenerate -> classic
  })

  it('dropping the ball LEFT of a player holds it on the left, not hardcoded right', async () => {
    const core = filled()
    const d = core.getDocument()
    const p = d.players[0]!
    const { moveBallStartInDraft } = await import('./segmentCommands')
    core.transaction('Move ball', (dd) => {
      moveBallStartInDraft(dd as never, { x: p.home.x - 1.2, y: p.home.y }, p.id)
    })
    const doc = core.getDocument()
    const { stateAt } = await import('@/engine/stateAt')
    const rs = stateAt(compile(doc), doc, 0)
    expect(rs.ball.holderId).toBe(p.id)
    expect(rs.ball.pos.x).toBeLessThan(p.home.x) // left side preserved
  })

  it('a receiver keeps the ball on the side the pass arrived from', () => {
    const core = filled()
    const d = core.getDocument()
    const holder = d.players.find((p) => p.id === d.ball.initialHolderId)!
    const mate = d.players.find((p) => p.teamId === holder.teamId && p.id !== holder.id)!
    // pass lands 1m to the LEFT of the mate
    addStepPass(
      core,
      makePath([d.ball.home, { x: mate.home.x - 1.0, y: mate.home.y }]).waypoints,
      1,
      holder.id,
    )
    const doc = core.getDocument()
    const track = findTrack(doc, doc.ball.id)!
    const recv = track.segments.find((s) => s.kind === 'possessed' && s.holderId === mate.id) as {
      offset?: { x: number; y: number }
    }
    expect(recv?.offset).toBeDefined()
    expect(recv.offset!.x).toBeLessThan(0) // held on the arrival side
  })
})

describe('natural speed within a step (user 2026-08-20 final)', () => {
  it('every member runs at natural speed; short ones finish early; the step still ends with the slowest', () => {
    const core = filled()
    const d = core.getDocument()
    const [a, b, c] = d.players
    const short = addStepRun(
      core,
      a!.id,
      makePath([a!.home, { x: a!.home.x + 2, y: a!.home.y }]).waypoints, // 2m
      1,
    )
    const long = addStepRun(
      core,
      b!.id,
      makePath([b!.home, { x: b!.home.x + 28, y: b!.home.y }]).waypoints, // 28m
      1,
    )
    const next = addStepRun(
      core,
      c!.id,
      makePath([c!.home, { x: c!.home.x + 5, y: c!.home.y }]).waypoints,
      2,
    )
    const cm = compile(core.getDocument())
    const tShort = cm.segmentTimes[short]!
    const tLong = cm.segmentTimes[long]!
    // same start
    expect(tShort.start).toBe(0)
    expect(tLong.start).toBe(0)
    // short one runs at NATURAL speed (2m / 7m/s)
    expect(tShort.end - tShort.start).toBeCloseTo(2 / 7, 1)
    expect(tShort.end).toBeLessThan(tLong.end)
    // the NEXT step still waits for the slowest member
    expect(cm.segmentTimes[next]!.start).toBeCloseTo(tLong.end, 1)
    // and both members run at their own natural pace
    expect(tLong.end - tLong.start).toBeCloseTo(28 / 7, 1)
  })
})
