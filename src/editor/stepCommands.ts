/**
 * Simple-mode authoring (ADR-0009): every movement belongs to a STEP (1-10).
 * Same step → starts together; step n+1 starts when the slowest segment of step n ends.
 * Steps are stored on the segments (`step`); triggers are derived here, so the engine,
 * persistence and old documents are untouched.
 */
import type { Track, Id, Path, TacticDocument, Vec2, Waypoint } from '@/domain/types'
import { GEN_PREFIX } from '@/engine/opponent'
import { heldBallPos } from '@/engine/carry'
import { BALL_OFFSET, carryOffset, compile } from '@/engine/compile'
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
  type ReceiverCandidate,
} from './segmentCommands'

export const MAX_STEP = 9

/** Quantise a stored metre value to 0.1 mm — enough to kill float drift, invisible on a pitch. */
const q = (v: number): number => Math.round(v * 10000) / 10000

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

  /*
   * 0) DANGLING REFERENCES — first, because everything below reads them.
   *
   * A deleted player can still be named as a holder or a receiver. The ball then rides someone who
   * is not on the pitch: `stateAt` finds no such player and falls back to the kickoff spot, so the
   * ball snapped across the field the moment that possession began (browser marathon: 29 m). The
   * formation commands already pruned this; deleting a player with Delete did not, and neither
   * healed the anchors afterwards. Doing it HERE means every route in and every document out of
   * storage arrives consistent, whatever created it.
   */
  const alive = new Set(draft.players.map((p) => p.id))
  if (draft.ball.initialHolderId && !alive.has(draft.ball.initialHolderId))
    delete draft.ball.initialHolderId
  scene.timeline.tracks = scene.timeline.tracks.filter(
    (t) => t.entityKind === 'ball' || alive.has(t.entityId),
  )
  for (const track of scene.timeline.tracks) {
    if (track.entityKind !== 'ball') continue
    track.segments = track.segments.filter(
      (s) => !(s.kind === 'possessed' && !alive.has(s.holderId)),
    )
    for (const s of track.segments) {
      if (s.kind === 'travel' && s.receiverId && !alive.has(s.receiverId)) {
        delete s.receiverId
        // nobody is waiting for it any more: it is a ball rolling into space
        if (s.travelKind === 'pass') s.travelKind = 'loose'
      }
    }
    const ids = new Set(track.segments.map((s) => s.id))
    for (const s of track.segments)
      if (s.trigger.type === 'afterSegment' && !ids.has(s.trigger.segmentId))
        s.trigger = { type: 'at', t: 0 }
  }

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

  /*
   * 1b) PLAYER CHAINS. A player's movements are one chain that starts at their token: the first
   *     leaves from home, and every later one leaves from where the previous arrived.
   *
   *     Delete a leg — or drag the token away — and the following leg is left starting in mid-air,
   *     so the player TELEPORTS to it the instant it fires, dragging the ball they were carrying
   *     with them (tactic fuzz seed 1013: 14.58 m in one frame, from a run whose own first leg had
   *     been deleted). Only the START is moved; the destination the user drew is never touched.
   */
  for (const track of scene.timeline.tracks) {
    if (track.entityKind !== 'player') continue
    const home = draft.players.find((p) => p.id === track.entityId)?.home
    if (!home) continue
    const chain = track.segments
      .filter((s) => 'path' in s && !s.id.startsWith(GEN_PREFIX))
      .sort((a, b) => stepOf(a as { step?: number }) - stepOf(b as { step?: number }))
    let from: Vec2 = home
    for (const s of chain) {
      if (!('path' in s)) continue
      const wps = s.path.waypoints
      const first = wps[0]
      if (!first) continue
      const inc = { x: from.x - first.p.x, y: from.y - first.p.y }
      if (Math.hypot(inc.x, inc.y) > 1e-4) {
        first.p = { x: from.x, y: from.y }
        if (first.handleIn) first.handleIn = { x: first.handleIn.x + inc.x, y: first.handleIn.y + inc.y }
        if (first.handleOut)
          first.handleOut = { x: first.handleOut.x + inc.x, y: first.handleOut.y + inc.y }
      }
      from = wps[wps.length - 1]!.p
    }
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
  /**
   * THROUGH BALL (user 2026-08-20): a pass aimed at a receiver's FUTURE spot must ARRIVE when the
   * runner does — stretch the pass duration, never shrink it. It runs INSIDE the anchor loop
   * because it moves the arrival instant, which moves the anchor: sequenced after the snap it left
   * the pass attached to wherever the receiver stood at the un-stretched arrival, metres from
   * where they actually collect it (fuzz seed 572). `deriveTimings` resets durations to the step
   * window, so this re-applies at the top of every round.
   */
  const syncThroughBall = (): void => {
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
  }

  // 3) BALL ANCHORS (invariant B1 — ADR-0010 D7). Both ends of every pass are DERIVED from the
  //    one carry resolver, never composed here as `pos + offset`:
  //      · arrival  — where the ball comes to rest on the receiver
  //      · origin   — where the ball is at the launch instant
  //    They are computed together, from ONE compile, because each depends on the other through the
  //    clock: an arrival moves the path, the path length moves the step timings, and the timings
  //    move every launch instant. Snapping them in sequence left the first one stale (fuzz seeds
  //    169/415/448/572). Iterate to a fixed point instead.
  //
  //    EVERY ROUND STARTS FROM THE SAME BASELINE. Timings are re-derived at the TOP of the round,
  //    so a round is a pure function of the current geometry and nothing carries over from the last
  //    one. Deriving once up front and re-deriving only at the bottom left the loop able to exit
  //    right after `syncThroughBall` had stretched a duration — a stretch that the next call to
  //    this same function would then reset and recompute, so the document was not a fixed point of
  //    its own pipeline (tactic fuzz seeds 1002/1003/1007/1008/…: durations and triggers moved on a
  //    second, no-op relayout). Byte-idempotence is the contract, and the loop has to end ON it.
  for (let round = 0; round < 8; round++) {
    deriveTimings()
    syncThroughBall()
    const cm = compile(draft)
    let moved = false
    const shift = (w: Waypoint, to: Vec2): void => {
      const inc = { x: to.x - w.p.x, y: to.y - w.p.y }
      w.p = to
      if (w.handleIn) w.handleIn = { x: w.handleIn.x + inc.x, y: w.handleIn.y + inc.y }
      if (w.handleOut) w.handleOut = { x: w.handleOut.x + inc.x, y: w.handleOut.y + inc.y }
    }
    for (const track of scene.timeline.tracks) {
      if (track.entityKind !== 'ball') continue
      for (let i = 0; i < track.segments.length; i++) {
        const seg = track.segments[i]!
        if (seg.kind !== 'travel' || seg.id.startsWith(GEN_PREFIX)) continue
        const times = cm.segmentTimes[seg.id]
        const wps = seg.path.waypoints
        const first = wps[0]
        const last = wps[wps.length - 1]

        // arrival: the receiver's carried spot at the instant the ball gets there
        const arrival = times?.end
        if (last && seg.receiverId && arrival !== undefined && Number.isFinite(arrival)) {
          const rp = stateAt(cm, draft, arrival).players[seg.receiverId]
          const hold = track.segments[i + 1]
          const held = hold && hold.kind === 'possessed' && hold.holderId === seg.receiverId
          if (rp) {
            const to = heldBallPos(
              { pos: rp.pos, moving: rp.moving },
              rp.carryAhead,
              (held ? hold.offset : undefined) ?? BALL_OFFSET,
            )
            if (Math.hypot(to.x - last.p.x, to.y - last.p.y) > 0.25) {
              shift(last, to)
              moved = true
            }
            // The standing offset has to agree with the anchor we just placed. QUANTISED: writing
            // the raw difference fed itself back through `heldBallPos` and drifted by ~1e-15 every
            // single call, so the document never became byte-stable (tactic fuzz seed 1020). A
            // tenth of a millimetre is far below anything the pitch can show.
            if (held) hold.offset = { x: q(to.x - rp.pos.x), y: q(to.y - rp.pos.y) }
          }
        }

        /*
         * Origin: wherever the ball IS when this travel fires — from the COMPILED clock, sampled a
         * hair before it fires.
         *
         * Two separate mistakes lived in this one line. Asked exactly AT the launch instant,
         * `stateAt` can already have handed the ball to this very travel, so it answers with the
         * travel's own first waypoint and the check compares the anchor against itself — a no-op
         * that let a pass keep an origin 51 m from the ball. And `trigger.t` is only the step's
         * NOMINAL start: a through ball stretched past its step window pushes the next pass later,
         * and compile serialises them because one ball cannot fly two passes at once. Pinning to
         * the nominal time anchored the pass to where the ball was MID-FLIGHT on the previous one,
         * 19 m from where it actually leaves (tactic fuzz seed 1011). The compiled schedule is the
         * only clock the playback obeys, so it is the only clock the anchors may read.
         */
        if (first && times && Number.isFinite(times.start)) {
          const launch = stateAt(cm, draft, Math.max(0, times.start - 1e-3)).ball.pos
          if (Math.hypot(launch.x - first.p.x, launch.y - first.p.y) > 0.25) {
            shift(first, launch)
            moved = true
          }
        }
      }
    }
    if (!moved) break
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

/**
 * Player run drawn in simple mode: one undo step (create + step + relayout).
 *
 * Returns null when the entity has no step left. The bump below can land past MAX_STEP, and
 * `stepOf` used to CLAMP it back to 9 — which quietly put two of one player's runs on step 9, the
 * exact contradiction the bump exists to prevent (tactic fuzz). Nothing is created instead, and the
 * caller says why.
 */
export function addStepRun(
  core: EditorCore,
  playerId: Id,
  waypoints: Waypoint[],
  step: number,
): Id | null {
  const id = newId('seg')
  const track0 = findTrack(core.getDocument(), playerId)
  if (Math.max(step, lastAuthoredStep(track0) + 1) > MAX_STEP) return null
  core.transaction('Add run', (d) => {
    const doc = d as TacticDocument
    const track = ensureTrack(doc, playerId, 'player')
    // A player's own movements are inherently sequential — the next one starts where the last
    // ended, so it cannot share that step. The chip may still push it further out.
    step = Math.max(step, lastAuthoredStep(track) + 1)
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

/**
 * Highest authored step on a track (0 when it has no movements yet).
 *
 * ONE entity cannot hold two movements on the same step, because a step means "these start AND end
 * together" (ADR-0009) — a player being in two places at once is not a slower animation, it is a
 * contradiction. The ball has enforced this since 2026-08-21; players had not, so drawing three
 * runs in a row put them all on step 1 (user 2026-08-22: 1, 1, 1로 되는 게 아니라 순차적으로
 * 1, 2, 3이 되어야 하지 않을까).
 */
export function lastAuthoredStep(track: Track | undefined): number {
  let max = 0
  for (const sg of track?.segments ?? []) {
    if (!('path' in sg) || sg.id.startsWith(GEN_PREFIX)) continue
    max = Math.max(max, stepOf(sg))
  }
  return max
}

/** @deprecated name — `lastAuthoredStep` says what it actually does. */
export const lastBallStep = lastAuthoredStep

/**
 * The last step in which the BALL actually moved — which is NOT the same as the last step it was
 * PASSED on.
 *
 * A ball is moved by its own travels and by being carried: if it arrives on step 1 and its holder
 * then runs through step 2, the ball was still moving through step 2, so the next pass cannot fire
 * before step 3 (user 2026-08-22: 공을 소유한 선수가 3단계까지 진행했다면 공의 마지막 단계는
 * 2단계가 아니라 3단계로 봐야지). Reading only the ball's own track put the next pass on the same
 * step as the carry, so it left the holder's foot at the START of their run instead of the end.
 */
export function lastBallMovedStep(doc: TacticDocument): number {
  let last = lastAuthoredStep(findTrack(doc, doc.ball.id))
  const cm = compile(doc)
  let end = 0
  for (const t of Object.values(cm.segmentTimes))
    if (Number.isFinite(t.end) && t.end > end) end = t.end
  const holder = stateAt(cm, doc, end).ball.holderId
  if (holder) last = Math.max(last, lastAuthoredStep(findTrack(doc, holder)))
  return last
}

/**
 * Drop every authored ball movement from `step` onwards. Returns how many were removed.
 *
 * THE BALL IS THE ONE ENTITY WITH A PAST TO OVERWRITE. A player's chain can only ever be extended,
 * because two of them may stand anywhere at once — so clicking any of a player's faded tokens just
 * continues from the end. There is only one ball, so releasing it at an earlier moment does not
 * branch the timeline, it REPLACES the rest of it: whatever the ball did after that instant simply
 * never happens now (user 2026-08-22: 공이 동시에 존재할 수 없으니 그 이후 공들은 없어지고).
 *
 * Only the ball's OWN travels are removed. Carries are not stored — the ball rides with whoever
 * holds it — so a run that used to carry the ball keeps running, empty-footed, all by itself.
 */
export function truncateBallFromStepInDraft(doc: TacticDocument, step: number): number {
  const track = findTrack(doc, doc.ball.id)
  if (!track) return 0
  const doomed = track.segments
    .filter((s) => 'path' in s && !s.id.startsWith(GEN_PREFIX) && stepOf(s) >= step)
    .map((s) => s.id)
  for (const id of doomed) removeSegmentInDraft(doc, id)
  return doomed.length
}

/** How many authored ball movements a grab at `step` would overwrite — asked before committing. */
export function ballMovesFromStep(doc: TacticDocument, step: number): number {
  const track = findTrack(doc, doc.ball.id)
  return (track?.segments ?? []).filter(
    (s) => 'path' in s && !s.id.startsWith(GEN_PREFIX) && stepOf(s) >= step,
  ).length
}

/** Ball pass drawn in simple mode: create + step + relayout + receiver at arrival — one undo step. */
export function addStepPass(
  core: EditorCore,
  waypoints: Waypoint[],
  step: number,
  holderHint?: Id,
  opts?: {
    /** The ball was grabbed at a NAMED moment: `step` is exact, and the rest of its chain goes. */
    exactStep?: boolean
  },
): Id | null {
  const id = newId('seg')
  // Same ceiling as a run: past step 9 there is nowhere left to put the pass, and clamping would
  // stack two of the ball's travels on one step (tactic fuzz).
  if (!opts?.exactStep && Math.max(step, lastBallMovedStep(core.getDocument()) + 1) > MAX_STEP)
    return null
  if (opts?.exactStep && step > MAX_STEP) return null
  core.transaction('Add pass', (d) => {
    const doc = d as TacticDocument
    const track = ensureTrack(doc, doc.ball.id, 'ball')
    if (opts?.exactStep) truncateBallFromStepInDraft(doc, step)
    // ONE ball: its passes are inherently sequential. A new pass can never fire at/before an
    // existing one (user 2026-08-21: 마지막 단계 이후 이어 그렸는데 0단계에서 발사) — drawing
    // from the live ball at a result frame used to inherit the step CHIP (1) and launch at t0.
    // Carrying counts as moving, so the bar is the last step the ball MOVED, pass or carry.
    else step = Math.max(step, lastBallMovedStep(doc) + 1)
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
  const candidateSets: ReceiverCandidate[][] = [
    // The resolved set carries the motion state too, so the catch point is placed by the carry
    // resolver rather than composed from a bare offset (invariant B1).
    doc.players.map((p) => ({
      id: p.id,
      pos: rs.players[p.id]?.pos ?? p.home,
      moving: rs.players[p.id]?.moving ?? false,
      ...(rs.players[p.id]?.carryAhead ? { carry: rs.players[p.id]!.carryAhead } : {}),
    })),
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

/**
 * The steps an entity's movement may legally take: strictly between its neighbours in the chain.
 *
 * One entity's movements are a CHAIN — each starts where the last one ended — so their order is
 * baked into their geometry, and their steps must rise with it. Two of them on one step would put
 * that entity in two places at once, and swapping two of them would tear the chain open at the
 * joint. So retiming a movement can widen or narrow its gap to its neighbours and nothing else.
 * Returns null when the neighbours leave no room at all.
 */
export function stepRangeFor(doc: TacticDocument, segmentId: Id): { lo: number; hi: number } | null {
  const f = findSegment(doc, segmentId)
  if (!f || !('path' in f.segment)) return null
  const chain = f.track.segments
    .filter((s) => 'path' in s && !s.id.startsWith(GEN_PREFIX))
    .sort((a, b) => stepOf(a as { step?: number }) - stepOf(b as { step?: number }))
  const i = chain.findIndex((s) => s.id === segmentId)
  if (i < 0) return null
  const lo = i > 0 ? stepOf(chain[i - 1] as { step?: number }) + 1 : 1
  const hi = i < chain.length - 1 ? stepOf(chain[i + 1] as { step?: number }) - 1 : MAX_STEP
  return lo > hi ? null : { lo, hi }
}

/**
 * Change a movement's step (badge click / number key on selection). Clamped into the window its
 * chain neighbours leave — see `stepRangeFor`. Returns the step it actually landed on.
 */
export function setSegmentStep(core: EditorCore, segmentId: Id, step: number): number | null {
  const range = stepRangeFor(core.getDocument(), segmentId)
  if (!range) return null
  const landed = Math.max(range.lo, Math.min(range.hi, stepOf({ step })))
  core.transaction('Set step', (d) => {
    const doc = d as TacticDocument
    const f = findSegment(doc, segmentId)
    if (!f || !('path' in f.segment)) return
    f.segment.step = landed
    relayoutStepsInDraft(doc)
  })
  return landed
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
