/**
 * Scenario documents — TEST FIXTURES and a worked reference for the domain model.
 *
 * These no longer ship: the "예시 전술" panel was retired (user 2026-08-21: 예시 전술 그냥 폐기),
 * so nothing in the app imports them and they are tree-shaken out of the bundle. They stay because
 * the test suite needs realistic multi-track documents (compile, validate, path presentation) that
 * would otherwise be hand-rolled per test.
 *
 * Every authored path has an explicit simple-mode step and every builder finishes through the
 * same relayout pipeline as user edits. That is deliberate: an example must not look correct only
 * until the first edit and then collapse into implicit step 1.
 * [WH-CHANGE v0.1.0 | PRESET | 2026-08-21 | CHG-20260821-124]
 */
import { createEmptyDocument } from '@/domain/factories'
import type { BallTravelKind, Path, Player, Segment, TacticDocument, Track } from '@/domain/types'
import { DEFAULT_TEAMS } from '@/editor/commands'
import { DEFAULT_PASS_SPEED, DEFAULT_PLAYER_SPEED } from '@/editor/segmentCommands'
import { relayoutStepsInDraft } from '@/editor/stepCommands'
import { smoothWaypoints } from '@/engine/path'

type Point = readonly [number, number]

const path = (id: string, points: readonly Point[], curved = false): Path => {
  const vectors = points.map(([x, y]) => ({ x, y }))
  const ids = vectors.map((_, i) => `${id}-w${i}`)
  return {
    waypoints: curved
      ? smoothWaypoints(vectors, ids, 0.5)
      : vectors.map((p, i) => ({ id: ids[i]!, p })),
  }
}

const move = (id: string, step: number, points: readonly Point[], curved = false): Segment => ({
  id,
  kind: 'move',
  step,
  trigger: { type: 'at', t: 0 },
  timing: { speed: DEFAULT_PLAYER_SPEED },
  path: path(id, points, curved),
  facing: 'path',
})

const travel = (
  id: string,
  step: number,
  travelKind: BallTravelKind,
  points: readonly Point[],
  receiverId?: string,
  flight?: 'ground' | 'lofted',
): Segment => ({
  id,
  kind: 'travel',
  travelKind,
  step,
  trigger: { type: 'at', t: 0 },
  timing: { speed: DEFAULT_PASS_SPEED },
  path: path(id, points, false),
  ...(receiverId ? { receiverId } : {}),
  ...(flight ? { flight } : {}),
})

const firstPossession = (id: string, holderId: string): Segment => ({
  id,
  kind: 'possessed',
  trigger: { type: 'at', t: 0 },
  timing: { duration: 0 },
  holderId,
})

const receive = (id: string, holderId: string, passId: string): Segment => ({
  id,
  kind: 'possessed',
  trigger: { type: 'afterSegment', segmentId: passId, anchor: 'end', offset: 0 },
  timing: { duration: 0 },
  holderId,
})

const track = (entityId: string, entityKind: 'player' | 'ball', segments: Segment[]): Track => ({
  id: `trk-${entityId}`,
  entityId,
  entityKind,
  segments,
})

function scenario(
  id: string,
  title: string,
  description: string,
  players: Player[],
  holderId: string,
): TacticDocument {
  const doc = createEmptyDocument({ id, title })
  doc.meta.description = description
  doc.teams = DEFAULT_TEAMS.map((team) => ({ ...team }))
  doc.players = players
  const holder = players.find((player) => player.id === holderId)!
  doc.ball = {
    id: 'ball',
    home: { x: holder.home.x + 1.8, y: holder.home.y + 1.1 },
    initialHolderId: holderId,
  }
  return doc
}

/** Apply the production step pipeline so a loaded example and its first edit have identical rules. */
function finish(doc: TacticDocument): TacticDocument {
  relayoutStepsInDraft(doc)
  return doc
}

export interface ScenarioPreset {
  id: string
  name: string
  description: string
  build: () => TacticDocument
}

/** 2v2 — create width, find the free player, then escape the delayed pressure. */
export function buildScenarioA(): TacticDocument {
  const doc = scenario(
    'scenario-a',
    '예시 · 2v2 패스 & 압박 탈출',
    '측면 폭을 만든 뒤 패스하고, 수신 직후 압박을 첫 터치 드리블로 벗어나는 3단계 장면.',
    [
      { id: 'b1', teamId: 'team-a', number: 6, role: 'CM', home: { x: 38, y: 39 } },
      { id: 'b2', teamId: 'team-a', number: 7, role: 'RW', home: { x: 51, y: 23 } },
      { id: 'r1', teamId: 'team-b', number: 3, role: 'LB', home: { x: 60, y: 23 } },
      { id: 'r2', teamId: 'team-b', number: 6, role: 'CM', home: { x: 63, y: 40 } },
    ],
    'b1',
  )
  doc.scenes[0]!.timeline.tracks.push(
    track('b2', 'player', [
      move(
        'a-b2-wide',
        1,
        [
          [51, 23],
          [56, 18],
          [62, 15],
        ],
        true,
      ),
      move(
        'a-b2-escape',
        3,
        [
          [62, 15],
          [68, 13],
          [74, 10],
        ],
        true,
      ),
    ]),
    track('r1', 'player', [
      move(
        'a-r1-track',
        1,
        [
          [60, 23],
          [62, 21],
          [64, 19],
        ],
        true,
      ),
      move(
        'a-r1-cover',
        3,
        [
          [64, 19],
          [69, 17],
          [72, 14],
        ],
        true,
      ),
    ]),
    track('r2', 'player', [
      move(
        'a-r2-press',
        3,
        [
          [63, 40],
          [65, 29],
          [67, 20],
          [70, 14],
        ],
        true,
      ),
    ]),
    track('ball', 'ball', [
      firstPossession('a-hold-1', 'b1'),
      travel(
        'a-pass',
        2,
        'pass',
        [
          [38, 39],
          [62, 15],
        ],
        'b2',
      ),
      receive('a-hold-2', 'b2', 'a-pass'),
    ]),
  )
  doc.drawings.push(
    {
      id: 'a-zone',
      kind: 'zone',
      shape: { type: 'ellipse', center: { x: 70, y: 12 }, radius: { x: 7, y: 5 } },
      style: { color: 'var(--st-team-a)', opacity: 0.18 },
    },
    { id: 'a-text', kind: 'text', at: { x: 53, y: 7 }, text: '폭 확보 → 패스 → 압박 탈출' },
  )
  return finish(doc)
}

/** Wall pass — first pass draws pressure, runner and return pass attack the vacated lane together. */
export function buildScenarioB(): TacticDocument {
  const doc = scenario(
    'scenario-b',
    '예시 · 원투 & 침투',
    '첫 패스로 압박을 끌어낸 뒤, 패서가 빈 공간으로 침투하며 리턴패스를 받는 2단계 원투.',
    [
      { id: 'b1', teamId: 'team-a', number: 8, role: 'CM', home: { x: 39, y: 39 } },
      { id: 'b2', teamId: 'team-a', number: 10, role: 'AM', home: { x: 52, y: 27 } },
      { id: 'r1', teamId: 'team-b', number: 6, role: 'DM', home: { x: 58, y: 28 } },
      { id: 'r2', teamId: 'team-b', number: 4, role: 'CB', home: { x: 65, y: 39 } },
    ],
    'b1',
  )
  doc.scenes[0]!.timeline.tracks.push(
    track('ball', 'ball', [
      firstPossession('b-hold-1', 'b1'),
      travel(
        'b-pass-1',
        1,
        'pass',
        [
          [39, 39],
          [52, 27],
        ],
        'b2',
      ),
      receive('b-hold-2', 'b2', 'b-pass-1'),
      travel(
        'b-pass-2',
        2,
        'throughBall',
        [
          [52, 27],
          [66, 31],
        ],
        'b1',
      ),
      receive('b-hold-3', 'b1', 'b-pass-2'),
    ]),
    track('r1', 'player', [
      move(
        'b-r1-close',
        1,
        [
          [58, 28],
          [55, 27],
          [53, 27],
        ],
        true,
      ),
    ]),
    track('b1', 'player', [
      move(
        'b-b1-run',
        2,
        [
          [39, 39],
          [51, 35],
          [66, 31],
        ],
        true,
      ),
    ]),
    track('r2', 'player', [
      move(
        'b-r2-cover',
        2,
        [
          [65, 39],
          [66, 36],
          [67, 33],
        ],
        true,
      ),
    ]),
  )
  doc.drawings.push(
    {
      id: 'b-lane',
      kind: 'zone',
      shape: { type: 'ellipse', center: { x: 63, y: 31 }, radius: { x: 6, y: 4 } },
      style: { color: 'var(--st-team-a)', opacity: 0.16 },
    },
    { id: 'b-text', kind: 'text', at: { x: 45, y: 19 }, text: '압박을 끌고, 비운 공간으로' },
  )
  return finish(doc)
}

/** Third-man combination — receiver lays off, a different runner attacks beyond the line. */
export function buildScenarioThirdMan(): TacticDocument {
  const doc = scenario(
    'scenario-third-man',
    '예시 · 세 번째 선수 움직임',
    '6번의 전진 패스, 9번의 레이오프, 8번의 스루패스로 10번이 수비선 뒤를 공격.',
    [
      { id: 'b6', teamId: 'team-a', number: 6, role: 'DM', home: { x: 42, y: 43 } },
      { id: 'b8', teamId: 'team-a', number: 8, role: 'CM', home: { x: 56, y: 28 } },
      { id: 'b9', teamId: 'team-a', number: 9, role: 'ST', home: { x: 69, y: 32 } },
      { id: 'b10', teamId: 'team-a', number: 10, role: 'AM', home: { x: 58, y: 48 } },
      { id: 'r4', teamId: 'team-b', number: 4, role: 'CB', home: { x: 81, y: 21 } },
      { id: 'r5', teamId: 'team-b', number: 5, role: 'CB', home: { x: 77, y: 32 } },
      { id: 'r6', teamId: 'team-b', number: 6, role: 'DM', home: { x: 78, y: 45 } },
    ],
    'b6',
  )
  doc.scenes[0]!.timeline.tracks.push(
    track('ball', 'ball', [
      firstPossession('tm-hold-1', 'b6'),
      travel(
        'tm-pass-1',
        1,
        'pass',
        [
          [42, 43],
          [69, 32],
        ],
        'b9',
      ),
      receive('tm-hold-2', 'b9', 'tm-pass-1'),
      travel(
        'tm-pass-2',
        2,
        'pass',
        [
          [69, 32],
          [62, 31],
        ],
        'b8',
      ),
      receive('tm-hold-3', 'b8', 'tm-pass-2'),
      travel(
        'tm-pass-3',
        3,
        'throughBall',
        [
          [62, 31],
          [91, 37],
        ],
        'b10',
      ),
      receive('tm-hold-4', 'b10', 'tm-pass-3'),
    ]),
    track('b8', 'player', [
      move(
        'tm-b8-show',
        1,
        [
          [56, 28],
          [59, 29],
          [62, 31],
        ],
        true,
      ),
    ]),
    track('b10', 'player', [
      move(
        'tm-b10-prepare',
        2,
        [
          [58, 48],
          [64, 45],
          [70, 43],
        ],
        true,
      ),
      move(
        'tm-b10-break',
        3,
        [
          [70, 43],
          [81, 40],
          [91, 37],
        ],
        true,
      ),
    ]),
    track('r5', 'player', [
      move(
        'tm-r5-step',
        1,
        [
          [77, 32],
          [74, 32],
          [72, 32],
        ],
        true,
      ),
      move(
        'tm-r5-cover',
        3,
        [
          [72, 32],
          [78, 33],
          [84, 35],
        ],
        true,
      ),
    ]),
    track('r6', 'player', [
      move(
        'tm-r6-track',
        2,
        [
          [78, 45],
          [76, 43],
          [74, 42],
        ],
        true,
      ),
      move(
        'tm-r6-chase',
        3,
        [
          [74, 42],
          [82, 41],
          [88, 40],
        ],
        true,
      ),
    ]),
  )
  doc.drawings.push(
    {
      id: 'tm-zone',
      kind: 'zone',
      shape: { type: 'ellipse', center: { x: 89, y: 37 }, radius: { x: 7, y: 5 } },
      style: { color: 'var(--st-team-a)', opacity: 0.16 },
    },
    { id: 'tm-text', kind: 'text', at: { x: 49, y: 17 }, text: '전진 → 레이오프 → 제3자 침투' },
  )
  return finish(doc)
}

/** Overlap/underlap — two lanes pin the defender; the ball is released outside. */
export function buildScenarioOverlap(): TacticDocument {
  const doc = scenario(
    'scenario-overlap',
    '예시 · 오버랩 vs 언더랩',
    '윙어가 안으로 운반하며 풀백은 바깥, 8번은 안쪽으로 달려 수비 선택을 만들고 오버랩을 사용.',
    [
      { id: 'b7', teamId: 'team-a', number: 7, role: 'RW', home: { x: 65, y: 16 } },
      { id: 'b2', teamId: 'team-a', number: 2, role: 'RB', home: { x: 52, y: 9 } },
      { id: 'b8', teamId: 'team-a', number: 8, role: 'CM', home: { x: 55, y: 27 } },
      { id: 'r3', teamId: 'team-b', number: 3, role: 'LB', home: { x: 74, y: 17 } },
      { id: 'r4', teamId: 'team-b', number: 4, role: 'LCB', home: { x: 81, y: 29 } },
      { id: 'r6', teamId: 'team-b', number: 6, role: 'DM', home: { x: 82, y: 19 } },
    ],
    'b7',
  )
  doc.scenes[0]!.timeline.tracks.push(
    track('b7', 'player', [
      move(
        'ov-b7-carry',
        1,
        [
          [65, 16],
          [68, 18],
          [71, 20],
        ],
        true,
      ),
    ]),
    track('b2', 'player', [
      move(
        'ov-b2-overlap-1',
        1,
        [
          [52, 9],
          [64, 7],
          [78, 8],
        ],
        true,
      ),
      move('ov-b2-overlap-2', 2, [
        [78, 8],
        [85, 8],
      ]),
    ]),
    track('b8', 'player', [
      move(
        'ov-b8-underlap-1',
        1,
        [
          [55, 27],
          [66, 24],
          [77, 22],
        ],
        true,
      ),
      move('ov-b8-underlap-2', 2, [
        [77, 22],
        [87, 20],
      ]),
    ]),
    track('r3', 'player', [
      move(
        'ov-r3-jockey',
        1,
        [
          [74, 17],
          [75, 18],
          [76, 19],
        ],
        true,
      ),
      move(
        'ov-r3-inside',
        2,
        [
          [76, 19],
          [81, 20],
          [84, 20],
        ],
        true,
      ),
    ]),
    track('r4', 'player', [
      move(
        'ov-r4-cover',
        2,
        [
          [81, 29],
          [83, 21],
          [85, 14],
        ],
        true,
      ),
    ]),
    track('ball', 'ball', [
      firstPossession('ov-hold-1', 'b7'),
      travel(
        'ov-pass',
        2,
        'pass',
        [
          [71, 20],
          [85, 8],
        ],
        'b2',
      ),
      receive('ov-hold-2', 'b2', 'ov-pass'),
    ]),
  )
  doc.drawings.push(
    { id: 'ov-text-over', kind: 'text', at: { x: 76, y: 4 }, text: '오버랩 — 바깥' },
    { id: 'ov-text-under', kind: 'text', at: { x: 76, y: 26 }, text: '언더랩 — 안쪽 미끼' },
    {
      id: 'ov-zone',
      kind: 'zone',
      shape: { type: 'ellipse', center: { x: 86, y: 10 }, radius: { x: 6, y: 5 } },
      style: { color: 'var(--st-team-a)', opacity: 0.16 },
    },
  )
  return finish(doc)
}

/** 4-3-3 build-up — create a 3+1, draw the press, then find the advancing full-back. */
export function buildScenarioBuildup(): TacticDocument {
  const doc = scenario(
    'scenario-buildup',
    '예시 · 4-3-3 후방 빌드업',
    'GK-센터백-6번의 3+1 구조로 두 명의 압박을 끌고 오른쪽 풀백에게 전진 패스.',
    [
      { id: 'b1', teamId: 'team-a', number: 1, role: 'GK', home: { x: 7, y: 34 } },
      { id: 'b4', teamId: 'team-a', number: 4, role: 'LCB', home: { x: 18, y: 23 } },
      { id: 'b5', teamId: 'team-a', number: 5, role: 'RCB', home: { x: 18, y: 45 } },
      { id: 'b6', teamId: 'team-a', number: 6, role: 'DM', home: { x: 29, y: 34 } },
      { id: 'b2', teamId: 'team-a', number: 2, role: 'RB', home: { x: 31, y: 10 } },
      { id: 'b8', teamId: 'team-a', number: 8, role: 'CM', home: { x: 46, y: 27 } },
      { id: 'r9', teamId: 'team-b', number: 9, role: 'ST', home: { x: 31, y: 27 } },
      { id: 'r10', teamId: 'team-b', number: 10, role: 'AM', home: { x: 32, y: 42 } },
      { id: 'r7', teamId: 'team-b', number: 7, role: 'LW', home: { x: 39, y: 13 } },
    ],
    'b1',
  )
  doc.scenes[0]!.timeline.tracks.push(
    track('ball', 'ball', [
      firstPossession('bu-hold-1', 'b1'),
      travel(
        'bu-pass-1',
        1,
        'pass',
        [
          [7, 34],
          [18, 23],
        ],
        'b4',
      ),
      receive('bu-hold-2', 'b4', 'bu-pass-1'),
      travel(
        'bu-pass-2',
        2,
        'pass',
        [
          [18, 23],
          [24, 34],
        ],
        'b6',
      ),
      receive('bu-hold-3', 'b6', 'bu-pass-2'),
      travel(
        'bu-pass-3',
        3,
        'throughBall',
        [
          [24, 34],
          [48, 9],
        ],
        'b2',
      ),
      receive('bu-hold-4', 'b2', 'bu-pass-3'),
    ]),
    track('b6', 'player', [
      move(
        'bu-b6-drop',
        1,
        [
          [29, 34],
          [26, 34],
          [24, 34],
        ],
        true,
      ),
    ]),
    track('b2', 'player', [
      move('bu-b2-push-1', 2, [
        [31, 10],
        [38, 9],
      ]),
      move('bu-b2-push-2', 3, [
        [38, 9],
        [48, 9],
      ]),
    ]),
    track('b8', 'player', [
      move('bu-b8-open', 3, [
        [46, 27],
        [51, 25],
      ]),
    ]),
    track('r9', 'player', [
      move(
        'bu-r9-press',
        1,
        [
          [31, 27],
          [25, 25],
          [21, 23],
        ],
        true,
      ),
    ]),
    track('r10', 'player', [
      move(
        'bu-r10-screen',
        1,
        [
          [32, 42],
          [28, 38],
          [26, 36],
        ],
        true,
      ),
      move('bu-r10-jump', 2, [
        [26, 36],
        [25, 35],
      ]),
    ]),
    track('r7', 'player', [
      move('bu-r7-track-1', 2, [
        [39, 13],
        [41, 11],
      ]),
      move('bu-r7-track-2', 3, [
        [41, 11],
        [46, 12],
      ]),
    ]),
  )
  doc.drawings.push(
    {
      id: 'bu-zone',
      kind: 'zone',
      shape: { type: 'ellipse', center: { x: 25, y: 34 }, radius: { x: 5, y: 4 } },
      style: { color: 'var(--st-team-a)', opacity: 0.15 },
    },
    { id: 'bu-text', kind: 'text', at: { x: 34, y: 57 }, text: '3+1로 압박 유도 → 풀백 전진' },
  )
  return finish(doc)
}

/** Pressing trigger — the back-pass happens first, then the front three lock the next options. */
export function buildScenarioPressTrigger(): TacticDocument {
  const doc = scenario(
    'scenario-press-trigger',
    '예시 · 전방 압박 트리거',
    '센터백의 백패스를 확인한 뒤 9번은 GK를 압박하고, 10번과 7번은 가까운 출구를 잠금.',
    [
      { id: 'r1', teamId: 'team-b', number: 1, role: 'GK', home: { x: 99, y: 34 } },
      { id: 'r2', teamId: 'team-b', number: 2, role: 'LCB', home: { x: 88, y: 24 } },
      { id: 'r3', teamId: 'team-b', number: 3, role: 'RCB', home: { x: 88, y: 44 } },
      { id: 'r4', teamId: 'team-b', number: 4, role: 'LB', home: { x: 82, y: 11 } },
      { id: 'b9', teamId: 'team-a', number: 9, role: 'ST', home: { x: 75, y: 30 } },
      { id: 'b10', teamId: 'team-a', number: 10, role: 'AM', home: { x: 74, y: 44 } },
      { id: 'b7', teamId: 'team-a', number: 7, role: 'RW', home: { x: 72, y: 13 } },
    ],
    'r2',
  )
  doc.scenes[0]!.timeline.tracks.push(
    track('ball', 'ball', [
      firstPossession('pt-hold-1', 'r2'),
      travel(
        'pt-back-pass',
        1,
        'pass',
        [
          [88, 24],
          [99, 34],
        ],
        'r1',
      ),
      receive('pt-hold-2', 'r1', 'pt-back-pass'),
      travel(
        'pt-clear',
        3,
        'clearance',
        [
          [99, 34],
          [58, 47],
        ],
        undefined,
        'lofted',
      ),
    ]),
    track('b9', 'player', [
      move(
        'pt-b9-press',
        2,
        [
          [75, 30],
          [86, 28],
          [95, 32],
        ],
        true,
      ),
    ]),
    track('b10', 'player', [
      move(
        'pt-b10-lock',
        2,
        [
          [74, 44],
          [82, 43],
          [85, 43],
        ],
        true,
      ),
    ]),
    track('b7', 'player', [
      move(
        'pt-b7-lock',
        2,
        [
          [72, 13],
          [77, 12],
          [80, 12],
        ],
        true,
      ),
    ]),
  )
  doc.drawings.push(
    {
      id: 'pt-zone',
      kind: 'zone',
      shape: { type: 'ellipse', center: { x: 94, y: 32 }, radius: { x: 6, y: 5 } },
      style: { color: 'var(--st-team-a)', opacity: 0.16 },
    },
    {
      id: 'pt-text',
      kind: 'text',
      at: { x: 73, y: 55 },
      text: '백패스 확인 → 중앙 압박 → 출구 봉쇄',
    },
  )
  return finish(doc)
}

/** Defence-to-attack transition — secure the first separation, then play into the continuing run. */
export function buildScenarioTransition(): TacticDocument {
  const doc = scenario(
    'scenario-transition',
    '예시 · 수비→공격 전환',
    '탈취 직후 세 명이 먼저 벌어지고, 두 번째 움직임에 맞춘 로빙 패스로 수비 복귀 전에 슈팅.',
    [
      { id: 'b4', teamId: 'team-a', number: 4, role: 'CB', home: { x: 29, y: 35 } },
      { id: 'b9', teamId: 'team-a', number: 9, role: 'ST', home: { x: 52, y: 32 } },
      { id: 'b7', teamId: 'team-a', number: 7, role: 'RW', home: { x: 49, y: 15 } },
      { id: 'b8', teamId: 'team-a', number: 8, role: 'CM', home: { x: 47, y: 49 } },
      { id: 'r1', teamId: 'team-b', number: 1, role: 'GK', home: { x: 101, y: 34 } },
      { id: 'r2', teamId: 'team-b', number: 2, role: 'CB', home: { x: 60, y: 24 } },
      { id: 'r3', teamId: 'team-b', number: 3, role: 'CB', home: { x: 61, y: 43 } },
    ],
    'b4',
  )
  doc.scenes[0]!.timeline.tracks.push(
    track('b9', 'player', [
      move('tr-b9-break-1', 1, [
        [52, 32],
        [62, 31],
      ]),
      move(
        'tr-b9-break-2',
        2,
        [
          [62, 31],
          [73, 30],
          [84, 30],
        ],
        true,
      ),
    ]),
    track('b7', 'player', [
      move('tr-b7-break-1', 1, [
        [49, 15],
        [61, 13],
      ]),
      move('tr-b7-break-2', 2, [
        [61, 13],
        [82, 14],
      ]),
    ]),
    track('b8', 'player', [
      move('tr-b8-support-1', 1, [
        [47, 49],
        [59, 45],
      ]),
      move('tr-b8-support-2', 2, [
        [59, 45],
        [74, 41],
      ]),
    ]),
    track('r2', 'player', [
      move('tr-r2-recover-1', 1, [
        [60, 24],
        [67, 27],
      ]),
      move('tr-r2-recover-2', 2, [
        [67, 27],
        [79, 28],
      ]),
      move('tr-r2-chase', 3, [
        [79, 28],
        [87, 30],
      ]),
    ]),
    track('r3', 'player', [
      move('tr-r3-recover-1', 1, [
        [61, 43],
        [67, 39],
      ]),
      move('tr-r3-recover-2', 2, [
        [67, 39],
        [79, 37],
      ]),
    ]),
    track('r1', 'player', [
      move('tr-r1-set', 2, [
        [101, 34],
        [98, 34],
      ]),
      move('tr-r1-dive', 3, [
        [98, 34],
        [101, 33],
      ]),
    ]),
    track('ball', 'ball', [
      firstPossession('tr-hold-1', 'b4'),
      travel(
        'tr-long-pass',
        2,
        'throughBall',
        [
          [29, 35],
          [84, 30],
        ],
        'b9',
        'lofted',
      ),
      receive('tr-hold-2', 'b9', 'tr-long-pass'),
      travel('tr-shot', 3, 'shot', [
        [84, 30],
        [104.2, 33],
      ]),
    ]),
  )
  doc.drawings.push(
    {
      id: 'tr-zone',
      kind: 'zone',
      shape: { type: 'ellipse', center: { x: 84, y: 30 }, radius: { x: 6, y: 5 } },
      style: { color: 'var(--st-team-a)', opacity: 0.15 },
    },
    {
      id: 'tr-text',
      kind: 'text',
      at: { x: 45, y: 58 },
      text: '폭을 먼저 확보 → 두 번째 움직임에 롱패스',
    },
  )
  return finish(doc)
}

/** Cutback — carry to the byline, pin the near-post defender, arrive late around the spot. */
export function buildScenarioCutback(): TacticDocument {
  const doc = scenario(
    'scenario-cutback',
    '예시 · 컷백 마무리',
    '7번이 바이라인까지 운반하고 9번이 니어포스트를 비우며, 10번이 늦게 도착해 컷백을 슈팅.',
    [
      { id: 'b7', teamId: 'team-a', number: 7, role: 'RW', home: { x: 78, y: 57 } },
      { id: 'b9', teamId: 'team-a', number: 9, role: 'ST', home: { x: 82, y: 40 } },
      { id: 'b10', teamId: 'team-a', number: 10, role: 'AM', home: { x: 72, y: 34 } },
      { id: 'r1', teamId: 'team-b', number: 1, role: 'GK', home: { x: 101, y: 34 } },
      { id: 'r5', teamId: 'team-b', number: 5, role: 'CB', home: { x: 91, y: 39 } },
      { id: 'r6', teamId: 'team-b', number: 6, role: 'CB', home: { x: 92, y: 29 } },
    ],
    'b7',
  )
  doc.scenes[0]!.timeline.tracks.push(
    track('b7', 'player', [
      move(
        'cb-b7-drive',
        1,
        [
          [78, 57],
          [91, 61],
          [99, 55],
        ],
        true,
      ),
    ]),
    track('b9', 'player', [
      move(
        'cb-b9-near-1',
        1,
        [
          [82, 40],
          [91, 39],
          [97, 39],
        ],
        true,
      ),
      move('cb-b9-near-2', 2, [
        [97, 39],
        [101, 38],
      ]),
    ]),
    track('b10', 'player', [
      move('cb-b10-arrive-1', 1, [
        [72, 34],
        [78, 35],
      ]),
      move('cb-b10-arrive-2', 2, [
        [78, 35],
        [88, 37],
      ]),
    ]),
    track('r5', 'player', [
      move('cb-r5-track-1', 1, [
        [91, 39],
        [97, 40],
      ]),
      move('cb-r5-track-2', 2, [
        [97, 40],
        [101, 39],
      ]),
    ]),
    track('r6', 'player', [
      move('cb-r6-drop-1', 1, [
        [92, 29],
        [95, 34],
      ]),
      move(
        'cb-r6-close',
        2,
        [
          [95, 34],
          [93, 36],
          [91, 37],
        ],
        true,
      ),
    ]),
    track('r1', 'player', [
      move('cb-r1-shift', 1, [
        [101, 34],
        [102, 38],
      ]),
      move('cb-r1-set', 2, [
        [102, 38],
        [101, 36],
      ]),
      move('cb-r1-dive', 3, [
        [101, 36],
        [102, 34],
      ]),
    ]),
    track('ball', 'ball', [
      firstPossession('cb-hold-1', 'b7'),
      travel(
        'cb-cutback',
        2,
        'pass',
        [
          [99, 55],
          [88, 37],
        ],
        'b10',
      ),
      receive('cb-hold-2', 'b10', 'cb-cutback'),
      travel('cb-shot', 3, 'shot', [
        [88, 37],
        [104.2, 34],
      ]),
    ]),
  )
  doc.drawings.push(
    {
      id: 'cb-zone',
      kind: 'zone',
      shape: { type: 'ellipse', center: { x: 88, y: 37 }, radius: { x: 5, y: 4 } },
      style: { color: 'var(--st-team-a)', opacity: 0.16 },
    },
    {
      id: 'cb-text',
      kind: 'text',
      at: { x: 72, y: 50 },
      text: '니어포스트 비우기 → 늦은 컷백 도착',
    },
  )
  return finish(doc)
}

export const SCENARIOS: ScenarioPreset[] = [
  {
    id: 'scenario-a',
    name: '2v2 패스 & 압박 탈출',
    description: '폭 확보 → 패스 → 수신 직후 압박을 드리블로 탈출',
    build: buildScenarioA,
  },
  {
    id: 'scenario-b',
    name: '원투 & 침투',
    description: '첫 패스로 압박을 유인하고 빈 공간으로 리턴패스',
    build: buildScenarioB,
  },
  {
    id: 'scenario-third-man',
    name: '세 번째 선수 움직임',
    description: '전진 패스 → 레이오프 → 제3선수 스루패스 침투',
    build: buildScenarioThirdMan,
  },
  {
    id: 'scenario-overlap',
    name: '오버랩 vs 언더랩',
    description: '바깥·안쪽 동시 침투로 수비 선택을 만든 뒤 오버랩 사용',
    build: buildScenarioOverlap,
  },
  {
    id: 'scenario-buildup',
    name: '4-3-3 후방 빌드업',
    description: 'GK+2CB+DM의 3+1 구조로 압박을 끌고 풀백 전진',
    build: buildScenarioBuildup,
  },
  {
    id: 'scenario-press-trigger',
    name: '전방 압박 트리거',
    description: '백패스 확인 → GK 압박 → 가까운 패스 출구 봉쇄',
    build: buildScenarioPressTrigger,
  },
  {
    id: 'scenario-transition',
    name: '수비→공격 전환',
    description: '폭 확보 → 두 번째 침투에 로빙 패스 → 슈팅',
    build: buildScenarioTransition,
  },
  {
    id: 'scenario-cutback',
    name: '컷백 마무리',
    description: '바이라인 운반 → 니어포스트 미끼 → 늦은 도착 슈팅',
    build: buildScenarioCutback,
  },
]
