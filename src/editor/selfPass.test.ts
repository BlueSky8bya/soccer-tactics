/**
 * A PLAYER MAY COLLECT THEIR OWN PASS — IF THEY WENT AND GOT IT (user 2026-08-23: 공 띄워서 다시
 * 받는 것). Lobbing over yourself and knocking it ahead to run onto are real football; a blanket
 * "the passer never receives" made them impossible, and the ball stayed nobody's for every later
 * step. The rule that replaces it, pinned here: distance from the LAUNCH spot at arrival.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from '@/domain'
import type { Id, TacticDocument } from '@/domain/types'
import { compile } from '@/engine/compile'
import { stateAt } from '@/engine/stateAt'
import { applyFormations, seedDefaultTeams } from './commands'
import { EditorCore } from './editorCore'
import { makePath, moveBallStartInDraft } from './segmentCommands'
import {
  addStepPass as addStepPassRaw,
  addStepRun as addStepRunRaw,
  relayoutStepsInDraft,
} from './stepCommands'

function filled() {
  const core = new EditorCore(
    seedDefaultTeams(createEmptyDocument({ id: 'r', now: '2026-08-23T00:00:00.000Z' })),
  )
  const [home, away] = core.getDocument().teams
  applyFormations(core, [
    { teamId: home!.id, formationId: '4-3-3' },
    { teamId: away!.id, formationId: '4-4-2' },
  ])
  return core
}

const travel = (doc: TacticDocument) =>
  doc.scenes[0]!.timeline.tracks
    .flatMap((t) => t.segments)
    .find((s) => s.kind === 'travel')

const holderAtEnd = (doc: TacticDocument): Id | null => {
  const cm = compile(doc)
  let end = 0
  for (const t of Object.values(cm.segmentTimes))
    if (Number.isFinite(t.end) && t.end > end) end = t.end
  return stateAt(cm, doc, end).ball.holderId ?? null
}

/** #1 holds the ball, runs two steps, and the ball is lobbed to a spot along the way. */
function lobBoard(passTo: (runEnds: { p1: { x: number; y: number }; p2: { x: number; y: number } }) => {
  x: number
  y: number
}) {
  const core = filled()
  const p = core.getDocument().players[0]!
  core.transaction('hold', (d) => {
    const doc = d as TacticDocument
    moveBallStartInDraft(doc, p.home, p.id)
    relayoutStepsInDraft(doc)
  })
  const p1 = { x: p.home.x + 22, y: p.home.y - 12 }
  const p2 = { x: p1.x + 24, y: p1.y + 9 }
  addStepRunRaw(core, p.id, makePath([p.home, p1]).waypoints, 1)
  addStepRunRaw(core, p.id, makePath([p1, p2]).waypoints, 2)
  const start = core.getDocument().ball.home
  addStepPassRaw(core, makePath([start, passTo({ p1, p2 })]).waypoints, 1, p.id, {
    exactStep: true,
  })
  return { core, p, p1, p2 }
}

describe('a self pass', () => {
  it('is COLLECTED when the passer runs onto it — and carried on from there', () => {
    const { core, p, p2 } = lobBoard(({ p2: end }) => end)
    const doc = core.getDocument()
    const tv = travel(doc)!
    expect('receiverId' in tv && tv.receiverId).toBe(p.id)
    expect(holderAtEnd(doc)).toBe(p.id)
    // …and it ends in his hands where his run ends
    const cm = compile(doc)
    let end = 0
    for (const t of Object.values(cm.segmentTimes))
      if (Number.isFinite(t.end) && t.end > end) end = t.end
    const ball = stateAt(cm, doc, end).ball.pos
    expect(Math.hypot(ball.x - p2.x, ball.y - p2.y)).toBeLessThan(4)
  })

  it('is NOT collected when it never left him — a pass to his own feet is nobody’s', () => {
    const core = filled()
    const p = core.getDocument().players[0]!
    core.transaction('hold', (d) => {
      const doc = d as TacticDocument
      moveBallStartInDraft(doc, p.home, p.id)
      relayoutStepsInDraft(doc)
    })
    // he never moves; the ball is "passed" 2 m away — still inside his own launch radius
    const start = core.getDocument().ball.home
    addStepPassRaw(
      core,
      makePath([start, { x: start.x + 2, y: start.y + 1 }]).waypoints,
      1,
      p.id,
      { exactStep: true },
    )
    const tv = travel(core.getDocument())!
    expect('receiverId' in tv && tv.receiverId).toBeFalsy()
    expect(holderAtEnd(core.getDocument())).toBeNull()
  })
})
