import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from '@/domain'
import type { TacticDocument } from '@/domain/types'
import { carryOffset, compile } from '@/engine/compile'
import { applyFormations, seedDefaultTeams } from './commands'
import { EditorCore } from './editorCore'
import { DEFAULT_PLAYER_SPEED, findTrack, makePath, moveTravelEndInDraft } from './segmentCommands'
import {
  addStepPass,
  addStepRun,
  bendMoveWaypointInDraft,
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
    // pass released 1m to the LEFT of the mate — but the ball ARRIVES from the holder's side,
    // and the first touch keeps it on that approach side (CHG-079: release scatter is ignored)
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
    const approach = { x: d.ball.home.x - mate.home.x, y: d.ball.home.y - mate.home.y }
    const dot = recv.offset!.x * approach.x + recv.offset!.y * approach.y
    expect(dot).toBeGreaterThan(0) // held on the side the ball came from
  })
})

describe('same step ends together (user 2026-08-20 최종)', () => {
  it('every member of a step starts AND ends together, lasting the slowest natural duration', () => {
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
    // both end together at the slowest member's natural duration (28m / 7m/s = 4s)
    expect(tShort.end).toBeCloseTo(tLong.end, 1)
    expect(tLong.end - tLong.start).toBeCloseTo(28 / DEFAULT_PLAYER_SPEED, 1)
    // the NEXT step starts right after
    expect(cm.segmentTimes[next]!.start).toBeCloseTo(tLong.end, 1)
  })
})

describe('through ball sync (user 2026-08-20: 미래 지점 패스)', () => {
  it("a pass aimed at the receiver's future spot arrives when the runner does", () => {
    const core = filled()
    const d = core.getDocument()
    const holder = d.players.find((p) => p.id === d.ball.initialHolderId)!
    const runner = d.players.find((p) => p.teamId === holder.teamId && p.id !== holder.id)!
    const target = { x: runner.home.x + 24, y: runner.home.y } // long run (24m -> ~3.4s)
    const runId = addStepRun(core, runner.id, makePath([runner.home, target]).waypoints, 1)
    // pass INTO that future spot, same step (real through ball)
    const passId = addStepPass(core, makePath([d.ball.home, target]).waypoints, 1, holder.id)
    const cm = compile(core.getDocument())
    expect(cm.issues.filter((i) => i.level === 'error')).toHaveLength(0)
    const run = cm.segmentTimes[runId]!
    const pass = cm.segmentTimes[passId]!
    // receiver resolved to the runner via the future-spot fallback
    const trav = core
      .getDocument()
      .scenes[0]!.timeline.tracks.flatMap((t) => t.segments)
      .find((s) => s.id === passId)!
    expect(trav.kind === 'travel' && trav.receiverId).toBe(runner.id)
    // pass ARRIVES together with the runner (never before)
    expect(pass.end).toBeCloseTo(run.end, 1)
  })

  it('junction follow: dragging a movement END carries the chained next run and the arriving pass', () => {
    const core = filled()
    const d = core.getDocument()
    const holder = d.players.find((p) => p.id === d.ball.initialHolderId)!
    const runner = d.players.find((p) => p.teamId === holder.teamId && p.id !== holder.id)!
    const E = { x: runner.home.x + 15, y: runner.home.y }
    const runId = addStepRun(core, runner.id, makePath([runner.home, E]).waypoints, 1)
    const passId = addStepPass(core, makePath([d.ball.home, E]).waypoints, 1, holder.id)
    const run2Id = addStepRun(core, runner.id, makePath([E, { x: E.x, y: E.y - 8 }]).waypoints, 2)
    const seg = (id: string) =>
      core
        .getDocument()
        .scenes[0]!.timeline.tracks.flatMap((t) => t.segments)
        .find((s) => s.id === id)!
    const wps = (id: string) => {
      const s = seg(id)
      if (!('path' in s)) throw new Error('no path')
      return s.path.waypoints
    }
    const passEndBefore = { ...wps(passId)[wps(passId).length - 1]!.p }
    const passStartBefore = { ...wps(passId)[0]!.p }
    const run2StartBefore = { ...wps(run2Id)[0]!.p }
    const run2EndBefore = { ...wps(run2Id)[wps(run2Id).length - 1]!.p }
    const lastWpId = wps(runId)[wps(runId).length - 1]!.id
    core.transaction('bend', (dd) =>
      bendMoveWaypointInDraft(dd as TacticDocument, runId, lastWpId, { x: E.x + 3, y: E.y + 2 }),
    )
    // chained run 2 origin + arriving pass end travel WITH the junction
    expect(wps(run2Id)[0]!.p.x).toBeCloseTo(run2StartBefore.x + 3, 5)
    expect(wps(run2Id)[0]!.p.y).toBeCloseTo(run2StartBefore.y + 2, 5)
    expect(wps(passId)[wps(passId).length - 1]!.p.x).toBeCloseTo(passEndBefore.x + 3, 5)
    expect(wps(passId)[wps(passId).length - 1]!.p.y).toBeCloseTo(passEndBefore.y + 2, 5)
    // far anchors stay put: pass origin, run 2 destination
    expect(wps(passId)[0]!.p.x).toBeCloseTo(passStartBefore.x, 5)
    expect(wps(run2Id)[wps(run2Id).length - 1]!.p.x).toBeCloseTo(run2EndBefore.x, 5)
    expect(wps(run2Id)[wps(run2Id).length - 1]!.p.y).toBeCloseTo(run2EndBefore.y, 5)
  })

  it('junction follow: the pass a holder makes FROM the moved spot keeps its carried origin', () => {
    const core = filled()
    const d = core.getDocument()
    const holder = d.players.find((p) => p.id === d.ball.initialHolderId)!
    const mate = d.players.find((p) => p.teamId === holder.teamId && p.id !== holder.id)!
    const E = { x: holder.home.x + 12, y: holder.home.y }
    const runId = addStepRun(core, holder.id, makePath([holder.home, E]).waypoints, 1)
    // pass drawn from the CARRIED ball at the future spot (ghost-continue authoring)
    const carried = { x: E.x + 1.9, y: E.y + 1.2 }
    const passId = addStepPass(core, makePath([carried, mate.home]).waypoints, 2, holder.id)
    const seg = (id: string) =>
      core
        .getDocument()
        .scenes[0]!.timeline.tracks.flatMap((t) => t.segments)
        .find((s) => s.id === id)!
    const wps = (id: string) => {
      const s = seg(id)
      if (!('path' in s)) throw new Error('no path')
      return s.path.waypoints
    }
    const originBefore = { ...wps(passId)[0]!.p }
    const targetBefore = { ...wps(passId)[wps(passId).length - 1]!.p }
    const lastWpId = wps(runId)[wps(runId).length - 1]!.id
    core.transaction('bend', (dd) =>
      bendMoveWaypointInDraft(dd as TacticDocument, runId, lastWpId, { x: E.x - 2, y: E.y + 3 }),
    )
    expect(wps(passId)[0]!.p.x).toBeCloseTo(originBefore.x - 2, 5)
    expect(wps(passId)[0]!.p.y).toBeCloseTo(originBefore.y + 3, 5)
    // the aimed target never moves
    expect(wps(passId)[wps(passId).length - 1]!.p.x).toBeCloseTo(targetBefore.x, 5)
    expect(wps(passId)[wps(passId).length - 1]!.p.y).toBeCloseTo(targetBefore.y, 5)
  })

  it('a pass landing near a player ATTACHES: end snaps to the carried spot, chained pass follows', () => {
    const core = filled()
    const d = core.getDocument()
    const holder = d.players.find((p) => p.id === d.ball.initialHolderId)!
    const relay = d.players.find((p) => p.teamId === holder.teamId && p.id !== holder.id)!
    // released ~3m short of the relay player — inside RECEIVE_RADIUS_M, but visibly detached
    const released = { x: relay.home.x - 3, y: relay.home.y }
    const passId = addStepPass(core, makePath([d.ball.home, released]).waypoints, 1, holder.id)
    const seg = (id: string) =>
      core
        .getDocument()
        .scenes[0]!.timeline.tracks.flatMap((t) => t.segments)
        .find((s) => s.id === id)!
    const p1 = seg(passId)
    if (!('path' in p1) || p1.kind !== 'travel') throw new Error('not a travel')
    expect(p1.receiverId).toBe(relay.id)
    const end = p1.path.waypoints[p1.path.waypoints.length - 1]!.p
    const dist = Math.hypot(end.x - relay.home.x, end.y - relay.home.y)
    // carried spot: within the carry-offset band, not the raw release point
    expect(dist).toBeGreaterThanOrEqual(1.9)
    expect(dist).toBeLessThanOrEqual(2.7)
    // chained NEXT pass drawn from that ghost starts at the SNAPPED spot and stays glued
    const pass2Id = addStepPass(
      core,
      makePath([{ ...end }, { x: relay.home.x, y: relay.home.y - 20 }]).waypoints,
      2,
      relay.id,
    )
    const p2 = seg(pass2Id)
    if (!('path' in p2)) throw new Error('no path')
    const p1end = seg(passId)
    if (!('path' in p1end)) throw new Error('no path')
    const e1 = p1end.path.waypoints[p1end.path.waypoints.length - 1]!.p
    const s2 = p2.path.waypoints[0]!.p
    expect(Math.hypot(e1.x - s2.x, e1.y - s2.y)).toBeLessThanOrEqual(0.8)
  })

  it('a pass released PAST the receiver still rests on the APPROACH side (first touch)', () => {
    const core = filled()
    const d = core.getDocument()
    const holder = d.players.find((p) => p.id === d.ball.initialHolderId)!
    const relay = d.players.find((p) => p.teamId === holder.teamId && p.id !== holder.id)!
    // ball approaches from the LEFT; the user overshoots and releases 2.5m to the RIGHT
    const released = { x: relay.home.x + 2.5, y: relay.home.y }
    const passId = addStepPass(
      core,
      makePath([d.ball.home, { x: relay.home.x - 8, y: relay.home.y }, released]).waypoints,
      1,
      holder.id,
    )
    const seg = core
      .getDocument()
      .scenes[0]!.timeline.tracks.flatMap((t) => t.segments)
      .find((s2) => s2.id === passId)!
    if (!('path' in seg) || seg.kind !== 'travel') throw new Error('not a travel')
    expect(seg.receiverId).toBe(relay.id)
    const end = seg.path.waypoints[seg.path.waypoints.length - 1]!.p
    // rests on the LEFT (approach) side, never the overshot far side
    expect(end.x).toBeLessThan(relay.home.x)
    const dist = Math.hypot(end.x - relay.home.x, end.y - relay.home.y)
    expect(dist).toBeGreaterThanOrEqual(1.9)
    expect(dist).toBeLessThanOrEqual(2.7)
  })
})

describe('receive-junction orbit (ADR-0010 D3 — audit S1/R9)', () => {
  it('moveTravelEndInDraft changes the endpoint only — curvature, holds and receiver stay', () => {
    const core = filled()
    const d = core.getDocument()
    const holder = d.players.find((p) => p.id === d.ball.initialHolderId)!
    const receiver = d.players.find((p) => p.teamId === holder.teamId && p.id !== holder.id)!
    const thief = d.players.find(
      (p) => p.teamId === holder.teamId && p.id !== holder.id && p.id !== receiver.id,
    )!
    const passId = addStepPass(core, makePath([d.ball.home, receiver.home]).waypoints, 1, holder.id)

    const seg = (id: string) =>
      core
        .getDocument()
        .scenes[0]!.timeline.tracks.flatMap((t) => t.segments)
        .find((x) => x.id === id)!
    const wps = (id: string) => {
      const x = seg(id)
      if (!('path' in x)) throw new Error('no path')
      return x.path.waypoints
    }

    // authored curvature + a HOLD on an interior waypoint — both must survive the orbit
    core.transaction('curve', (dd) => {
      const x = (dd as TacticDocument).scenes[0]!.timeline.tracks.flatMap((t) => t.segments).find(
        (y) => y.id === passId,
      )!
      if ('path' in x) {
        const a = x.path.waypoints[0]!
        const b = x.path.waypoints[x.path.waypoints.length - 1]!
        const mid = { x: (a.p.x + b.p.x) / 2, y: (a.p.y + b.p.y) / 2 + 4 }
        x.path.waypoints.splice(1, 0, {
          id: 'mid-w',
          p: mid,
          handleIn: { x: mid.x - 2, y: mid.y },
          handleOut: { x: mid.x + 2, y: mid.y },
          hold: 0.4,
        })
      }
    })

    const endBefore = { ...wps(passId)[wps(passId).length - 1]!.p }
    // chained next pass drawn FROM the arrival ghost
    const pass2Id = addStepPass(
      core,
      makePath([endBefore, { x: endBefore.x + 15, y: endBefore.y }]).waypoints,
      2,
      receiver.id,
    )
    const pass2StartBefore = { ...wps(pass2Id)[0]!.p }

    // user orbits the arrival to BELOW the receiver; a thief stands even closer to that spot
    const to = { x: receiver.home.x, y: receiver.home.y + 2.6 }
    core.transaction('thief', (dd) => {
      const t = (dd as TacticDocument).players.find((pl) => pl.id === thief.id)!
      t.home = { x: to.x + 0.4, y: to.y }
    })

    const interiorBefore = JSON.stringify(wps(passId).slice(0, -1))
    core.transaction('orbit', (dd) =>
      moveTravelEndInDraft(dd as TacticDocument, passId, to, receiver.home),
    )

    const after = wps(passId)
    const inc = { x: to.x - endBefore.x, y: to.y - endBefore.y }
    // endpoint moved to the chosen ring spot…
    expect(after[after.length - 1]!.p.x).toBeCloseTo(to.x, 6)
    expect(after[after.length - 1]!.p.y).toBeCloseTo(to.y, 6)
    // …and EVERYTHING else is byte-identical: no re-smooth, hold intact (audit S1/R12-B)
    expect(JSON.stringify(after.slice(0, -1))).toBe(interiorBefore)
    // receiver identity NEVER reinterpreted — even with a closer thief (audit R9)
    const p1 = seg(passId)
    expect(p1.kind === 'travel' && p1.receiverId).toBe(receiver.id)
    // follow possession pinned to the chosen side, locked
    const track = findTrack(core.getDocument(), core.getDocument().ball.id)!
    const idx = track.segments.findIndex((x) => x.id === passId)
    const follow = track.segments[idx + 1]!
    expect(follow.kind).toBe('possessed')
    if (follow.kind === 'possessed') {
      expect(follow.holderId).toBe(receiver.id)
      expect(follow.offset!.x).toBeCloseTo(0, 5)
      expect(follow.offset!.y).toBeCloseTo(2.6, 5)
      expect(follow.offsetLocked).toBe(true)
    }
    // the chained pass origin follows the junction — the chain never tears
    expect(wps(pass2Id)[0]!.p.x).toBeCloseTo(pass2StartBefore.x + inc.x, 5)
    expect(wps(pass2Id)[0]!.p.y).toBeCloseTo(pass2StartBefore.y + inc.y, 5)
  })
})
