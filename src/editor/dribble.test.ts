import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from '@/domain'
import { compile } from '@/engine/compile'
import { DRIBBLE_AHEAD_M, stateAt } from '@/engine/stateAt'
import { applyFormations, seedDefaultTeams } from './commands'
import { EditorCore } from './editorCore'
import { makePath, moveBallStartInDraft } from './segmentCommands'
import { addStepRun as addStepRunRaw } from './stepCommands'
import type { Id, TacticDocument } from '@/domain/types'

/** These commands refuse past step 9; every case here stays well inside, so assert non-null once. */
const addStepRun = (...a: Parameters<typeof addStepRunRaw>): Id => addStepRunRaw(...a)!


describe('dribbling carries the ball AHEAD of the run (user 2026-08-21)', () => {
  it('mid-run the possessed ball leads the holder along the heading; at rest it sits beside', () => {
    const core = new EditorCore(
      seedDefaultTeams(createEmptyDocument({ id: 'd', now: '2026-08-21T00:00:00.000Z' })),
    )
    const [home, away] = core.getDocument().teams
    applyFormations(core, [
      { teamId: home!.id, formationId: '4-3-3' },
      { teamId: away!.id, formationId: '4-4-2' },
    ])
    const d = core.getDocument()
    const runner = d.players[3]!
    // give the runner the ball, resting on their LEFT (side carry)
    core.transaction('give', (dd) =>
      moveBallStartInDraft(
        dd as TacticDocument,
        { x: runner.home.x - 2.2, y: runner.home.y },
        runner.id,
      ),
    )
    // straight run to the right, 24m
    addStepRun(
      core,
      runner.id,
      makePath([runner.home, { x: runner.home.x + 24, y: runner.home.y }]).waypoints,
      1,
    )
    const doc = core.getDocument()
    const cm = compile(doc)
    const dur = 24 / 10 // DEFAULT_PLAYER_SPEED

    // just after kickoff: still blending from the side spot (ball NOT ahead yet)
    const early = stateAt(cm, doc, 0.02)
    expect(early.ball.status).toBe('possessed')
    const er = early.players[runner.id]!
    expect(early.ball.pos.x - er.pos.x).toBeLessThan(0.5) // still mostly beside/behind

    // mid-run: ball rides ahead along +x (heading), centred on the running line
    const mid = stateAt(cm, doc, dur / 2)
    const mr = mid.players[runner.id]!
    expect(mid.ball.status).toBe('possessed')
    expect(mid.ball.pos.x - mr.pos.x).toBeCloseTo(DRIBBLE_AHEAD_M, 1)
    expect(Math.abs(mid.ball.pos.y - mr.pos.y)).toBeLessThan(0.15)

    // after the run the ball RESTS OUT FRONT where the dribble left it (user 사진1) — it
    // never swings back to the initial side.
    const after = stateAt(cm, doc, dur + 0.5)
    const ar = after.players[runner.id]!
    expect(after.ball.pos.x - ar.pos.x).toBeCloseTo(DRIBBLE_AHEAD_M, 1)
  })

  it('CHAINED runs keep the ball out front through the step boundary (no side-dip)', () => {
    const core = new EditorCore(
      seedDefaultTeams(createEmptyDocument({ id: 'd2', now: '2026-08-21T00:00:00.000Z' })),
    )
    const [home, away] = core.getDocument().teams
    applyFormations(core, [
      { teamId: home!.id, formationId: '4-3-3' },
      { teamId: away!.id, formationId: '4-4-2' },
    ])
    const d = core.getDocument()
    const runner = d.players[3]!
    core.transaction('give', (dd) =>
      moveBallStartInDraft(
        dd as TacticDocument,
        { x: runner.home.x - 2.2, y: runner.home.y },
        runner.id,
      ),
    )
    // step 1: 20m right, step 2: 20m further right — one continuous dribble
    addStepRun(
      core,
      runner.id,
      makePath([runner.home, { x: runner.home.x + 20, y: runner.home.y }]).waypoints,
      1,
    )
    addStepRun(
      core,
      runner.id,
      makePath([
        { x: runner.home.x + 20, y: runner.home.y },
        { x: runner.home.x + 40, y: runner.home.y },
      ]).waypoints,
      2,
    )
    const doc = core.getDocument()
    const cm = compile(doc)
    const step1Dur = 20 / 10
    // sample densely around the boundary: the ball must STAY ahead (+x) the whole way
    for (const t of [step1Dur - 0.2, step1Dur - 0.05, step1Dur, step1Dur + 0.05, step1Dur + 0.2]) {
      const rs = stateAt(cm, doc, t)
      const pr = rs.players[runner.id]!
      expect(rs.ball.status).toBe('possessed')
      expect(rs.ball.pos.x - pr.pos.x).toBeGreaterThan(DRIBBLE_AHEAD_M - 0.35)
      expect(Math.abs(rs.ball.pos.y - pr.pos.y)).toBeLessThan(0.2)
    }
    // after the chain the ball stays out front too (2026-08-21 v3 rule)
    const done = stateAt(cm, doc, step1Dur * 2 + 0.6)
    const pr = done.players[runner.id]!
    expect(done.ball.pos.x - pr.pos.x).toBeCloseTo(DRIBBLE_AHEAD_M, 1)
  })

  it('TURNING chained runs are position-continuous at the exact boundary (ADR-0010 D2)', () => {
    const core = new EditorCore(
      seedDefaultTeams(createEmptyDocument({ id: 'd3', now: '2026-08-21T00:00:00.000Z' })),
    )
    const [home, away] = core.getDocument().teams
    applyFormations(core, [
      { teamId: home!.id, formationId: '4-3-3' },
      { teamId: away!.id, formationId: '4-4-2' },
    ])
    const d = core.getDocument()
    const runner = d.players[3]!
    core.transaction('give', (dd) =>
      moveBallStartInDraft(
        dd as TacticDocument,
        { x: runner.home.x - 2.2, y: runner.home.y },
        runner.id,
      ),
    )
    // step 1: 20m RIGHT, step 2: 20m DOWN — a 90° turn at the junction
    addStepRun(
      core,
      runner.id,
      makePath([runner.home, { x: runner.home.x + 20, y: runner.home.y }]).waypoints,
      1,
    )
    addStepRun(
      core,
      runner.id,
      makePath([
        { x: runner.home.x + 20, y: runner.home.y },
        { x: runner.home.x + 20, y: runner.home.y + 20 },
      ]).waypoints,
      2,
    )
    const doc = core.getDocument()
    const cm = compile(doc)
    const step1Dur = 20 / 10
    // the ball may not TELEPORT across the boundary: adjacent samples stay within the
    // distance a blend can cover (ball speed ≈ carry radius / ramp), never metres apart
    let prevPos: { x: number; y: number } | undefined
    for (let t = step1Dur - 0.1; t <= step1Dur + 0.45; t += 0.025) {
      const rs = stateAt(cm, doc, t)
      expect(rs.ball.status).toBe('possessed')
      if (prevPos) {
        const jump = Math.hypot(rs.ball.pos.x - prevPos.x, rs.ball.pos.y - prevPos.y)
        expect(jump).toBeLessThan(0.9) // 0.025s step — a 3.2m teleport was the audit's S5 bug
      }
      prevPos = rs.ball.pos
    }
    // and the blend completes: well after the turn the ball leads DOWN (+y)
    const late = stateAt(cm, doc, step1Dur + 1.2)
    const lr = late.players[runner.id]!
    expect(late.ball.pos.y - lr.pos.y).toBeCloseTo(DRIBBLE_AHEAD_M, 1)
    expect(Math.abs(late.ball.pos.x - lr.pos.x)).toBeLessThan(0.2)
  })

  it('carryEnd pin at a middle junction is passed EXACTLY, then blends out (ADR-0010 D2)', () => {
    const core = new EditorCore(
      seedDefaultTeams(createEmptyDocument({ id: 'd4', now: '2026-08-21T00:00:00.000Z' })),
    )
    const [home, away] = core.getDocument().teams
    applyFormations(core, [
      { teamId: home!.id, formationId: '4-3-3' },
      { teamId: away!.id, formationId: '4-4-2' },
    ])
    const d = core.getDocument()
    const runner = d.players[3]!
    core.transaction('give', (dd) =>
      moveBallStartInDraft(
        dd as TacticDocument,
        { x: runner.home.x - 2.2, y: runner.home.y },
        runner.id,
      ),
    )
    addStepRun(
      core,
      runner.id,
      makePath([runner.home, { x: runner.home.x + 20, y: runner.home.y }]).waypoints,
      1,
    )
    addStepRun(
      core,
      runner.id,
      makePath([
        { x: runner.home.x + 20, y: runner.home.y },
        { x: runner.home.x + 40, y: runner.home.y },
      ]).waypoints,
      2,
    )
    // user orbits the ball ghost at the step-1 junction: pin the carry BELOW the runner
    const doc = core.getDocument()
    const run1 = doc.scenes[0]!.timeline.tracks.filter((t) => t.entityId === runner.id)
      .flatMap((t) => t.segments)
      .find((sg) => sg.kind === 'move')!
    core.transaction('pin', (dd) => {
      const sg = (dd as TacticDocument).scenes[0]!.timeline.tracks.flatMap((t) => t.segments).find(
        (x) => x.id === run1.id,
      )
      if (sg && sg.kind === 'move') sg.carryEnd = { x: 0, y: 2.6 }
    })
    const doc2 = core.getDocument()
    const cm = compile(doc2)
    const step1Dur = 20 / 10
    // AT the boundary the ball sits at the pin — the next run starts FROM there
    const atEnd = stateAt(cm, doc2, step1Dur)
    const pr = atEnd.players[runner.id]!
    expect(atEnd.ball.pos.x - pr.pos.x).toBeCloseTo(0, 1)
    expect(atEnd.ball.pos.y - pr.pos.y).toBeCloseTo(2.6, 1)
    // no teleport just across the boundary
    const justBefore = stateAt(cm, doc2, step1Dur - 0.01)
    const justAfter = stateAt(cm, doc2, step1Dur + 0.01)
    expect(
      Math.hypot(
        justAfter.ball.pos.x - justBefore.ball.pos.x,
        justAfter.ball.pos.y - justBefore.ball.pos.y,
      ),
    ).toBeLessThan(0.6)
    // the pin washes out: later in run 2 the ball leads out front again
    const later = stateAt(cm, doc2, step1Dur + 1.0)
    const lr = later.players[runner.id]!
    expect(later.ball.pos.x - lr.pos.x).toBeCloseTo(DRIBBLE_AHEAD_M, 1)
  })
})
