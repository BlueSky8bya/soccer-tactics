import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from '@/domain'
import { compile } from '@/engine/compile'
import { DRIBBLE_AHEAD_M, stateAt } from '@/engine/stateAt'
import { applyFormations, seedDefaultTeams } from './commands'
import { EditorCore } from './editorCore'
import { makePath, moveBallStartInDraft } from './segmentCommands'
import { addStepRun } from './stepCommands'
import type { TacticDocument } from '@/domain/types'

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

    // after the run: back at the side-carry spot (authored anchors stay valid)
    const after = stateAt(cm, doc, dur + 0.5)
    const ar = after.players[runner.id]!
    expect(after.ball.pos.x - ar.pos.x).toBeLessThan(0) // resting on the LEFT again
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
    // the TRUE end of the chain still settles back to the side spot
    const done = stateAt(cm, doc, step1Dur * 2 + 0.6)
    const pr = done.players[runner.id]!
    expect(done.ball.pos.x - pr.pos.x).toBeLessThan(0)
  })
})
