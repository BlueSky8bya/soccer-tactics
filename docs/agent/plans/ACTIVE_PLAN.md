# Active ExecPlan

Plan ID: PLAN-20260821-005  
Status: Approved (2026-08-20, 사용자 구두 승인 — "A-04 보류, 나머지는 계획대로")  
Task Risk: L2  
Created: 2026-08-21  
Updated: 2026-08-20  
Execution Owner: Claude (Fable 5)

> 승인 조건: Ambiguity A-04(route handle)는 **보류** — Shift+드래그를 유일한 경로 작성 진입점으로 유지한다.
> 이에 따라 M3에서 route handle·ghost handle 분리·REV-03은 제외하고, intent resolver 추출 + path drag=항상 bend + step 9 overflow 안내만 수행한다.
> 나머지 Ambiguity는 전부 추천안 (a)로 확정: A-01 chip 즉시 preview, A-02 종료 frame 유지, A-03 세션 A/B 포함(M5 진행), A-05 step 거리 감쇠, A-06 확인창 없음+Undo toast.

## Objective

단일 간편 모드를 유지하면서 사용자가 전술을 **그리고 → 재생해 보고 → 일부만 바꿔 다시 재생**하는 반복을 빠르고 즐겁게 수행하도록 만든다. 시간축·고급 모드·저장 중심 제품으로 되돌아가지 않고, 22명과 여러 경로가 있는 실제 전술판에서 반복 편집, 단계 재생, 가독성, 오류 복구, 모션 완성도를 개선한다.

## Scope and Guardrails

- 기준 결정은 `ADR-0009-simple-mode-interaction.md`와 Amendment v2/v3다. ADR-0006의 트랙·스크럽·과거 키맵과 충돌하면 ADR-0009가 우선한다.
- 단일 간편 모드만 유지한다. 트랙 패널, 시간축, scrubber, 고급 모드 토글을 되살리지 않는다.
- 저장/내보내기/다크 모드는 범위 밖이다. 새 실사용 근거가 생겨도 P2 제안으로만 다룬다.
- `src/engine`, `src/domain`은 React/DOM/spring/wall-clock 없이 순수·결정론적으로 유지한다.
- 모든 문서 변경은 `EditorCore.transaction` 또는 `begin/update/commit`을 거친다. UI store 직접 변경은 선택·재생·표시 상태에 한정한다.
- 새 의존성은 추가하지 않는다. schema 변경은 기본적으로 하지 않으며, 불가피하면 additive-only와 migration 검토를 별도 ADR로 선행한다.
- 각 milestone은 전체 검증을 통과한 뒤에만 다음으로 진행한다. 이 계획 작성 단계에서는 이 파일 외 코드를 수정하지 않는다.

## Evidence Read

- 문서: `CONSTITUTION.md`, `CURRENT_STATE.md`의 PLAN-004 R1~R27와 Known Issues, ADR-0009 본문·Amendment v2/v3, `CHANGELOG_AGENT.md` CHG-20260820-018~035.
- 코드: `AppShell`, `SimplePitch`, `StepBar`, `SidePanels`, `PlayerCard`, `tour/*`, `stepCommands`, `ui/motion/*`, `keymap`, `useEditorKeyboard`, `usePlayback`, `uiStore`, `PathLayer`, 관련 CSS와 EditorCore/EditorContext 연결부.
- 테스트: `stepCommands.test.ts`, `AppShell.test.tsx`, `accessibility.test.tsx`, `tour.test.tsx`, `motion/spring.test.ts`, `pitch/pathPresentation.test.ts` 및 관련 엔진/에디터 테스트.
- 판단 기준은 기능 수가 아니라 반복 실험 한 회의 클릭/대기 비용, 결과 확인 가능성, 오조작 복구, 22명 상태의 판독성이다.

## Harness Audit

### Current State

- 1~9 단계 기반 단일 간편 모드다. 같은 단계는 동시에 시작하고 다음 단계는 직전 단계의 가장 긴 동작 뒤에 시작한다.
- 선수/공 Shift+드래그, 고스트에서 이어 그리기와 끝점 미세 조정, 경로 굽힘, 그룹 이동, 패스 소유권 연결, 단계 배지가 구현돼 있다.
- 재생은 전체 구간만 지원한다. 일시정지와 자연 종료 모두 전술 시간을 즉시 0으로 되돌린다.
- 경로 선택/삭제와 단계 변경은 가능하지만 단계 미리보기·구간 재생·단계 단위 삭제·A/B 변형은 없다.
- 렌더러는 표시 전용 입력을 받는 순수 컴포넌트로 유지되며, 보유자에 붙는 패스 시작점도 UI에서 파생한다.

### Documentation–Code Mismatches

| ID | 문서와 코드가 다른 곳 | 근거 | 계획상 처리 |
|---|---|---|---|
| DOC-01 | `CURRENT_STATE` 머리말의 최신 라운드/검증 수와 본문 R27 및 CHANGELOG가 맞지 않는다. | 머리말은 R15·90 tests 계열 설명, CHG-035는 R27·86 tests를 기록한다. | M7에서 실제 최종 명령 출력만 기록한다. |
| DOC-02 | ADR-0009 초기안의 더블클릭·1~10·애니메이션 토글과 v2/v3 및 코드가 공존한다. | 현 코드는 Shift+드래그, 1~9, 단일 모드다. | 원 ADR은 보존하고 Amendment 우선순위를 현재 상태/가이드에 명시한다. |
| DOC-03 | 제거된 모드의 state/style/test setup이 남아 있다. | `animMode`, `timelineExpanded`, `autoReactOpen`, `theme`; scrub/time/anim-toggle 및 path-scrub CSS가 잔존한다. | M7에서 참조가 실제로 0인 것만 별도 정리한다. |
| DOC-04 | 단계 상한이 한 곳에서 10으로 남았다. | `MAX_STEP`/StepBar는 9지만 `uiStore.setCurrentStep`은 10까지 clamp하고 키보드 주석은 `1-0`이다. | M2에서 exported 상수 하나로 통일한다. |
| DOC-05 | 가이드 그룹명이 제거된 모드를 암시한다. | `keymap.ts` 주석/그룹이 여전히 “애니메이션 모드”를 전제로 한다. | M6에서 “경로 만들기/다듬기/재생” 작업 언어로 교체한다. |

### Rule-Violation and Regression Risks

| ID | 가능성 | 근거 | 방지책 |
|---|---|---|---|
| RULE-01 | 단계 재생을 엔진 시간 특수 규칙으로 넣을 위험 | 현재 `compile → stateAt(t)`는 결정론적이고 구간 재생은 UI clock 문제다. | M1 범위/종료 시각은 UI/editor helper에서 계산하고 engine/domain은 변경하지 않는다. |
| RULE-02 | 부분 삭제나 A/B 전환이 transaction을 우회할 위험 | 현재 문서 편집은 command 경계를 사용하고 `replaceDocument`도 한 undo entry다. | M2는 단일 transaction command, M5는 독립 EditorCore를 쓴다. |
| RULE-03 | 단축키 동작이 다시 갈라질 위험 | 표시 정의는 `keymap.ts`, 실제 분기는 `useEditorKeyboard`, 버튼 재생은 `usePlayback`에 있다. | 바인딩은 `keymap.ts`, 실행은 공용 action으로 모아 버튼/키보드가 같은 함수를 호출한다. |
| RULE-04 | 모션 폴리시가 전술 시간에 spring을 섞을 위험 | tactical playback은 선형 rAF이고 spring은 token UI 피드백에만 있다. | 좌표는 계속 `stateAt`; cross-fade·pickup/drop만 `ui/motion`에서 처리한다. |
| RULE-05 | A/B가 저장 기능의 우회 재도입이 될 위험 | 새로고침 시 빈 판이라는 제품 결정이 있다. | M5 기본안은 메모리 세션 한정 2개 슬롯이며 JSON/schema/localStorage에 저장하지 않는다. |

### Duplicate or Fragile Code

| ID | 문제 | 근거 | 정리 방향 |
|---|---|---|---|
| FRAG-01 | 재생 시작/정지 조건 중복 | `usePlaybackController`와 `useEditorKeyboard`가 각각 `playFrom`, duration, reset을 다룬다. | M1에서 공용 controller action으로 합친다. |
| FRAG-02 | `SimplePitch`의 거대 포인터 상태 머신 | 배치·선택·마키·작성·굽힘·고스트·그룹 이동·스냅이 target/modifier 분기에 얽혀 있다. | M3에서 DOM 없는 intent 판정 helper를 먼저 추출한다. |
| FRAG-03 | path drag의 숨은 이중 의미 | owner가 선택돼 있으면 전체 translate, 아니면 bend다. | path drag=항상 bend, 그룹 이동=live token drag로 고정한다. |
| FRAG-04 | 고스트 우선순위가 전역 단계와 무관 | 각 entity의 첫 고스트가 모두 비교적 진해 22명일 때 계층이 무너진다. | M4에서 global step/selection/active 상태로 presentation을 계산한다. |
| FRAG-05 | 제거된 UI의 dead state/CSS | DOC-03의 필드와 스타일이 유지보수 표면을 키운다. | M7에서 기능 변경과 분리해 제거한다. |

### User-Feedback Regression Hotspots

| 피드백 이력 | 현재 회귀 위험 | 보호 기준 |
|---|---|---|
| 같은 단계 동시 시작, 다음 단계는 가장 늦은 종료 뒤 시작 | 구간 재생/삭제 relayout이 병렬 규칙을 깨뜨릴 수 있다. | M1/M2에서 동일 t0, max-duration 경계, undo timing을 단언한다. |
| 재생바·시간 표시·모드 토글 제거 | 단계 미리보기가 작은 타임라인으로 팽창할 수 있다. | 시각적 시간축·초 표시는 금지하고 1~9 칩과 문맥 action만 사용한다. |
| Shift 연속 지그재그 | modifier 부담 개선 중 숙련자 체인을 깨뜨릴 수 있다. | Shift는 accelerator로 보존하고 무수정자 route handle을 추가한다. |
| 고스트 끝점 미세 조정 | 이어 그리기 handle과 plain drag가 충돌할 수 있다. | ghost body=끝점 조정, 별도 handle=새 경로로 hit target을 분리한다. |
| 그룹 이동 시 홈과 전체 경로 함께 이동 | path drag 단순화 중 그룹 이동이 사라질 수 있다. | 다중 선택 후 live token drag는 기존 translate를 유지한다. |
| 패스 시작점의 보유자 부착/잠금 | presentation 변경이 marker/hit-test를 되돌릴 수 있다. | `deriveAttachedPathStart`와 시작점 non-draggable 테스트를 유지한다. |
| 재생 중 고스트/배지 숨김 | active 강조 중 편집 장식이 재등장할 수 있다. | playback 동안 handle/ghost/badge는 숨기고 active path만 강조한다. |

### Improvement Candidates Found

1. P0 — 단계 시작 미리보기, 현재 단계만/여기부터 재생, 종료 프레임 유지.
2. P0 — 단계 칩 선택과 경로 재배정 분리; 배지의 즉시 +1 제거.
3. P0 — path drag 이중 의미 제거, Shift 없는 route handle 제공.
4. P0 — 재생 중 active step/path 시선 유도와 selection 부재 시 전체 dim 수정.
5. P1 — 단계/선수/전체 움직임 부분 삭제와 undo 가능한 reset menu.
6. P1 — ghost declutter, badge 충돌 회피, path casing으로 22명 판독성 향상.
7. P1 — 세션 한정 A/B 변형과 독립 undo.
8. P1 — 편집 루프 중심 tour/가이드, 구체적인 실패 피드백.
9. P1 — 종료/편집 전환, ghost visibility, drop feedback, reduce-motion 일관화.
10. P2 — 작은 화면/touch 전용 경로 작성. 별도 사용자 조사 필요.
11. P2 — 저장/내보내기/다크 모드. 실사용 자료 손실 근거가 생길 때만 재평가.

## Product Audit A — Experimentation Loop

| ID | 문제 | 근거 | 제안 | 난이도 | 우선순위 |
|---|---|---|---|---|---|
| A-01 | 만든 플레이의 일부만 곧바로 재생할 수 없다. | Play는 전체 duration만 재생하고 StepBar는 작성 단계 선택/재배정만 한다. | chip 선택 시 시작 장면 preview, `현재 단계만`, `여기부터`, `전체` action 제공. | M | P0 |
| A-02 | 결과를 보자마자 시작 위치로 튄다. | 자연 종료와 `setPlaying(false)`가 모두 t=0으로 만든다. | 종료/일시정지는 현재 frame 유지, 편집 시작 또는 Home에서만 authoring start로 복귀. | M | P0 |
| A-03 | 단계 chip 클릭이 상황에 따라 문서를 수정한다. | 경로 선택 중에는 `setSegmentStep`, 아니면 current step 변경이다. | chip은 단계 선택/preview 전용; 재배정은 선택 action의 명시적 1~9 picker. | S | P0 |
| A-04 | 경로 작성 시 Shift 유지 부담이 크다. | live token/ghost chain 진입이 Shift에 의존한다. | 선택/hover token과 ghost에 route handle; Shift는 accelerator로 유지. | M | P0 |
| A-05 | 9단계 연속 체인이 조용히 같은 단계에 누적될 수 있다. | auto-advance가 9로 clamp된다. | chain overflow는 생성 전 차단하고 이유/해결 toast. 명시적 병렬 step 9는 허용. | S | P0 |
| A-06 | 일부 삭제 단위가 경로 하나 또는 전체 판뿐이다. | current step/entity/all authored motion clear command가 없다. | `이 동작/이 단계/선택 선수/움직임 전체` 삭제를 각각 1 transaction으로 추가. | M | P1 |
| A-07 | A안을 복제해 B안과 빠르게 비교할 수 없다. | 단일 EditorCore/document만 있다. | 세션 한정 A/B 독립 core/history와 빠른 toggle. | L | P1 |

## Product Audit B — Readability at 22 Players

| ID | 문제 | 근거 | 제안 | 난이도 | 우선순위 |
|---|---|---|---|---|---|
| B-01 | 재생 중 현재 경로를 찾기 어렵다. | `dimOthers`는 selection만 보며 active segment를 모른다. selection이 없으면 모두 같은 dim이다. | compiled t0/t1로 active IDs를 UI에서 파생해 active path/token 강조, past/future 차등 dim. | M | P0 |
| B-02 | 여러 선수의 고스트 우선순위가 비슷하다. | opacity가 global step이 아니라 entity별 index다. | 선택 단계/entity/hover 우선, 먼 step 자동 감쇠, 최소 opacity 유지. | M | P1 |
| B-03 | 배지가 경로·토큰·배지와 겹친다. | 모든 badge가 path midpoint 고정이며 collision pass가 없다. | deterministic offset 후보를 적용하고 미해결 묶음은 hover/selection 때 펼친다. | M | P1 |
| B-04 | 공 경로와 얇은 팀 경로가 피치 선에서 약하다. | ball은 흰 dashed, move는 2.5px 단일 stroke다. | 반투명 casing 아래 팀색/공 본선을 그려 대비 유지. | S | P1 |
| B-05 | 경로 작성 뒤 focus lens가 사라질 수 있다. | 작성 완료 시 segment selection을 해제하는 흐름이 있다. | 마지막 편집 segment/step의 UI-only focus를 Delete 대상 selection과 분리해 유지. | M | P1 |

## Product Audit C — Convenience and Friendliness

| ID | 문제 | 근거 | 제안 | 난이도 | 우선순위 |
|---|---|---|---|---|---|
| C-01 | 같은 path drag가 bend 또는 translate가 된다. | owner selection이라는 숨은 상태가 intent를 바꾼다. | path drag=항상 bend, live token drag=선택 그룹 translate. | S | P0 |
| C-02 | badge 오클릭이 단계 변경이며 역방향 수정이 번거롭다. | pointerdown이 즉시 step+1 순환한다. | badge는 select만, 정확한 단계는 접근 가능한 picker로 지정. | S | P0 |
| C-03 | 짧은 경로/9단계/target 실패가 조용하거나 generic하다. | threshold 미달은 no-op, compile error UI는 cycle 한 문구다. | reason code별 “왜/다음 행동” toast. | S | P1 |
| C-04 | 첫 방문 tour가 만들기까지만 가르친다. | 배치→run→pass→play 중심이고 수정/부분 재생/undo가 없다. | 기본 tour는 짧게 유지하고 opt-in “조금 바꿔 다시 보기” mini tour. | S | P1 |
| C-05 | 제거된 모드 언어가 안내와 state에 남았다. | keymap group/comment와 legacy fields. | 실제 gesture/작업 언어로 갱신하고 dead state 분리 정리. | S | P1 |
| C-06 | SVG badge/ghost를 keyboard로 직접 다루기 어렵다. | 안정적인 tab/focus/action 경로가 없다. | SVG tab stop 증식 대신 native selection action bar로 단계/삭제/재생 제공. | M | P0 |

## Product Audit D — Animation and Motion Polish

| ID | 문제 | 근거 | 제안 | 난이도 | 우선순위 |
|---|---|---|---|---|---|
| D-01 | 재생 종료→원위치 전환이 즉각적이다. | 자연 종료가 같은 frame에 t=0/playing=false를 쓴다. | 종료 위치 유지와 `결과 보는 중` 상태; 편집/Home에서만 복귀. | M | P0 |
| D-02 | playback 경계에서 ghost/badge가 한 frame에 전환된다. | `isPlaying` boolean으로 visibility가 즉시 갈린다. | 120~180ms UI opacity transition, reduced-motion은 즉시. | S | P1 |
| D-03 | drop spring이 실제 pitch drop에 연결되지 않는다. | `AnimatedToken` 지원에 비해 SimplePitch `dropFrom` 전달이 없다. | document 좌표는 즉시 확정하고 UI offset만 spring으로 0에 수렴. | M | P1 |
| D-04 | 공 spin/height와 kick pulse는 있으나 체감 검증이 없다. | 코드/ISSUE 기록은 있으나 pulse 강도·ground bounce 브라우저 검증이 없다. | 기존 효과를 먼저 체감 검증하고 bounce 추가는 P2로 판단. | S | P2 |
| D-05 | reduce-motion이 모든 simple-mode CSS transition을 포괄하지 않는다. | tour/spring 중심이고 path opacity 정책이 분산돼 있다. | media query/data-reduced로 route/ghost/action transition을 일괄 정지. | S | P1 |

## Target Interaction Contract

1. Step chip은 document를 바꾸지 않는다. 사용 step이면 시작 state preview, 빈 step이면 authoring step만 선택한다.
2. footer main Play는 전체 플레이를 유지한다. 문맥 action에서만 `현재 단계만`/`여기부터`를 선택한다.
3. pause/natural finish는 현재 frame 유지. Home은 즉시 0. document-changing edit 시작 시 0으로 복귀한다.
4. path drag는 항상 bend. 선택 그룹 이동은 live token drag만 사용한다.
5. ghost body drag=끝점 조정, Shift+drag=다음 segment 작성. (route handle은 A-04 보류로 미구현)
6. badge click은 select만 한다. 단계 변경은 native picker 또는 1~9 keyboard command다.
7. playback 중 active path는 강조하지만 ghost/badge/waypoint handle은 계속 숨긴다.

## Milestone Plan

### M1 — P0: Step Preview, Scoped Replay, Result Hold

목표: 수정한 부분을 전체 처음부터 기다리지 않고 확인하고 종료 결과를 검토한다.

**Files/types/functions**

- `src/editor/stepCommands.ts`: read-only `stepWindow(doc, step): { start; end } | null`.
- `src/editor/uiStore.ts`: `PlaybackScope = all | step | from-step`, `rangeStart`, `rangeEnd`, `completion: idle | held-result`; 암묵적 reset과 `returnToAuthoringStart()` 분리.
- `src/editor/usePlayback.ts`: `playAll`, `playStep`, `playFromStep`, `pause`, `finishAtRangeEnd`, `restart`; loop는 range start로 복귀.
- `src/ui/StepBar.tsx`: chip/setSegmentStep 결합 제거, preview/step-only/from-step 문맥 action.
- `src/ui/AppShell.tsx`: footer와 StepBar가 같은 controller를 사용.
- `src/ui/useEditorKeyboard.ts`, `src/ui/keymap.ts`: Space/Home/G가 같은 action을 호출. 새 shortcut은 승인 전 추가하지 않는다.
- `src/ui/pitch/SimplePitch.tsx`: document edit gesture 시작에만 authoring start 복귀.
- Schema: 변경 없음, `SCHEMA_VERSION`/migration 영향 없음.

**Data/control flow**

1. chip event → current step → `stepWindow` → playhead=start → `stateAt(compiled,start)` → preview.
2. step-only/from-step event → UI scope/start/end → rAF clock → `stateAt` → range end에서 held-result. document/compile 불변.
3. edit pointerdown → authoring start → 기존 command begin/transaction → document revision → compile → render.

**Conflicts/decisions**

- ADR-0009의 scrub/time 제거를 지키기 위해 discrete step action만 쓴다.
- `playFrom`과 scope가 이중 시작점이 되지 않게 `playFrom`은 “마지막 변경 step 추천”으로 통합하거나 제거한다.
- pause 상태의 편집도 모든 document-changing gesture가 공용 authoring-entry helper를 거친다.

**Tests**

- `stepCommands.test.ts`: `describe('stepWindow')`; 병렬 segment의 shared start/longest end, unused null, relayout 안정성.
- 신규 `usePlayback.test.ts`: `describe('scoped playback')`; step-only final hold, from-step, range loop, pause hold/Home reset.
- `AppShell.test.tsx`: `step preview changes UI time without document revision`; footer/keyboard/controller 의미 동일.
- `accessibility.test.tsx`: step replay action의 accessible name과 tab order.

**Validation / acceptance**

- 자동: targeted tests와 `npm run typecheck && npm run lint && npm test && npm run build && npm run harness:verify` 모두 PASS.
- 사용자 브라우저: 4단계만, 3단계부터, 전체 재생이 구분됨; 종료/일시정지 frame 유지; Home/첫 편집에서만 복귀; 시간축처럼 보이지 않음.
- 롤백: playback scope/StepBar context 전체를 제거하면 기존 all-play로 복귀.
- 위험: 결과/편집 frame 혼동. `결과 보는 중` 상태와 Home affordance로 완화.

### M2 — P0: Explicit Step Editing and Safe Partial Reset

목표: 실수로 step을 바꾸지 않고 필요한 범위만 지운 뒤 다시 그린다.

**Files/types/functions**

- `stepCommands.ts`: `clearStep`, `clearEntityAuthoredPaths`, `clearAllAuthoredPaths`; 기존 remove/relayout/receiver cleanup 공용화, 각각 1 transaction. `MAX_STEP` export.
- `StepBar.tsx`: chip은 선택/preview 전용.
- 신규 `SelectionActionBar.tsx`: path 종류/소유자/step, 1~9 picker, replay, delete native controls.
- `SidePanels.tsx`: `움직임 전체 지우기`와 `전술판 새로 시작` 분리, undo 가능 문구.
- `SimplePitch.tsx`: badge 즉시 +1 제거, select만 수행.
- `uiStore.ts`: step clamp를 9로 통일.
- Schema: 변경 없음.

**Flow/conflicts**

1. badge/path event → selection UI → action bar.
2. picker → `setSegmentStep` → one transaction → relayout → compile/render.
3. partial clear → authored IDs/관련 possession 정리 → relayout → one undo entry.
4. legacy `gen-` reaction segment는 모든 authored-clear에서 보존한다.
5. full reset은 확인창 대신 기존 undoable `replaceDocument`와 Undo toast를 쓴다.

**Tests**

- `stepCommands.test.ts`: one-step clear+relayout+one undo; entity clear isolation; all-authored clear가 formation/meta/drawing/generated 보존; pass possession orphan 제거.
- `AppShell.test.tsx`: badge select가 revision/step을 바꾸지 않음; picker exact assignment; current-step clear one undo.
- `accessibility.test.tsx`: SVG focus 없이 path renumber/replay/delete 가능.

**Validation / acceptance**

- 자동: 선택만으로 revision 불변, clear별 history 1개와 완전 undo, full gate PASS.
- 사용자 브라우저: step 5→4 한 선택; step/entity/all movement clear와 Undo; Tab만으로 path action 가능.
- 롤백: action bar와 partial-clear commands를 함께 제거, 기존 select/Delete 유지.
- 위험: overlay가 PlayerCard를 가림. selection 종류별 카드 하나만 같은 anchor에 렌더.

### M3 — P0: Predictable Gestures Without Modifier Burden

목표: 같은 gesture는 항상 같은 결과를 내고 Shift 없이도 path를 만든다.

**Files/types/functions**

- `SimplePitch.tsx`: `resolvePointerIntent(target, modifiers, state)`를 추출; intent union은 `select-token | move-token-group | draw-route | adjust-ghost-end | bend-path | marquee`.
- 신규 `src/ui/pitch/gestureIntent.ts`와 테스트: DOM 없는 intent 우선순위.
- token/ghost route handle hit target; ghost body fine-adjust와 분리; step 9 chain overflow guard/toast.
- `keymap.ts`, `SidePanels.tsx`, `tour/*`: handle을 기본, Shift를 빠른 연속 작성법으로 안내.
- `PathLayer.tsx`: 변경하지 않는 것이 기본. handle은 SimplePitch UI overlay가 그려 renderer 순수성 유지.
- Schema: 변경 없음.

**Flow/conflicts**

1. pointerdown → hit/modifier → pure resolver → 한 gesture state만 시작.
2. handle/Shift draw → draft → 기존 `addStepRun/addStepPass` → transaction → compile/render.
3. ghost body → endpoint command; path → bend; live token → group translate.
4. step overflow → command 전 차단 → revision 불변 → toast.
5. Shift 체인과 group move는 회귀 방지를 위해 그대로 보존한다.

**Tests**

- `gestureIntent.test.ts`: owner selection과 무관한 path bend; live token group translate; ghost body/handle 분리; handle/Shift 동일 draw intent.
- `AppShell.test.tsx`: no-Shift handle draw; Shift chain 호환; automatic step 10 거부+문서 불변+설명.

**Validation / acceptance**

- 자동: intent truth table, 기존 group/ghost/chain tests, full gate PASS.
- 사용자 브라우저: 안내 없이 handle 발견; selection과 무관하게 path drag=bend; ghost body/handle 결과 구분; 9단계 뒤 조용한 중첩 없음.
- 롤백: route handle/resolver 제거 시 기존 Shift fallback 유지.
- 위험: 22명 handle clutter. hover/primary selection에서만 표시하고 invisible hit area만 넓힘.

### M4 — P1: Crowded-Pitch Focus and Active-Play Hierarchy

목표: 22명과 다수 path에서도 지금 보는 동작을 즉시 식별한다.

**Files/types/functions**

- 신규 `src/ui/pitch/pathPresentation.ts`: `deriveActiveSegmentIds`, `derivePathEmphasis`, `placeStepBadges` 순수 helper.
- `SimplePitch.tsx`: t, selected step/entity/segment, hover 전달; ghost opacity를 global step 거리로 계산.
- `PathLayer.tsx`: `activeSegmentIds`/plain presentation props와 casing/active class만 렌더. compile/state 판단은 넣지 않는다.
- `pitch.module.css`: selected/active/past/future opacity/width, casing, badge collision 상태.
- `StepBar.tsx`: active step에 `aria-current="step"`.
- Schema: 변경 없음.

**Flow/conflicts**

1. playback t + compiled t0/t1 → active IDs/step.
2. selection/hover/current step + active IDs → presentation model → pure renderer.
3. rAF마다 compile하지 않는다. playback 중 ghost/badge/waypoint는 계속 숨긴다.
4. 팀색은 유지하고 casing/굵기/opacity만 바꾼다. badge offset은 UI-only다.

**Tests**

- `pathPresentation.test.ts`: simultaneous active; past/active/future classification; global-step ghost rank; deterministic bounded badge placement; document 불변.
- `AppShell.test.tsx`: active step highlight/announcement.

**Validation / acceptance**

- 자동: deterministic helper, compile memo 유지, full gate PASS.
- 사용자 브라우저: 11v11 양 팀 3+ paths에서 active path를 1초 안에 식별; 팀/공 경로 판독; 비선택 맥락은 남음; badge가 번호/방향을 가리지 않음.
- 롤백: presentation props/helper/CSS만 제거.
- 위험: 과도한 dim. 최소 opacity를 0으로 하지 않고 브라우저 calibration으로 확정.

### M5 — P1, Approval-Gated: Session A/B Variants

목표: A를 B로 복제하고 빠르게 전환하며 각 안을 독립 수정/undo한다.

**Precondition**: Ambiguity A-03 승인 및 M1~M4 안정화. 기본안은 세션 한정 2개 슬롯, 빠른 전환, 동시 분할 화면 없음이다.

**Files/types/functions**

- 신규 `src/editor/variantSession.ts`: `VariantId='A'|'B'`, `VariantSlot { id; core: EditorCore; createdFromRevision }`, `cloneActiveTo`, `switchTo`, `resetVariant`.
- `EditorContext.tsx`: active core를 안전하게 바꿔 subscribe하는 seam.
- `src/app/App.tsx`: VariantSession 수명 소유.
- `AppShell.tsx`: 작은 `A | B`, `B로 복제`; 저장/파일 용어 금지.
- `uiStore.ts`: selection/playback은 전환 시 reset. variant별 currentStep 보존 여부는 승인 후 고정.
- Schema: 변경 없음. scenes/localStorage/JSON에 variant를 넣지 않는다.

**Flow/conflicts**

1. clone → 현재 immutable doc로 새 EditorCore 생성 → B 저장.
2. switch → playback stop/selection clear → provider active core 변경 → subscribe/compile/render.
3. edit/undo는 active core에만 적용. `replaceDocument`로 A/B를 load하며 history를 섞는 방식은 금지.
4. refresh 시 slots 소멸. 두 pitch 동시 렌더는 가벼운 사이트 원칙상 범위 밖.

**Tests**

- 신규 `variantSession.test.ts`: clone mutable isolation; switch 간 독립 undo/redo; TacticDocument에 variant 비직렬화.
- `AppShell.test.tsx`: A→B clone/switch; switch 시 playback stop/selection clear.

**Validation / acceptance**

- 자동: core/history independence, persistence 없음, full gate PASS.
- 사용자 브라우저: 2 action 이하 B 복제; A↔B 차이 즉시 식별; 각 Undo 독립; 저장/고급 모드처럼 느껴지지 않음.
- 롤백: VariantSession/provider switch/UI 전체. schema 흔적 없음.
- 위험: core 구독 stale closure와 학습 비용. provider remount 여부를 jsdom/브라우저로 검증.

### M6 — P1: Feedback, Learnability, Motion Polish

목표: 기능을 발견하고 실패 이유를 이해하며 수정 전후 전환을 자연스럽게 느낀다.

**Files/types/functions**

- `tour/tourSteps.ts`, `TourOverlay.tsx`: 기본 tour를 늘리지 않고 opt-in “조금 바꿔 다시 보기” mini tour.
- `keymap.ts`, `SidePanels.tsx`: 실제 gesture/반복 루프 기준 안내, shortcut 문자열 단일 source.
- `SimplePitch.tsx`: short path/step limit/ambiguous snap의 reasoned toast.
- `motion/AnimatedToken.tsx`, `presets.ts`, `spring.ts`: document 좌표와 분리된 pickup/drop UI offset.
- `shell.module.css`, `pitch.module.css`: focus-visible, held-result, reduced-motion 일관화.
- Schema: 변경 없음.

**Flow/conflicts**

1. invalid gesture → UI reason code/toast; command/revision 없음.
2. pointerup commit으로 document 좌표 확정 → UI-only drop offset spring.
3. playback/authoring → opacity transition; reducedMotion이면 immediate.
4. tour predicate는 state를 읽기만 하고 command를 실행하지 않는다. tactical movement에는 spring 금지.

**Tests**

- `tour.test.tsx`: mini tour opt-in; route 수정+step replay로 완료.
- `AppShell.test.tsx`: short-route/step-limit 설명과 revision 불변.
- `motion/spring.test.ts`: drop offset deterministic convergence/immediate mode.
- `accessibility.test.tsx`: title→actions→pitch→selection card→replay→guide focus order; held-result/status semantics.

**Validation / acceptance**

- 자동: invalid action no-command, deterministic spring, focus tests, full gate PASS.
- 사용자 브라우저: guide만 보고 작성→수정→부분 재생; 실패 이유/다음 행동 이해; motion이 빠르고 절제됨; reduced-motion에서 장식만 제거.
- 롤백: feedback/tour, transitions, drop spring을 각각 독립 제거.
- 위험: 도움말 과밀·motion 과장. 기본 안내는 핵심 5개 행동만 유지.

### M7 — Documentation, Dead-State Cleanup, Handoff

목표: 승인 동작과 코드를 일치시키고 과거 모드 가정을 제거한다.

**Files/actions**

- `uiStore.ts`, `shell.module.css`, `pitch.module.css`, tour tests: `rg`로 참조 0인 legacy state/style만 제거.
- `CURRENT_STATE.md`: 완료 milestone, Known Issues, 브라우저 미검증 갱신.
- `CHANGELOG_AGENT.md`: 새 `CHG-YYYYMMDD-NNN`에 실제 변경/검증 수치.
- ADR-0009: 승인된 replay/result-hold/gesture contract를 새 Amendment로 추가; 원 기록 보존.
- `PROJECT_MAP.md`: 새 파일/책임 경계가 생긴 경우만 갱신.
- `npm run harness:handoff -- <approved-topic>` 실행.

**Validation / acceptance**

- `rg "animMode|timelineExpanded|autoReactOpen|scrubGhost|animToggle" src docs/agent`를 항목별 검토한다. 역사 ADR 언급은 제거하지 않는다.
- 전체 gate PASS, 문서 test count는 실제 출력과 일치.
- 브라우저 미검증은 `EXTERNAL-VERIFICATION-PENDING`으로 기록.
- 롤백: dead-state cleanup과 문서 갱신은 기능 milestone과 분리.

## Milestone Order and Stop Rules

1. M1 → M2 → M3의 P0를 먼저 끝낸다.
2. 각 milestone에서 targeted tests 후 `npm run typecheck && npm run lint && npm test && npm run build && npm run harness:verify`를 실행한다.
3. 하나라도 실패하면 같은 milestone에서 고치고 다음으로 넘어가지 않는다.
4. 각 P0 뒤 브라우저 체크리스트용 handoff를 남긴다. 사용자 확인 전에는 ACCEPTED가 아니라 AGENT-VERIFIED 또는 EXTERNAL-VERIFICATION-PENDING이다.
5. M4는 P0 체감 확인 뒤 진행한다. M5는 Ambiguity A-03 승인 때만 진행한다.
6. M6 뒤 M7로 문서와 legacy cleanup을 마감한다.

## Plan Reversal Log

| ID | Previous Plan / Assumption | New Evidence | Invalidated Scope | Replacement Plan | Preserved Work |
|---|---|---|---|---|---|
| REV-01 | PLAN-20260820-004의 후속 후보는 schema 정합화, 자동 대응, Record/Scene 같은 구조 확장이 중심이었다. | ADR-0009 v3 이후 제품은 단일 간편 모드로 수렴했고, 최신 목표는 전술 실험의 작성→재생→수정 반복 비용이다. | 고급 모드·트랙·시간축·자동 대응·Record/Scene 확장 우선순위. | PLAN-20260821-005의 P0 반복 재생/명시적 편집/예측 가능한 gesture를 먼저 수행한다. | R1~R27의 간편 모드, step timing, ghost/bend/group move, possession, attached pass start와 회귀 테스트. |
| REV-02 | 일시정지/종료 시 t=0 복귀가 authoring 가독성에 유리하다는 가정. | 결과를 보자마자 원위치로 튀어 수정 전 비교가 끊긴다. | `setPlaying(false)`의 암묵적 reset 계약. | 결과 frame 유지 후 Home 또는 실제 편집 시작에서 명시적으로 authoring start 복귀. | 전술 시간의 선형성, Home restart, 재생 중 편집 장식 숨김. |
| REV-03 | Shift가 단일 모드 경로 작성의 유일한 진입점이라는 가정. | 22명 반복 작성에서 modifier 유지 부담이 크고 ghost body의 fine-adjust와 학습 충돌이 있다. | Shift-only 기본 조작. | route handle을 기본 경로로 추가하고 Shift chain은 accelerator로 보존. | 기존 Shift chain command와 step auto-advance 의미. |

## Ambiguity Register

| ID | 질문 | 선택지 | 추천 | 영향 | 상태 |
|---|---|---|---|---|---|
| A-01 | Step chip 클릭만으로 해당 step 시작을 preview할 것인가? | (a) 즉시 preview (b) 별도 preview 버튼 | **(a)** 문서 mutation 없이 반복 클릭 수가 최소다. | M1 UI/a11y 계약 | **Approved (a)** 2026-08-20 |
| A-02 | 종료/일시정지 뒤 화면은? | (a) 마지막 frame 유지, 편집/Home에서 복귀 (b) 짧은 dwell 뒤 자동 복귀 | **(a)** 결과 검토 시간을 사용자가 통제한다. | playback store/편집 진입 | **Approved (a)** 2026-08-20 |
| A-03 | A/B를 이번 범위에 포함할 것인가? | (a) 세션 한정 독립 core (b) P2로 미룸 (c) scenes에 영구 모델링 | **(a)** 비교를 충족하고 schema/save를 재도입하지 않는다. | L 규모, Provider/history 검증 | **Approved (a)** 2026-08-20 — M5 진행 |
| A-04 | Shift 부담을 줄이는 기본 gesture는? | (a) route handle+Shift accelerator (b) sticky toggle (c) plain token drag=draw | **(a)** 단일 모드와 token move를 보존한다. | M3 hit target/가이드 | **Deferred (사용자 보류)** 2026-08-20 — Shift 유지, handle 미구현 |
| A-05 | 비선택 ghost를 얼마나 감출 것인가? | (a) step 거리 감쇠+최소 opacity (b) 완전 숨김 (c) 동일 표시 | **(a)** 맥락과 집중의 균형. | M4 browser calibration | **Approved (a)** 2026-08-20, 수치는 브라우저 확인 |
| A-06 | 전체 reset 확인창이 필요한가? | (a) 확인 없음+Undo/toast (b) 매번 확인 | **(a)** 반복 속도와 현재 undoable replace 활용. | M2 copy/undo 노출 | **Approved (a)** 2026-08-20 |

## Schema and Migration Assessment

- M1~M4, M6~M7은 document schema 변경 없음. 새 필드는 UI-only/editor helper type이며 `SCHEMA_VERSION`과 migration 영향이 없다.
- M5 기본안도 session-owned EditorCore 두 개이므로 schema/JSON/localStorage 영향이 없다.
- A-03에서 scenes 기반 영구 variant를 선택하면 이 계획으로 바로 구현하지 않는다. scene 의미, compile scene index, import/export, migration을 다루는 Proposed ADR과 별도 L3 plan을 먼저 작성한다.

## Global Verification Matrix

| 검증 | 방법 | 통과 조건 |
|---|---|---|
| Engine/domain purity | harness verify와 import 검색 | React/DOM/spring/wall-clock import 0, PASS |
| Determinism | 같은 doc/scope/t helper 테스트 반복 | deep-equal, wall-clock 비의존 |
| Transaction integrity | revision/history/undo 단언 | gesture/clear/renumber마다 의도한 1 entry, 완전 복원 |
| Simple-mode integrity | DOM smoke와 `rg` | track/timeline/scrubber/mode toggle UI 없음 |
| Accessibility | jsdom role/name/tab order와 수동 keyboard | positive tabindex 0, 핵심 action 모두 native focus 가능 |
| Lightweight | dependency/build 비교 | dependency diff 0, build PASS, 동시 pitch render 없음 |
| Full gate | milestone마다 전체 명령 | typecheck/lint/test/build/harness 모두 PASS |

## Browser Validation Checklist (User-Owned)

- 11v11 배치 후 양 팀 3개 이상 경로와 공 패스를 만든다.
- step 4 시작 preview와 `현재 단계만`, `여기부터`, `전체`를 비교한다.
- 종료 위치를 본 뒤 path를 조금 굽히고 같은 step만 다시 재생한다. 불필요한 대기/이동이 없는지 본다.
- path drag, token group drag, ghost body, ghost handle이 각각 한 결과만 내는지 확인한다.
- 한 path/한 step/한 선수/all movement를 각각 지우고 Undo한다.
- playback 중 active/team/ball/selected 경로의 시각 우선순위를 확인한다.
- reduced-motion on/off에서 tactical playback은 같고 장식 transition만 달라지는지 확인한다.
- M5 승인 시 A→B clone, B edit, toggle, 독립 Undo를 확인한다.

## Rollback Strategy

- M1 playback, M2 commands/action bar, M3 gestures, M4 presentation, M5 variants, M6 polish를 서로 섞지 않는다.
- schema를 바꾸지 않아 문서 호환 rollback 비용을 만들지 않는다.
- rollback 후에도 기존 Shift authoring, full playback, Delete selected path, undoable full reset은 남아야 한다.

## Done Report Template for Execution Owner

```text
Task: PLAN-20260821-005 / <milestone>
Risk Level: L2
Acceptance Status: IMPLEMENTED / AGENT-VERIFIED / EXTERNAL-VERIFICATION-PENDING / ACCEPTED
Changed:
Why:
Files:
Validation Executed:
- npm run typecheck — PASS/FAIL
- npm run lint — PASS/FAIL
- npm test — PASS/FAIL (<actual count>)
- npm run build — PASS/FAIL
- npm run harness:verify — PASS/FAIL
Agent-Not-Verifiable:
External Validation Required:
- criterion / executor / procedure / expected / evidence / blocking / status
Documentation Updated:
Rollback:
Remaining Risks / Next Exact Step:
```
