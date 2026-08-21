/**
 * Scenario presets — complete example documents (data). Presets, never constraints.
 * Used by "예시 불러오기" and as living documentation of the model.
 */
import { createEmptyDocument } from '@/domain/factories'
import type { Path, Segment, TacticDocument, Track } from '@/domain/types'
import { DEFAULT_TEAMS } from '@/editor/commands'

const line = (...pts: [number, number][]): Path => ({
  waypoints: pts.map(([x, y], i) => ({ id: `w${i}-${x}-${y}`, p: { x, y } })),
})
const track = (entityId: string, entityKind: 'player' | 'ball', segments: Segment[]): Track => ({
  id: `trk-${entityId}`,
  entityId,
  entityKind,
  segments,
})

export interface ScenarioPreset {
  id: string
  name: string
  description: string
  build: () => TacticDocument
}

/** Scenario A — 2v2: delay, reaction, pass detach/receive, event-triggered press (PRODUCT_BRIEF §6). */
export function buildScenarioA(): TacticDocument {
  const doc = createEmptyDocument({ id: 'scenario-a', title: '예시 · 2v2 패스 & 압박' })
  doc.teams = DEFAULT_TEAMS.map((t) => ({ ...t }))
  doc.players = [
    { id: 'b1', teamId: 'team-a', number: 1, home: { x: 40, y: 34 } },
    { id: 'b2', teamId: 'team-a', number: 2, home: { x: 50, y: 20 } },
    { id: 'r1', teamId: 'team-b', number: 1, home: { x: 60, y: 24 } },
    { id: 'r2', teamId: 'team-b', number: 2, home: { x: 62, y: 40 } },
  ]
  doc.ball = { id: 'ball', home: { x: 41.1, y: 34.7 }, initialHolderId: 'b1' }
  const tl = doc.scenes[0]!.timeline
  tl.tracks.push(
    track('b2', 'player', [
      {
        id: 'b2-run',
        kind: 'move',
        trigger: { type: 'at', t: 0.4 },
        timing: { speed: 5 },
        path: line([50, 20], [60, 12]),
      },
    ]),
    track('r1', 'player', [
      {
        id: 'r1-track',
        kind: 'move',
        trigger: { type: 'afterSegment', segmentId: 'b2-run', anchor: 'start', offset: 0.2 },
        timing: { speed: 5 },
        path: line([60, 24], [64, 16]),
      },
    ]),
    track('ball', 'ball', [
      {
        id: 'ball-pos1',
        kind: 'possessed',
        trigger: { type: 'at', t: 0 },
        timing: { duration: 0 },
        holderId: 'b1',
      },
      {
        id: 'ball-pass',
        kind: 'travel',
        travelKind: 'pass',
        trigger: { type: 'at', t: 1.2 },
        timing: { speed: 15 },
        path: line([40, 34], [58, 13]),
        receiverId: 'b2',
      },
      {
        id: 'ball-pos2',
        kind: 'possessed',
        trigger: { type: 'afterSegment', segmentId: 'ball-pass', anchor: 'end', offset: 0 },
        timing: { duration: 0 },
        holderId: 'b2',
      },
    ]),
    track('r2', 'player', [
      {
        id: 'r2-press',
        kind: 'move',
        trigger: {
          type: 'onEvent',
          event: { kind: 'ball.received', segmentId: 'ball-pass' },
          offset: 0,
        },
        timing: { speed: 6 },
        path: line([62, 40], [60, 16]),
      },
    ]),
  )
  doc.drawings.push({
    id: 'dr-zone',
    kind: 'zone',
    shape: { type: 'ellipse', center: { x: 60, y: 13 }, radius: { x: 6, y: 4 } },
    style: { color: 'var(--st-team-a)' },
  })
  doc.drawings.push({ id: 'dr-text', kind: 'text', at: { x: 60, y: 6 }, text: '측면 공간 공략' })
  return doc
}

/** Scenario B — the user's sequence (2026-08-20): pass, closing down, third-man run, return pass before the press. */
export function buildScenarioB(): TacticDocument {
  const doc = createEmptyDocument({ id: 'scenario-b', title: '예시 · 원투 & 침투 (압박 전 리턴)' })
  doc.teams = DEFAULT_TEAMS.map((t) => ({ ...t }))
  doc.players = [
    { id: 'b1', teamId: 'team-a', number: 1, home: { x: 40, y: 34 } },
    { id: 'b2', teamId: 'team-a', number: 2, home: { x: 50, y: 20 } },
    { id: 'r1', teamId: 'team-b', number: 1, home: { x: 60, y: 24 } },
    { id: 'r2', teamId: 'team-b', number: 2, home: { x: 62, y: 40 } },
  ]
  doc.ball = { id: 'ball', home: { x: 41.1, y: 34.7 }, initialHolderId: 'b1' }
  const tl = doc.scenes[0]!.timeline
  tl.tracks.push(
    track('ball', 'ball', [
      {
        id: 'hold1',
        kind: 'possessed',
        trigger: { type: 'at', t: 0 },
        timing: { duration: 0 },
        holderId: 'b1',
      },
      {
        id: 'pass1',
        kind: 'travel',
        travelKind: 'pass',
        trigger: { type: 'at', t: 0.5 },
        timing: { speed: 15 },
        path: line([40, 34], [50, 20]),
        receiverId: 'b2',
      },
      {
        id: 'hold2',
        kind: 'possessed',
        trigger: { type: 'afterSegment', segmentId: 'pass1', anchor: 'end', offset: 0 },
        timing: { duration: 0 },
        holderId: 'b2',
      },
      {
        id: 'pass2',
        kind: 'travel',
        travelKind: 'throughBall',
        trigger: {
          type: 'onEvent',
          event: { kind: 'ball.received', segmentId: 'pass1' },
          offset: 0.8,
        },
        timing: { speed: 15 },
        path: line([50, 20], [58, 30]),
        receiverId: 'b1',
      },
      {
        id: 'hold3',
        kind: 'possessed',
        trigger: { type: 'afterSegment', segmentId: 'pass2', anchor: 'end', offset: 0 },
        timing: { duration: 0 },
        holderId: 'b1',
      },
    ]),
    track('r1', 'player', [
      {
        id: 'r1-close',
        kind: 'move',
        trigger: {
          type: 'onEvent',
          event: { kind: 'ball.released', segmentId: 'pass1' },
          offset: 0,
        },
        timing: { speed: 6 },
        path: line([60, 24], [52, 21]),
      },
    ]),
    track('b1', 'player', [
      {
        id: 'b1-run',
        kind: 'move',
        trigger: {
          type: 'onEvent',
          event: { kind: 'ball.released', segmentId: 'pass1' },
          offset: 0.3,
        },
        timing: { speed: 5 },
        path: line([40, 34], [58, 30]),
      },
    ]),
    track('r2', 'player', [
      {
        id: 'r2-press',
        kind: 'move',
        trigger: {
          type: 'onEvent',
          event: { kind: 'ball.received', segmentId: 'pass1' },
          offset: 0.4,
        },
        timing: { speed: 6 },
        path: line([62, 40], [51, 21]),
      },
    ]),
  )
  return doc
}

/** Scenario C — third-man combination: wall pass, lay-off, runner arrives beyond the line. */
export function buildScenarioThirdMan(): TacticDocument {
  const doc = createEmptyDocument({ id: 'scenario-third-man', title: '예시 · 세 번째 선수 움직임' })
  doc.teams = DEFAULT_TEAMS.map((t) => ({ ...t }))
  doc.players = [
    { id: 'b6', teamId: 'team-a', number: 6, home: { x: 45, y: 40 } },
    { id: 'b8', teamId: 'team-a', number: 8, home: { x: 58, y: 26 } },
    { id: 'b9', teamId: 'team-a', number: 9, home: { x: 78, y: 30 } },
    { id: 'b10', teamId: 'team-a', number: 10, home: { x: 60, y: 44 } },
    { id: 'r5', teamId: 'team-b', number: 5, home: { x: 82, y: 32 } },
    { id: 'r6', teamId: 'team-b', number: 6, home: { x: 80, y: 44 } },
  ]
  doc.ball = { id: 'ball', home: { x: 46.1, y: 40.7 }, initialHolderId: 'b6' }
  const tl = doc.scenes[0]!.timeline
  tl.tracks.push(
    track('ball', 'ball', [
      {
        id: 'tm-hold1',
        kind: 'possessed',
        trigger: { type: 'at', t: 0 },
        timing: { duration: 0 },
        holderId: 'b6',
      },
      {
        id: 'tm-pass1',
        kind: 'travel',
        travelKind: 'pass',
        trigger: { type: 'at', t: 0.6 },
        timing: { speed: 16 },
        path: line([45, 40], [77, 31]),
        receiverId: 'b9',
      },
      {
        id: 'tm-hold2',
        kind: 'possessed',
        trigger: { type: 'afterSegment', segmentId: 'tm-pass1', anchor: 'end', offset: 0 },
        timing: { duration: 0 },
        holderId: 'b9',
      },
      {
        id: 'tm-pass2',
        kind: 'travel',
        travelKind: 'pass',
        trigger: { type: 'afterSegment', segmentId: 'tm-pass1', anchor: 'end', offset: 0.5 },
        timing: { speed: 14 },
        path: line([77, 31], [67, 28]),
        receiverId: 'b8',
      },
      {
        id: 'tm-hold3',
        kind: 'possessed',
        trigger: { type: 'afterSegment', segmentId: 'tm-pass2', anchor: 'end', offset: 0 },
        timing: { duration: 0 },
        holderId: 'b8',
      },
      {
        id: 'tm-pass3',
        kind: 'travel',
        travelKind: 'throughBall',
        trigger: { type: 'afterSegment', segmentId: 'tm-pass2', anchor: 'end', offset: 0.35 },
        timing: { speed: 17 },
        path: line([67, 28], [90, 38]),
        receiverId: 'b10',
      },
      {
        id: 'tm-hold4',
        kind: 'possessed',
        trigger: { type: 'afterSegment', segmentId: 'tm-pass3', anchor: 'end', offset: 0 },
        timing: { duration: 0 },
        holderId: 'b10',
      },
    ]),
    track('b8', 'player', [
      {
        id: 'tm-b8-move',
        kind: 'move',
        trigger: { type: 'onEvent', event: { kind: 'ball.released', segmentId: 'tm-pass1' }, offset: 0 },
        timing: { speed: 5.5 },
        path: line([58, 26], [66, 28]),
      },
    ]),
    track('b10', 'player', [
      {
        id: 'tm-b10-run',
        kind: 'move',
        trigger: { type: 'onEvent', event: { kind: 'ball.released', segmentId: 'tm-pass1' }, offset: 0.2 },
        timing: { speed: 7 },
        path: line([60, 44], [74, 43], [90, 37]),
      },
    ]),
    track('r5', 'player', [
      {
        id: 'tm-r5-step',
        kind: 'move',
        trigger: { type: 'onEvent', event: { kind: 'ball.received', segmentId: 'tm-pass1' }, offset: 0 },
        timing: { speed: 4 },
        path: line([82, 32], [79, 31.5]),
      },
    ]),
    track('r6', 'player', [
      {
        id: 'tm-r6-track',
        kind: 'move',
        trigger: { type: 'onEvent', event: { kind: 'ball.released', segmentId: 'tm-pass2' }, offset: 0.2 },
        timing: { speed: 6 },
        path: line([80, 44], [88, 40]),
      },
    ]),
  )
  doc.drawings.push({
    id: 'tm-text',
    kind: 'text',
    at: { x: 55, y: 16 },
    text: '벽 패스 → 레이오프 → 세 번째 선수 침투',
  })
  return doc
}

/** Scenario D — overlap vs underlap on one flank: two runs, defender must choose, ball to the overlap. */
export function buildScenarioOverlap(): TacticDocument {
  const doc = createEmptyDocument({ id: 'scenario-overlap', title: '예시 · 오버랩 vs 언더랩' })
  doc.teams = DEFAULT_TEAMS.map((t) => ({ ...t }))
  doc.players = [
    { id: 'b7', teamId: 'team-a', number: 7, home: { x: 68, y: 12 } },
    { id: 'b2', teamId: 'team-a', number: 2, home: { x: 56, y: 7 } },
    { id: 'b8', teamId: 'team-a', number: 8, home: { x: 58, y: 22 } },
    { id: 'r3', teamId: 'team-b', number: 3, home: { x: 75, y: 15 } },
    { id: 'r4', teamId: 'team-b', number: 4, home: { x: 80, y: 27 } },
  ]
  doc.ball = { id: 'ball', home: { x: 69.1, y: 12.7 }, initialHolderId: 'b7' }
  const tl = doc.scenes[0]!.timeline
  tl.tracks.push(
    track('b2', 'player', [
      {
        id: 'ov-b2-run',
        kind: 'move',
        trigger: { type: 'at', t: 0.3 },
        timing: { speed: 6.5 },
        path: line([56, 7], [72, 4], [85, 5]),
      },
    ]),
    track('b8', 'player', [
      {
        id: 'ov-b8-run',
        kind: 'move',
        trigger: { type: 'at', t: 0.5 },
        timing: { speed: 6 },
        path: line([58, 22], [72, 17], [83, 13]),
      },
    ]),
    track('r3', 'player', [
      {
        id: 'ov-r3-jockey',
        kind: 'move',
        trigger: { type: 'at', t: 0.8 },
        timing: { speed: 3.5 },
        path: line([75, 15], [78, 11]),
      },
    ]),
    track('ball', 'ball', [
      {
        id: 'ov-hold1',
        kind: 'possessed',
        trigger: { type: 'at', t: 0 },
        timing: { duration: 0 },
        holderId: 'b7',
      },
      {
        id: 'ov-pass1',
        kind: 'travel',
        travelKind: 'pass',
        trigger: { type: 'at', t: 3.2 },
        timing: { speed: 15 },
        path: line([68, 12], [83, 5]),
        receiverId: 'b2',
      },
      {
        id: 'ov-hold2',
        kind: 'possessed',
        trigger: { type: 'afterSegment', segmentId: 'ov-pass1', anchor: 'end', offset: 0 },
        timing: { duration: 0 },
        holderId: 'b2',
      },
    ]),
    track('r4', 'player', [
      {
        id: 'ov-r4-cover',
        kind: 'move',
        trigger: { type: 'onEvent', event: { kind: 'ball.released', segmentId: 'ov-pass1' }, offset: 0 },
        timing: { speed: 6.5 },
        path: line([80, 27], [85, 12]),
      },
    ]),
  )
  doc.drawings.push({ id: 'ov-text-over', kind: 'text', at: { x: 79, y: 4 }, text: '오버랩 — 바깥' })
  doc.drawings.push({ id: 'ov-text-under', kind: 'text', at: { x: 76, y: 19 }, text: '언더랩 — 안쪽' })
  doc.drawings.push({
    id: 'ov-zone',
    kind: 'zone',
    shape: { type: 'ellipse', center: { x: 85, y: 8 }, radius: { x: 5, y: 3.5 } },
    style: { color: 'var(--st-team-a)' },
  })
  return doc
}

/** Scenario E — 4-3-3 build-up: GK + 2 CB + dropping DM outnumber two pressers, full-back breaks the line. */
export function buildScenarioBuildup(): TacticDocument {
  const doc = createEmptyDocument({ id: 'scenario-buildup', title: '예시 · 4-3-3 후방 빌드업' })
  doc.teams = DEFAULT_TEAMS.map((t) => ({ ...t }))
  doc.players = [
    { id: 'b1', teamId: 'team-a', number: 1, home: { x: 5, y: 34 } },
    { id: 'b4', teamId: 'team-a', number: 4, home: { x: 15, y: 23 } },
    { id: 'b5', teamId: 'team-a', number: 5, home: { x: 15, y: 45 } },
    { id: 'b6', teamId: 'team-a', number: 6, home: { x: 26, y: 34 } },
    { id: 'b2', teamId: 'team-a', number: 2, home: { x: 28, y: 9 } },
    { id: 'b3', teamId: 'team-a', number: 3, home: { x: 28, y: 59 } },
    { id: 'r9', teamId: 'team-b', number: 9, home: { x: 23, y: 29 } },
    { id: 'r10', teamId: 'team-b', number: 10, home: { x: 23, y: 39 } },
    { id: 'r7', teamId: 'team-b', number: 7, home: { x: 33, y: 14 } },
  ]
  doc.ball = { id: 'ball', home: { x: 6.1, y: 34.7 }, initialHolderId: 'b1' }
  const tl = doc.scenes[0]!.timeline
  tl.tracks.push(
    track('ball', 'ball', [
      {
        id: 'bu-hold1',
        kind: 'possessed',
        trigger: { type: 'at', t: 0 },
        timing: { duration: 0 },
        holderId: 'b1',
      },
      {
        id: 'bu-pass1',
        kind: 'travel',
        travelKind: 'pass',
        trigger: { type: 'at', t: 0.8 },
        timing: { speed: 14 },
        path: line([5, 34], [14, 24]),
        receiverId: 'b4',
      },
      {
        id: 'bu-hold2',
        kind: 'possessed',
        trigger: { type: 'afterSegment', segmentId: 'bu-pass1', anchor: 'end', offset: 0 },
        timing: { duration: 0 },
        holderId: 'b4',
      },
      {
        id: 'bu-pass2',
        kind: 'travel',
        travelKind: 'pass',
        trigger: { type: 'afterSegment', segmentId: 'bu-pass1', anchor: 'end', offset: 0.7 },
        timing: { speed: 14 },
        path: line([14, 24], [24, 32]),
        receiverId: 'b6',
      },
      {
        id: 'bu-hold3',
        kind: 'possessed',
        trigger: { type: 'afterSegment', segmentId: 'bu-pass2', anchor: 'end', offset: 0 },
        timing: { duration: 0 },
        holderId: 'b6',
      },
      {
        id: 'bu-pass3',
        kind: 'travel',
        travelKind: 'pass',
        trigger: { type: 'afterSegment', segmentId: 'bu-pass2', anchor: 'end', offset: 0.5 },
        timing: { speed: 16 },
        path: line([24, 32], [35, 10]),
        receiverId: 'b2',
      },
      {
        id: 'bu-hold4',
        kind: 'possessed',
        trigger: { type: 'afterSegment', segmentId: 'bu-pass3', anchor: 'end', offset: 0 },
        timing: { duration: 0 },
        holderId: 'b2',
      },
    ]),
    track('b6', 'player', [
      {
        id: 'bu-b6-show',
        kind: 'move',
        trigger: { type: 'at', t: 1.2 },
        timing: { speed: 4 },
        path: line([26, 34], [24, 32]),
      },
    ]),
    track('b2', 'player', [
      {
        id: 'bu-b2-push',
        kind: 'move',
        trigger: { type: 'onEvent', event: { kind: 'ball.received', segmentId: 'bu-pass2' }, offset: 0 },
        timing: { speed: 5 },
        path: line([28, 9], [36, 10]),
      },
    ]),
    track('r9', 'player', [
      {
        id: 'bu-r9-press',
        kind: 'move',
        trigger: { type: 'onEvent', event: { kind: 'ball.released', segmentId: 'bu-pass1' }, offset: 0 },
        timing: { speed: 6.5 },
        path: line([23, 29], [16, 25]),
      },
    ]),
    track('r10', 'player', [
      {
        id: 'bu-r10-shift',
        kind: 'move',
        trigger: { type: 'onEvent', event: { kind: 'ball.released', segmentId: 'bu-pass2' }, offset: 0 },
        timing: { speed: 5.5 },
        path: line([23, 39], [25, 34]),
      },
    ]),
    track('r7', 'player', [
      {
        id: 'bu-r7-close',
        kind: 'move',
        trigger: { type: 'onEvent', event: { kind: 'ball.released', segmentId: 'bu-pass3' }, offset: 0 },
        timing: { speed: 6 },
        path: line([33, 14], [35, 11]),
      },
    ]),
  )
  doc.drawings.push({
    id: 'bu-zone',
    kind: 'zone',
    shape: { type: 'ellipse', center: { x: 24, y: 33 }, radius: { x: 4, y: 3 } },
    style: { color: 'var(--st-team-a)' },
  })
  doc.drawings.push({
    id: 'bu-text',
    kind: 'text',
    at: { x: 42, y: 56 },
    text: '3+1 빌드업 — 숫자 우위로 전진',
  })
  return doc
}

/** Scenario F — pressing trigger: the back-pass is the signal; striker curves onto the GK. */
export function buildScenarioPressTrigger(): TacticDocument {
  const doc = createEmptyDocument({ id: 'scenario-press-trigger', title: '예시 · 전방 압박 트리거' })
  doc.teams = DEFAULT_TEAMS.map((t) => ({ ...t }))
  doc.players = [
    { id: 'r1', teamId: 'team-b', number: 1, home: { x: 100, y: 34 } },
    { id: 'r2', teamId: 'team-b', number: 2, home: { x: 88, y: 25 } },
    { id: 'r3', teamId: 'team-b', number: 3, home: { x: 88, y: 43 } },
    { id: 'r4', teamId: 'team-b', number: 4, home: { x: 82, y: 11 } },
    { id: 'b9', teamId: 'team-a', number: 9, home: { x: 76, y: 30 } },
    { id: 'b10', teamId: 'team-a', number: 10, home: { x: 74, y: 44 } },
    { id: 'b7', teamId: 'team-a', number: 7, home: { x: 72, y: 13 } },
  ]
  doc.ball = { id: 'ball', home: { x: 86.9, y: 25.6 }, initialHolderId: 'r2' }
  const tl = doc.scenes[0]!.timeline
  tl.tracks.push(
    track('ball', 'ball', [
      {
        id: 'pt-hold1',
        kind: 'possessed',
        trigger: { type: 'at', t: 0 },
        timing: { duration: 0 },
        holderId: 'r2',
      },
      {
        id: 'pt-pass1',
        kind: 'travel',
        travelKind: 'pass',
        trigger: { type: 'at', t: 1 },
        timing: { speed: 14 },
        path: line([88, 25], [98, 33]),
        receiverId: 'r1',
      },
      {
        id: 'pt-hold2',
        kind: 'possessed',
        trigger: { type: 'afterSegment', segmentId: 'pt-pass1', anchor: 'end', offset: 0 },
        timing: { duration: 0 },
        holderId: 'r1',
      },
      {
        id: 'pt-clear',
        kind: 'travel',
        travelKind: 'clearance',
        trigger: { type: 'afterSegment', segmentId: 'pt-pass1', anchor: 'end', offset: 1.5 },
        timing: { speed: 20 },
        path: line([98, 33], [58, 45]),
        flight: 'lofted',
      },
    ]),
    track('b9', 'player', [
      {
        id: 'pt-b9-press',
        kind: 'move',
        trigger: { type: 'onEvent', event: { kind: 'ball.released', segmentId: 'pt-pass1' }, offset: 0 },
        timing: { speed: 6.8 },
        path: line([76, 30], [88, 29], [95, 32]),
      },
    ]),
    track('b10', 'player', [
      {
        id: 'pt-b10-mark',
        kind: 'move',
        trigger: { type: 'onEvent', event: { kind: 'ball.released', segmentId: 'pt-pass1' }, offset: 0.2 },
        timing: { speed: 6 },
        path: line([74, 44], [84, 43]),
      },
    ]),
    track('b7', 'player', [
      {
        id: 'pt-b7-mark',
        kind: 'move',
        trigger: { type: 'onEvent', event: { kind: 'ball.released', segmentId: 'pt-pass1' }, offset: 0.2 },
        timing: { speed: 6 },
        path: line([72, 13], [79, 12]),
      },
    ]),
  )
  doc.drawings.push({
    id: 'pt-zone',
    kind: 'zone',
    shape: { type: 'ellipse', center: { x: 93, y: 29.5 }, radius: { x: 4.5, y: 3 } },
    style: { color: 'var(--st-team-a)' },
  })
  doc.drawings.push({
    id: 'pt-text',
    kind: 'text',
    at: { x: 75, y: 55 },
    text: '백패스 = 압박 시작 신호',
  })
  return doc
}

/** Scenario G — defence→attack transition: win the ball deep, one lofted ball over the top, finish. */
export function buildScenarioTransition(): TacticDocument {
  const doc = createEmptyDocument({ id: 'scenario-transition', title: '예시 · 수비→공격 전환' })
  doc.teams = DEFAULT_TEAMS.map((t) => ({ ...t }))
  doc.players = [
    { id: 'b4', teamId: 'team-a', number: 4, home: { x: 25, y: 31 } },
    { id: 'b9', teamId: 'team-a', number: 9, home: { x: 50, y: 29 } },
    { id: 'b7', teamId: 'team-a', number: 7, home: { x: 46, y: 12 } },
    { id: 'b8', teamId: 'team-a', number: 8, home: { x: 42, y: 46 } },
    { id: 'r2', teamId: 'team-b', number: 2, home: { x: 38, y: 22 } },
    { id: 'r3', teamId: 'team-b', number: 3, home: { x: 40, y: 42 } },
  ]
  doc.ball = { id: 'ball', home: { x: 26.1, y: 31.7 }, initialHolderId: 'b4' }
  const tl = doc.scenes[0]!.timeline
  tl.tracks.push(
    track('b9', 'player', [
      {
        id: 'tr-b9-run',
        kind: 'move',
        trigger: { type: 'at', t: 0.3 },
        timing: { speed: 7.5 },
        path: line([50, 29], [78, 28]),
      },
    ]),
    track('b7', 'player', [
      {
        id: 'tr-b7-run',
        kind: 'move',
        trigger: { type: 'at', t: 0.5 },
        timing: { speed: 7 },
        path: line([46, 12], [78, 13]),
      },
    ]),
    track('b8', 'player', [
      {
        id: 'tr-b8-run',
        kind: 'move',
        trigger: { type: 'at', t: 0.5 },
        timing: { speed: 6 },
        path: line([42, 46], [66, 40]),
      },
    ]),
    track('r2', 'player', [
      {
        id: 'tr-r2-rec',
        kind: 'move',
        trigger: { type: 'at', t: 0.6 },
        timing: { speed: 6.8 },
        path: line([38, 22], [72, 27]),
      },
    ]),
    track('r3', 'player', [
      {
        id: 'tr-r3-rec',
        kind: 'move',
        trigger: { type: 'at', t: 0.6 },
        timing: { speed: 6.8 },
        path: line([40, 42], [73, 35]),
      },
    ]),
    track('ball', 'ball', [
      {
        id: 'tr-hold1',
        kind: 'possessed',
        trigger: { type: 'at', t: 0 },
        timing: { duration: 0 },
        holderId: 'b4',
      },
      {
        id: 'tr-pass1',
        kind: 'travel',
        travelKind: 'pass',
        trigger: { type: 'at', t: 1 },
        timing: { speed: 18 },
        path: line([25, 31], [75, 28.5]),
        receiverId: 'b9',
        flight: 'lofted',
      },
      {
        id: 'tr-hold2',
        kind: 'possessed',
        trigger: { type: 'afterSegment', segmentId: 'tr-pass1', anchor: 'end', offset: 0 },
        timing: { duration: 0 },
        holderId: 'b9',
      },
      {
        id: 'tr-shot',
        kind: 'travel',
        travelKind: 'shot',
        trigger: { type: 'afterSegment', segmentId: 'tr-b9-run', anchor: 'end', offset: 0.3 },
        timing: { speed: 24 },
        path: line([78, 28], [103.5, 32]),
      },
    ]),
  )
  doc.drawings.push({
    id: 'tr-text',
    kind: 'text',
    at: { x: 48, y: 58 },
    text: '탈취 후 5초 — 수비 복귀 전 마무리',
  })
  return doc
}

/** Scenario H — cutback: byline drive, near-post decoy drags the CB, finish from the spot. */
export function buildScenarioCutback(): TacticDocument {
  const doc = createEmptyDocument({ id: 'scenario-cutback', title: '예시 · 컷백 마무리' })
  doc.teams = DEFAULT_TEAMS.map((t) => ({ ...t }))
  doc.players = [
    { id: 'b7', teamId: 'team-a', number: 7, home: { x: 78, y: 58 } },
    { id: 'b9', teamId: 'team-a', number: 9, home: { x: 82, y: 42 } },
    { id: 'b10', teamId: 'team-a', number: 10, home: { x: 70, y: 34 } },
    { id: 'r5', teamId: 'team-b', number: 5, home: { x: 92, y: 38 } },
    { id: 'r6', teamId: 'team-b', number: 6, home: { x: 90, y: 28 } },
  ]
  doc.ball = { id: 'ball', home: { x: 79.1, y: 58.7 }, initialHolderId: 'b7' }
  const tl = doc.scenes[0]!.timeline
  tl.tracks.push(
    track('b7', 'player', [
      {
        id: 'cb-b7-drive',
        kind: 'move',
        trigger: { type: 'at', t: 0.3 },
        timing: { speed: 6.5 },
        path: line([78, 58], [94, 62], [100, 54]),
      },
    ]),
    track('b9', 'player', [
      {
        id: 'cb-b9-near',
        kind: 'move',
        trigger: { type: 'at', t: 1.5 },
        timing: { speed: 5.5 },
        path: line([82, 42], [99, 38.5]),
      },
    ]),
    track('b10', 'player', [
      {
        id: 'cb-b10-spot',
        kind: 'move',
        trigger: { type: 'at', t: 1.8 },
        timing: { speed: 5 },
        path: line([70, 34], [87, 36]),
      },
    ]),
    track('r5', 'player', [
      {
        id: 'cb-r5-track',
        kind: 'move',
        trigger: { type: 'at', t: 1.8 },
        timing: { speed: 4.5 },
        path: line([92, 38], [100, 39]),
      },
    ]),
    track('r6', 'player', [
      {
        id: 'cb-r6-cover',
        kind: 'move',
        trigger: { type: 'at', t: 2.2 },
        timing: { speed: 6 },
        path: line([90, 28], [98, 50]),
      },
    ]),
    track('ball', 'ball', [
      {
        id: 'cb-hold1',
        kind: 'possessed',
        trigger: { type: 'at', t: 0 },
        timing: { duration: 0 },
        holderId: 'b7',
      },
      {
        id: 'cb-cutback',
        kind: 'travel',
        travelKind: 'pass',
        trigger: { type: 'afterSegment', segmentId: 'cb-b7-drive', anchor: 'end', offset: 0.3 },
        timing: { speed: 15 },
        path: line([100, 54], [88, 37]),
        receiverId: 'b10',
      },
      {
        id: 'cb-hold2',
        kind: 'possessed',
        trigger: { type: 'afterSegment', segmentId: 'cb-cutback', anchor: 'end', offset: 0 },
        timing: { duration: 0 },
        holderId: 'b10',
      },
      {
        id: 'cb-shot',
        kind: 'travel',
        travelKind: 'shot',
        trigger: { type: 'afterSegment', segmentId: 'cb-cutback', anchor: 'end', offset: 0.35 },
        timing: { speed: 23 },
        path: line([88, 37], [103.6, 33]),
      },
    ]),
  )
  doc.drawings.push({
    id: 'cb-zone',
    kind: 'zone',
    shape: { type: 'ellipse', center: { x: 88, y: 36.5 }, radius: { x: 4, y: 3 } },
    style: { color: 'var(--st-team-a)' },
  })
  doc.drawings.push({
    id: 'cb-text',
    kind: 'text',
    at: { x: 72, y: 50 },
    text: '컷백 — 수비 시선 반대로',
  })
  return doc
}

export const SCENARIOS: ScenarioPreset[] = [
  {
    id: 'scenario-a',
    name: '2v2 패스 & 압박',
    description: '지연 출발·반응·패스 detach/receive·이벤트 압박',
    build: buildScenarioA,
  },
  {
    id: 'scenario-b',
    name: '원투 & 침투',
    description: '패스 중 접근, 침투, 압박 도착 전 리턴패스',
    build: buildScenarioB,
  },
  {
    id: 'scenario-third-man',
    name: '세 번째 선수 움직임',
    description: '벽 패스 → 레이오프 → 제3선수 스루패스 침투',
    build: buildScenarioThirdMan,
  },
  {
    id: 'scenario-overlap',
    name: '오버랩 vs 언더랩',
    description: '한 측면에서 바깥 오버랩·안쪽 언더랩 동시 전개',
    build: buildScenarioOverlap,
  },
  {
    id: 'scenario-buildup',
    name: '4-3-3 후방 빌드업',
    description: 'GK+2CB+DM 숫자 우위 → 풀백 전진 라인 브레이크',
    build: buildScenarioBuildup,
  },
  {
    id: 'scenario-press-trigger',
    name: '전방 압박 트리거',
    description: '백패스 순간 스트라이커 압박 + 패스 길목 차단',
    build: buildScenarioPressTrigger,
  },
  {
    id: 'scenario-transition',
    name: '수비→공격 전환',
    description: '탈취 직후 롱볼 → 침투 → 마무리 슛',
    build: buildScenarioTransition,
  },
  {
    id: 'scenario-cutback',
    name: '컷백 마무리',
    description: '바이라인 드리블 → 니어포스트 미끼 → 컷백 슛',
    build: buildScenarioCutback,
  },
]
