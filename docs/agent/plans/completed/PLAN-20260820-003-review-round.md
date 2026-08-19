# Active ExecPlan

Plan ID: PLAN-20260820-003
Status: Completed (2026-08-20 — M1~M6 구현·검증 완료, 브라우저 체크 DELEGATED)
Task Risk: L2
Created: 2026-08-20
Updated: 2026-08-20
Execution Owner: Claude Code (계획 작성: Codex)

## Harness Audit

### 조사 범위와 현재 상태

- 읽은 코드: `src/app`, `src/domain`, `src/engine`, `src/editor`, `src/renderer`, `src/ui`, `src/presets`의 전체 소스·CSS·테스트.
- 대조 문서: `CODEX_BRIEF`, `CONSTITUTION`, `CURRENT_STATE` Known Issues, `PROJECT_MAP`, `DEFINITION_OF_DONE`, ADR-0001~0007(ADR-0005/0006 Amendment 포함), 제품/UX 문서, `CHANGELOG_AGENT`, 최신 Handoff, `agent-harness.yaml`과 검증 스크립트.
- 현재 제품은 배치→경로/패스→트리거/타임라인→재생→자동 대응→저장/내보내기의 전체 흐름이 연결돼 있다. 문서상 마지막 검증은 11 files / 53 tests와 typecheck/lint/build/harness PASS이고 브라우저 체감은 미확인이다.
- 작업 트리는 M1 이후 구현 전체가 미커밋인 상태다. 구현자는 기존 변경을 사용자 소유로 취급하고 마일스톤별 파일만 선택적으로 수정해야 한다.

### 1. 문서와 코드가 다른 곳

| 우선순위 | 문서의 약속 | 실제 코드 | 계획상 처리 |
|---|---|---|---|
| P0 | ADR-0003의 `Timing`은 `{duration}` 또는 `{speed}`이고 직렬화 형태 변경 시 버전 정책을 기록 | `Timing`에 `{speed, decel}`이 이미 추가됐지만 ADR-0003 Amendment·마이그레이션 메모 없이 `SCHEMA_VERSION = 1` 유지 | 이번 기능은 스키마를 더 바꾸지 않는다. M6에서 기존 불일치를 명시하고 별도 ADR-0003 정합화 후보로 남긴다. |
| P0 | ADR-0007은 `meta.generated=true`, `lineHeight`, 패스 레인/0.5s tick을 기술 | 구현은 `gen-` ID prefix, team/intensity/delay/lookAhead만 사용하고 release/receive 이벤트에만 반응 | M4는 현행 Phase 1 품질만 보정한다. 메타 필드는 schema 결정이므로 별도 질문으로 남긴다. |
| P0 | ADR-0003 compile 결과가 화면 경로의 진실이고 travel 시작은 보유자 위치에 붙음 | `compile.ts`의 LUT만 첫 점을 보정하고 `PathLayer`는 원문 `seg.path`를 그림 | M1에서 UI가 compiled 시작점을 presentation data로 만들고 순수 renderer에 전달한다. |
| P1 | ADR-0002/0004는 재생 중 token을 ref로 직접 갱신해 React 60fps 재렌더를 피함 | `playback.t`→`useResolvedState`→`PitchStage` 전체 React 렌더 경로 | 범위 밖 성능 후보. 11v11+자동 대응 브라우저 프로파일링 후 별도 처리한다. |
| P1 | ADR-0003은 trigger 위상 정렬, track 탐색 O(log segments)를 기술 | `compile`은 최대 1000회 반복 해석, `stateAt.findSegment`는 선형 탐색 | 현재 규모에서는 동작하나 복잡도 약속과 다르다. 성능 측정 없이 이번에 리팩터링하지 않는다. |
| P1 | ADR-0005는 Inspector 텍스트/숫자를 blur/Enter 단위 한 history entry로 기록 | 제목·등번호·라벨·좌표·segment 숫자가 대부분 `onChange`마다 transaction | 범위 밖 history 품질 후보로 등록한다. |
| P1 | `PROJECT_MAP`은 renderer를 순수 SVG 계층으로 설명 | `PitchMarkings`가 `editor/geometry`를 역방향 import하고 Timeline이 `PitchStage.teamColorOf`를 import | 동작 순수성은 유지되지만 계층 결합이 취약하다. 이번 helper는 `src/ui/pitch`/timeline 내부에 둔다. |
| P1 | `keymap.ts`가 바인딩의 단일 소스 | key 값은 읽지만 pointer modifier·fling threshold는 `PitchStage`에도 하드코딩 | M3에서 mouse gesture predicate/표시 정책을 `keymap.ts`로 모은다. 물리 상수 통합은 별도 후보다. |
| P2 | ADR-0004 viewBox는 pitch 자체 `0 0 L W` | 실제 `PitchStage`는 편집 여백 때문에 `-5 -5 L+10 W+10` 사용 | 의도적 UI 확장이지만 ADR 메모가 없다. 문서 정합화 후보로 기록한다. |
| P2 | UI 로컬 지침은 `src/ui/inspector/`를 라우팅 위치로 지칭 | Inspector 파일은 `src/ui/Inspector.tsx`, `SegmentInspector.tsx` | 문서만 낡았다. 이번에 폴더 이동은 하지 않는다. |

### 2. 규칙 위반 가능성

- 엔진 순수성/결정론: `src/engine`에서 React/DOM/spring/wall-clock/random 사용은 발견하지 못했다. `generateReaction`도 고정 입력에 결정론적이다. 단, harness는 금지 문자열만 검사하므로 알고리즘 결정론 전체를 증명하지 않는다.
- 도메인 wall-clock 경계: `createEmptyDocument`가 기본값으로 `new Date().toISOString()`을 호출한다. 검증 스크립트는 이를 명시적으로 허용하지만 Constitution의 “domain wall-clock 금지”와 충돌한다. 현재는 주입 가능한 생성 메타데이터 예외로 취급하되 규칙 문구 정합화가 필요하다.
- transaction 우회: 일반 편집에서 직접 document store set은 발견하지 못했다. 그러나 `SegmentInspector`, `Timeline`, `PitchStage`가 command 대신 `core.transaction/begin/update`를 직접 호출해 mutation 규칙이 컴포넌트에 분산돼 있다. `core.load`는 history를 비우는 의도적 예외지만 ADR에 명시되지 않았다.
- history 의미 위반 가능성: Inspector `onChange` transaction은 키 입력마다 undo entry를 만든다. transaction 자체는 지키지만 ADR-0005의 사용자 의미 단위와 다르다.
- 자동 대응 제거가 `id.startsWith('gen-')`에 의존하므로 import된 정상 segment가 같은 prefix면 삭제될 수 있다.
- harness는 renderer의 spring import만 금지하며 renderer→editor 역참조, 숨은 focus 대상, UI inline transaction은 검사하지 않는다.

### 3. 중복·취약 코드

- `PitchStage.tsx`(약 800줄)가 token drag, tail edit, fling, path draw, waypoint, annotation, marquee를 한 pointer state machine에서 처리한다. M1/M3 계산은 별도 pure UI helper로 분리한다.
- `Timeline.tsx`가 재생, track 렌더, block move/resize를 함께 가진다. M2 group/visibility 계산만 `trackView.ts`로 분리한다.
- `addBallTravel`/`addBallFling`의 ball track·possession·receiver 생성 규칙, fling 임계값 `22`, Scenario A/B fixture가 중복된다.
- 자동 대응은 생성 segment를 기존 track 끝에 append한다. 이벤트가 authored move보다 빨라도 compile이 뒤로 clamp해 path 시작 계산 시각과 실제 시작이 달라질 수 있다.
- `applyFormation`/`clearTeam`은 제거된 선수를 가리키는 `ball.initialHolderId`를 정리하지 않아 dangling possession 가능성이 있다.
- `ShortcutsOverlay`/`FormationPicker`의 닫힌 UI는 opacity/pointer-events만 0이고 focusable 자식이 DOM에 남는다. `EntityMiniBar`도 시각적으로 숨은 동안 tab 대상일 수 있다.
- `stateAt.distanceAlong`은 easing/hold/deceleration과 무관한 선형 시간 비율이라 곡선 heading이 실제 이동 거리와 어긋날 수 있다.

### 4. 사용자 피드백 이력 기준 회귀 위험

| 피드백 | 회귀 위험 | 방어책 |
|---|---|---|
| keymap 단일 소스·왼손 조작 | M3 Shift가 선택 토글/직선/타원/step/nudge와 충돌 | select-tool token만 Shift scrub, Ctrl/Cmd만 additive selection으로 명시하고 conflict matrix 테스트 |
| 좌표보다 “할 수 있는 것” 우선 | M5에서 Inspector 구조가 재배치될 위험 | DOM 의미/aria만 최소 변경, action-first와 좌표 details 유지 |
| 패스 후 playhead=도착 시각 | M1/M3이 `finishDraw` arrival seek를 덮을 위험 | path 생성과 scrub gesture를 분리하고 arrival seek 회귀 테스트 유지 |
| 공 패턴·회전·높이·잔상·pulse | M1 path 변경이 token render를 건드릴 위험 | `PathLayer` props/CSS만 수정, `Token`/`AnimatedToken` 불변 |
| 라이트 기본·우측 단일 컬럼 | M2/M5가 새 패널/모달을 만들 위험 | timeline L2 내부 compact controls만 추가 |
| 경로 beautify와 tail 편집 | M3 scrub이 waypoint/tail/fling을 가로챌 위험 | 명시적 gesture priority와 modifier 조합 테스트 |
| 던지기 물리 결정론 | scrub을 engine 또는 spring으로 구현할 위험 | `stateAt` 읽기 전용 UI helper, document/engine/spring 변경 없음 |
| 자동 대응은 editable segment | 품질 보정이 실시간 AI/숨은 state를 도입할 위험 | 계속 일반 `PlayerSegment[]`, 한 transaction으로 document 기록 |

### 5. 추가 개선 후보

| 우선순위 | 후보 | 근거 | 이번 범위 |
|---|---|---|---|
| P0 | schema/ADR 정합화와 import migration 강화 | `decel` shape가 ADR/guard보다 앞섰고 nested document 검증이 얕음 | 범위 밖 L2/L3 |
| P0 | dangling possession 정리 | formation/clear 후 삭제 선수 holder 가능 | 범위 밖 bugfix |
| P0 | 닫힌 popover/overlay tab 차단 | 보이지 않는 control로 focus 이동 가능 | M5 포함 |
| P1 | playback React render 프로파일링 | ADR 성능 설계와 실제가 다르고 11v11에서 영향 증가 | 범위 밖; 측정만 M2 checklist |
| P1 | Inspector transaction coalescing | ADR-0005 불일치, undo 오염 | 범위 밖 |
| P1 | generated provenance metadata | prefix 충돌 없이 제거/재생성하려면 schema 정책 필요 | M4 질문, 별도 ADR |
| P1 | command 경계 통합 | UI inline mutation이 테스트·재사용을 어렵게 함 | 범위 밖 |
| P1 | persistence nested validation/migration registry | malformed segment를 현재 guard가 통과 가능 | 범위 밖 |
| P2 | geometry/team color 공용 pure 모듈 | renderer→editor, timeline→pitch 결합 | 범위 밖 구조 변경 |
| P2 | Scenario fixture 공유 | 엔진/프리셋 중복 회귀 | 범위 밖 |
| P2 | 실제 schedule distance 기반 heading | ease/hold/decel 방향 cue 정확도 | 범위 밖 |
| P2 | 자동 대응 공격 전환 | 사용자 요청상 구현 범위 밖 | Proposed ADR만 M4 |

## Objective

사용자 승인 후 ISSUE-006, timeline 팀 필터/접기, ADR-0006 D4-1 path-scrub, ADR-0007 P1 수비 반응 품질, 최소 접근성을 독립적으로 구현하고 각 milestone을 전체 검증으로 봉인한다. 본 계획 단계에서는 코드를 수정하지 않는다.

## Verifiable End State

- 선택된 ball travel의 compile-time 시작점이 보유자에 붙은 locked marker로 보이며 첫 waypoint는 drag 대상이 아니다.
- track을 팀별 필터/접을 수 있고 선택 엔티티 row는 상태와 무관하게 하나 보인다.
- 선택 도구에서 path-bearing token을 Shift+drag하면 document/history 변화 없이 전역 playhead가 경로 시각으로 이동하며 교차는 현재 시각에 가까운 후보를 택한다.
- 자동 대응은 authored/generated 직전 끝과 이어지고, 겹친 이벤트로 동일 선수가 불필요한 out-and-back queue를 만들지 않는다.
- 툴 레일·timeline·Inspector의 자연스러운 tab 순서, focus ring, accessible name이 확인되고 숨은 UI는 tab 순서에서 빠진다.
- M1~M6 각 직후 전체 검증이 PASS하며 실패하면 다음으로 진행하지 않는다.

## Scope / Out of Scope

### Scope

- ISSUE-006 selected pass presentation.
- Timeline L2 team filter/collapse와 selected-row override.
- ADR-0006 D4-1 path-scrub 및 keymap/help.
- ADR-0007 Phase 1 수비 반응 연속성·왕복 억제.
- 요청 영역의 최소 keyboard focus/aria.
- 관련 pure Vitest, jsdom smoke, 문서/Done Report/Handoff.

### Out of Scope

- 공격 측 자동 대응 구현, Phase 2 학습/ONNX, 실시간 simulation.
- Domain schema 변경, generated metadata, migration framework.
- Record, Scene/Phase 복제, on-canvas pill.
- playback 전면 성능 개선, command 전면 정리, Inspector history coalescing.
- 새 dependency, 폴더 재구성, commit/push.

## Global Constraints

- `src/engine`, `src/domain` 순수·결정론 유지. tactical position에 spring 금지. renderer는 입력→SVG 순수 표현만 한다.
- shortcut/gesture binding 이름·설명·modifier 정책은 `src/ui/keymap.ts`에서만 정의한다.
- document 변경은 editor command 또는 명시적 transaction 경유. 한 gesture는 undo 한 step. Scrub/filter/focus는 UI state라 history에 들어가지 않는다.
- 이번 계획은 serialized shape를 바꾸지 않으므로 `SCHEMA_VERSION=1`, migration 없음. 새 field 필요 시 milestone을 중단하고 ADR-0003 Amendment+사용자 승인을 먼저 받는다.
- 새 의존성 없음. 기존 CSS token 사용. milestone gate 실패 시 다음 단계 금지.

## Data / Control Flow Baseline

```text
pointer/keyboard event
  → keymap policy + PitchStage/Timeline/Inspector handler
  → editor command or EditorCore transaction (document change일 때만)
  → TacticDocument revision
  → useCompiled(revision) → compile(doc)
  → stateAt(compiled, doc, playback.t)
  → UI presentation derivation
  → pure SVG renderer / Timeline / Inspector
```

Filter, scrub, selection, focus는 UI state이므로 command/document 단계를 건너뛴다. 테스트에서 document revision/history 불변을 단언한다.

## Milestones

### M1 — ISSUE-006: 보유자에 붙은 pass start 표시 (+ 범위 추가: dangling `ball.initialHolderId` 정리 — applyFormation/clearTeam/removeEntities 공통 헬퍼 + 테스트)

#### 파일·함수·타입

- 새 `src/ui/pitch/pathPresentation.ts`
  - `AttachedPathStart { segmentId, waypointId, holderId, p }` UI-only 타입.
  - `deriveAttachedPathStart(doc, compiled, selectedSegmentId)`.
  - 선택 segment가 ball `travel`이고 같은 track 직전 source segment가 `possessed`일 때 compiled travel `schedule.lut.pts[0]`을 반환. dangling/unresolved/waypoint 없음이면 `null`.
- `src/ui/pitch/PitchStage.tsx`
  - `useMemo`로 presentation 계산 후 `PathLayer`에 전달.
  - `data-waypoint-locked="true"` pointerdown은 gesture를 만들지 않는 이중 방어.
- `src/renderer/PathLayer.tsx`
  - plain-data `attachedStart` prop.
  - selected segment만 첫 waypoint와 handle을 release delta만큼 옮긴 presentation copy로 그림. 원문 doc 불변.
  - locked 첫 점은 `data-attached-start` marker만 그리고 `data-waypoint` hit circle은 생략. 이후 waypoint는 유지.
- `src/renderer/pitch.module.css`: token 기반 attached ring/notch와 disabled cursor.
- Domain/serialized type 없음. schema/migration 영향 없음.

#### 데이터/제어 흐름

1. path/timeline/Inspector에서 travel 선택→`uiStore.selectedSegmentId`.
2. `PitchStage`가 source possession과 compiled schedule을 대조.
3. actual release point presentation 생성→`PathLayer`.
4. renderer는 전달 값만 그림. 첫 marker는 waypoint command로 진입하지 않음.
5. doc/revision/history 불변.

#### 충돌·해결

- compile 규칙을 renderer에서 복제하지 않고 compiled LUT만 읽는다.
- source waypoint/JSON을 변경하지 않는다.
- possession 없는 loose/shot은 기존 첫 waypoint 편집 유지.
- 선택되지 않은 pass는 보정 표시하지 않는다.
- ball token/pulse/trail은 수정하지 않는다.

#### 테스트

- `src/ui/pitch/pathPresentation.test.ts`, `describe('deriveAttachedPathStart')`
  - `it('returns the compiled holder release point for a selected possessed-to-travel pass')`.
  - `it('returns null for a move, unresolved travel, or travel without preceding possession')`.
  - `it('does not mutate the authored first waypoint')`.
- `src/ui/AppShell.test.tsx`, `describe('ISSUE-006 attached pass start')`
  - `it('renders one locked attached marker and leaves later waypoints draggable')`.
  - `it('keeps the authored path JSON unchanged after selection/render')`.

#### 수용 기준

- 자동: DOM marker 좌표=compiled LUT 첫 점, first hit 부재/second hit 존재, doc/revision/history 불변, 테스트 PASS.
- 사용자 브라우저 체크:
  - 움직이는 보유자의 pass가 실제 출발점부터 이어져 보임.
  - marker가 보유자에 붙은 의미로 보임.
  - 첫 marker drag 불가, 이후 waypoint drag 정상.
  - light/dark에서 식별되고 공/경로를 가리지 않음.

#### 롤백·리스크

- 롤백: helper→PitchStage 전달/guard→PathLayer prop/render→CSS/tests 한 묶음.
- 리스크: compiled start 이동 후 bezier handle이 뒤틀릴 수 있어 handle도 동일 delta로 옮긴 presentation copy가 필요.
- Gate: 전체 검증 PASS 기록 전 M2 금지.

### M2 — Timeline 팀 필터/접기와 selected-row 보존

#### 파일·함수·타입

- 새 `src/ui/timeline/trackView.ts`
  - `TrackGroupId = 'ball' | \`team:${Id}\``.
  - `TrackGroup { id, label, color?, tracks, collapsed, filtered }`.
  - `TrackVisibilityInput { teamFilter, collapsedGroups, selectedEntityIds }`.
  - `buildTrackGroups(doc, input)`: team document 순서→ball 순서 안정 정렬, 선택 track `forcedVisible`.
- `src/ui/timeline/Timeline.tsx`
  - local UI state `teamFilter: 'all' | Id`, `collapsedGroups: Set<TrackGroupId>`.
  - document 교체 후 없는 filter ID는 `'all'`로 정규화.
  - track panel 안 compact “전체/팀명” filter와 team/ball band header(collapse, row/generated count).
  - 선택 때문에 강제 노출된 row에 accessible 상태 표시.
- `src/ui/timeline/timeline.module.css`, `src/ui/i18n/ko.ts`.
- Document/uiStore serialized field 없음. schema/migration 없음.

#### 데이터/제어 흐름

1. filter/collapse 클릭→Timeline local state.
2. `buildTrackGroups(doc, selection, filters)`→visible rows.
3. row는 기존 `compiled.segmentTimes`로 block 표시.
4. filter만으로 command/revision/history 변화 없음.
5. block drag/resize만 기존 transaction→doc→compile→render.
6. pitch/Inspector selection 변경 시 filtered/collapsed group에서도 그 row만 즉시 노출.

#### 충돌·해결

- compile 입력/document track은 건드리지 않는다.
- ball은 별도 group이고 추천안에서는 team filter와 무관하게 유지(A-01).
- 전체 팀을 강제 펼치지 않고 선택 row만 예외 노출(A-02).
- expanded track panel 한 줄+group header만 사용해 L3를 만들지 않는다.
- 기존 selection/block drag/resize/`V` toggle 유지.

#### 테스트

- `src/ui/timeline/trackView.test.ts`, `describe('buildTrackGroups')`
  - `it('groups player tracks by document team order and keeps ball separate')`.
  - `it('hides ordinary rows for a filter but forces selected entity visible exactly once')`.
  - `it('keeps the selected row visible when its group is collapsed')`.
  - `it('ignores tracks whose entity no longer exists without throwing')`.
- `src/ui/timeline/Timeline.test.tsx` (`jsdom`), `describe('Timeline team filtering')`
  - `it('filters 11v11 rows by team and leaves ball visible')`.
  - `it('collapses a team, then shows only the selected entity override')`.
  - `it('preserves block selection and drag entry points after filtering')`.
  - `it('shows generated segment count without duplicating rows')`.

#### 수용 기준

- 자동: 22-player+ball counts, selected row exactly one, filter doc/revision/history 불변, block selection 회귀 PASS.
- 사용자 브라우저 체크:
  - 11v11+자동 대응에서 원하는 팀만 빠르게 표시.
  - 접힌 팀 선수를 pitch에서 선택하면 그 row 즉시 표시.
  - generated block이 많아도 label/block 구분 및 scroll 안정.
  - tracks animation과 pitch ≥55% 높이 유지.

#### 롤백·리스크

- 롤백: `trackView.ts`+tests, Timeline state/controls, CSS/i18n.
- 리스크: A-01/A-02가 DOM 구조를 바꾸므로 승인 전 구현 금지. Local state는 reload에 유지되지 않음.
- Gate: 전체 검증 PASS 기록 전 M3 금지.

### M3 — ADR-0006 D4-1 path-scrub

#### 파일·함수·타입

- `src/ui/keymap.ts`
  - `KEYMAP.mouse.pathScrub` 추가.
  - `toggleSelect`를 Ctrl/Cmd+click만으로 변경.
  - pointer modifier predicate가 읽을 `MOUSE_MODIFIERS`/policy export로 설명과 동작 일치.
- 새 `src/ui/pitch/pathScrub.ts`
  - `ScrubTracePoint { t, p, segmentId }`, `PathScrubIndex`, `PathScrubHit { t, p, segmentId, distance }`.
  - `buildPathScrubIndex(doc, compiled, entityId)`: compiled move/travel 시간 범위를 sample하고 각 위치를 `stateAt`에서 읽음.
  - revision/entity 변경 때만 memoize; pointermove마다 `stateAt` 전체 반복 금지.
  - `findPathScrubHit(index, pointer, currentT, tolerance)`: trace 선분 최근접 투영으로 시각 보간. 교차/동률은 `abs(t-currentT)`→source 순서 안정 정렬.
  - tolerance 밖/경로 없음은 `null`.
- `src/ui/pitch/PitchStage.tsx`
  - `Gesture`에 `path-scrub` variant와 ghost state.
  - 진입: select tool, primary button, path-bearing token, Shift only, Alt/Ctrl/Meta 없음.
  - 3px threshold 후 playback pause+seek. transaction/fling samples/snap 없음.
  - pointerup/cancel/Escape에서 ghost 정리.
- `src/renderer/pitch.module.css` 또는 pitch UI CSS: token과 구분되는 ghost ring. Tactical spring 없음.
- `HelpPanel` current-tool tip, `src/ui/i18n/ko.ts`; overlay는 keymap group 자동 반영 확인.
- Engine/domain/source path/schema 변경 없음.

#### Gesture priority

1. zone/arrow/text tool의 Shift 의미.
2. selected waypoint drag.
3. path tool 또는 Alt+drag path drawing(Shift=straight).
4. select tool+Shift+path-bearing token path-scrub.
5. Ctrl/Cmd selection/group drag.
6. normal token drag/tail/fling.
7. path click/marquee.

#### 데이터/제어 흐름

1. Shift+pointerdown→keymap policy/priority→path-scrub gesture.
2. memoized trace에서 pointer 최근접 후보 탐색.
3. 교차는 current playback time 근접 후보 선택.
4. `uiStore.setPlayhead(t)`→`useResolvedState`→`stateAt`→모든 entity/timeline 동기 렌더.
5. pointerup에서 UI gesture만 종료; doc/revision/history 불변.

#### 충돌·해결

- Shift selection toggle/additive marquee는 제거하고 Ctrl/Cmd로 통일.
- path tool/Alt+drag가 먼저라 Shift 직선 유지; zone Shift ellipse 유지.
- waypoint가 먼저라 waypoint edit 유지.
- scrub에는 core.begin/samples/tail/snap이 없어 drag/fling/tail과 분리.
- keyboard Shift step/nudge는 event context가 달라 유지.
- path stroke 시작 scrub은 추천안에서 제외(A-03).

#### 테스트

- `src/ui/pitch/pathScrub.test.ts`, `describe('buildPathScrubIndex / findPathScrubHit')`
  - `it('inverts a linear player move to absolute time within 0.05s')`.
  - `it('uses stateAt positions for eased, held, and decelerating schedules')`.
  - `it('uses the compiled attached start for a possessed ball travel')`.
  - `it('chooses the crossing candidate nearest the current playhead deterministically')`.
  - `it('returns null outside tolerance and without a path')`.
- `src/ui/pitch/PitchStage.test.tsx` (`jsdom`), `describe('Shift-drag path scrub')`
  - `it('pauses and seeks all entities without changing document revision or history')`.
  - `it('does not scrub for Alt+Shift draw, waypoint drag, Ctrl+Shift selection, or no-path token')`.
  - `it('cleans up ghost on pointerup, pointercancel, and Escape')`.
- `src/ui/useEditorKeyboard.test.tsx`
  - `it('keeps Shift step/nudge and Ctrl/Cmd additive selection policy')`.
- `src/ui/AppShell.test.tsx`: `it('keeps pass-creation arrival seek after adding path scrub')`.

#### 수용 기준

- 자동: linear/ease/hold/decel/ball inverse 오차 기준, crossing determinism, modifier matrix, doc/history 불변.
- 사용자 브라우저 체크:
  - Shift+drag token으로 장면 전체가 자연스럽게 앞뒤 이동.
  - 교차에서 현재 branch 유지, 먼 시각으로 jump하지 않음.
  - path 밖에서는 마지막 유효 시각 유지.
  - drag/tail/fling/Alt draw/Shift straight/ellipse/waypoint가 기존대로.
  - 도움말과 실제 Shift/Ctrl 동작 일치.

#### 롤백·리스크

- 롤백: keymap modifier+help, helper, gesture/ghost, tests를 한 묶음. Ctrl-only selection과 scrub을 분리 롤백하지 않는다.
- 가장 위험한 milestone: gesture arbitration이 기존 핵심 조작을 회귀시킬 수 있고 sampling/교차에서 체감 jump가 날 수 있다.
- 긴 timeline index 비용을 브라우저에서 측정하고 sample cap을 두되 정확도 기준 우선.
- Gate: 전체 검증 PASS 기록 전 M4 금지.

### M4 — ADR-0007 Phase 1 수비 자동 대응 품질

#### M4.1 Failing pure tests

- 새 `src/engine/opponent.test.ts`; 자동 대응 테스트를 큰 `engine.test.ts`에서 분리하거나 중복 없이 유지.
- continuity 정의:
  - 첫 generated 시작 = 실제 generated 시작 compiled 시각의 authored state.
  - 이후 generated 첫 waypoint = 직전 surviving generated 마지막 waypoint.
  - compiled 경계 직전/직후 위치 차이 ≤ `1e-6m`.
- excessive round-trip은 A-05 승인값으로 고정. 추천: 인접 leg 모두 ≥5m, cosine≤-0.8, 다음 event가 이전 nominal end 전이면 queue 금지.

#### M4.2 Planner correction

- `src/engine/opponent.ts` `generateReaction`
  - player별 `PlanState { availableAt, start, target, role, lastVector, segmentIndex }`.
  - base compiled track의 마지막 authored end와 `stateAt(base, actualStart)`로 첫 start 계산.
  - 다음 event가 직전 generated nominal end 전이면 obsolete intermediate를 queue하지 않고 직전 planned segment target을 최신 target으로 retarget/coalesce.
  - 겹치지 않는 다음 segment는 직전 target에서 시작.
  - presser 교대는 challenger가 승인 margin만큼 명확히 가까울 때만 허용하는 deterministic hysteresis. 동률은 document player order.
  - deadband/pitch clamp 유지, `summary`는 surviving segment와 1:1.
- `stripGenerated`/output은 일반 editable `PlayerSegment[]` 유지.
- `src/editor/moreCommands.ts`는 필요한 경우 count 정합성만 조정하고 한 transaction 유지.
- Serialized field/schema/migration 없음.

#### M4.3 공격 반응은 ADR proposal only

- 코드 구현 금지.
- 새 `docs/agent/decisions/ADR-0008-attacking-transition-reaction.md`, `Status: Proposed`; `DECISION_INDEX`도 Proposed.
- possession transition 입력, support/run/width 역할, 수비 생성과 결합, 결정론, provenance/schema 질문, 승인/Revisit 조건을 기록. Accepted 표기 금지.

#### 데이터/제어 흐름

1. AutoReactPanel Generate→`applyReaction`.
2. `stripGenerated` base→`compile`→events→`stateAt` prediction→per-player planner/coalescing.
3. 일반 segments 반환.
4. 한 `Auto-react` transaction에서 기존 generated만 제거하고 새 segments 기록.
5. revision→compile→stateAt→Pitch/Timeline. 생성물은 기존 waypoint/block/Inspector로 편집.

#### 충돌·해결

- authored defender segment 보존. event가 빨라도 actual available time의 path start를 사용.
- event trigger는 유지해 pass retime에 반응.
- 실시간 AI/hidden state/random/wall-clock 금지.
- `gen-` prefix는 schema-free 범위에서 유지하되 위험 문서화(A-07).
- 공격 support/run은 Proposed ADR 밖으로 넘기지 않는다.

#### 테스트

- `src/engine/opponent.test.ts`
  - `describe('generateReaction continuity')`
  - `it('starts the first generated move at the authored endpoint when its event is early')`.
  - `it('starts every later generated segment at the previous generated endpoint')`.
  - `it('has no positional jump at compiled generated boundaries')`.
  - `describe('generateReaction anti-shuttle')`
  - `it('coalesces an obsolete reaction when the next event arrives before completion')`.
  - `it('does not produce a qualifying excessive out-and-back pair between adjacent pass events')`.
  - `it('still changes presser when the challenger wins by the hysteresis margin')`.
  - `describe('generateReaction invariants')`
  - `it('is deterministic for identical doc/options')`.
  - `it('is idempotent after strip/regenerate and compiles without errors')`.
  - `it('does not mutate input or authored segments')`.
- `src/ui/AppShell.test.tsx`: auto-react count와 일반 segment 편집 가능성 회귀.

#### 수용 기준

- 자동: raw/compiled continuity, round-trip metric 위반 0, deterministic JSON, input immutability, compile error 0, authored 보존.
- 사용자 브라우저 체크:
  - 11v11 자동 대응에서 순간이동 없음.
  - 빠른 연속 pass에서 이전 목표를 찍고 반대로 돌아오는 queue 감소.
  - low/mid/high 차이와 press/cover/shape 변화는 유지.
  - waypoint/block/Inspector 편집과 regenerate/clear 정상.

#### 롤백·리스크

- 롤백: planner+tests 한 묶음. Proposed ADR은 독립적으로 제거/유지 가능.
- 리스크: anti-shuttle이 반응 수를 줄여 “약해진” 체감 가능. A-05와 브라우저 비교 필수.
- authored track 뒤 append의 구조적 한계는 scheduling 모델 변경 없이 actual start 보정만 한다.
- Gate: 전체 검증 PASS 기록 전 M5 금지.

### M5 — 최소 접근성: focus order, focus-visible, aria

#### 파일·함수·타입

- `src/ui/AppShell.tsx`
  - 자연 순서 `topbar → tool rail → pitch → Inspector/help → timeline`, positive tabindex 없음.
  - rail 버튼 번역 기반 `aria-label`, pressed/current 유지.
- `src/ui/FormationPicker.tsx`, `ShortcutsOverlay.tsx`, `pitch/EntityMiniBar.tsx`, `timeline/Timeline.tsx`
  - 숨은 subtree에 `inert`+`aria-hidden` 또는 조건부 mount. 닫힘/재생/접힘 상태 tab 제외.
  - shortcut dialog open 시 focus 진입, close 시 trigger 복귀.
  - collapsed track controls focus 제외.
- `src/ui/timeline/Timeline.tsx`
  - restart/loop/tracks/speed accessible name/state.
  - scrubber `aria-valuetext`, keyboard `preventDefault`, Home/End/Arrow step.
  - row label은 native button. Segment block도 keyboard selection entry를 제공하되 resize와 nested interactive HTML을 만들지 않음.
- `src/ui/Inspector.tsx`, `SegmentInspector.tsx`, `HelpPanel.tsx`
  - icon-only close/back/delete aria-label.
  - Help header는 native button으로 role/tabIndex/key handler 중복 제거.
  - label/input association 보완, action-first 구조 유지.
- CSS: `shell.module.css` link/help/summary/input/select, `timeline.module.css` btn/row/block, `miniBar.module.css` btn에 `:focus-visible`; accent token만 사용.
- `src/ui/i18n/ko.ts` accessible label 키.
- Domain/schema 영향 없음.

#### 데이터/제어 흐름

1. Tab/Shift+Tab은 native DOM order.
2. focus-visible은 CSS token ring.
3. Enter/Space는 native button handler.
4. row/segment selection은 uiStore만 변경.
5. Inspector edit만 command→doc→compile→render.
6. timeline keyboard seek는 playback→stateAt→render.

#### 충돌·해결

- positive tabindex로 순서를 강제하지 않는다.
- focus safety가 closing spring보다 우선; reduced-motion도 동일.
- global shortcut은 interactive target에서 빠져 native edit 유지.
- focused button/slider Space가 global playback까지 이중 실행되지 않게 guard 확장.
- block button과 resize handle은 sibling/비interactive overlay로 invalid nesting 방지.

#### 테스트

- 새 `src/ui/accessibility.test.tsx` (`jsdom`), `describe('minimum editor accessibility')`
  - `it('exposes meaningful names for rail, timeline, and Inspector controls')`.
  - `it('keeps focusable DOM order aligned with layout without positive tabindex')`.
  - `it('removes closed formation, shortcut, minibar, and collapsed-track controls from tab order')`.
  - `it('moves focus into the shortcut dialog and restores its trigger on Escape')`.
  - `it('operates timeline slider and track selection with keyboard without mutating document')`.
  - `it('does not toggle global playback when Space activates a focused button')`.
- `src/ui/AppShell.test.tsx`: pitch role, Inspector action structure, theme/help 회귀.
- CSS 시각 품질은 jsdom 불가이므로 selector review+delegated browser로 분리.

#### 수용 기준

- 자동: role/name 조회, hidden tab target 0, positive tabindex 0, dialog focus 복귀, slider keyboard, doc/history 불변.
- 사용자 브라우저 체크:
  - keyboard만으로 승인된 순서를 예측 가능하게 순회.
  - light/dark에서 모든 focus ring 명확.
  - 닫힌 popover/shortcut, 숨은 minibar, 접힌 tracks로 focus가 사라지지 않음.
  - slider Arrow/Home/End와 row/segment Enter/Space 동작.
  - Inspector 입력 중 Space/Arrow/Delete가 global shortcut 오작동하지 않음.

#### 롤백·리스크

- 롤백: inert/focus management→aria/semantic→focus CSS→tests 역순.
- 리스크: focus management와 spring/global keyboard 이중 실행. jsdom과 실제 Tab 검증 모두 필요.
- Gate: 전체 검증 PASS 기록 전 M6 금지.

### M6 — 문서 정합화, Done Report, Handoff (+ 범위 추가: ADR-0003 Amendment — Timing decel 필드, SCHEMA_VERSION 1 유지 근거)

#### 파일·절차

- `docs/agent/CURRENT_STATE.md`: 완료 M1~M5, 남은 Known Issues, 실제 Last Verified, delegated browser status.
- `docs/agent/CHANGELOG_AGENT.md`: 충돌 없는 `CHG-YYYYMMDD-NNN`, 기능/이유/파일/검증/rollback/ADR.
- `docs/agent/PROJECT_MAP.md`: 새 helper routing이 장기적으로 유효할 때만 갱신.
- `docs/agent/decisions/DECISION_INDEX.md`+ADR-0008: 공격 반응은 Proposed만.
- `docs/agent/plans/ACTIVE_PLAN.md`: gate result, ambiguity resolution, reversal 기록. 브라우저 전 Acceptance는 `EXTERNAL-VERIFICATION-PENDING`.
- `npm run harness:handoff -- codex-round1` 후 생성 Handoff를 다시 읽어 실제 상태 확인.
- commit/push 금지.

#### 데이터/제어 흐름

M1~M5 검증 증거→Current State/Changelog/Plan→handoff 생성/검토→최종 harness 검증. 코드 변경 없음.

#### 수용·롤백·리스크

- 문서 링크, ADR index/status, Change ID 중복, Handoff 내용 확인.
- 최종 전체 검증 PASS. Done Report는 DoD 양식, 자동/사용자 체크 분리.
- 롤백: M6 문서 diff와 생성 Handoff만 제거.
- 리스크: 실행하지 않은 browser 항목은 반드시 `DELEGATED / NOT VERIFIED`; 완료로 오기하지 않음.
- Gate: 전체 검증 PASS 후 최종 보고.

## Milestone Validation Matrix

각 milestone 직후 아래 전체 명령을 실행한다. 하나라도 실패하면 원인을 고친 뒤 같은 행 전체를 재실행하고, 그 전에는 다음 milestone으로 넘어가지 않는다.

| Milestone | Command | Required | Current |
|---|---|---|---|
| M1 | `npm run typecheck && npm run lint && npm test && npm run build && npm run harness:verify` | all PASS | PASS (58 tests) |
| M2 | same | all PASS | PASS (63 tests) |
| M3 | same | all PASS | PASS (68 tests) |
| M4 | same | all PASS | PASS (74 tests) |
| M5 | same | all PASS | PASS (78 tests) |
| M6 | same | all PASS | PASS (78 tests, 문서만) |

## Ambiguity Register

| ID | 질문 | 선택지 | 추천 | 영향 | 상태 |
|---|---|---|---|---|---|
| A-01 | 팀 필터는 단일 선택인가, 다중 toggle인가? Ball도 필터 대상인가? | (a) 전체/팀 하나, ball 항상 (b) 팀 다중+ball toggle | (a). 2팀 제품과 L2 한 줄에 단순 | M2 state/control/test matrix | Resolved: (a) |
| A-02 | filtered/collapsed 팀의 선택 row 표현은? | (a) 팀 전체 강제 펼침 (b) group 안 선택 row만 예외 (c) 별도 pinned band | (b). 맥락 유지+11 row 폭증 방지 | M2 DOM/aria/밀도 | Resolved: (b) |
| A-03 | Path-scrub을 어디서 시작? | (a) select tool의 path-bearing token만 (b) token+선택 path stroke | (a). path 선택/waypoint 충돌 최소 | 발견성 vs 충돌 | Resolved: (a) |
| A-04 | Path 밖 scrub 정책/tolerance는? | (a) 12px 상당 또는 1.2m 내만 seek, 밖은 마지막 시각 (b) 항상 최근접 seek | (a). 먼 branch jump 방지 | M3 체감/hit 테스트 | Resolved: (a) 1.2m |
| A-05 | “과도한 왕복” 정량 기준은? | (a) leg≥5m, cosine≤-0.8, overlap이면 coalesce (b) detour/direct≤1.5 (c) 수치 없이 체감 | (a)+(b), 승인 후 수치 고정 | M4 수/적극성/test 기준 | Resolved: (a)+(b): leg≥5m & cos≤-0.8 → coalesce; detour/direct≤1.5 |
| A-06 | 정확한 focus 순서는? | (a) topbar→rail→pitch→Inspector/help→timeline (b) rail→pitch→timeline→Inspector | (a). positive tabindex 없이 현재 DOM과 일치 | M5 DOM 이동 위험 | Resolved: (a) |
| A-07 | generated provenance를 이번에 metadata로 바꿀까? | (a) `gen-` 유지+위험 기록 (b) metadata+schema/migration | (a). 품질 범위와 L2 유지 | (b)는 L3/ADR 필요 | Resolved: (a) gen- 유지 |
| A-08 | Attached marker 시각 언어는? | (a) accent ring+link notch (b) 자물쇠 glyph (c) 고정점만 | (a). 경로를 덜 가리고 붙음 표현 | M1 CSS/browser 기준 | Resolved: (a) |

## Plan Reversal Log

| ID | Previous Plan / Assumption | New Evidence | Invalidated Scope | Replacement Plan | Preserved Work |
|---|---|---|---|---|---|
| PR-01 | 초기 skeleton은 바로 구현할 수 있는 `Ready` 상태이며 Execution Owner가 지정됨 | 사용자가 Codex의 역할을 전체 조사 기반 계획 작성으로 한정하고 실행자는 추후 직접 정한다고 명시 | `Ready`, 지정된 owner, 근거 없는 milestone 뼈대 | `Draft (awaiting approval)`, 빈 Execution Owner, Harness Audit+상세 M1~M6+Ambiguity Register | 기존 Plan ID, 목표 우선순위, 독립 milestone/gate 요구 |

## Rollback Strategy

1. M6 문서/Handoff.
2. M5 focus semantics/CSS/tests.
3. M4 opponent planner/tests/Proposed ADR.
4. M3 keymap+scrub helper+gesture/tests. Ctrl-only selection과 scrub은 같은 단위.
5. M2 track view helper/state/UI/tests.
6. M1 attached presentation/renderer prop/CSS/tests.

각 단계는 기존 미커밋 사용자 변경을 보존하고 해당 milestone의 명시 hunk만 복원한다. destructive git, broad restore, commit, push는 금지한다.

## Progress Log

### 2026-08-20 — 계획 조사

- 전체 `src/`/테스트와 Harness·제품 문서, ADR-0001~0007/Amendments 대조 완료.
- Harness Audit과 M1~M6 함수/타입/흐름/충돌/테스트/수용/롤백 상세화.
- 구현 코드 변경 없음. 사용자 승인과 Ambiguity Register 결정 대기.

### 2026-08-20 — 승인·구현 시작
- 사용자: "계획은 Codex, 구현은 Claude Code". A-01~A-08 전부 추천안 채택. 범위 추가 2건(M1 dangling holder, M6 ADR-0003 Amendment).
- 구현 전 커밋은 사용자 지시 없어 보류(롤백은 마일스톤 단위 diff). 

### 2026-08-20 — 구현 완료 (Claude Code)
- M1~M6 순차 구현, 각 게이트 PASS. 세부는 CHG-20260820-008.
- 계획 대비 차이: M3 PitchStage jsdom 제스처 테스트는 getScreenCTM 부재로 순수 helper 테스트(pathScrub.test)로 대체. M5 jsdom에서 multi-mount 간섭 → 테스트 cleanup 추가.
- 남은 DELEGATED: 브라우저 체크리스트(CURRENT_STATE). Plan → completed/.
