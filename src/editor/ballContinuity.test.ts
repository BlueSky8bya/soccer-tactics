import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from '@/domain'
import type { Id, TacticDocument, Vec2 } from '@/domain/types'
import { applyFormations, seedDefaultTeams } from './commands'
import { EditorCore } from './editorCore'
import { makePath, moveBallStartInDraft } from './segmentCommands'
import { addStepPass, addStepRun } from './stepCommands'
import { compile } from '@/engine/compile'
import { stateAt } from '@/engine/stateAt'
import { describeJump, maxBallJump } from '@/engine/ballContinuity'

/**
 * Invariant B1: the ball never teleports.
 *
 * Reported over and over (latest 2026-08-22, with screenshots): a pass drawn from the ball where
 * it rests at the END of a receiver's run leaves from somewhere else entirely. Each past fix
 * patched one of the five places that reconcile "the stored anchor" with "where the resolver puts
 * the ball". This suite checks the observable consequence instead, so it survives those five
 * being rewritten.
 */

function board() {
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

/** Where the board DRAWS the resting ball after `segId` — the spot a user can grab. */
function restingBallAfter(core: EditorCore, segId: Id): Vec2 {
  const doc = core.getDocument()
  const cm = compile(doc)
  const end = cm.segmentTimes[segId]?.end ?? 0
  return stateAt(cm, doc, end + 0.05).ball.pos
}

function noJump(core: EditorCore) {
  const j = maxBallJump(core.getDocument())
  expect(j === null ? 'continuous' : describeJump(j)).toBe('continuous')
}

describe('ball continuity (invariant B1)', () => {
  it('a pass drawn from the resting ball leaves from where the ball rests', () => {
    const core = board()
    const d = core.getDocument()
    const A = d.players.find((p) => p.id === d.ball.initialHolderId)!
    const B = d.players.filter((p) => p.teamId === A.teamId && p.id !== A.id)[0]!
    core.transaction('give', (dd) =>
      moveBallStartInDraft(dd as TacticDocument, { x: A.home.x + 2, y: A.home.y }, A.id),
    )

    // step 1 + 2: both players run (the receiver ARRIVES at the pass target, as in the report)
    const A1 = { x: A.home.x + 8, y: A.home.y - 6 }
    const B1 = { x: B.home.x + 8, y: B.home.y - 6 }
    const A2 = { x: A1.x + 10, y: A1.y }
    const B2 = { x: B1.x + 12, y: B1.y - 4 }
    const rA1 = addStepRun(core, A.id, makePath([A.home, A1]).waypoints, 1)
    addStepRun(core, B.id, makePath([B.home, B1]).waypoints, 1)
    addStepRun(core, A.id, makePath([A1, A2]).waypoints, 2)
    addStepRun(core, B.id, makePath([B1, B2]).waypoints, 2)

    // step 2: the pass is drawn FROM the ball as the board shows it riding player A
    const from = restingBallAfter(core, rA1)
    const pass = addStepPass(core, makePath([from, B2]).waypoints, 2, A.id)
    noJump(core)

    // step 3: grab the ball where it now rests and fling it at the goal
    const grab = restingBallAfter(core, pass)
    const shot = addStepPass(core, makePath([grab, { x: 103, y: 37.8 }]).waypoints, 3, B.id)

    const seg = core
      .getDocument()
      .scenes[0]!.timeline.tracks.flatMap((t) => t.segments)
      .find((s) => s.id === shot)!
    const origin = 'path' in seg ? seg.path.waypoints[0]!.p : { x: NaN, y: NaN }
    expect(`${Math.hypot(origin.x - grab.x, origin.y - grab.y).toFixed(2)}m from the grab`).toBe(
      '0.00m from the grab',
    )
    noJump(core)
  })

  it('stays continuous when the receiver is still running as the pass arrives', () => {
    const core = board()
    const d = core.getDocument()
    const A = d.players.find((p) => p.id === d.ball.initialHolderId)!
    const B = d.players.filter((p) => p.teamId === A.teamId && p.id !== A.id)[1]!
    core.transaction('give', (dd) =>
      moveBallStartInDraft(dd as TacticDocument, { x: A.home.x + 2, y: A.home.y }, A.id),
    )
    // a long run and a short pass in the SAME step: the ball lands mid-stride
    const B1 = { x: B.home.x + 26, y: B.home.y - 10 }
    addStepRun(core, B.id, makePath([B.home, B1]).waypoints, 1)
    addStepPass(core, makePath([d.ball.home, B1]).waypoints, 1, A.id)
    noJump(core)
  })

  it('stays continuous across a three-pass chain between moving players', () => {
    const core = board()
    const d = core.getDocument()
    const A = d.players.find((p) => p.id === d.ball.initialHolderId)!
    const mates = d.players.filter((p) => p.teamId === A.teamId && p.id !== A.id)
    const B = mates[0]!
    const C = mates[1]!
    core.transaction('give', (dd) =>
      moveBallStartInDraft(dd as TacticDocument, { x: A.home.x + 2, y: A.home.y }, A.id),
    )
    const B1 = { x: B.home.x + 12, y: B.home.y - 5 }
    const C1 = { x: C.home.x + 14, y: C.home.y + 4 }
    const rA = addStepRun(
      core,
      A.id,
      makePath([A.home, { x: A.home.x + 9, y: A.home.y }]).waypoints,
      1,
    )
    addStepRun(core, B.id, makePath([B.home, B1]).waypoints, 1)
    const p1 = addStepPass(core, makePath([restingBallAfter(core, rA), B1]).waypoints, 2, A.id)
    addStepRun(core, C.id, makePath([C.home, C1]).waypoints, 2)
    const p2 = addStepPass(core, makePath([restingBallAfter(core, p1), C1]).waypoints, 3, B.id)
    addStepPass(core, makePath([restingBallAfter(core, p2), { x: 103, y: 34 }]).waypoints, 4, C.id)
    noJump(core)
  })
})
