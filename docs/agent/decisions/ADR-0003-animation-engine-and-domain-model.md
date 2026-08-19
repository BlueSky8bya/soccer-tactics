# ADR-0003: Animation Engine Architecture and Tactic Domain Model

Status: Accepted (2026-08-19 세션 2 — 사용자 추천안 채택, 이의 없음)
Date: 2026-08-19
Decision Owners: Agent proposal / User approval
Related: ADR-0001 (원칙 2,4,5,7,9,10), ADR-0004 (좌표), ADR-0005 (상태/히스토리)

## Context

프로젝트 핵심. 요구: 독립 track, delay/sequential/triggered, ball possession attach/detach, `stateAt(t)` 결정론, Engine↔Renderer 분리, Scene 확장, 직렬화 가능. Scenario A(2v2) 표현 가능해야 함.

## Decision Drivers

- 시간 관계 표현력 (절대 시간 + 상대/이벤트 trigger)
- 결정론·재현성 (wall-clock 금지, 순수 함수)
- 직접 조작 편집 친화 (waypoint/handle/block drag가 곧 모델 수정)
- 확장성 (trigger UI, scene, export, annotation 시간 가시성)
- 단순함 (v1 UI는 일부만 노출)

## Architecture (Proposed)

```text
User Interaction (pointer / keyboard)
        ↓
Editor Tools (state machine: select · move · path · ball · draw)        [UI motion: springs, 별도]
        ↓ Commands (transactional, ADR-0005)
TacticDocument (immutable, JSON-serializable)  ⇄  History (undo/redo)
        ↓ compile(doc)  — memoized by document revision
CompiledTimeline  (trigger → 절대 시간 해석, path arc-length LUT, 이벤트 테이블, duration)
        ↓ stateAt(compiled, t)
ResolvedState(t)  { players[id]: {pos, heading, phase}, ball: {pos, status, holderId?}, events≤t }
        ↓
Playback Controller (clock: play/pause/seek/speed/loop, rAF)  →  Pitch Renderer (SVG layers)
                                                               →  Timeline UI (tracks/blocks ← compiled; edit → commands)
                                                               →  Inspector (selection ← doc; edit → commands)
```

원칙:
- `engine/`은 순수 TS. DOM·React·시계 의존 없음. 입력: document + t. 출력: 값.
- Renderer는 ResolvedState만 읽는다. Renderer가 위치를 "가지지" 않음.
- Playback clock은 UI 계층. `t`를 엔진에 전달할 뿐.
- compile은 doc revision 기준 memoize. 편집 중 매 프레임 재컴파일 금지.

## Domain Model (Proposed, 개념 스키마)

```text
TacticDocument
├─ schemaVersion: 1
├─ id, meta { title, description?, tags?, createdAt, updatedAt, author? }
├─ pitch { length: 105, width: 68, unit: "m", view: "full" | "half-left" | "half-right", theme? }   (ADR-0004)
├─ teams: Team[]            { id, name, color, side: "left"|"right", kit? }
├─ players: Player[]        { id, teamId, number, label?, role?, home: Vec2 }    // home = 씬 시작 위치
├─ ball: Ball               { id, home: Vec2, initialHolderId?: PlayerId }
├─ formationRefs?           { [teamId]: presetId }   // provenance only, constraint 아님
├─ drawings: Drawing[]      // annotation: arrow | line | dashedRun | zone(rect|ellipse|polygon) | freehand | text | highlight
│                            { id, kind, geometry, style, visible?: TimeRange }   // 시간 가시성 선택
└─ scenes: Scene[]          // v1 length=1, 구조는 배열
    └─ Scene { id, name, overrides?: { players/ball home 재정의 }, timeline: Timeline }
        └─ Timeline
            ├─ tracks: Track[]     { id, entityId, entityKind: "player"|"ball", segments: Segment[] }
            └─ markers: Marker[]   { id, name, trigger }   // 사용자 정의 cue point (예: "패스 순간")
```

```text
Segment (공통)   { id, kind, trigger: Trigger, timing: Timing, easing?: "linear"|"easeIn"|"easeOut"|"easeInOut" }
  Timing = { duration: s } | { speed: m/s }   // speed → duration = arcLength / speed (compile 시 계산)

Player Segment
  move  { path: Path, facing?: "path"|"ball"|"fixed" }
  hold  { duration }                              // 대기(현 위치 유지)

Ball Segment
  possessed { holderId, offset?: Vec2 }           // 공 = holder 위치 + offset. holder가 move면 드리블
  travel    { travelKind: "pass"|"throughBall"|"cross"|"shot"|"clearance"|"deflection"|"loose",
              path: Path, receiverId?: PlayerId, flight?: "ground"|"lofted" }   // receiverId 있으면 종료=receive
  loose     { position?: Vec2 }                   // 정지 루즈볼 (직전 위치 기본)

Path      { waypoints: Waypoint[] }               // 2개 이상. 모든 handle 없으면 polyline
Waypoint  { id, p: Vec2, handleIn?: Vec2, handleOut?: Vec2, hold?: s }   // cubic bezier 선택, 경유지 정지 선택

Trigger
  | { type: "at", t: s }                                                  // 절대 시간
  | { type: "afterSegment", segmentId, anchor: "start"|"end", offset: s } // 순차/지연
  | { type: "atWaypoint", segmentId, waypointIndex, offset: s }           // "A가 waypoint 2 도달 시"
  | { type: "onEvent", event: EventRef, offset: s }                       // "공 release 시", "receive 0.3s 후"
  | { type: "atMarker", markerId, offset: s }
EventRef  = { kind: "ball.released"|"ball.received"|"segment.start"|"segment.end", ref: id }
```

같은 track 안의 segment는 기본적으로 `afterSegment(prev, end, 0)` (순차). 첫 segment 기본 `at 0`.
이벤트는 별도 엔티티가 아니라 **compile 시 segment/possession 전이에서 파생**되는 시각(ball.released = possessed→travel 전환 시각, ball.received = travel(receiverId)→possessed 전환 시각). 사용자 정의 cue는 Marker.

## Compile

1. Path별 arc-length LUT 생성 (bezier는 세분 샘플, 단조 보간).
2. Timing speed → duration.
3. Trigger 의존 그래프 구성 → 위상 정렬 → 절대 start/end 계산. 순환이면 compile error(UI에 표시, 재생 불가).
4. Ball track 검증: possessed↔travel 전이에서 파생 이벤트 테이블 생성. travel 시작 위치 = 직전 holder 위치(compile 시 stateAt으로 고정) — 즉 ball path의 첫 waypoint는 "holder에 붙음" 모드 허용.
5. 전체 duration = max(end).
결과 `CompiledTimeline`은 불변, 순수 값.

## stateAt(compiled, t)

- 각 player track: t를 포함하는 segment 찾기 → move면 LUT로 진행률→위치(easing 적용), hold/빈 구간이면 마지막 위치 유지. 첫 segment 전 = home.
- Ball: possessed면 holder 위치+offset, travel이면 path 샘플, loose면 고정.
- O(tracks × log segments). 22명+공 60fps 충분.
- Keyframe = 사용자 노출 개념 아님. Segment+Waypoint가 사용자 키프레임; compiled 샘플이 내부 키프레임.

## Scenario A 매핑 (검증용)

```text
Blue1.track:  possessed? (ball.track) / hold …
Blue2.track:  move{path→측면, trigger at 0.4}
Red1.track:   move{trigger afterSegment(Blue2.move,start,+0.2)}
Ball.track:   possessed{Blue1} → travel{pass, receiverId Blue2, trigger at 1.2} → possessed{Blue2}
Red2.track:   move{press, trigger onEvent(ball.received(Ball.travel#1), +0.0)}
```
→ 단위테스트: stateAt(0.3) Blue2 미이동, stateAt(1.2) ball detach 직후, stateAt(1.8) receive, Red2 start=receive 시각.

## Amendment 2026-08-20 (Timing.decel, PLAN-003 M6 정합화)

- `Timing`에 선택 변형 `{ speed, decel }` 추가(`src/domain/types.ts`). 운동학 `s(t)=v₀t−½at²`, 정지 거리 `v₀²/2a`, 경로가 짧으면 조기 도착. `compile.buildSchedule`이 `MoveSchedule.decel`로 전달, `schedulePosAt/scheduleEndDistance`가 사용. 용도: 공/선수 "휙 던지기"(ADR-0006 라운드 4).
- **스키마 정책**: 추가 선택 필드이므로 `SCHEMA_VERSION = 1` 유지(기존 문서는 그대로 읽힘, 구형 리더는 `decel` 무시 시 등속으로 해석). 필드 제거/의미 변경 시에만 버전 증가.
- 파생 이벤트·trigger 해석은 변경 없음. `Keyframe`은 여전히 사용자 노출 개념 아님.
- 알려진 문서-구현 차이(Codex Audit, 범위 밖 후보): compile은 위상 정렬 대신 반복 해석(최대 1000회), `stateAt.findSegment`는 선형 탐색 — 현재 규모(≤23 엔티티, 수십 segment)에서 성능 영향 없음. 성능 측정 후 필요 시 별도 ADR.

## Consequences

- (+) v1 UI가 `at`/`afterSegment`만 노출해도 데이터가 이벤트 trigger 지원 → 후속 확장 무비용.
- (+) 결정론: 같은 doc → 같은 compiled → 같은 stateAt.
- (+) Scene 배열로 시작 → Phase 연결 확장 가능.
- (−) compile 단계가 하나 더 있음 → memoization 필수, 순환 trigger 검증 필요.
- (−) Trigger 그래프 UI는 복잡 → v1은 Inspector "시작 조건: 시간 / ~직후 / ~이벤트" 드롭다운 수준.

## Revisit Conditions

- 물리(감속, 공 탄성) 시뮬레이션 요구 시 → 별도 ADR (현재는 명시 경로만).
- Scene 간 상태 계승 규칙 필요 시.

## Validation

- `src/engine/**` 단위테스트: arc-length, trigger 해석(순차·지연·이벤트·순환 오류), possession 전이, Scenario A 타임라인.
- `engine/`이 React/DOM import 금지.
