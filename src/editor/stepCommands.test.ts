import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from '@/domain'
import { compile } from '@/engine/compile'
import { applyFormations, seedDefaultTeams } from './commands'
import { EditorCore } from './editorCore'
import { findTrack, makePath } from './segmentCommands'
import {
  addStepPass,
  addStepRun,
  removeStepSegment,
  setSegmentStep,
  stepCounts,
  stepStart,
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
