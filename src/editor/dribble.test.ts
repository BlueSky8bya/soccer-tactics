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
})
