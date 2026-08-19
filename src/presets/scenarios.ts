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
]
