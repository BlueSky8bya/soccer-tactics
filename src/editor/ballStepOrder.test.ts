import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from '@/domain'
import type { Id, TacticDocument } from '@/domain/types'
import { compile } from '@/engine/compile'
import { stateAt } from '@/engine/stateAt'
import { applyFormations, seedDefaultTeams } from './commands'
import { EditorCore } from './editorCore'
import { makePath, moveBallStartInDraft } from './segmentCommands'
import { addStepPass as addStepPassRaw, addStepRun as addStepRunRaw } from './stepCommands'

/** These commands refuse past step 9; every case here stays well inside, so assert non-null once. */
const addStepRun = (...a: Parameters<typeof addStepRunRaw>): Id => addStepRunRaw(...a)!
const addStepPass = (...a: Parameters<typeof addStepPassRaw>): Id => addStepPassRaw(...a)!


function filled() {
  const core = new EditorCore(
    seedDefaultTeams(createEmptyDocument({ id: 'r', now: '2026-08-21T00:00:00.000Z' })),
  )
  const [home, away] = core.getDocument().teams
  applyFormations(core, [
    { teamId: home!.id, formationId: '4-3-3' },
    { teamId: away!.id, formationId: '4-4-2' },
  ])
  return core
}

describe('ball step order — passes are strictly sequential (2026-08-21 t0-launch bug)', () => {
  it('4-step chain: each pass launches at its own step start', () => {
    const core = filled()
    const d = core.getDocument()
    const holder = d.players.find((p) => p.id === d.ball.initialHolderId)!
    const mates = d.players.filter((p) => p.teamId === holder.teamId && p.id !== holder.id)
    const m1 = mates[0]!
    const m2 = mates[1]!
    core.transaction('give', (dd) =>
      moveBallStartInDraft(
        dd as TacticDocument,
        { x: holder.home.x + 2, y: holder.home.y },
        holder.id,
      ),
    )
    // step1: holder dribbles
    const E1 = { x: holder.home.x + 10, y: holder.home.y }
    addStepRun(core, holder.id, makePath([holder.home, E1]).waypoints, 1)
    // step2: pass to m1 (drawn from carried ghost)
    const p2 = addStepPass(
      core,
      makePath([{ x: E1.x + 1.9, y: E1.y }, m1.home]).waypoints,
      2,
      holder.id,
    )
    // step3: pass m1 -> m2 (drawn from p2 arrival ghost)
    const seg = (id: string) =>
      core
        .getDocument()
        .scenes[0]!.timeline.tracks.flatMap((t) => t.segments)
        .find((x) => x.id === id)!
    const p2end = () => {
      const s = seg(p2)
      if (!('path' in s)) throw new Error('no path')
      return s.path.waypoints[s.path.waypoints.length - 1]!.p
    }
    const p3 = addStepPass(core, makePath([p2end(), m2.home]).waypoints, 3, m1.id)
    // step4 (the NEW pass drawn "after step 3"): from p3 arrival ghost to a far spot
    const p3end = () => {
      const s = seg(p3)
      if (!('path' in s)) throw new Error('no path')
      return s.path.waypoints[s.path.waypoints.length - 1]!.p
    }
    const far = { x: Math.min(100, p3end().x + 25), y: Math.max(5, p3end().y - 10) }
    const p4 = addStepPass(core, makePath([p3end(), far]).waypoints, 4, m2.id)

    const doc = core.getDocument()
    const cm = compile(doc)
    expect(cm.issues.filter((i) => i.level === 'error')).toHaveLength(0)
    const t2 = cm.segmentTimes[p2]!
    const t3 = cm.segmentTimes[p3]!
    const t4 = cm.segmentTimes[p4]!
    // each pass fires strictly after the previous one
    expect(t3.start).toBeGreaterThan(t2.start)
    expect(t4.start).toBeGreaterThan(t3.start)
    expect(t4.start).toBeGreaterThan(0.5)
    // at the very beginning the ball is POSSESSED by the holder, not flying pass 4
    const s0 = stateAt(cm, doc, 0.05)
    expect(s0.ball.status).toBe('possessed')
    expect(s0.ball.holderId).toBe(holder.id)
    // right before p4 fires the ball rests with m2 (or is still finishing p3), near p4's origin
    const sPre = stateAt(cm, doc, Math.max(0, t4.start - 0.01))
    const p4seg = seg(p4)
    if ('path' in p4seg) {
      const o = p4seg.path.waypoints[0]!.p
      const dist = Math.hypot(sPre.ball.pos.x - o.x, sPre.ball.pos.y - o.y)
      expect(dist).toBeLessThan(1.0)
    }
  })

  it('a pass requested at a LOWER step than an existing one is bumped to the next step', () => {
    const core = filled()
    const d = core.getDocument()
    const holder = d.players.find((p) => p.id === d.ball.initialHolderId)!
    const mates = d.players.filter((p) => p.teamId === holder.teamId && p.id !== holder.id)
    const m1 = mates[0]!
    core.transaction('give', (dd) =>
      moveBallStartInDraft(
        dd as TacticDocument,
        { x: holder.home.x + 2, y: holder.home.y },
        holder.id,
      ),
    )
    const pA = addStepPass(core, makePath([d.ball.home, m1.home]).waypoints, 3, holder.id)
    // the buggy UI flow: drawing from the live ball at a result frame passed the CHIP step (1)
    const arrival = () => {
      const s = core
        .getDocument()
        .scenes[0]!.timeline.tracks.flatMap((t) => t.segments)
        .find((x) => x.id === pA)!
      if (!('path' in s)) throw new Error('no path')
      return s.path.waypoints[s.path.waypoints.length - 1]!.p
    }
    const far = { x: Math.min(100, arrival().x + 20), y: arrival().y }
    const pB = addStepPass(core, makePath([arrival(), far]).waypoints, 1, m1.id)
    const doc = core.getDocument()
    const cm = compile(doc)
    expect(cm.issues.filter((i) => i.level === 'error')).toHaveLength(0)
    // bumped: fires AFTER pass A, never at t=0
    expect(cm.segmentTimes[pB]!.start).toBeGreaterThanOrEqual(cm.segmentTimes[pA]!.end - 1e-6)
    expect(cm.segmentTimes[pB]!.start).toBeGreaterThan(0.2)
    const sB = doc.scenes[0]!.timeline.tracks.flatMap((t) => t.segments).find((x) => x.id === pB)!
    expect((sB as { step?: number }).step).toBe(4)
    // at t≈0 the ball is flying pass A (steps compress: a lone step 3 starts at 0 by design)
    // — the point is it is NOT flying the newly drawn pass B
    const s0 = stateAt(cm, doc, 0.05)
    expect(s0.ball.segmentId).toBe(pA)
  })
})
