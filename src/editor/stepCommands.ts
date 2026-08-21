/**
 * Simple-mode authoring (ADR-0009): every movement belongs to a STEP (1-10).
 * Same step → starts together; step n+1 starts when the slowest segment of step n ends.
 * Steps are stored on the segments (`step`); triggers are derived here, so the engine,
 * persistence and old documents are untouched.
 */
import type { Track, Id, Path, TacticDocument, Vec2, Waypoint } from '@/domain/types'
import { GEN_PREFIX } from '@/engine/opponent'
import { carryOffset, compile } from '@/engine/compile'
import { buildPathLUT } from '@/engine/path'
import { stateAt } from '@/engine/stateAt'
import { newId } from './commands'
import type { EditorCore } from './editorCore'
import {
  DEFAULT_PASS_SPEED,
  DEFAULT_PLAYER_SPEED,
  RECEIVE_RADIUS_M,
  ensureTrack,
  findSegment,
  findTrack,
  lastKnownPosition,
  passerFor,
  possessTrigger,
  removeSegmentInDraft,
  sceneOf,
  syncTravelReceiverInDraft,
} from './segmentCommands'

export const MAX_STEP = 9

export function stepOf(seg: { step?: number }): number {
  const n = seg.step ?? 1
  return Math.max(1, Math.min(MAX_STEP, Math.round(n)))
}

/** Steps that have at least one authored movement (for the step bar), plus counts. */
export function stepCounts(doc: TacticDocument): number[] {
  const counts = Array.from({ length: MAX_STEP }, () => 0)
  for (const track of sceneOf(doc).timeline.tracks)
    for (const s of track.segments) {
      if (!('path' in s) || s.id.startsWith(GEN_PREFIX)) continue
      counts[stepOf(s) - 1]!++
    }
  return counts
}

/**
 * Derive triggers/timings from steps and pin every ball anchor — ONE ordered pipeline
 * (ADR-0010 / audit Q4): structure first, then timing, then anchors, then constraints.
 * Byte-idempotent: running it twice yields the identical document (tested). Commands call it
 * ONCE at their end — it never calls itself and nothing here calls back into commands.
 */
export function relayoutStepsInDraft(draft: TacticDocument): void {
  const scene = sceneOf(draft)
  const authored = scene.timeline.tracks
    .flatMap((t) => t.segments)
    .filter((s) => 'path' in s && !s.id.startsWith(GEN_PREFIX))
  if (authored.length === 0) return
  const steps = [...new Set(authored.map(stepOf))].sort((a, b) => a - b)

  // 1) STRUCTURE (audit: self-heal must precede timing/anchor work). A ball travel with NO
  //    preceding possession while a holder is known leaves the ball parked at its initial spot
  //    until the pass fires — reinsert the possession so the ball rides with its holder.
  for (const track of scene.timeline.tracks) {
    if (track.entityKind !== 'ball') continue
    const firstPathIdx = track.segments.findIndex((s2) => 'path' in s2)
    if (firstPathIdx < 0) break
    const before = track.segments[firstPathIdx - 1]
    const holder = draft.ball.initialHolderId
    if (!before && holder) {
      track.segments.splice(firstPathIdx, 0, {
        id: newId('seg'),
        kind: 'possessed',
        trigger: { type: 'at', t: 0 },
        timing: { duration: 0 },
        holderId: holder,
      })
    }
    break
  }

  // 2) STEP GRAPH → timing. Same step = same start AND same end (user 2026-08-20 최종 확정).
  const deriveTimings = (): void => {
    let t = 0
    for (const step of steps) {
      const members = authored.filter((s2) => stepOf(s2) === step)
      let stepDur = 0.1
      for (const s2 of members) {
        const seg2 = s2 as { kind: string; path: Path }
        const speed = seg2.kind === 'travel' ? DEFAULT_PASS_SPEED : DEFAULT_PLAYER_SPEED
        stepDur = Math.max(stepDur, Math.max(0.2, buildPathLUT(seg2.path).length / speed))
      }
      stepDur = Math.round(stepDur * 100) / 100
      for (const s2 of members) {
        s2.trigger = { type: 'at', t }
        s2.timing = { duration: stepDur }
      }
      t = Math.round((t + stepDur) * 100) / 100
    }
  }
  deriveTimings()

  // 3) ORIGIN = BALL AT LAUNCH (ADR-0010 D2): the authored origin snaps to the ball position
  //    at the EXACT launch instant. Since M1 the compiled release anchor IS the shared carry
  //    resolver, so stateAt(t) at a travel start returns that same anchor — no ±ε sampling
  //    tricks (audit R4), and a second pass moves nothing (idempotence).
  {
    const cm0 = compile(draft)
    let moved = false
    for (const track of scene.timeline.tracks) {
      if (track.entityKind !== 'ball') continue
      for (const seg of track.segments) {
        if (seg.kind !== 'travel' || seg.id.startsWith(GEN_PREFIX)) continue
        if (seg.trigger.type !== 'at') continue
        const first = seg.path.waypoints[0]
        if (!first) continue
        const rs = stateAt(cm0, draft, seg.trigger.t)
        const launch = rs.ball.pos
        const dx = launch.x - first.p.x
        const dy = launch.y - first.p.y
        if (Math.hypot(dx, dy) > 0.25) {
          moved = true
          first.p = { x: launch.x, y: launch.y }
          if (first.handleIn)
            first.handleIn = { x: first.handleIn.x + dx, y: first.handleIn.y + dy }
          if (first.handleOut)
            first.handleOut = { x: first.handleOut.x + dx, y: first.handleOut.y + dy }
        }
      }
    }
    // lengths changed → re-derive the step timings once
    if (moved) deriveTimings()
  }

  // 4) THROUGH BALL constraint (user 2026-08-20): a pass aimed at a receiver's FUTURE spot
  //    must ARRIVE when the runner does — stretch the pass duration (never shrink).
  for (const track of scene.timeline.tracks) {
    if (track.entityKind !== 'ball') continue
    for (const seg of track.segments) {
      if (seg.kind !== 'travel' || !seg.receiverId || seg.id.startsWith(GEN_PREFIX)) continue
      if (seg.trigger.type !== 'at' || !('duration' in seg.timing)) continue
      const end = seg.path.waypoints[seg.path.waypoints.length - 1]?.p
      if (!end) continue
      const rTrack = scene.timeline.tracks.find((tr) => tr.entityId === seg.receiverId)
      if (!rTrack) continue
      for (const run of rTrack.segments) {
        if (!('path' in run) || run.id.startsWith(GEN_PREFIX)) continue
        if (run.trigger.type !== 'at' || !('duration' in run.timing)) continue
        const rEnd = run.path.waypoints[run.path.waypoints.length - 1]?.p
        // Pass ends rest at the receiver's CARRIED spot (2.0–2.6m) — the match tolerance
        // must cover that attachment distance.
        if (!rEnd || Math.hypot(rEnd.x - end.x, rEnd.y - end.y) > 3.0) continue
        const receiverArrives = run.trigger.t + run.timing.duration
        const synced = receiverArrives - seg.trigger.t
        if (synced > seg.timing.duration) {
          seg.timing.duration = Math.round(synced * 100) / 100
        }
        break
      }
    }
  }

  // 5) Ball possessions with an absolute time: keep them at/before the pass they precede.
  for (const track of scene.timeline.tracks) {
    if (track.entityKind !== 'ball') continue
    for (let i = 0; i < track.segments.length; i++) {
      const s = track.segments[i]!
      if (s.kind !== 'possessed' || s.trigger.type !== 'at') continue
      const next = track.segments
        .slice(i + 1)
        .find((x) => 'path' in x && x.trigger.type === 'at') as
        { trigger: { type: 'at'; t: number } } | undefined
      s.trigger = {
        type: 'at',
        t: i === 0 ? 0 : Math.min(s.trigger.t, next?.trigger.t ?? s.trigger.t),
      }
    }
  }
}

/** Player run drawn in simple mode: one undo step (create + step + relayout). */
export function addStepRun(
  core: EditorCore,
  playerId: Id,
  waypoints: Waypoint[],
  step: number,
): Id {
  const id = newId('seg')
  core.transaction('Add run', (d) => {
    const doc = d as TacticDocument
    const track = ensureTrack(doc, playerId, 'player')
    track.segments.push({
      id,
      kind: 'move',
      trigger: { type: 'at', t: 0 },
      timing: { speed: DEFAULT_PLAYER_SPEED },
      path: { waypoints },
      step: stepOf({ step }),
    })
    relayoutStepsInDraft(doc)
    // A run drawn AFTER a loose pass can become its receiver (user 2026-08-21 사진4): re-resolve
    // any receiverless pass ending near this run's end so the ball attaches to the carry ring
    // instead of stacking exactly on the player ghost.
    const runEnd = waypoints[waypoints.length - 1]?.p
    if (runEnd) {
      const ballTrack = findTrack(doc, doc.ball.id)
      let resolved = false
      for (const sg of ballTrack?.segments ?? []) {
        if (sg.kind !== 'travel' || sg.id.startsWith('gen-') || sg.receiverId) continue
        const end = sg.path.waypoints[sg.path.waypoints.length - 1]?.p
        if (end && Math.hypot(end.x - runEnd.x, end.y - runEnd.y) <= RECEIVE_RADIUS_M) {
          resolvePassReceiverInDraft(doc, sg.id)
          resolved = true
        }
      }
      if (resolved) relayoutStepsInDraft(doc)
    }
  })
  return id
}

/** Highest authored step on the ball track (0 when no pass exists yet). */
export function lastBallStep(track: Track | undefined): number {
  let max = 0
  for (const sg of track?.segments ?? []) {
    if (!('path' in sg) || sg.id.startsWith(GEN_PREFIX)) continue
    max = Math.max(max, stepOf(sg))
  }
  return max
}

/** Ball pass drawn in simple mode: create + step + relayout + receiver at arrival — one undo step. */
export function addStepPass(
  core: EditorCore,
  waypoints: Waypoint[],
  step: number,
  holderHint?: Id,
): Id {
  const id = newId('seg')
  core.transaction('Add pass', (d) => {
    const doc = d as TacticDocument
    const track = ensureTrack(doc, doc.ball.id, 'ball')
    // ONE ball: its passes are inherently sequential. A new pass can never fire at/before an
    // existing one (user 2026-08-21: 마지막 단계 이후 이어 그렸는데 0단계에서 발사) — drawing
    // from the live ball at a result frame used to inherit the step CHIP (1) and launch at t0.
    step = Math.max(step, lastBallStep(track) + 1)
    const last = track.segments[track.segments.length - 1]
    const holder = passerFor(doc, track, holderHint)
    if (holder && !(last && last.kind === 'possessed' && last.holderId === holder)) {
      // Inherit the CARRY DIRECTION from where the ball rests around the holder (user 2026-08-20):
      // without this the possession falls back to the fixed right-foot offset and the ball jumps.
      const holderHome = doc.players.find((p) => p.id === holder)?.home
      const off = holderHome
        ? carryOffset({ x: doc.ball.home.x - holderHome.x, y: doc.ball.home.y - holderHome.y })
        : undefined
      track.segments.push({
        id: newId('seg'),
        kind: 'possessed',
        trigger: possessTrigger(last, 0),
        timing: { duration: 0 },
        holderId: holder,
        ...(off ? { offset: off } : {}),
      })
    }
    track.segments.push({
      id,
      kind: 'travel',
      travelKind: 'pass',
      trigger: { type: 'at', t: 0 },
      timing: { speed: DEFAULT_PASS_SPEED },
      path: { waypoints },
      step: stepOf({ step }),
    })
    if (!doc.ball.initialHolderId && holder) doc.ball.initialHolderId = holder
    relayoutStepsInDraft(doc)
    resolvePassReceiverInDraft(doc, id)
    relayoutStepsInDraft(doc)
  })
  return id
}

/**
 * Receiver for a pass, tried in order: positions at the arrival time → resting (t=0) positions →
 * every authored future spot (ghosts) → each player's final position. First radius hit wins.
 * NOTE: mutates receiver/possession only — the CALLER runs relayoutStepsInDraft once
 * afterwards (single-pipeline rule, ADR-0010 / audit Q4).
 */
export function resolvePassReceiverInDraft(
  doc: TacticDocument,
  segmentId: Id,
  opts?: { preserveEndDirection?: boolean },
): void {
  const compiled = compile(doc)
  const arrival = compiled.segmentTimes[segmentId]?.end ?? 0
  const rs = stateAt(compiled, doc, arrival)
  const ghostSpots: { id: Id; pos: { x: number; y: number } }[] = []
  for (const tr of sceneOf(doc).timeline.tracks) {
    if (tr.entityKind !== 'player') continue
    for (const sg of tr.segments) {
      if (!('path' in sg) || sg.id.startsWith(GEN_PREFIX)) continue
      const end = sg.path.waypoints[sg.path.waypoints.length - 1]?.p
      if (end) ghostSpots.push({ id: tr.entityId, pos: end })
    }
  }
  const candidateSets: { id: Id; pos: { x: number; y: number } }[][] = [
    doc.players.map((p) => ({ id: p.id, pos: rs.players[p.id]?.pos ?? p.home })),
    doc.players.map((p) => ({ id: p.id, pos: p.home })),
    ghostSpots,
    doc.players.map((p) => ({ id: p.id, pos: lastKnownPosition(doc, p.id) })),
  ]
  for (const candidates of candidateSets) {
    syncTravelReceiverInDraft(doc, segmentId, candidates, RECEIVE_RADIUS_M, opts)
    const seg = findSegment(doc, segmentId)
    if (seg && seg.segment.kind === 'travel' && seg.segment.receiverId) break
  }
}

/**
 * Grab-and-bend: pick (or insert) the waypoint nearest to `at` on the segment's polyline.
 * Returns the waypoint id to drag. Existing waypoint within 1.2 m is reused.
 */
/** Grab an existing waypoint within this radius instead of inserting a new one. */
export const BEND_GRAB_RADIUS_M = 2.4

export function bendGrabWaypointInDraft(
  doc: TacticDocument,
  segmentId: Id,
  at: { x: number; y: number },
): Id | null {
  const f = findSegment(doc, segmentId)
  if (!f || !('path' in f.segment)) return null
  const wps = f.segment.path.waypoints
  // Reuse a nearby existing waypoint rather than spawning another one beside it. The old 1.2m
  // radius meant bending twice at roughly the same place left two control points a metre apart,
  // which kinks the curve and makes it feel twitchy (user 2026-08-22: 너무 민감하게 점이 잡혀).
  let bestI = -1
  let bestD = BEND_GRAB_RADIUS_M
  for (let i = 0; i < wps.length; i++) {
    const d = Math.hypot(wps[i]!.p.x - at.x, wps[i]!.p.y - at.y)
    if (d < bestD) {
      bestD = d
      bestI = i
    }
  }
  if (bestI >= 0) return wps[bestI]!.id
  // nearest polyline segment → insert there
  let insI = 1
  let insD = Infinity
  for (let i = 1; i < wps.length; i++) {
    const a = wps[i - 1]!.p
    const b = wps[i]!.p
    const abx = b.x - a.x
    const aby = b.y - a.y
    const len2 = abx * abx + aby * aby || 1
    const t = Math.max(0, Math.min(1, ((at.x - a.x) * abx + (at.y - a.y) * aby) / len2))
    const px = a.x + abx * t
    const py = a.y + aby * t
    const d = Math.hypot(px - at.x, py - at.y)
    if (d < insD) {
      insD = d
      insI = i
    }
  }
  const id = newId('w')
  wps.splice(insI, 0, { id, p: { x: at.x, y: at.y } })
  return id
}

/**
 * Move a waypoint and re-smooth LOCALLY (ADR-0010 / audit R12-B): only the grabbed point and
 * its two neighbours get fresh Catmull-Rom handles — every other waypoint keeps its position,
 * handles AND `hold` byte-for-byte. The old whole-path resmooth silently deleted holds and
 * rewrote non-adjacent curvature on every drag.
 */
export function bendMoveWaypointInDraft(
  doc: TacticDocument,
  segmentId: Id,
  waypointId: Id,
  to: { x: number; y: number },
): void {
  const f = findSegment(doc, segmentId)
  if (!f || !('path' in f.segment)) return
  const wps = f.segment.path.waypoints
  const i = wps.findIndex((w) => w.id === waypointId)
  if (i < 0) return
  const isEnd = i === wps.length - 1
  const old = { x: wps[i]!.p.x, y: wps[i]!.p.y }
  wps[i]!.p = { x: to.x, y: to.y }
  // Catmull-Rom handle refresh for the affected window only (same formula as smoothWaypoints)
  const n = wps.length
  const TENSION = 0.5
  for (let k = Math.max(0, i - 1); k <= Math.min(n - 1, i + 1); k++) {
    if (n < 3) break
    const p0 = wps[Math.max(0, k - 1)]!.p
    const p1 = wps[k]!.p
    const p2 = wps[Math.min(n - 1, k + 1)]!.p
    const w = wps[k]!
    if (k > 0) {
      w.handleIn = {
        x: p1.x - ((p2.x - p0.x) * TENSION) / 3,
        y: p1.y - ((p2.y - p0.y) * TENSION) / 3,
      }
    }
    if (k < n - 1) {
      w.handleOut = {
        x: p1.x + ((p2.x - p0.x) * TENSION) / 3,
        y: p1.y + ((p2.y - p0.y) * TENSION) / 3,
      }
    }
  }
  const inc = { x: to.x - old.x, y: to.y - old.y }
  if (isEnd && (inc.x !== 0 || inc.y !== 0))
    shiftJunctionAnchorsInDraft(doc, f.track.entityId, segmentId, old, inc)
}

/** Chained next-movement origin is SNAPPED to the ghost — tight follow tolerance. */
const JUNCTION_CHAIN_M = 0.75
/** Ball anchors sit within carry offset (≤2.6 m) / receive radius (3.5 m) of the junction. */
const JUNCTION_BALL_M = RECEIVE_RADIUS_M

function shiftWaypoint(w: Waypoint, inc: Vec2): void {
  w.p = { x: w.p.x + inc.x, y: w.p.y + inc.y }
  if (w.handleIn) w.handleIn = { x: w.handleIn.x + inc.x, y: w.handleIn.y + inc.y }
  if (w.handleOut) w.handleOut = { x: w.handleOut.x + inc.x, y: w.handleOut.y + inc.y }
}

/**
 * Junction follow (user 2026-08-20): dragging a movement's END (its ghost) must carry everything
 * anchored at that future spot — the same entity's CHAINED next movement (its origin was drawn
 * from this ghost) and the ball anchors held there (the pass this player makes FROM that spot,
 * the pass they RECEIVE at it). Only the junction waypoint translates; the far anchor stays put,
 * so the user's aimed destination is never disturbed. QA: "2단계와 3단계를 잇는 선수를 옮겼는데
 * 공이 같이 안 옮겨져".
 */
export function shiftJunctionAnchorsInDraft(
  doc: TacticDocument,
  entityId: Id,
  movedSegId: Id,
  oldEnd: Vec2,
  inc: Vec2,
): void {
  const near = (p: Vec2, tol: number) => Math.hypot(p.x - oldEnd.x, p.y - oldEnd.y) <= tol
  // 1) chained next movement of the SAME entity: origin snapped to the moved end
  const track = findTrack(doc, entityId)
  if (track)
    for (const s of track.segments) {
      if (!('path' in s) || s.id === movedSegId || s.id.startsWith(GEN_PREFIX)) continue
      const first = s.path.waypoints[0]
      if (first && near(first.p, JUNCTION_CHAIN_M)) shiftWaypoint(first, inc)
    }
  // 2) ball anchors at the junction (player movements only)
  if (entityId === doc.ball.id) return
  const ball = findTrack(doc, doc.ball.id)
  if (!ball) return
  for (let i = 0; i < ball.segments.length; i++) {
    const seg = ball.segments[i]!
    if (seg.kind !== 'travel') continue
    // pass INTO this player arriving at the moved spot → its end travels with the junction
    if (seg.receiverId === entityId) {
      const last = seg.path.waypoints[seg.path.waypoints.length - 1]
      if (last && near(last.p, JUNCTION_BALL_M)) shiftWaypoint(last, inc)
    }
    // pass FROM this player leaving the moved spot → its origin travels with the junction
    const prev = ball.segments[i - 1]
    if (prev && prev.kind === 'possessed' && prev.holderId === entityId) {
      const first = seg.path.waypoints[0]
      if (first && near(first.p, JUNCTION_BALL_M)) shiftWaypoint(first, inc)
    }
  }
}

/** Change a movement's step (badge click / number key on selection). */
export function setSegmentStep(core: EditorCore, segmentId: Id, step: number): void {
  core.transaction('Set step', (d) => {
    const doc = d as TacticDocument
    const f = findSegment(doc, segmentId)
    if (!f || !('path' in f.segment)) return
    f.segment.step = stepOf({ step })
    relayoutStepsInDraft(doc)
  })
}

/** Authored (non-generated) path segment ids matching `pred` — the partial-clear unit (M2). */
function authoredIds(
  doc: TacticDocument,
  pred: (seg: { id: Id; step?: number }, entityId: Id) => boolean,
): Id[] {
  const ids: Id[] = []
  for (const track of sceneOf(doc).timeline.tracks)
    for (const s of track.segments) {
      if (!('path' in s) || s.id.startsWith(GEN_PREFIX)) continue
      if (pred(s, track.entityId)) ids.push(s.id)
    }
  return ids
}

/** Shared partial clear: remove the given authored movements in ONE transaction (A-06). */
function clearMovements(core: EditorCore, label: string, ids: Id[]): number {
  if (ids.length === 0) return 0
  core.transaction(label, (d) => {
    const doc = d as TacticDocument
    for (const id of ids) removeSegmentInDraft(doc, id)
    relayoutStepsInDraft(doc)
  })
  return ids.length
}

/** Delete every movement of one step — one undo entry. Generated (gen-) segments survive. */
export function clearStep(core: EditorCore, step: number): number {
  return clearMovements(
    core,
    'Clear step',
    authoredIds(core.getDocument(), (s) => stepOf(s) === step),
  )
}

/** Delete every authored movement of one entity (player runs, or all ball passes). */
export function clearEntityMovements(core: EditorCore, entityId: Id): number {
  return clearMovements(
    core,
    'Clear entity movements',
    authoredIds(core.getDocument(), (_s, eid) => eid === entityId),
  )
}

/** Delete every authored movement on the board; formation/meta/drawings stay. */
export function clearAllMovements(core: EditorCore): number {
  return clearMovements(
    core,
    'Clear all movements',
    authoredIds(core.getDocument(), () => true),
  )
}

/** Delete a movement and re-derive the remaining steps — one undo step. */
export function removeStepSegment(core: EditorCore, segmentId: Id): void {
  core.transaction('Delete', (d) => {
    const doc = d as TacticDocument
    removeSegmentInDraft(doc, segmentId)
    relayoutStepsInDraft(doc)
  })
}

/**
 * Compiled time window of a step: shared start (all members start together) to the end of its
 * slowest member. Read-only — used by the UI for step preview and scoped replay (PLAN-005 M1).
 * Returns null when the step has no authored movement.
 */
export function stepWindow(
  doc: TacticDocument,
  step: number,
): { start: number; end: number } | null {
  const compiled = compile(doc)
  let start = Infinity
  let end = 0
  for (const track of sceneOf(doc).timeline.tracks)
    for (const s of track.segments) {
      if (!('path' in s) || s.id.startsWith(GEN_PREFIX) || stepOf(s) !== step) continue
      const tm = compiled.segmentTimes[s.id]
      if (!tm) continue
      start = Math.min(start, tm.start)
      end = Math.max(end, tm.end)
    }
  return Number.isFinite(start) ? { start, end } : null
}

/** Start time of a step (for setting the playhead when authoring). */
export function stepStart(doc: TacticDocument, step: number): number {
  return stepWindow(doc, step)?.start ?? 0
}
