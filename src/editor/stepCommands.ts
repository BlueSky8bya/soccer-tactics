/**
 * Simple-mode authoring (ADR-0009): every movement belongs to a STEP (1-10).
 * Same step → starts together; step n+1 starts when the slowest segment of step n ends.
 * Steps are stored on the segments (`step`); triggers are derived here, so the engine,
 * persistence and old documents are untouched.
 */
import type { Id, Path, TacticDocument, Waypoint } from '@/domain/types'
import { GEN_PREFIX } from '@/engine/opponent'
import { carryOffset, compile } from '@/engine/compile'
import { smoothWaypoints } from '@/engine/path'
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
 * Derive every authored path trigger from step numbers. Auto-generated (`gen-`) segments keep
 * their event anchors; ball possessions keep their chaining (their `at` times are pulled to the
 * following pass's start so nothing clamps).
 */
export function relayoutStepsInDraft(draft: TacticDocument): void {
  const scene = sceneOf(draft)
  const authored = scene.timeline.tracks
    .flatMap((t) => t.segments)
    .filter((s) => 'path' in s && !s.id.startsWith(GEN_PREFIX))
  if (authored.length === 0) return
  const steps = [...new Set(authored.map(stepOf))].sort((a, b) => a - b)
  let t = 0
  for (const step of steps) {
    const members = authored.filter((s) => stepOf(s) === step)
    // Same step = same START; the step lasts as long as its longest movement at natural speed.
    // Balance guard (user 2026-08-20): a short movement stretches to AT MOST 3x its natural
    // duration — beyond that it keeps a believable speed and simply finishes early instead of
    // crawling (1m next to a 30m sprint must not take the same seconds).
    const MAX_STRETCH = 3
    let stepDur = 0.1
    const durs = new Map<string, number>()
    for (const s of members) {
      const seg = s as { kind: string; path: Path }
      const speed = seg.kind === 'travel' ? DEFAULT_PASS_SPEED : DEFAULT_PLAYER_SPEED
      const dur = Math.max(0.2, buildPathLUT(seg.path).length / speed)
      durs.set(s.id, dur)
      stepDur = Math.max(stepDur, dur)
    }
    stepDur = Math.round(stepDur * 100) / 100
    for (const s of members) {
      const natural = durs.get(s.id) ?? stepDur
      const capped = Math.round(Math.min(stepDur, natural * MAX_STRETCH) * 100) / 100
      s.trigger = { type: 'at', t }
      s.timing = { duration: capped }
    }
    t = Math.round((t + stepDur) * 100) / 100
  }
  // Ball possessions with an absolute time: keep them at/before the pass they precede.
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
  })
  return id
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
  })
  return id
}

/**
 * Receiver for a pass, tried in order: positions at the arrival time → resting (t=0) positions →
 * every authored future spot (ghosts) → each player's final position. First radius hit wins.
 */
export function resolvePassReceiverInDraft(doc: TacticDocument, segmentId: Id): void {
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
    syncTravelReceiverInDraft(doc, segmentId, candidates, RECEIVE_RADIUS_M)
    const seg = findSegment(doc, segmentId)
    if (seg && seg.segment.kind === 'travel' && seg.segment.receiverId) break
  }
}

/**
 * Grab-and-bend: pick (or insert) the waypoint nearest to `at` on the segment's polyline.
 * Returns the waypoint id to drag. Existing waypoint within 1.2 m is reused.
 */
export function bendGrabWaypointInDraft(
  doc: TacticDocument,
  segmentId: Id,
  at: { x: number; y: number },
): Id | null {
  const f = findSegment(doc, segmentId)
  if (!f || !('path' in f.segment)) return null
  const wps = f.segment.path.waypoints
  // nearest existing waypoint
  let bestI = -1
  let bestD = 1.2
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

/** Move a waypoint and re-smooth the whole path (Catmull-Rom handles) — the "bend" feel. */
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
  const pts = wps.map((w, k) => (k === i ? { x: to.x, y: to.y } : w.p))
  f.segment.path.waypoints = smoothWaypoints(
    pts,
    wps.map((w) => w.id),
  )
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
