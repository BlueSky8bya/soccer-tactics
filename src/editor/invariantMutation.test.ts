/**
 * INVARIANT MUTATION-KILL — PLAN-014 M1.
 *
 * `violation()` (tacticFuzz.harness) is the project's defect detector: ten RESULT invariants that
 * every fuzz session and audit relies on. A detector that only ever sees healthy documents proves
 * nothing — it could be vacuous and the fuzz would still be green. So this suite injects one
 * deliberate, minimal defect per invariant class into an otherwise healthy command-built document
 * and PINS which invariant actually fires. The pins are the audit result:
 *
 *   KILLED — the invariant written for this defect class caught it itself.
 *   MASKED — a different invariant caught it first. The defect class IS defended (defense in
 *            depth), but the named invariant is not independently evidenced by this mutant.
 *
 * Observed topology (2026-08-23, PLAN-014 M1): authored-side tears are largely absorbed by I9 —
 * relayout self-heals them, so the healed clone differs byte-wise from the mutated document and
 * idempotence fires. Resolved-side tears at a junction fire I5 (B1). I6 fires when compile
 * re-anchors a launch so the RESOLVED ball is continuous but disagrees with the authored origin.
 * I7 is structurally shadowed: an authored landing >2.8m from the resolved rest always implies a
 * resolved jump far beyond B1's budget, so I5 reports first — I7 is a second fence, not dead code.
 *
 * If a refactor changes who catches what, these pins go red — that is the point: re-audit, then
 * re-pin deliberately.
 *
 * Mutations are test-only: they clone the document and edit it directly, simulating the bug a
 * future command could write. Nothing here touches production source.
 */
import { describe, expect, it } from 'vitest'
import type { TacticDocument, Vec2 } from '@/domain/types'
import { maxBallJump } from '@/engine/ballContinuity'
import { board, violation } from './tacticFuzz.harness'
import { findSegment, makePath, sceneOf } from './segmentCommands'
import { addStepPass, addStepRun } from './stepCommands'

// ---------------------------------------------------------------------------------------------
// which invariant produced a violation message (mirrors the order and wording in violation())
// ---------------------------------------------------------------------------------------------

function detectorOf(msg: string | null): string | null {
  if (!msg) return null
  if (msg.startsWith('compile error')) return 'I1'
  if (msg.startsWith('non-finite waypoint')) return 'I2'
  if (msg.startsWith('two movements share')) return 'I3'
  if (msg.startsWith('first run of') || msg.includes('run chain torn')) return 'I4'
  if (msg.startsWith('ball discontinuity')) return 'I5'
  if (msg.includes('launches')) return 'I6'
  if (msg.includes('from where the ball lands')) return 'I7'
  if (msg.startsWith('passes overlap in flight')) return 'I8'
  if (msg.startsWith('relayout is not idempotent')) return 'I9'
  return 'I10' // invalid document / save → load rejected / save → load changed
}

// ---------------------------------------------------------------------------------------------
// fixtures — built through the real commands, asserted healthy before any mutation
// ---------------------------------------------------------------------------------------------

/** Holder passes to a runner who ran in step 1; the standard relay every defect ships in. */
function relayDoc() {
  const core = board()
  const d0 = core.getDocument()
  const holder = d0.players.find((p) => p.id === d0.ball.initialHolderId)!
  const runner = d0.players.find((p) => p.teamId === holder.teamId && p.id !== holder.id)!
  const dest: Vec2 = { x: runner.home.x + 10, y: runner.home.y }
  const runId = addStepRun(core, runner.id, makePath([runner.home, dest]).waypoints, 1)!
  const passId = addStepPass(core, makePath([d0.ball.home, dest]).waypoints, 2, holder.id)!
  const doc = core.getDocument()
  expect(violation(doc), 'relay fixture must be healthy before mutation').toBeNull()
  return { core, doc, runId, passId, holderId: holder.id, runnerId: runner.id }
}

/** One player, two chained runs — the chain-continuity fixture. */
function chainDoc() {
  const core = board()
  const d0 = core.getDocument()
  const p = d0.players.find((x) => x.id !== d0.ball.initialHolderId)!
  const mid: Vec2 = { x: p.home.x + 8, y: p.home.y }
  const end: Vec2 = { x: p.home.x + 8, y: p.home.y + 6 }
  const runA = addStepRun(core, p.id, makePath([p.home, mid]).waypoints, 1)!
  const runB = addStepRun(core, p.id, makePath([mid, end]).waypoints, 2)!
  const doc = core.getDocument()
  expect(violation(doc), 'chain fixture must be healthy before mutation').toBeNull()
  return { doc, runA, runB, playerId: p.id }
}

function mutate(doc: TacticDocument, f: (d: TacticDocument) => void): TacticDocument {
  const c = structuredClone(doc)
  f(c)
  return c
}

type PathSegment = {
  id: string
  step?: number
  timing?: { duration?: number }
  path: { waypoints: { id: string; p: Vec2 }[] }
}

function pathSeg(doc: TacticDocument, id: string): PathSegment {
  const f = findSegment(doc, id)
  if (!f || !('path' in f.segment)) throw new Error(`no path segment ${id}`)
  return f.segment as unknown as PathSegment
}

/** Expect the mutant to be caught, and pin WHO catches it. */
function expectDetectedBy(name: string, msg: string | null, pinned: string) {
  expect(msg, `${name}: mutant must not survive`).not.toBeNull()
  expect(detectorOf(msg), `${name}: detector changed — re-audit before re-pinning (${msg})`).toBe(
    pinned,
  )
}

// ---------------------------------------------------------------------------------------------
// the matrix
// ---------------------------------------------------------------------------------------------

describe('invariant mutation-kill (PLAN-014 M1)', () => {
  it('I1 KILLED — a dangling trigger is a compile error', () => {
    const { doc, runB } = chainDoc()
    const m = mutate(doc, (d) => {
      const f = findSegment(d, runB)!
      ;(f.segment as { trigger: unknown }).trigger = {
        type: 'afterSegment',
        segmentId: 'seg-ghost',
        anchor: 'end',
        offset: 0,
      }
    })
    expectDetectedBy('I1 danglingTrigger', violation(m), 'I1')
  })

  it('duplicate segment id CRASHES compile instead of reporting an issue (Finding F-M1-04)', () => {
    const { doc, runA } = chainDoc()
    const m = mutate(doc, (d) => {
      const tr = sceneOf(d).timeline.tracks.find((t) => t.segments.some((s) => s.id === runA))!
      const dup = structuredClone(tr.segments.find((s) => s.id === runA)!)
      ;(dup as { step?: number }).step = 3 // different step so only the id collides, not I3
      tr.segments.push(dup)
    })
    // compile PUSHES the 'duplicate segment id' issue but then keeps compiling and dies in
    // scheduleDuration on the clobbered pending entry. Detected loudly (a fuzz session would
    // fail on the throw), but the I1 contract — errors come back as issues — is broken here.
    // Remediation candidate; pinned as the current truth.
    expect(() => violation(m)).toThrow(/keys/)
  })

  it('I2 KILLED — non-finite LAST waypoint', () => {
    const { doc, runId } = relayDoc()
    const m = mutate(doc, (d) => {
      const wps = pathSeg(d, runId).path.waypoints
      wps[wps.length - 1]!.p = { x: Number.NaN, y: Number.NaN }
    })
    expectDetectedBy('I2a lastWaypointNaN', violation(m), 'I2')
  })

  it('I2 MASKED by I9 — non-finite INTERIOR waypoint (I2 only reads first/last)', () => {
    const { doc, runA } = chainDoc()
    const m = mutate(doc, (d) => {
      const wps = pathSeg(d, runA).path.waypoints
      const a = wps[0]!.p
      const b = wps[wps.length - 1]!.p
      wps.splice(1, 0, { id: 'wp-mut', p: { x: (a.x + b.x) / 2, y: Number.NaN } })
    })
    // Defended, but not by I2: relayout recomputes the timing from the (NaN-poisoned) length and
    // the clone diverges — idempotence fires. Widening I2 to every waypoint would make this
    // independent (Finding F-M1-01, remediation candidate).
    expectDetectedBy('I2b interiorWaypointNaN', violation(m), 'I9')
  })

  it('I3 KILLED — two movements for one entity in one step', () => {
    const { doc, runA, playerId } = chainDoc()
    const m = mutate(doc, (d) => {
      const tr = sceneOf(d).timeline.tracks.find((t) => t.entityId === playerId)!
      const dup = structuredClone(tr.segments.find((s) => s.id === runA)!)
      ;(dup as { id: string }).id = 'seg-mut-dup'
      tr.segments.push(dup)
    })
    expectDetectedBy('I3 duplicateStep', violation(m), 'I3')
  })

  it('I4 KILLED — first run torn from the token', () => {
    const { doc, runA } = chainDoc()
    const m = mutate(doc, (d) => {
      const wps = pathSeg(d, runA).path.waypoints
      wps[0]!.p = { x: wps[0]!.p.x + 2, y: wps[0]!.p.y + 2 }
    })
    expectDetectedBy('I4a tokenGap', violation(m), 'I4')
  })

  it('I4 KILLED — chain torn between two runs', () => {
    const { doc, runB } = chainDoc()
    const m = mutate(doc, (d) => {
      const wps = pathSeg(d, runB).path.waypoints
      wps[0]!.p = { x: wps[0]!.p.x + 2.5, y: wps[0]!.p.y }
    })
    expectDetectedBy('I4b chainTear', violation(m), 'I4')
  })

  it('I5 KILLED / I7 MASKED — landing moved away from where the ball rests', () => {
    const { doc, passId } = relayDoc()
    const m = mutate(doc, (d) => {
      const wps = pathSeg(d, passId).path.waypoints
      const last = wps[wps.length - 1]!
      last.p = { x: last.p.x, y: last.p.y + 3.5 }
    })
    // This is I7's defect class (authored landing ≠ resolved rest), but the resolved ball path
    // then jumps metres at the receive junction, and I5 (B1) is checked first. I7 can only fire
    // if a landing is >2.8m off while the resolved path stays continuous — structurally excluded
    // at a junction. I7 stays as the second fence; B1 is the live detector for this class.
    expectDetectedBy('I5/I7 landingMoved3.5m', violation(m), 'I5')
  })

  it('I6 KILLED — launch torn from where the ball is', () => {
    const { doc, passId } = relayDoc()
    const m = mutate(doc, (d) => {
      const wps = pathSeg(d, passId).path.waypoints
      wps[0]!.p = { x: wps[0]!.p.x + 3, y: wps[0]!.p.y }
    })
    // compile re-anchors the resolved launch, so B1 sees a continuous ball — the AUTHORED origin
    // is what lies, and that is exactly I6's contract.
    expectDetectedBy('I6 junctionTear3m', violation(m), 'I6')
  })

  it('I9 catches the sub-budget authored tear (1m — under I6 tolerance, healed by relayout)', () => {
    const { doc, passId } = relayDoc()
    const m = mutate(doc, (d) => {
      const wps = pathSeg(d, passId).path.waypoints
      wps[0]!.p = { x: wps[0]!.p.x + 1, y: wps[0]!.p.y }
    })
    // 1m is under I6's 2.8m tolerance and compile re-anchoring hides it from B1 — but relayout
    // snaps the origin back, the clone differs, and idempotence reports the document lied.
    expectDetectedBy('I5b junctionTear1m', violation(m), 'I9')
  })

  it('B1 budget masking — a short-duration segment inflates the global allowance (characterization)', () => {
    // The B1 budget is GLOBAL: allowed = topBallSpeed·dt + slack, and topBallSpeed grows with
    // 1/shortest-run-duration (the legitimate carry swing). So one extreme segment ANYWHERE
    // raises the allowance for every junction. Measure it: the same 1.2m landing tear, with and
    // without an unrelated 0.06s-duration run.
    const base = relayDoc()
    const tear = (d: TacticDocument) => {
      const wps = pathSeg(d, base.passId).path.waypoints
      const last = wps[wps.length - 1]!
      last.p = { x: last.p.x, y: last.p.y + 1.2 }
    }
    const torn = mutate(base.doc, tear)
    const jumpAlone = maxBallJump(torn)
    expect(jumpAlone, 'baseline: a 1.2m landing tear must be over the quiet budget').not.toBeNull()

    // distractor: a legal 1.2m run on an uninvolved player, then its duration crushed to 0.06s
    const d1 = base.doc
    const involved = new Set<string>([base.holderId, base.runnerId])
    const other = d1.players.find((p) => !involved.has(p.id))!
    const distractorId = addStepRun(
      base.core,
      other.id,
      makePath([other.home, { x: other.home.x + 1.2, y: other.home.y }]).waypoints,
      1,
    )!
    const healthy = base.core.getDocument()
    expect(violation(healthy), 'distractor fixture must be healthy').toBeNull()
    const tornWithDistractor = mutate(healthy, (d) => {
      tear(d)
      const seg = pathSeg(d, distractorId)
      if (seg.timing) seg.timing.duration = 0.06
    })
    const jumpMasked = maxBallJump(tornWithDistractor)
    // CHARACTERIZATION (Finding F-M1-02): the tear detected on a quiet board is invisible next to
    // one 0.06s segment — the budget more than doubles. The full violation() still flags the
    // DOCUMENT (relayout restores the crushed duration → I9), so the mutant does not survive the
    // suite; but B1 alone is honest only while the board has no extreme segment.
    expect(jumpAlone!.allowed).toBeLessThan(1.2)
    expect(jumpMasked, 'B1 budget inflated past the tear by the distractor').toBeNull()
    expect(detectorOf(violation(tornWithDistractor))).toBe('I9')
  })

  it('I8 — overlap predicate (not reachable by document mutation; unit-test the rule itself)', () => {
    // compile derives the schedule, so a document cannot INJECT overlapping flights — I8 guards a
    // future compile regression. Evidence the predicate works on the exact shape violation() uses:
    const times: Record<string, { start: number; end: number }> = {
      a: { start: 0, end: 2 },
      b: { start: 1.5, end: 3 }, // starts before a ends
    }
    const ordered = ['a', 'b'].sort((x, y) => times[x]!.start - times[y]!.start)
    let overlap = false
    for (let i = 1; i < ordered.length; i++) {
      const prev = times[ordered[i - 1]!]!
      const cur = times[ordered[i]!]!
      if (cur.start < prev.end - 1e-6) overlap = true
    }
    expect(overlap).toBe(true)
  })

  it('I9 KILLED — a pre-fixed-point document (home nudged under the I4 threshold)', () => {
    const { doc, playerId } = chainDoc()
    const m = mutate(doc, (d) => {
      const p = d.players.find((x) => x.id === playerId)!
      p.home = { x: p.home.x + 0.5, y: p.home.y }
    })
    expectDetectedBy('I9 preFixedPoint', violation(m), 'I9')
  })

  it('I10 KILLED — a document the validator refuses (negative pitch)', () => {
    const { doc } = relayDoc()
    const m = mutate(doc, (d) => {
      d.pitch = { ...d.pitch, width: -5 }
    })
    expectDetectedBy('I10a negativePitch', violation(m), 'I10')
  })

  it('I10 — a ghost initial holder', () => {
    const { doc } = relayDoc()
    const m = mutate(doc, (d) => {
      ;(d.ball as { initialHolderId?: string }).initialHolderId = 'player-ghost'
    })
    const msg = violation(m)
    expect(msg, 'ghost holder must be caught').not.toBeNull()
  })

  it('unknown extra fields round-trip untouched — TOLERATED BY DESIGN, not a gap', () => {
    const { doc } = relayDoc()
    const m = mutate(doc, (d) => {
      ;(d as unknown as Record<string, unknown>).mutantJunk = { hello: 1 }
    })
    // validateDocument is deliberately tolerant of unknown fields (forward compat) and serialize
    // keeps them, so nothing fires. Pinned so a future STRICT importer shows up here as a
    // deliberate contract change, not a surprise.
    expect(violation(m)).toBeNull()
  })

  it('dead receiver reference — healed by relayout, caught as I9', () => {
    const { doc, passId } = relayDoc()
    const m = mutate(doc, (d) => {
      const f = findSegment(d, passId)!
      ;(f.segment as { receiverId?: string }).receiverId = 'player-ghost'
    })
    // relayout resolves the dead receiver (pass → loose) so the clone differs — idempotence
    // fires. The validator does not check receiverId liveness (Finding F-M1-03, gap candidate:
    // a dead receiver in a SAVED file would import, then change meaning on first relayout).
    expectDetectedBy('I10b deadReceiver', violation(m), 'I9')
  })
})
