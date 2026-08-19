/**
 * Simple-mode authoring (ADR-0009): every movement belongs to a STEP (1-10).
 * Same step → starts together; step n+1 starts when the slowest segment of step n ends.
 * Steps are stored on the segments (`step`); triggers are derived here, so the engine,
 * persistence and old documents are untouched.
 */
import type { Id, Path, TacticDocument, Waypoint } from '@/domain/types'
import { GEN_PREFIX } from '@/engine/opponent'
import { compile } from '@/engine/compile'
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
    // Same step = same start AND same end (user decision 2026-08-20): the step lasts as long as its
    // longest movement at natural speed; shorter ones are slowed to finish together.
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
      s.trigger = { type: 'at', t }
      s.timing = { duration: stepDur }
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
      track.segments.push({
        id: newId('seg'),
        kind: 'possessed',
        trigger: possessTrigger(last, 0),
        timing: { duration: 0 },
        holderId: holder,
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
    // Receiver = whoever stands at the end point when the ball arrives.
    const compiled = compile(doc)
    const arrival = compiled.segmentTimes[id]?.end ?? 0
    const rs = stateAt(compiled, doc, arrival)
    syncTravelReceiverInDraft(
      doc,
      id,
      doc.players.map((p) => ({ id: p.id, pos: rs.players[p.id]?.pos ?? p.home })),
      RECEIVE_RADIUS_M,
    )
  })
  return id
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

/** Delete a movement and re-derive the remaining steps — one undo step. */
export function removeStepSegment(core: EditorCore, segmentId: Id): void {
  core.transaction('Delete', (d) => {
    const doc = d as TacticDocument
    removeSegmentInDraft(doc, segmentId)
    relayoutStepsInDraft(doc)
  })
}

/** Start time of a step (for setting the playhead when authoring). */
export function stepStart(doc: TacticDocument, step: number): number {
  const compiled = compile(doc)
  let start = 0
  let best = Infinity
  for (const track of sceneOf(doc).timeline.tracks)
    for (const s of track.segments) {
      if (!('path' in s) || s.id.startsWith(GEN_PREFIX) || stepOf(s) !== step) continue
      const tm = compiled.segmentTimes[s.id]
      if (tm && tm.start < best) {
        best = tm.start
        start = tm.start
      }
    }
  return Number.isFinite(best) ? start : 0
}
