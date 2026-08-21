/**
 * THE BALL IS ANCHORED BY A MOMENT — the one entity whose past can be overwritten.
 *
 * A player's chain only ever grows: two players may stand anywhere at once, so continuing from any
 * of a player's faded tokens means the same thing. There is exactly one ball, so releasing it at an
 * earlier instant is not a branch — it REPLACES the rest of its chain (user 2026-08-22: 공이 동시에
 * 존재할 수 없으니 그 이후 공들은 없어지고).
 *
 * The UI names the moment (which ball token was grabbed); these tests pin what the COMMAND does
 * with it, which is where the rule actually has to hold.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from '@/domain'
import type { Id, TacticDocument } from '@/domain/types'
import { maxBallJump, describeJump } from '@/engine/ballContinuity'
import { compile } from '@/engine/compile'
import { stateAt } from '@/engine/stateAt'
import { applyFormations, seedDefaultTeams } from './commands'
import { EditorCore } from './editorCore'
import { makePath, moveBallStartInDraft } from './segmentCommands'
import {
  addStepPass as addStepPassRaw,
  addStepRun as addStepRunRaw,
  ballMovesFromStep,
  stepOf,
  truncateBallFromStepInDraft,
} from './stepCommands'

/** These commands refuse past step 9; every case here stays well inside, so assert non-null once. */
const addStepRun = (...a: Parameters<typeof addStepRunRaw>): Id => addStepRunRaw(...a)!
const addStepPass = (...a: Parameters<typeof addStepPassRaw>): Id => addStepPassRaw(...a)!


function filled() {
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

const ballTravels = (core: EditorCore) => {
  const doc = core.getDocument()
  const track = doc.scenes[0]!.timeline.tracks.find((t) => t.entityKind === 'ball')
  return (track?.segments ?? [])
    .filter((s) => 'path' in s && !s.id.startsWith('gen-'))
    .map((s) => ({
      id: s.id,
      step: stepOf(s as { step?: number }),
      first: (s as { path: { waypoints: { p: { x: number; y: number } }[] } }).path.waypoints[0]!.p,
    }))
}

const playableEnd = (doc: TacticDocument) => {
  const cm = compile(doc)
  let end = 0
  for (const t of Object.values(cm.segmentTimes)) if (Number.isFinite(t.end) && t.end > end) end = t.end
  return end
}

const sane = (doc: TacticDocument) => {
  expect(compile(doc).issues.filter((i) => i.level === 'error')).toHaveLength(0)
  const jump = maxBallJump(doc)
  expect(jump === null || jump.dist <= jump.allowed, jump ? describeJump(jump) : '').toBe(true)
}

/** Holder + two team-mates, ball already at the holder's feet. */
function scene() {
  const core = filled()
  const d = core.getDocument()
  const holder = d.players.find((p) => p.id === d.ball.initialHolderId)!
  const mates = d.players.filter((p) => p.teamId === holder.teamId && p.id !== holder.id)
  core.transaction('give', (dd) =>
    moveBallStartInDraft(dd as TacticDocument, { x: holder.home.x + 2, y: holder.home.y }, holder.id),
  )
  return { core, holder, m1: mates[0]!, m2: mates[1]! }
}

describe('ball moment — grabbing the ball early overwrites the rest of its chain', () => {
  it('a pass on an EXACT step fires there, however far its holder runs afterwards', () => {
    const { core, holder, m1 } = scene()
    // the holder carries the ball through two runs...
    const A = { x: holder.home.x + 12, y: holder.home.y }
    const B = { x: holder.home.x + 24, y: holder.home.y }
    addStepRun(core, holder.id, makePath([holder.home, A]).waypoints, 1)
    addStepRun(core, holder.id, makePath([A, B]).waypoints, 2)

    // ...but the user grabs the ball back at the KICKOFF spot and passes from there
    const start = { ...core.getDocument().ball.home }
    const id = addStepPass(core, makePath([start, m1.home]).waypoints, 1, holder.id, {
      exactStep: true,
    })

    const doc = core.getDocument()
    const seg = doc.scenes[0]!.timeline.tracks
      .flatMap((t) => t.segments)
      .find((s) => s.id === id)!
    expect(stepOf(seg as { step?: number })).toBe(1)
    // it launches at the very start, not after the runs
    expect(compile(doc).segmentTimes[id]!.start).toBeLessThan(0.05)
    // the runs are untouched — only the BALL was rerouted
    const runs = doc.scenes[0]!.timeline.tracks
      .filter((t) => t.entityKind === 'player')
      .flatMap((t) => t.segments.filter((s) => 'path' in s))
    expect(runs).toHaveLength(2)
    // and the runner finishes empty-footed
    const cm = compile(doc)
    expect(stateAt(cm, doc, playableEnd(doc)).ball.holderId).not.toBe(holder.id)
    sane(doc)
  })

  it('without exactStep the same call still APPENDS — carrying counts as moving', () => {
    const { core, holder, m1 } = scene()
    const A = { x: holder.home.x + 12, y: holder.home.y }
    addStepRun(core, holder.id, makePath([holder.home, A]).waypoints, 1)
    const start = { ...core.getDocument().ball.home }
    const id = addStepPass(core, makePath([start, m1.home]).waypoints, 1, holder.id)
    const seg = core
      .getDocument()
      .scenes[0]!.timeline.tracks.flatMap((t) => t.segments)
      .find((s) => s.id === id)!
    expect(stepOf(seg as { step?: number })).toBe(2)
    sane(core.getDocument())
  })

  it('an exact pass mid-chain drops every later pass and keeps the earlier ones', () => {
    const { core, holder, m1, m2 } = scene()
    const endOf = (id: Id) => {
      const s = core
        .getDocument()
        .scenes[0]!.timeline.tracks.flatMap((t) => t.segments)
        .find((x) => x.id === id)!
      if (!('path' in s)) throw new Error('no path')
      return { ...s.path.waypoints[s.path.waypoints.length - 1]!.p }
    }
    const p1 = addStepPass(core, makePath([core.getDocument().ball.home, m1.home]).waypoints, 1, holder.id)
    const p2 = addStepPass(core, makePath([endOf(p1), m2.home]).waypoints, 2, m1.id)
    addStepPass(core, makePath([endOf(p2), { x: 95, y: 40 }]).waypoints, 3, m2.id)
    expect(ballTravels(core)).toHaveLength(3)

    // grabbed at the ball's step-1 resting spot → the next pass is step 2, and 2/3 are overwritten
    expect(ballMovesFromStep(core.getDocument(), 2)).toBe(2)
    const fresh = addStepPass(core, makePath([endOf(p1), { x: 20, y: 60 }]).waypoints, 2, m1.id, {
      exactStep: true,
    })
    const now = ballTravels(core)
    expect(now.map((t) => t.step)).toEqual([1, 2])
    expect(now[1]!.id).toBe(fresh)
    expect(now[0]!.id).toBe(p1)
    sane(core.getDocument())
  })

  it('grabbing the ball at its very start wipes the whole chain', () => {
    const { core, holder, m1, m2 } = scene()
    const endOf = (id: Id) => {
      const s = core
        .getDocument()
        .scenes[0]!.timeline.tracks.flatMap((t) => t.segments)
        .find((x) => x.id === id)!
      if (!('path' in s)) throw new Error('no path')
      return { ...s.path.waypoints[s.path.waypoints.length - 1]!.p }
    }
    const p1 = addStepPass(core, makePath([core.getDocument().ball.home, m1.home]).waypoints, 1, holder.id)
    addStepPass(core, makePath([endOf(p1), m2.home]).waypoints, 2, m1.id)
    const start = { ...core.getDocument().ball.home }
    addStepPass(core, makePath([start, m2.home]).waypoints, 1, holder.id, { exactStep: true })
    const now = ballTravels(core)
    expect(now.map((t) => t.step)).toEqual([1])
    // it leaves from the kickoff spot, and the passer is still the original holder
    expect(Math.hypot(now[0]!.first.x - start.x, now[0]!.first.y - start.y)).toBeLessThan(1.0)
    sane(core.getDocument())
  })

  it('truncation is a pure count: the draft helper and the query agree', () => {
    const { core, holder, m1 } = scene()
    addStepPass(core, makePath([core.getDocument().ball.home, m1.home]).waypoints, 1, holder.id)
    addStepPass(core, makePath([m1.home, { x: 90, y: 20 }]).waypoints, 2, m1.id)
    for (const step of [1, 2, 3, 4]) {
      const doc = core.getDocument()
      const predicted = ballMovesFromStep(doc, step)
      const clone = JSON.parse(JSON.stringify(doc)) as TacticDocument
      expect(truncateBallFromStepInDraft(clone, step)).toBe(predicted)
      expect(ballMovesFromStep(clone, step)).toBe(0)
    }
  })
})
