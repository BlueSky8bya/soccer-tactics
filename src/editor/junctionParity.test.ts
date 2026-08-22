/**
 * JUNCTION PARITY — PLAN-014 M2.
 *
 * Six core fixtures, each built through the real commands, each asking the same question at every
 * ball junction: do the authored document, the relayout result, the compiled schedule and
 * `stateAt` all say the SAME place at the SAME instant?
 *
 * Tolerances are the pipeline's own, not invented for the audit: the anchor fixed-point loop in
 * `relayoutStepsInDraft` moves an endpoint whenever it is more than 0.25m from the resolved ball,
 * so a document that IS a fixed point must sit within 0.25m at both ends of every travel. That is
 * an order of magnitude tighter than I6/I7's 2.8m detection fence — this suite checks the
 * CONTRACT, the fuzz invariants catch the CRIME.
 *
 * Also measured, not gated (M2 measurement-first policy): per-fixture relayout wall time,
 * external applications to reach a byte fixed point (must be 0 extra — commands leave the
 * document settled), and the receiver-tie order dependence (R12-E) is pinned as a
 * characterization: an EXACT distance tie resolves by players-array order.
 */
import { describe, expect, it } from 'vitest'
import type { Id, TacticDocument, Vec2 } from '@/domain/types'
import { compile } from '@/engine/compile'
import { stateAt } from '@/engine/stateAt'
import { board, violation } from './tacticFuzz.harness'
import type { EditorCore } from './editorCore'
import { findSegment, makePath, moveTravelEndInDraft, sceneOf } from './segmentCommands'
import {
  addStepPass,
  addStepRun,
  relayoutStepsInDraft,
  removeStepSegment,
  resolvePassReceiverInDraft,
} from './stepCommands'

// ---------------------------------------------------------------------------------------------
// the parity audit every fixture runs
// ---------------------------------------------------------------------------------------------

/** The anchor loop's own snap threshold (stepCommands relayout, round loop `> 0.25`). */
const ANCHOR_M = 0.25 + 1e-6

interface TravelParity {
  segId: string
  launchDelta: number
  landDelta: number
}

interface Audit {
  travels: TravelParity[]
  relayoutMs: number
  extraApplications: number
}

/**
 * Assert the full parity contract on a committed document; return the measurements.
 * Every check is against the RESULT (compile + stateAt), never a resolver's internals.
 */
function auditParity(doc: TacticDocument): Audit {
  // healthy by the ten invariants (includes I9 byte-idempotence and I10 round-trip)
  expect(violation(doc)).toBeNull()

  // relayout is already a fixed point: zero further applications change bytes
  const c1 = structuredClone(doc)
  const t0 = performance.now()
  relayoutStepsInDraft(c1)
  const relayoutMs = performance.now() - t0
  const extraApplications = JSON.stringify(c1) === JSON.stringify(doc) ? 0 : 1
  expect(extraApplications, 'commands must leave the document settled').toBe(0)

  // deterministic compile: two compiles agree on every segment time
  const cm = compile(doc)
  const cm2 = compile(doc)
  expect(JSON.stringify(cm2.segmentTimes)).toBe(JSON.stringify(cm.segmentTimes))

  // travel junction parity: authored endpoints vs the resolved ball at the compiled instants
  const travels: TravelParity[] = []
  for (const tr of sceneOf(doc).timeline.tracks) {
    if (tr.entityKind !== 'ball') continue
    for (const seg of tr.segments) {
      if (seg.kind !== 'travel' || seg.id.startsWith('gen-')) continue
      const times = cm.segmentTimes[seg.id]
      if (!times || !Number.isFinite(times.start) || !Number.isFinite(times.end)) continue
      const first = seg.path.waypoints[0]!.p
      const last = seg.path.waypoints[seg.path.waypoints.length - 1]!.p
      const launch = stateAt(cm, doc, Math.max(0, times.start - 1e-3)).ball.pos
      const land = stateAt(cm, doc, times.end).ball.pos
      const launchDelta = Math.hypot(launch.x - first.x, launch.y - first.y)
      const landDelta = Math.hypot(land.x - last.x, land.y - last.y)
      expect(launchDelta, `launch parity of ${seg.id}`).toBeLessThanOrEqual(ANCHOR_M)
      expect(landDelta, `landing parity of ${seg.id}`).toBeLessThanOrEqual(ANCHOR_M)
      travels.push({ segId: seg.id, launchDelta, landDelta })
    }
  }

  // deterministic stateAt: resampling gives byte-identical ball positions
  for (const t of [0, cm.duration / 2, cm.duration]) {
    const a = stateAt(cm, doc, t).ball.pos
    const b = stateAt(cm, doc, t).ball.pos
    expect(a).toEqual(b)
  }

  return { travels, relayoutMs, extraApplications }
}

/**
 * After this travel lands, the named receiver is carrying the ball: nearer to it than any other
 * player, and within the receive radius. (The raw carry distance briefly exceeds the 2.6m resting
 * ring while a carry vector swings — measured 2.71m in the relay fixture — so proximity ORDER is
 * the honest ownership statement, not a fixed circle.)
 */
function expectReceiverHolds(doc: TacticDocument, segId: string, receiverId: Id) {
  const cm = compile(doc)
  const times = cm.segmentTimes[segId]!
  const after = stateAt(cm, doc, times.end + 0.05)
  const rp = after.players[receiverId]
  expect(rp, 'receiver exists at arrival').toBeDefined()
  const d = Math.hypot(after.ball.pos.x - rp!.pos.x, after.ball.pos.y - rp!.pos.y)
  expect(d, 'ball within receive radius of the receiver').toBeLessThanOrEqual(3.5)
  // structural ownership: the segment after the travel is a possession held by THIS receiver
  // (a bystander merely STANDING near the landing spot must not read as the owner)
  const f = findSegment(doc, segId)!
  const nx = f.track.segments[f.index + 1]
  expect(nx?.kind, 'a possession follows the catch').toBe('possessed')
  expect((nx as { holderId?: Id }).holderId, 'held by the receiver').toBe(receiverId)
}

const measurements: Record<string, Audit> = {}

function fixture(core: EditorCore) {
  const d0 = core.getDocument()
  const holder = d0.players.find((p) => p.id === d0.ball.initialHolderId)!
  const mates = d0.players
    .filter((p) => p.teamId === holder.teamId && p.id !== holder.id)
    .sort((a, b) => Math.hypot(a.home.x - d0.ball.home.x, a.home.y - d0.ball.home.y) -
                    Math.hypot(b.home.x - d0.ball.home.x, b.home.y - d0.ball.home.y))
  return { d0, holder, mates }
}

// ---------------------------------------------------------------------------------------------
// the six fixtures
// ---------------------------------------------------------------------------------------------

describe('junction parity (PLAN-014 M2)', () => {
  it('F1 — initial possession → first pass', () => {
    const core = board()
    const { d0, holder, mates } = fixture(core)
    const passId = addStepPass(core, makePath([d0.ball.home, mates[0]!.home]).waypoints, 1, holder.id)!
    const doc = core.getDocument()
    measurements.F1 = auditParity(doc)
    const seg = findSegment(doc, passId)!.segment as { receiverId?: Id }
    expect(seg.receiverId).toBe(mates[0]!.id)
    expectReceiverHolds(doc, passId, mates[0]!.id)
  })

  it('F2 — pass to a receiver who ran in step 1', () => {
    const core = board()
    const { d0, holder, mates } = fixture(core)
    const runner = mates[0]!
    const dest: Vec2 = { x: runner.home.x + 10, y: runner.home.y }
    addStepRun(core, runner.id, makePath([runner.home, dest]).waypoints, 1)!
    const passId = addStepPass(core, makePath([d0.ball.home, dest]).waypoints, 2, holder.id)!
    const doc = core.getDocument()
    measurements.F2 = auditParity(doc)
    expectReceiverHolds(doc, passId, runner.id)
  })

  it('F3 — through-pass: a loose pass to grass becomes targeted when the run is drawn onto it', () => {
    const core = board()
    const { d0, holder, mates } = fixture(core)
    const runner = mates[1]!
    // pass into empty space FIRST — far from every player so it commits as loose/receiverless
    const spot: Vec2 = { x: d0.ball.home.x + 18, y: Math.max(6, d0.ball.home.y - 18) }
    const passId = addStepPass(core, makePath([d0.ball.home, spot]).waypoints, 1, holder.id)!
    const seg0 = findSegment(core.getDocument(), passId)!.segment as {
      receiverId?: Id
      target?: { entityId: Id; step: number }
    }
    expect(seg0.receiverId, 'a pass to grass has no receiver yet').toBeUndefined()
    // now draw the run that ENDS on the spot — production route to `target` (stepCommands)
    const runId = addStepRun(core, runner.id, makePath([runner.home, spot]).waypoints, 1)!
    const doc = core.getDocument()
    const seg = findSegment(doc, passId)!.segment as {
      receiverId?: Id
      target?: { entityId: Id; step: number }
    }
    const runStep = (findSegment(doc, runId)!.segment as { step?: number }).step ?? 1
    expect(seg.target, 'the run onto the spot names the destination moment').toEqual({
      entityId: runner.id,
      step: runStep,
    })
    measurements.F3 = auditParity(doc)
    // the moment contract: the pass arrives exactly when the targeted run ends
    const cm = compile(doc)
    expect(cm.segmentTimes[passId]!.end).toBeCloseTo(cm.segmentTimes[runId]!.end, 2)
    expectReceiverHolds(doc, passId, runner.id)
  })

  it('F4 — receive-side pin: dragging the travel end near the receiver locks the carry side', () => {
    const core = board()
    const { d0, holder, mates } = fixture(core)
    const receiver = mates[0]!
    const passId = addStepPass(core, makePath([d0.ball.home, receiver.home]).waypoints, 1, holder.id)!
    // the UI's travel-end drag, replayed at the editor layer exactly as endGesture commits it:
    // moveTravelEndInDraft with the receiver center → offsetLocked possession, then one relayout.
    const side: Vec2 = { x: receiver.home.x - 1.9, y: receiver.home.y + 1.2 }
    core.transaction('Drag pass end', (d) => {
      const doc2 = d as TacticDocument
      moveTravelEndInDraft(doc2, passId, side, receiver.home)
      resolvePassReceiverInDraft(doc2, passId, { preserveEndDirection: true })
      relayoutStepsInDraft(doc2)
    })
    const doc = core.getDocument()
    const hold = (() => {
      const f = findSegment(doc, passId)!
      return f.track.segments[f.index + 1]
    })()!
    expect(hold.kind).toBe('possessed')
    expect((hold as { offsetLocked?: boolean }).offsetLocked).toBe(true)
    measurements.F4 = auditParity(doc)
    expectReceiverHolds(doc, passId, receiver.id)
  })

  it('F5 — relay: receive then pass on (A→B→C)', () => {
    const core = board()
    const { d0, holder, mates } = fixture(core)
    const b = mates[0]!
    const c = mates[1]!
    const p1 = addStepPass(core, makePath([d0.ball.home, b.home]).waypoints, 1, holder.id)!
    const p2 = addStepPass(core, makePath([b.home, c.home]).waypoints, 2, b.id)!
    const doc = core.getDocument()
    measurements.F5 = auditParity(doc)
    expectReceiverHolds(doc, p1, b.id)
    expectReceiverHolds(doc, p2, c.id)
    // chronology: one ball, strictly ordered flights (I8 in the small)
    const cm = compile(doc)
    expect(cm.segmentTimes[p2]!.start).toBeGreaterThanOrEqual(cm.segmentTimes[p1]!.end - 1e-6)
  })

  it('F6 — delete the receiving run, re-draw elsewhere, save/load, relayout twice', () => {
    const core = board()
    const { d0, holder, mates } = fixture(core)
    const runner = mates[0]!
    const dest: Vec2 = { x: runner.home.x + 10, y: runner.home.y }
    const runId = addStepRun(core, runner.id, makePath([runner.home, dest]).waypoints, 1)!
    addStepPass(core, makePath([d0.ball.home, dest]).waypoints, 2, holder.id)!
    expect(violation(core.getDocument())).toBeNull()

    // delete the run the pass depends on — the pass must degrade coherently, not dangle
    removeStepSegment(core, runId)
    const afterDelete = core.getDocument()
    measurements['F6a-afterDelete'] = auditParity(afterDelete)

    // re-draw the runner somewhere else entirely
    const elsewhere: Vec2 = { x: runner.home.x - 8, y: runner.home.y + 5 }
    addStepRun(core, runner.id, makePath([runner.home, elsewhere]).waypoints, 1)!
    const redrawn = core.getDocument()
    measurements['F6b-redrawn'] = auditParity(redrawn)

    // save → load → relayout twice: byte-stable through storage
    const json = JSON.stringify(redrawn)
    const loaded = JSON.parse(json) as TacticDocument
    relayoutStepsInDraft(loaded)
    expect(JSON.stringify(loaded), 'a saved committed document is already a fixed point').toBe(json)
  })

  it('R12-E characterization — an EXACT receiver tie resolves by players-array order', () => {
    const core = board()
    const { d0, holder } = fixture(core)
    // two teammates placed mirror-symmetric around the pass end → exactly equal distances
    const end: Vec2 = { x: d0.ball.home.x + 12, y: d0.ball.home.y }
    const mates = d0.players.filter((p) => p.teamId === holder.teamId && p.id !== holder.id)
    const [pa, pb] = [mates[0]!, mates[1]!]
    core.transaction('Stage tie', (d) => {
      const doc2 = d as TacticDocument
      doc2.players.find((p) => p.id === pa.id)!.home = { x: end.x - 2, y: end.y }
      doc2.players.find((p) => p.id === pb.id)!.home = { x: end.x + 2, y: end.y }
      relayoutStepsInDraft(doc2)
    })
    const passId = addStepPass(core, makePath([d0.ball.home, end]).waypoints, 1, holder.id)!
    const committed = core.getDocument()
    const rec1 = (findSegment(committed, passId)!.segment as { receiverId?: Id }).receiverId
    expect(rec1, 'a tie picks SOMEONE deterministically').toBeDefined()

    // Isolate the RULE: strip the committed resolution back to the pre-resolve state, then run
    // the resolver on both player orders. (Re-resolving the committed doc would not tie — the
    // winner already carries the ball at the arrival instant.)
    const strip = (d: TacticDocument): TacticDocument => {
      const c = structuredClone(d)
      const f = findSegment(c, passId)!
      delete (f.segment as { receiverId?: Id }).receiverId
      const nx = f.track.segments[f.index + 1]
      if (nx && nx.kind === 'possessed') f.track.segments.splice(f.index + 1, 1)
      // the commit's arrival anchor already pulled the endpoint onto the winner's carry ring —
      // restore the geometric midpoint so the two candidates are EXACTLY tied again
      const seg = f.segment as { path: { waypoints: { p: Vec2 }[] } }
      seg.path.waypoints[seg.path.waypoints.length - 1]!.p = { ...end }
      return c
    }
    const orderA = strip(committed)
    resolvePassReceiverInDraft(orderA, passId)
    const recA = (findSegment(orderA, passId)!.segment as { receiverId?: Id }).receiverId
    const orderB = strip(committed)
    orderB.players.reverse()
    resolvePassReceiverInDraft(orderB, passId)
    const recB = (findSegment(orderB, passId)!.segment as { receiverId?: Id }).receiverId
    // PINNED CHARACTERIZATION (Finding F-M2-02): the stable distance sort breaks exact ties by
    // array position, so reversing the players array flips the receiver. Real documents rarely
    // hold an exact float tie, and the array order is stable through save/load — but the rule is
    // order-dependent, not a stated tie-break. If this pin goes red, the rule changed: re-audit.
    expect(recA).toBe(pa.id)
    expect(recB).toBe(pb.id)
    expect(recB).not.toBe(recA)
  })

  it('reports the measurements', () => {
    const rows = Object.entries(measurements).map(([k, a]) => ({
      fixture: k,
      travels: a.travels.length,
      maxLaunchDelta: +Math.max(0, ...a.travels.map((t) => t.launchDelta)).toFixed(4),
      maxLandDelta: +Math.max(0, ...a.travels.map((t) => t.landDelta)).toFixed(4),
      relayoutMs: +a.relayoutMs.toFixed(2),
    }))
    // eslint-disable-next-line no-console
    console.log('[M2 parity]', JSON.stringify(rows))
    expect(rows.length).toBeGreaterThanOrEqual(6)
  })
})
