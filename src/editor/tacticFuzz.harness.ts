/**
 * TACTIC FUZZ — every editing operation, in random order, checked against RESULT invariants.
 *
 * The recurring defects in this project were never "this function is wrong". They were "these two
 * edits, in this order, leave the document saying two different things about where the ball is".
 * Hand scenarios cannot find those: the same board authored in a different sequence passes. So this
 * suite drives the real commands — draw, bend, delete, re-draw elsewhere, re-step, move a player,
 * move the ball, grab the ball at an earlier moment, undo — and after EVERY single one asks the
 * document what it actually depicts.
 *
 * The invariants below are deliberately about the RESULT, not about any resolver, so they keep
 * catching the bug after the next refactor moves the resolvers around (user 2026-08-22 playbook).
 *
 * Deterministic: every failure prints its seed and the exact op log that produced it.
 */
import { createEmptyDocument } from '@/domain'
import type { Id, TacticDocument, Vec2 } from '@/domain/types'
import { describeJump, maxBallJump } from '@/engine/ballContinuity'
import { compile } from '@/engine/compile'
import { stateAt } from '@/engine/stateAt'
import { addPlayer, applyFormations, removeEntities, seedDefaultTeams } from './commands'
import { EditorCore } from './editorCore'
import { SCENARIOS } from '@/presets/scenarios'
import { parseDocument, serialize } from './persistence'
import { validateDocument } from './validateDocument'
import { carryOffset } from '@/engine/compile'
import {
  findSegment,
  makePath,
  moveBallStartInDraft,
  moveTravelEndInDraft,
  sceneOf,
  shiftBallAnchorsForPlayerInDraft,
  shiftEntityPathsInDraft,
} from './segmentCommands'
import {
  addStepPass,
  addStepRun,
  bendGrabWaypointInDraft,
  bendMoveWaypointInDraft,
  MAX_STEP,
  clearStep,
  relayoutStepsInDraft,
  removeStepSegment,
  resolvePassReceiverInDraft,
  setSegmentStep,
  shiftJunctionAnchorsInDraft,
  stepOf,
} from './stepCommands'

// ---------------------------------------------------------------------------------------------
// harness
// ---------------------------------------------------------------------------------------------

function rng(seed: number) {
  let s = (seed >>> 0) || 1
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}

export function board() {
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

const clampToPitch = (p: Vec2): Vec2 => ({
  x: Math.max(2, Math.min(103, p.x)),
  y: Math.max(2, Math.min(66, p.y)),
})

interface PathSeg {
  id: Id
  entityId: Id
  kind: string
  step: number
  first: Vec2
  last: Vec2
  receiverId?: Id
}

export function authored(doc: TacticDocument): PathSeg[] {
  const out: PathSeg[] = []
  for (const tr of sceneOf(doc).timeline.tracks) {
    for (const s of tr.segments) {
      if (!('path' in s) || s.id.startsWith('gen-')) continue
      const wps = s.path.waypoints
      out.push({
        id: s.id,
        entityId: tr.entityId,
        kind: s.kind,
        step: stepOf(s as { step?: number }),
        first: { ...wps[0]!.p },
        last: { ...wps[wps.length - 1]!.p },
        receiverId: (s as { receiverId?: Id }).receiverId,
      })
    }
  }
  return out
}

/** A segment's waypoints, deep-copied so a later mutation cannot rewrite the record of them. */
function waypointsOf(doc: TacticDocument, segId: Id): { id: Id }[] {
  const f = findSegment(doc, segId)
  if (!f || !('path' in f.segment)) return []
  return JSON.parse(JSON.stringify(f.segment.path.waypoints)) as { id: Id }[]
}

const playableEnd = (doc: TacticDocument): number => {
  const cm = compile(doc)
  let end = 0
  for (const t of Object.values(cm.segmentTimes))
    if (Number.isFinite(t.end) && t.end > end) end = t.end
  return end
}

const finite = (p: Vec2 | undefined) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y)

/**
 * Everything the document must still be true about, after any edit whatsoever.
 * Returns a human-readable violation, or null.
 *
 * Tolerances are the ones the UI itself draws with: a pass rests on the carry ring (≤2.6 m) and a
 * chained run is snapped to its predecessor's ghost (0.75 m), so anything past those is a joint the
 * user can SEE torn open.
 */
export function violation(doc: TacticDocument): string | null {
  // I1 — the timeline compiles
  const cm = compile(doc)
  const errs = cm.issues.filter((i) => i.level === 'error')
  if (errs.length) return `compile error: ${errs.map((e) => e.message).join('; ')}`

  const segs = authored(doc)

  // I2 — no NaN anywhere the user can see
  for (const s of segs) {
    if (!finite(s.first) || !finite(s.last)) return `non-finite waypoint on ${s.kind} ${s.id}`
  }

  // I3 — ONE entity, ONE movement per step (a player in two places is a contradiction, not a
  //      slower animation — ADR-0009)
  const seen = new Map<string, Id>()
  for (const s of segs) {
    const key = `${s.entityId}@${s.step}`
    const prev = seen.get(key)
    if (prev) return `two movements share ${key} (${prev}, ${s.id})`
    seen.set(key, s.id)
  }

  // I4 — a player's chain is contiguous: it LEAVES FROM THE TOKEN and each run starts where the
  //      previous one ended. A gap anywhere is a teleport the eye can see.
  for (const tr of sceneOf(doc).timeline.tracks) {
    if (tr.entityKind !== 'player') continue
    const mine = segs.filter((s) => s.entityId === tr.entityId).sort((a, b) => a.step - b.step)
    const home = doc.players.find((p) => p.id === tr.entityId)?.home
    if (home && mine[0]) {
      const gap = Math.hypot(mine[0].first.x - home.x, mine[0].first.y - home.y)
      if (gap > 0.9)
        return `first run of ${tr.entityId} starts ${gap.toFixed(2)}m from the player's token`
    }
    for (let i = 1; i < mine.length; i++) {
      const gap = Math.hypot(mine[i]!.first.x - mine[i - 1]!.last.x, mine[i]!.first.y - mine[i - 1]!.last.y)
      if (gap > 0.9) return `run chain torn on ${tr.entityId}: step ${mine[i - 1]!.step}→${mine[i]!.step} gap ${gap.toFixed(2)}m`
    }
  }

  // I5 — the ball is ONE object: continuous through time (invariant B1)
  const jump = maxBallJump(doc)
  if (jump) return `ball discontinuity — ${describeJump(jump)}`

  // I6 — every pass LEAVES from where the ball actually is at its launch instant. This is the
  //      recurring "the pass came out of the wrong player" defect, stated as a result.
  const ballSegs = segs.filter((s) => s.kind === 'travel')
  for (const s of ballSegs) {
    const t = cm.segmentTimes[s.id]
    if (!t || !Number.isFinite(t.start)) continue
    const at = stateAt(cm, doc, Math.max(0, t.start - 0.02)).ball.pos
    const d = Math.hypot(at.x - s.first.x, at.y - s.first.y)
    if (d > 2.8) return `pass ${s.id} (step ${s.step}) launches ${d.toFixed(2)}m from where the ball is`
  }

  // I7 — and ARRIVES where the ball comes to rest
  for (const s of ballSegs) {
    const t = cm.segmentTimes[s.id]
    if (!t || !Number.isFinite(t.end)) continue
    const at = stateAt(cm, doc, t.end).ball.pos
    const d = Math.hypot(at.x - s.last.x, at.y - s.last.y)
    if (d > 2.8) return `pass ${s.id} (step ${s.step}) ends ${d.toFixed(2)}m from where the ball lands`
  }

  // I8 — passes are strictly sequential: there is only one ball, so two cannot overlap in flight
  const ordered = [...ballSegs].sort(
    (a, b) => (cm.segmentTimes[a.id]?.start ?? 0) - (cm.segmentTimes[b.id]?.start ?? 0),
  )
  for (let i = 1; i < ordered.length; i++) {
    const prev = cm.segmentTimes[ordered[i - 1]!.id]
    const cur = cm.segmentTimes[ordered[i]!.id]
    if (prev && cur && Number.isFinite(prev.end) && cur.start < prev.end - 1e-6)
      return `passes overlap in flight: ${ordered[i - 1]!.id} ends ${prev.end} but ${ordered[i]!.id} starts ${cur.start}`
  }

  // I9 — the pipeline settles: running it again changes nothing (byte-idempotent, ADR-0010 Q4)
  const clone = JSON.parse(JSON.stringify(doc)) as TacticDocument
  relayoutStepsInDraft(clone)
  if (JSON.stringify(clone) !== JSON.stringify(doc))
    return `relayout is not idempotent — ${firstDiff(doc, clone) ?? '(no scalar diff)'}`

  // I10 — the document is EXPORTABLE. Every edit has to leave something the importer accepts, or
  //       the user finds out at the moment they try to save the work they just did.
  const problems = validateDocument(doc)
  if (problems.length) return `invalid document: ${problems.slice(0, 3).join('; ')}`
  let round: TacticDocument
  try {
    round = parseDocument(serialize(doc))
  } catch (e) {
    return `save → load rejected the document: ${(e as Error).message}`
  }
  if (JSON.stringify(round) !== JSON.stringify(doc))
    return `save → load changed the document — ${firstDiff(doc, round) ?? '(no scalar diff)'}`

  return null
}

/** Where two documents first disagree, as a dotted path — so a failure names the field. */
export function firstDiff(a: unknown, b: unknown, path = ''): string | null {
  if (a === b) return null
  if (typeof a === 'number' && typeof b === 'number')
    return `${path}: ${a} → ${b} (Δ${(b - a).toFixed(4)})`
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object')
    return `${path}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`
  const ka = Object.keys(a as object)
  const kb = Object.keys(b as object)
  for (const k of new Set([...ka, ...kb])) {
    const d = firstDiff(
      (a as Record<string, unknown>)[k],
      (b as Record<string, unknown>)[k],
      path ? `${path}.${k}` : k,
    )
    if (d) return d
  }
  return null
}

// ---------------------------------------------------------------------------------------------
// the random session
// ---------------------------------------------------------------------------------------------

type Op =
  | 'run'
  | 'pass'
  | 'bend'
  | 'delete'
  | 'restep'
  | 'movePlayer'
  | 'dragRigid'
  | 'moveBall'
  | 'ballMoment'
  | 'passToMoment'
  | 'undo'
  | 'redo'
  | 'addPlayer'
  | 'deletePlayer'
  | 'clearStep'
  | 'carrySide'
  | 'receiveSide'

const OPS: Op[] = [
  'run', 'run', 'run',
  'pass', 'pass',
  'bend', 'bend',
  'delete',
  'restep',
  'movePlayer', 'movePlayer',
  'dragRigid',
  'moveBall',
  'ballMoment',
  'passToMoment',
  'undo',
  'redo',
  'addPlayer',
  'deletePlayer',
  'clearStep',
  'carrySide',
  'receiveSide',
]

export interface Failure {
  seed: number
  log: string[]
  why: string
}

/**
 * One session's starting board. A third of them start from a BUILT-IN SCENARIO instead of a blank
 * formation: those are authored documents that ship with the app, and "does editing one of the
 * examples break it" is exactly the question (user 2026-08-22: 어떠한 전술 재현에도).
 */
export function session(seed: number, steps: number, out?: { core?: EditorCore }): Failure | null {
  const rand = rng(seed)
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!
  const fromPreset = rand() < 0.34
  const preset = pick(SCENARIOS)
  const core = fromPreset ? new EditorCore(preset.build()) : board()
  if (out) out.core = core
  const doc0 = core.getDocument()
  const squad0 = doc0.players.filter((p) => p.teamId === doc0.teams[0]!.id)
  const opener = pick(squad0)
  const log: string[] = [`seed ${seed}`, fromPreset ? `preset ${preset.id}` : 'blank board']
  if (!fromPreset && opener) {
    log.push(`ball → #${opener.number}`)
    core.transaction('give', (dd) =>
      moveBallStartInDraft(
        dd as TacticDocument,
        { x: opener.home.x + 2, y: opener.home.y },
        opener.id,
      ),
    )
  }

  const fail = (why: string): Failure => ({ seed, log, why })

  // The board itself (formations, the opening give) was built with transactions too, so undo has a
  // FLOOR: past it the squad disappears and the session is testing an empty document, not the app.
  let depth = 0

  const bad0 = violation(core.getDocument())
  if (bad0) return fail(`at setup: ${bad0}`)

  /** Where the board actually draws an entity once everything authored has played. */
  const restOf = (id: Id): Vec2 => {
    const d = core.getDocument()
    const cm = compile(d)
    const rs = stateAt(cm, d, playableEnd(d))
    if (id === d.ball.id) return rs.ball.pos
    return rs.players[id]?.pos ?? d.players.find((p) => p.id === id)!.home
  }

  for (let i = 0; i < steps; i++) {
    const op = pick(OPS)
    const doc = core.getDocument()
    const segs = authored(doc)
    const squad = doc.players.filter((p) => p.teamId === doc.teams[0]!.id)
    if (squad.length === 0) break
    let did = ''

    switch (op) {
      case 'run': {
        const who = pick(squad)
        const from = restOf(who.id)
        const to = clampToPitch({
          x: from.x + (rand() - 0.35) * 34,
          y: from.y + (rand() - 0.5) * 28,
        })
        if (Math.hypot(to.x - from.x, to.y - from.y) < 3) continue
        const step = 1 + Math.floor(rand() * MAX_STEP)
        addStepRun(core, who.id, makePath([from, to]).waypoints, step)
        did = `run #${who.number} step≥${step} → (${to.x.toFixed(1)}, ${to.y.toFixed(1)})`
        break
      }
      case 'pass': {
        const from = restOf(core.getDocument().ball.id)
        const target = pick(squad)
        const to = restOf(target.id)
        if (Math.hypot(to.x - from.x, to.y - from.y) < 4) continue
        const step = 1 + Math.floor(rand() * MAX_STEP)
        addStepPass(core, makePath([from, to]).waypoints, step, undefined)
        did = `pass step≥${step} → #${target.number}`
        break
      }
      case 'passToMoment': {
        // aim the ball exactly at a player's FUTURE SPOT — the destination-moment path (D9)
        const runs = segs.filter((s) => s.kind === 'move')
        if (!runs.length) continue
        const r = pick(runs)
        const from = restOf(core.getDocument().ball.id)
        if (Math.hypot(r.last.x - from.x, r.last.y - from.y) < 4) continue
        const step = 1 + Math.floor(rand() * MAX_STEP)
        addStepPass(core, makePath([from, r.last]).waypoints, step, undefined)
        did = `pass → moment (step-${r.step} end of ${r.entityId})`
        break
      }
      case 'ballMoment': {
        // grab the ball at an EARLIER moment — the rest of its chain is overwritten
        const passes = segs.filter((s) => s.kind === 'travel')
        if (!passes.length) continue
        const grabbed = pick(passes)
        const at = grabbed.last
        const target = pick(squad)
        const to = clampToPitch({ x: at.x + (rand() - 0.5) * 40, y: at.y + (rand() - 0.5) * 30 })
        if (Math.hypot(to.x - at.x, to.y - at.y) < 4) continue
        const exact = grabbed.step + 1
        if (exact > MAX_STEP) continue
        addStepPass(core, makePath([at, to]).waypoints, exact, undefined, { exactStep: true })
        did = `ball grabbed after step ${grabbed.step} → new pass at step ${exact} (target #${target.number})`
        break
      }
      case 'bend': {
        if (!segs.length) continue
        const s = pick(segs)
        // Grab somewhere along the stroke and pull it sideways — a curvature change. The grab point
        // wanders so repeated bends build a genuinely multi-waypoint path, which is the only shape
        // where "bending is local" has anything to say.
        const f0 = 0.15 + rand() * 0.7
        const mid = {
          x: s.first.x + (s.last.x - s.first.x) * f0,
          y: s.first.y + (s.last.y - s.first.y) * f0,
        }
        const to = clampToPitch({ x: mid.x + (rand() - 0.5) * 22, y: mid.y + (rand() - 0.5) * 22 })
        const before = waypointsOf(doc, s.id)
        let grabbed: Id | null = null
        core.transaction('bend', (dd) => {
          const d = dd as TacticDocument
          const wpId = bendGrabWaypointInDraft(d, s.id, mid)
          if (!wpId) return
          grabbed = wpId
          bendMoveWaypointInDraft(d, s.id, wpId, to)
          relayoutStepsInDraft(d)
          const f = findSegment(d, s.id)
          if (f && f.segment.kind === 'travel') {
            const wps = f.segment.path.waypoints
            if (wps[wps.length - 1]!.id === wpId) {
              resolvePassReceiverInDraft(d, s.id)
              relayoutStepsInDraft(d)
            }
          }
        })
        /*
         * BENDING IS LOCAL (ADR-0010 R12-B). Only the grabbed point and its two neighbours may get
         * fresh curvature; every other waypoint keeps its position, handles and hold byte-for-byte.
         * The ends are exempt because the pipeline owns them — a run's start is pinned to the token,
         * a pass's ends to where the ball leaves and lands.
         */
        const after = waypointsOf(core.getDocument(), s.id)
        if (grabbed && before.length && after.length) {
          const gi = after.findIndex((w) => w.id === grabbed)
          const bad = after.find((w, k) => {
            if (k === 0 || k === after.length - 1) return false
            if (gi >= 0 && Math.abs(k - gi) <= 1) return false
            const was = before.find((x) => x.id === w.id)
            return was !== undefined && JSON.stringify(was) !== JSON.stringify(w)
          })
          if (bad) {
            log.push(`${i}: bend ${s.kind} step ${s.step}`)
            return fail(`bending moved a far waypoint (${bad.id}) on ${s.id}`)
          }
        }
        did = `bend ${s.kind} step ${s.step} → (${to.x.toFixed(1)}, ${to.y.toFixed(1)})`
        break
      }
      case 'delete': {
        if (!segs.length) continue
        const s = pick(segs)
        removeStepSegment(core, s.id)
        did = `delete ${s.kind} step ${s.step} of ${s.entityId}`
        break
      }
      case 'restep': {
        if (!segs.length) continue
        const s = pick(segs)
        const step = 1 + Math.floor(rand() * MAX_STEP)
        setSegmentStep(core, s.id, step)
        did = `restep ${s.kind} ${s.step} → ${step}`
        break
      }
      case 'movePlayer': {
        // exactly what a single-token drag commits: the home moves, whatever was pinned to the OLD
        // starting spot follows, everything downstream stays where the user put it
        const who = pick(squad)
        const cur = doc.players.find((p) => p.id === who.id)!.home
        const to = clampToPitch({ x: cur.x + (rand() - 0.5) * 20, y: cur.y + (rand() - 0.5) * 20 })
        const inc = { x: to.x - cur.x, y: to.y - cur.y }
        if (Math.hypot(inc.x, inc.y) < 0.5) continue
        core.transaction('drag player', (dd) => {
          const d = dd as TacticDocument
          const pl = d.players.find((x) => x.id === who.id)!
          const from = { ...pl.home }
          pl.home = to
          shiftJunctionAnchorsInDraft(d, who.id, '', from, inc)
          relayoutStepsInDraft(d)
        })
        did = `drag #${who.number} → (${to.x.toFixed(1)}, ${to.y.toFixed(1)})`
        break
      }
      case 'dragRigid': {
        // group drag: the player and their whole play translate together
        const who = pick(squad)
        const cur = doc.players.find((p) => p.id === who.id)!.home
        const to = clampToPitch({ x: cur.x + (rand() - 0.5) * 16, y: cur.y + (rand() - 0.5) * 16 })
        const inc = { x: to.x - cur.x, y: to.y - cur.y }
        if (Math.hypot(inc.x, inc.y) < 0.5) continue
        core.transaction('group drag', (dd) => {
          const d = dd as TacticDocument
          const pl = d.players.find((x) => x.id === who.id)!
          pl.home = to
          shiftEntityPathsInDraft(d, who.id, inc)
          shiftBallAnchorsForPlayerInDraft(d, who.id, inc)
          relayoutStepsInDraft(d)
        })
        did = `group-drag #${who.number} by (${inc.x.toFixed(1)}, ${inc.y.toFixed(1)})`
        break
      }
      case 'moveBall': {
        const d = core.getDocument()
        const onPlayer = rand() < 0.5
        const target = pick(squad)
        const to = onPlayer
          ? { x: target.home.x + 1.9, y: target.home.y + 1.1 }
          : clampToPitch({ x: 5 + rand() * 95, y: 4 + rand() * 60 })
        core.transaction('move ball', (dd) => {
          const d2 = dd as TacticDocument
          moveBallStartInDraft(d2, to, onPlayer ? target.id : null)
          relayoutStepsInDraft(d2)
        })
        did = `ball start → (${to.x.toFixed(1)}, ${to.y.toFixed(1)})${onPlayer ? ` on #${target.number}` : ' loose'}`
        void d
        break
      }
      case 'addPlayer': {
        const team = pick(doc.teams).id
        const at = clampToPitch({ x: 4 + rand() * 97, y: 4 + rand() * 60 })
        addPlayer(core, team, at)
        did = `add player at (${at.x.toFixed(1)}, ${at.y.toFixed(1)})`
        break
      }
      case 'deletePlayer': {
        if (doc.players.length <= 2) continue
        const who = pick(doc.players)
        removeEntities(core, [who.id])
        did = `delete #${who.number}`
        break
      }
      case 'clearStep': {
        if (!segs.length) continue
        const step = pick(segs).step
        clearStep(core, step)
        did = `clear step ${step}`
        break
      }
      case 'carrySide': {
        // ball-ghost orbit on a carried run: pin which side of the runner the ball sits
        const runs = segs.filter((s) => s.kind === 'move')
        if (!runs.length) continue
        const r = pick(runs)
        const off = carryOffset({ x: (rand() - 0.5) * 4, y: (rand() - 0.5) * 4 })
        core.transaction('Set carry side', (dd) => {
          const d = dd as TacticDocument
          const f = findSegment(d, r.id)
          if (f && f.segment.kind === 'move') f.segment.carryEnd = off
          relayoutStepsInDraft(d)
        })
        did = `carry side on step ${r.step}`
        break
      }
      case 'receiveSide': {
        // arrival-ghost orbit: slide where the receiver collects it, curvature untouched
        const recv = segs.filter((s) => s.kind === 'travel' && s.receiverId)
        if (!recv.length) continue
        const t = pick(recv)
        const rp = doc.players.find((p) => p.id === t.receiverId)
        if (!rp) continue
        const around = restOf(rp.id)
        const off = carryOffset({ x: (rand() - 0.5) * 5, y: (rand() - 0.5) * 5 })
        core.transaction('Set receive side', (dd) => {
          const d = dd as TacticDocument
          moveTravelEndInDraft(d, t.id, { x: around.x + off.x, y: around.y + off.y }, around)
          relayoutStepsInDraft(d)
        })
        did = `receive side on step ${t.step}`
        break
      }
      case 'undo': {
        if (depth === 0 || !core.undo()) continue
        depth--
        did = 'undo'
        break
      }
      case 'redo': {
        if (!core.redo()) continue
        depth++
        did = 'redo'
        break
      }
    }

    if (!did) continue
    if (op !== 'undo' && op !== 'redo') depth++
    log.push(`${i}: ${did}`)
    const why = violation(core.getDocument())
    if (why) return fail(why)
  }

  // undo the whole session back to the start: history must not corrupt anything on the way
  let guard = 0
  while (depth-- > 0 && core.undo() && guard++ < 500) {
    const why = violation(core.getDocument())
    if (why) {
      log.push(`unwind ${guard}`)
      return fail(`while undoing: ${why}`)
    }
  }
  while (core.redo() && guard++ < 1000) {
    const why = violation(core.getDocument())
    if (why) {
      log.push(`rewind ${guard}`)
      return fail(`while redoing: ${why}`)
    }
  }
  return null
}

/** Replay a session and hand back the editor it left behind — for triaging a failing seed. */
export function replay(seed: number, steps: number): EditorCore {
  const captured: { core?: EditorCore } = {}
  session(seed, steps, captured)
  return captured.core!
}
