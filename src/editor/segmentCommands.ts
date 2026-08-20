/**
 * Timeline / segment commands (ADR-0003 model, ADR-0005 transactions).
 */
import type {
  BallTravelKind,
  Id,
  Path,
  Segment,
  TacticDocument,
  Timing,
  Track,
  Trigger,
  Vec2,
  Waypoint,
} from '@/domain/types'
import { carryOffset } from '@/engine/compile'
import { newId } from './commands'
import type { EditorCore } from './editorCore'

export const newIdFor = newId

export const SPEED_PRESETS = [
  { id: 'walk', label: '걷기', speed: 1.5 },
  { id: 'jog', label: '조깅', speed: 3 },
  { id: 'run', label: '달리기', speed: 5 },
  { id: 'sprint', label: '전력질주', speed: 7.5 },
] as const
export const PASS_SPEED_PRESETS = [
  { id: 'short', label: '짧게', speed: 10 },
  { id: 'firm', label: '보통', speed: 16 },
  { id: 'driven', label: '강하게', speed: 22 },
] as const
export const DEFAULT_PLAYER_SPEED = 7 // m/s — user 2026-08-20: 재생이 너무 느림
export const DEFAULT_PASS_SPEED = 20

export function sceneOf(doc: TacticDocument, sceneIndex = 0) {
  return doc.scenes[sceneIndex] ?? doc.scenes[0]!
}

export function findTrack(doc: TacticDocument, entityId: Id): Track | undefined {
  return sceneOf(doc).timeline.tracks.find((t) => t.entityId === entityId)
}

export function findSegment(
  doc: TacticDocument,
  segmentId: Id,
): { track: Track; segment: Segment; index: number } | undefined {
  for (const track of sceneOf(doc).timeline.tracks) {
    const index = track.segments.findIndex((s) => s.id === segmentId)
    if (index >= 0) return { track, segment: track.segments[index]!, index }
  }
  return undefined
}

export function ensureTrack(
  draft: TacticDocument,
  entityId: Id,
  entityKind: 'player' | 'ball',
): Track {
  const scene = sceneOf(draft)
  let track = scene.timeline.tracks.find((t) => t.entityId === entityId)
  if (!track) {
    track = { id: newId('trk'), entityId, entityKind, segments: [] }
    scene.timeline.tracks.push(track)
  }
  return track
}

/** Where an entity is at the end of its last segment (or home). Used to chain paths. */
export function lastKnownPosition(doc: TacticDocument, entityId: Id): Vec2 {
  const track = findTrack(doc, entityId)
  const home =
    entityId === doc.ball.id
      ? doc.ball.home
      : (doc.players.find((p) => p.id === entityId)?.home ?? { x: 0, y: 0 })
  if (!track) return home
  for (let i = track.segments.length - 1; i >= 0; i--) {
    const s = track.segments[i]!
    if ((s.kind === 'move' || s.kind === 'travel') && s.path.waypoints.length) {
      return s.path.waypoints[s.path.waypoints.length - 1]!.p
    }
  }
  return home
}

export function makePath(points: readonly Vec2[]): Path {
  return { waypoints: points.map((p) => ({ id: newId('w'), p })) }
}

export interface AddMoveOptions {
  /** Absolute start time; ignored if `afterPrevious` and a previous segment exists. */
  at: number
  afterPrevious?: boolean
  speed?: number
  easing?: Segment['easing']
}

/** Append a move segment to a player's track. Returns segment id. */
export function addMoveSegment(
  core: EditorCore,
  playerId: Id,
  waypoints: Waypoint[],
  opts: AddMoveOptions,
): Id {
  const id = newId('seg')
  core.transaction('Add movement', (d) => {
    const track = ensureTrack(d as TacticDocument, playerId, 'player')
    const prev = track.segments[track.segments.length - 1]
    const trigger: Trigger =
      prev && opts.afterPrevious !== false
        ? { type: 'afterSegment', segmentId: prev.id, anchor: 'end', offset: 0 }
        : { type: 'at', t: Math.max(0, opts.at) }
    track.segments.push({
      id,
      kind: 'move',
      trigger,
      timing: { speed: opts.speed ?? DEFAULT_PLAYER_SPEED },
      easing: opts.easing,
      path: { waypoints },
    })
  })
  return id
}

/**
 * Who passes: the track's last open-ended possession is the truth for "who holds the ball at the end of
 * the authored sequence"; callers' `holderId` (resolved at the playhead) is a hint, `initialHolderId` last.
 * ISSUE (QA r3): falling back to the initial holder after a pass created a possessed(#10) chained after
 * possessed(#8) → cycle ("unresolvable trigger").
 */
export function passerFor(doc: TacticDocument, track: Track, hint: Id | undefined): Id | undefined {
  const last = track.segments[track.segments.length - 1]
  if (last?.kind === 'possessed') return last.holderId
  return hint ?? doc.ball.initialHolderId
}

/** Trigger for a "holder possesses the ball" segment inserted before a pass/fling at time `at`. */
export function possessTrigger(last: Segment | undefined, at: number): Trigger {
  if (!last) return { type: 'at', t: 0 }
  // Never chain after an open-ended (duration 0) possession: its end IS the next start → cycle.
  if (last.kind === 'possessed') return { type: 'at', t: Math.max(0, at) }
  return { type: 'afterSegment', segmentId: last.id, anchor: 'end', offset: 0 }
}

export interface AddTravelOptions {
  at: number
  travelKind?: BallTravelKind
  receiverId?: Id
  speed?: number
  flight?: 'ground' | 'lofted'
  /** Holder at release time (creates/extends the preceding possessed segment). */
  holderId?: Id
}

/** Ball: [possessed by holder] → travel → [possessed by receiver]. Returns travel segment id. */
export function addBallTravel(core: EditorCore, waypoints: Waypoint[], opts: AddTravelOptions): Id {
  const id = newId('seg')
  core.transaction(opts.travelKind === 'shot' ? 'Add shot' : 'Add pass', (d) => {
    const doc = d as TacticDocument
    const track = ensureTrack(doc, doc.ball.id, 'ball')
    const last = track.segments[track.segments.length - 1]
    const holder = passerFor(doc, track, opts.holderId)
    // Make sure the ball is possessed by the holder before the pass (explicit segment).
    if (holder && !(last && last.kind === 'possessed' && last.holderId === holder)) {
      track.segments.push({
        id: newId('seg'),
        kind: 'possessed',
        trigger: possessTrigger(last, opts.at),
        timing: { duration: 0 },
        holderId: holder,
      })
    }
    track.segments.push({
      id,
      kind: 'travel',
      travelKind: opts.travelKind ?? 'pass',
      trigger: { type: 'at', t: Math.max(0, opts.at) },
      timing: { speed: opts.speed ?? DEFAULT_PASS_SPEED },
      path: { waypoints },
      receiverId: opts.receiverId,
      flight: opts.flight,
    })
    if (opts.receiverId) {
      track.segments.push({
        id: newId('seg'),
        kind: 'possessed',
        trigger: { type: 'afterSegment', segmentId: id, anchor: 'end', offset: 0 },
        timing: { duration: 0 },
        holderId: opts.receiverId,
      })
    }
    if (!doc.ball.initialHolderId && holder) doc.ball.initialHolderId = holder
  })
  return id
}

export function removeSegment(core: EditorCore, segmentId: Id): void {
  core.transaction('Delete segment', (d) => removeSegmentInDraft(d as TacticDocument, segmentId))
}

export function removeSegmentInDraft(doc: TacticDocument, segmentId: Id): void {
  {
    const scene = sceneOf(doc)
    for (const track of scene.timeline.tracks) {
      const i = track.segments.findIndex((s) => s.id === segmentId)
      if (i < 0) continue
      const removed = track.segments[i]!
      track.segments.splice(i, 1)
      // A pass owns the receiver's possession that follows it: drop that too (an orphan possessed
      // chained after an open-ended possessed is a cycle — QA r6 N1).
      const follower = track.segments[i]
      if (
        removed.kind === 'travel' &&
        follower &&
        follower.kind === 'possessed' &&
        follower.trigger.type === 'afterSegment' &&
        follower.trigger.segmentId === segmentId
      )
        track.segments.splice(i, 1)
      // Re-chain the next segment if it pointed at the removed one.
      const next = track.segments[i]
      const prev = track.segments[i - 1]
      if (next && next.trigger.type === 'afterSegment' && next.trigger.segmentId === segmentId) {
        const offset = next.trigger.offset
        next.trigger =
          prev && prev.kind !== 'possessed'
            ? { type: 'afterSegment', segmentId: prev.id, anchor: 'end', offset }
            : { type: 'at', t: Math.max(0, offset) }
      }
    }
    // Any other segment referencing it → convert to absolute 0 (compile would otherwise error).
    for (const track of scene.timeline.tracks) {
      for (const s of track.segments) {
        const tr = s.trigger
        const refId =
          tr.type === 'afterSegment' || tr.type === 'atWaypoint'
            ? tr.segmentId
            : tr.type === 'onEvent'
              ? tr.event.segmentId
              : null
        if (refId === segmentId) s.trigger = { type: 'at', t: 0 }
      }
    }
    scene.timeline.tracks = scene.timeline.tracks.filter((t) => t.segments.length > 0)
  }
}

export function setSegmentTiming(core: EditorCore, segmentId: Id, timing: Timing): void {
  core.transaction(
    'Set timing',
    (d) => {
      const f = findSegment(d as TacticDocument, segmentId)
      if (f) f.segment.timing = timing
    },
    { coalesceKey: `timing:${segmentId}` },
  )
}

export function setSegmentTrigger(
  core: EditorCore,
  segmentId: Id,
  trigger: Trigger,
  coalesce = false,
): void {
  core.transaction(
    'Set start',
    (d) => {
      const f = findSegment(d as TacticDocument, segmentId)
      if (f) f.segment.trigger = trigger
    },
    coalesce ? { coalesceKey: `trigger:${segmentId}` } : {},
  )
}

export function setSegmentEasing(core: EditorCore, segmentId: Id, easing: Segment['easing']): void {
  core.transaction('Set easing', (d) => {
    const f = findSegment(d as TacticDocument, segmentId)
    if (f) {
      if (easing) f.segment.easing = easing
      else delete f.segment.easing
    }
  })
}

/** Mutate a waypoint inside an open transaction (drag) — use with core.update. */
export function moveWaypointInDraft(
  draft: TacticDocument,
  segmentId: Id,
  waypointId: Id,
  p: Vec2,
): void {
  const f = findSegment(draft, segmentId)
  if (!f || !('path' in f.segment)) return
  const wp = f.segment.path.waypoints.find((w) => w.id === waypointId)
  if (!wp) return
  const dx = p.x - wp.p.x
  const dy = p.y - wp.p.y
  wp.p = p
  if (wp.handleIn) wp.handleIn = { x: wp.handleIn.x + dx, y: wp.handleIn.y + dy }
  if (wp.handleOut) wp.handleOut = { x: wp.handleOut.x + dx, y: wp.handleOut.y + dy }
}

/** Radius (m) within which a player at the pass end point counts as the receiver. */
export const RECEIVE_RADIUS_M = 3.5

/**
 * Re-resolve who receives a travel segment from its END point and the players' positions at arrival.
 * Keeps the following `possessed` segment in sync (set/insert/remove) and pass↔loose kind.
 * Used after the end of a pass was dragged (tail/waypoint edit) — ISSUE: receiver used to stay stale → ball teleported.
 */
export function syncTravelReceiverInDraft(
  draft: TacticDocument,
  segmentId: Id,
  playersAtArrival: readonly { id: Id; pos: Vec2 }[],
  radius = RECEIVE_RADIUS_M,
): void {
  const f = findSegment(draft, segmentId)
  if (!f || f.segment.kind !== 'travel') return
  const seg = f.segment
  const end = seg.path.waypoints[seg.path.waypoints.length - 1]?.p
  if (!end) return
  const prev = f.track.segments[f.index - 1]
  const passer = prev && prev.kind === 'possessed' ? prev.holderId : undefined
  const near = playersAtArrival
    .filter((p) => p.id !== passer)
    .map((p) => ({ id: p.id, pos: p.pos, dist: Math.hypot(p.pos.x - end.x, p.pos.y - end.y) }))
    .filter((x) => x.dist <= radius)
    .sort((a, b) => a.dist - b.dist)[0]
  const receiver = near?.id
  // Carry angle after the catch = where the pass landed relative to the receiver (360°).
  // Snapped-on-target passes land dead-centre — fall back to the side the ball CAME from.
  let recvOffset: Vec2 | undefined
  if (near) {
    const rel = { x: end.x - near.pos.x, y: end.y - near.pos.y }
    if (Math.hypot(rel.x, rel.y) >= 0.3) recvOffset = carryOffset(rel)
    else {
      const prevWp = seg.path.waypoints[seg.path.waypoints.length - 2]?.p
      recvOffset = prevWp
        ? carryOffset({ x: prevWp.x - end.x, y: prevWp.y - end.y })
        : carryOffset(rel)
    }
  }
  if (receiver) seg.receiverId = receiver
  else delete seg.receiverId
  // ATTACH the landing to the receiver (user 2026-08-20: "중간 거점 선수에게 공이 안 소지되어
  // 있어"): the authored end used to stay wherever the user released — up to 3.5m off — so the
  // ball ghost floated beside the relay player instead of resting at their feet. Snap the end
  // waypoint to the receiver's carried spot; any LATER ball path chained from the old end (the
  // next pass drawn from that ghost) moves with it so the chain never tears.
  if (near && recvOffset) {
    const endWp = seg.path.waypoints[seg.path.waypoints.length - 1]!
    const to = { x: near.pos.x + recvOffset.x, y: near.pos.y + recvOffset.y }
    const inc = { x: to.x - endWp.p.x, y: to.y - endWp.p.y }
    if (Math.hypot(inc.x, inc.y) > 1e-9) {
      const oldEnd = endWp.p
      endWp.p = to
      if (endWp.handleIn)
        endWp.handleIn = { x: endWp.handleIn.x + inc.x, y: endWp.handleIn.y + inc.y }
      if (endWp.handleOut)
        endWp.handleOut = { x: endWp.handleOut.x + inc.x, y: endWp.handleOut.y + inc.y }
      for (let j = f.index + 1; j < f.track.segments.length; j++) {
        const later = f.track.segments[j]!
        if (!('path' in later) || later.id.startsWith('gen-')) continue
        const first = later.path.waypoints[0]
        if (first && Math.hypot(first.p.x - oldEnd.x, first.p.y - oldEnd.y) <= 0.75) {
          first.p = { x: first.p.x + inc.x, y: first.p.y + inc.y }
          if (first.handleIn)
            first.handleIn = { x: first.handleIn.x + inc.x, y: first.handleIn.y + inc.y }
          if (first.handleOut)
            first.handleOut = { x: first.handleOut.x + inc.x, y: first.handleOut.y + inc.y }
        }
      }
    }
  }
  if (seg.travelKind === 'pass' || seg.travelKind === 'loose')
    seg.travelKind = receiver ? 'pass' : 'loose'
  const nx = f.track.segments[f.index + 1]
  if (
    nx &&
    nx.kind === 'possessed' &&
    nx.trigger.type === 'afterSegment' &&
    nx.trigger.segmentId === segmentId
  ) {
    if (receiver) {
      nx.holderId = receiver
      if (recvOffset) nx.offset = recvOffset
    } else f.track.segments.splice(f.index + 1, 1)
  } else if (receiver) {
    f.track.segments.splice(f.index + 1, 0, {
      id: `${segmentId}-recv`,
      kind: 'possessed',
      trigger: { type: 'afterSegment', segmentId, anchor: 'end', offset: 0 },
      timing: { duration: 0 },
      holderId: receiver,
      ...(recvOffset ? { offset: recvOffset } : {}),
    })
  }
}

export function setWaypointHold(
  core: EditorCore,
  segmentId: Id,
  waypointId: Id,
  hold: number,
): void {
  core.transaction(
    'Set hold',
    (d) => {
      const f = findSegment(d as TacticDocument, segmentId)
      if (!f || !('path' in f.segment)) return
      const wp = f.segment.path.waypoints.find((w) => w.id === waypointId)
      if (!wp) return
      if (hold > 0) wp.hold = hold
      else delete wp.hold
    },
    { coalesceKey: `hold:${segmentId}:${waypointId}` },
  )
}

/** Give the ball to a player at scene start (initial possession). */
/** Draft form of giveBallTo (used inside a drag transaction so the drop is ONE undo step). */
export function giveBallToInDraft(doc: TacticDocument, playerId: Id | null): void {
  if (!playerId) {
    delete doc.ball.initialHolderId
    return
  }
  const p = doc.players.find((x) => x.id === playerId)
  if (!p) return
  doc.ball.initialHolderId = playerId
  doc.ball.home = { x: p.home.x + 1.75, y: p.home.y + 1.15 }
  const track0 = findTrack(doc, doc.ball.id)
  const first0 = track0?.segments[0]
  if (first0 && first0.kind === 'possessed') first0.offset = { x: 1.75, y: 1.15 }
  // An authored opening possession (possessed @0) is the truth at t=0 — retarget it too,
  // otherwise "공 주기" looks like it did nothing (QA r4 C-3).
  const track = findTrack(doc, doc.ball.id)
  const first = track?.segments[0]
  if (first && first.kind === 'possessed' && first.trigger.type === 'at' && first.trigger.t === 0)
    first.holderId = playerId
}

export function giveBallTo(core: EditorCore, playerId: Id | null): void {
  core.transaction('Give ball', (d) => giveBallToInDraft(d as TacticDocument, playerId))
}

export function clearTimeline(core: EditorCore): void {
  core.transaction('Clear timeline', (d) => {
    const scene = sceneOf(d as TacticDocument)
    scene.timeline.tracks = []
    scene.timeline.markers = []
  })
}

// ---------- editing at time t (drag a moving entity) ----------

/**
 * Move the end of the segment active (or last ended) at time t by `delta`, and translate every
 * later segment of the same track so the chain stays continuous. Use inside core.update.
 * Returns false when there is nothing to edit at that time (caller falls back to home editing).
 */
/** End point of the path segment that a tail-drag at time `t` edits (null when none). */
export function tailEndAt(
  doc: TacticDocument,
  entityId: Id,
  segmentTimes: Record<Id, { start: number; end: number }>,
  t: number,
): Vec2 | null {
  const track = findTrack(doc, entityId)
  if (!track) return null
  let seg: Segment | undefined
  for (const s of track.segments) {
    const tm = segmentTimes[s.id]
    if (!tm || !('path' in s)) continue
    if (t >= tm.start) seg = s
  }
  if (!seg || !('path' in seg)) return null
  return seg.path.waypoints[seg.path.waypoints.length - 1]?.p ?? null
}

/**
 * Ball dragged at authoring time = move its STARTING point (kickoff spot), even when passes exist:
 * resting spot, the opening possession (retarget to `holderId` / remove when loose) and the first
 * pass's origin all move together. QA: "공이 안 움직여" once a pass had been drawn.
 */
/** Translate every authored path of an entity by delta (group drag moves whole plays together). */
export function shiftEntityPathsInDraft(doc: TacticDocument, entityId: Id, delta: Vec2): void {
  const track = findTrack(doc, entityId)
  if (!track) return
  for (const s of track.segments) {
    if (!('path' in s)) continue
    for (const w of s.path.waypoints) {
      w.p = { x: w.p.x + delta.x, y: w.p.y + delta.y }
      if (w.handleIn) w.handleIn = { x: w.handleIn.x + delta.x, y: w.handleIn.y + delta.y }
      if (w.handleOut) w.handleOut = { x: w.handleOut.x + delta.x, y: w.handleOut.y + delta.y }
    }
  }
}

/**
 * Shift the ball anchors that BELONG to a player (user 2026-08-20): passes they will RECEIVE
 * (travel end) and passes they will make AFTERWARDS (next travel's origin, via the possession
 * they hold). Waypoint + both handles translate together so curves keep their exact shape.
 */
export function shiftBallAnchorsForPlayerInDraft(
  doc: TacticDocument,
  playerId: Id,
  inc: Vec2,
): void {
  const track = findTrack(doc, doc.ball.id)
  if (!track) return
  const shiftWp = (w: Waypoint) => {
    w.p = { x: w.p.x + inc.x, y: w.p.y + inc.y }
    if (w.handleIn) w.handleIn = { x: w.handleIn.x + inc.x, y: w.handleIn.y + inc.y }
    if (w.handleOut) w.handleOut = { x: w.handleOut.x + inc.x, y: w.handleOut.y + inc.y }
  }
  for (let i = 0; i < track.segments.length; i++) {
    const seg = track.segments[i]!
    if (seg.kind !== 'travel') continue
    // pass INTO the player → its end (the future ball) travels with them
    if (seg.receiverId === playerId) {
      const last = seg.path.waypoints[seg.path.waypoints.length - 1]
      if (last) shiftWp(last)
    }
    // pass FROM the player (they hold it just before) → its origin travels with them
    const prev = track.segments[i - 1]
    if (prev && prev.kind === 'possessed' && prev.holderId === playerId) {
      const first = seg.path.waypoints[0]
      if (first) shiftWp(first)
    }
  }
}

/** Move the ball's authored pass ORIGIN (first waypoint + handles) to `to` — target stays put. */
export function moveBallPathOriginInDraft(doc: TacticDocument, to: Vec2): void {
  const track = findTrack(doc, doc.ball.id)
  const firstPath = track?.segments.find((s) => 'path' in s)
  if (!firstPath || !('path' in firstPath)) return
  const wp = firstPath.path.waypoints[0]
  if (!wp) return
  const dx = to.x - wp.p.x
  const dy = to.y - wp.p.y
  wp.p = { x: to.x, y: to.y }
  if (wp.handleIn) wp.handleIn = { x: wp.handleIn.x + dx, y: wp.handleIn.y + dy }
  if (wp.handleOut) wp.handleOut = { x: wp.handleOut.x + dx, y: wp.handleOut.y + dy }
}

export function moveBallStartInDraft(doc: TacticDocument, to: Vec2, holderId: Id | null): void {
  const holder = holderId ? doc.players.find((p) => p.id === holderId) : undefined
  // Keep the DIRECTION the user dropped the ball at (carry angle is theirs to choose);
  // only the distance is normalized to a natural dribbling radius.
  const off = holder ? carryOffset({ x: to.x - holder.home.x, y: to.y - holder.home.y }) : undefined
  const rest = holder && off ? { x: holder.home.x + off.x, y: holder.home.y + off.y } : to
  doc.ball.home = rest
  if (holder) doc.ball.initialHolderId = holder.id
  else delete doc.ball.initialHolderId
  const track = findTrack(doc, doc.ball.id)
  if (!track) return
  const first = track.segments[0]
  if (first && first.kind === 'possessed' && first.trigger.type === 'at' && first.trigger.t === 0) {
    if (holder) {
      first.holderId = holder.id
      if (off) first.offset = off
    } else track.segments.shift()
  }
  const firstPath = track.segments.find((s) => 'path' in s)
  if (firstPath && 'path' in firstPath) {
    const wp = firstPath.path.waypoints[0]
    if (wp) {
      const dx = rest.x - wp.p.x
      const dy = rest.y - wp.p.y
      wp.p = { ...rest }
      if (wp.handleIn) wp.handleIn = { x: wp.handleIn.x + dx, y: wp.handleIn.y + dy }
      if (wp.handleOut) wp.handleOut = { x: wp.handleOut.x + dx, y: wp.handleOut.y + dy }
    }
  }
}

export function shiftTailInDraft(
  draft: TacticDocument,
  entityId: Id,
  segmentTimes: Record<Id, { start: number; end: number }>,
  t: number,
  delta: Vec2,
): boolean {
  const track = findTrack(draft, entityId)
  if (!track) return false
  let idx = -1
  for (let i = 0; i < track.segments.length; i++) {
    const s = track.segments[i]!
    const tm = segmentTimes[s.id]
    if (!tm || !('path' in s)) continue
    if (t >= tm.start) idx = i
  }
  if (idx < 0) return false
  const sh = (p: Vec2) => ({ x: p.x + delta.x, y: p.y + delta.y })
  const seg = track.segments[idx]!
  if ('path' in seg) {
    const last = seg.path.waypoints[seg.path.waypoints.length - 1]!
    last.p = sh(last.p)
    if (last.handleIn) last.handleIn = sh(last.handleIn)
    if (last.handleOut) last.handleOut = sh(last.handleOut)
  }
  for (let i = idx + 1; i < track.segments.length; i++) {
    const s = track.segments[i]!
    if (!('path' in s)) continue
    for (const w of s.path.waypoints) {
      w.p = sh(w.p)
      if (w.handleIn) w.handleIn = sh(w.handleIn)
      if (w.handleOut) w.handleOut = sh(w.handleOut)
    }
  }
  return true
}

// ---------- fling (release-velocity → deterministic segment) ----------

export const FLING = {
  /**
   * Cursor speed (m/s in pitch units) above which a release counts as a fling.
   * 45 m/s ≈ 450 px/s on a 1060 px pitch — a deliberate flick, well above an ordinary reposition drag.
   */
  minCursorSpeed: 45,
  ball: { gain: 0.35, minV0: 8, maxV0: 28, decel: 4 },
  player: { gain: 0.22, minDist: 3, maxDist: 28 },
} as const

/** Ball flung from `from` with release velocity → travel (pass if a player is near the stop point, else loose). */
export function addBallFling(
  core: EditorCore,
  from: Vec2,
  velocity: Vec2,
  opts: {
    at: number
    holderId?: Id
    players: readonly { id: Id; pos: Vec2 }[]
    pitch: { length: number; width: number }
  },
): Id | null {
  const speed = Math.hypot(velocity.x, velocity.y)
  if (speed < FLING.minCursorSpeed) return null
  const v0 = Math.max(FLING.ball.minV0, Math.min(FLING.ball.maxV0, speed * FLING.ball.gain))
  const dir = { x: velocity.x / speed, y: velocity.y / speed }
  const stopDist = (v0 * v0) / (2 * FLING.ball.decel)
  const rawEnd = { x: from.x + dir.x * stopDist, y: from.y + dir.y * stopDist }
  const end = {
    x: Math.max(-1, Math.min(opts.pitch.length + 1, rawEnd.x)),
    y: Math.max(-1, Math.min(opts.pitch.width + 1, rawEnd.y)),
  }
  const receiver = opts.players
    .filter((p) => p.id !== opts.holderId)
    .map((p) => ({ p, d: Math.hypot(p.pos.x - end.x, p.pos.y - end.y) }))
    .filter((x) => x.d <= 4)
    .sort((a, b) => a.d - b.d)[0]
  const waypoints = [
    { id: newId('w'), p: from },
    { id: newId('w'), p: end },
  ]
  const id = newId('seg')
  core.transaction('Fling ball', (d) => {
    const doc = d as TacticDocument
    const scene = sceneOf(doc)
    let track = scene.timeline.tracks.find((tr) => tr.entityId === doc.ball.id)
    if (!track) {
      track = { id: newId('trk'), entityId: doc.ball.id, entityKind: 'ball', segments: [] }
      scene.timeline.tracks.push(track)
    }
    const last = track.segments[track.segments.length - 1]
    const holder = passerFor(doc, track, opts.holderId)
    if (holder && !(last && last.kind === 'possessed' && last.holderId === holder)) {
      track.segments.push({
        id: newId('seg'),
        kind: 'possessed',
        trigger: possessTrigger(last, opts.at),
        timing: { duration: 0 },
        holderId: holder,
      })
    }
    track.segments.push({
      id,
      kind: 'travel',
      travelKind: receiver ? 'pass' : 'loose',
      trigger: { type: 'at', t: Math.max(0, opts.at) },
      timing: { speed: v0, decel: FLING.ball.decel },
      path: { waypoints },
      receiverId: receiver?.p.id,
    })
    if (receiver) {
      track.segments.push({
        id: newId('seg'),
        kind: 'possessed',
        trigger: { type: 'afterSegment', segmentId: id, anchor: 'end', offset: 0 },
        timing: { duration: 0 },
        holderId: receiver.p.id,
      })
    }
    if (!doc.ball.initialHolderId && holder) doc.ball.initialHolderId = holder
  })
  return id
}

/** Player flung → straight run in the release direction; distance from cursor speed. */
export function addPlayerFling(
  core: EditorCore,
  playerId: Id,
  from: Vec2,
  velocity: Vec2,
  opts: { at: number; prevEnd?: number; prevId?: Id; pitch: { length: number; width: number } },
): Id | null {
  const speed = Math.hypot(velocity.x, velocity.y)
  if (speed < FLING.minCursorSpeed) return null
  const dist = Math.max(
    FLING.player.minDist,
    Math.min(FLING.player.maxDist, speed * FLING.player.gain),
  )
  const dir = { x: velocity.x / speed, y: velocity.y / speed }
  const end = {
    x: Math.max(0.5, Math.min(opts.pitch.length - 0.5, from.x + dir.x * dist)),
    y: Math.max(0.5, Math.min(opts.pitch.width - 0.5, from.y + dir.y * dist)),
  }
  const waypoints = [
    { id: newId('w'), p: from },
    { id: newId('w'), p: end },
  ]
  const runSpeed = dist > 15 ? 7.5 : dist > 8 ? 5 : 3.5
  const afterPrevious = opts.prevEnd !== undefined && opts.at <= opts.prevEnd + 1e-6
  const id = addMoveSegment(core, playerId, waypoints, {
    at: opts.at,
    afterPrevious,
    speed: runSpeed,
    easing: 'easeOut',
  })
  if (opts.prevId && opts.prevEnd !== undefined && opts.at > opts.prevEnd + 1e-6) {
    setSegmentTrigger(core, id, {
      type: 'afterSegment',
      segmentId: opts.prevId,
      anchor: 'end',
      offset: opts.at - opts.prevEnd,
    })
  }
  return id
}
