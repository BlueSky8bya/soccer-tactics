# PLAN-20260823-014 — 핵심 재현 무결성 감사, Phase 1 (개정 v2)

Plan ID: PLAN-20260823-014
Status: Ready — G0만 먼저 실행 가능하며, M1/M2는 G0 PASS 전까지 착수 금지
Level: L2 — 전량 테스트 안정화 + domain/engine/editor 교차 감사. 브라우저·UX·스키마 변경은 별도 계획이다.
Trigger: 사용자 2026-08-23 Claude Code 리뷰 — 이동하는 전량 테스트 실패, 미결 브라우저 런타임, 과대 범위, 측정 전 합격선 문제를 수정한다.
Owner: 후속 실행 에이전트

## Revision Rationale

초안의 방향과 증거 규율은 유지하되 다음 판단을 바로잡는다.

1. `AppShell.test.tsx:359`를 지속 단일 실패로 적은 것은 잘못이었다. 단독 테스트는 초록이고, 전량 실행에서 `:186`, `:359` 등 실패 위치가 이동한다. 이는 특정 assertion 하나보다 suite 부하·순서·실시간 clock/rAF·정리 경계의 선행 결함으로 다뤄야 한다.
2. 브라우저 runtime과 probe source가 없는데 브라우저 전량 PASS를 종료 조건으로 둔 것은 자기모순이었다. 브라우저 결정은 Ambiguity가 아니라 명시적 Decision Gate로 승격한다.
3. A~E를 한 계획에 담지 않는다. 이 계획은 G0와 가치가 가장 큰 core M1/M2만 실행한다. C/D/E는 규모가 표시된 후속 PLAN 후보로 분리한다.
4. resolver 수, relayout 호출 수, p95 시간의 사전 목표를 폐기한다. M2는 먼저 수치와 역할을 측정하고, remediation 기준은 측정 뒤 별도 결정한다.
5. contrast 4.5:1, CLS, ultrawide/tall, Zen 전환 frame 감사는 핵심 정션 감사에서 제외하고 선택적 UX polish 후보로 내린다.

## Objective

빨간 전량 테스트 게이트를 먼저 안정화한 뒤, 브라우저 없이 재현 가능한 Node/Vitest 환경에서 현재 I1~I10이 실제 결함을 잡는 비공허한 detector인지 mutation-kill로 확인하고, 공 정션의 read/write graph와 `compile`/`stateAt`/`relayoutStepsInDraft` parity를 검증한다. 이 단계는 저장 문서와 core playback state가 같은 전술을 말하는지에 답한다. React/SimplePitch의 실제 포인터 dispatch, SVG presentation/hit, 사용자 체감은 답하지 않으며 그 범위를 넘는 “전체 제품 재현 폐쇄”를 선언하지 않는다.

## M1+M2 독립 분리 가능성 판정

**분리 가능하다.** 브라우저, React render, Playwright/Puppeteer 없이 실행할 수 있다. 다만 “순수 `src/engine`·`src/domain`만”으로 한정하는 것은 불가능하고 부정확하다.

| 대상 | 필요한 계층 | 이유 |
|---|---|---|
| I1/I2/I5~I8 | domain + engine | document, `compile`, `stateAt`, B1, travel schedule을 검사 |
| I3/I4 | domain + editor | step uniqueness와 authored player chain은 editor의 step/track 의미론 |
| I9 | editor + engine | `relayoutStepsInDraft`의 byte fixed-point를 검사 |
| I10 | domain + editor | validator, serialize/parse round-trip을 검사 |
| 조작 순서 fuzz | editor + engine + domain | 실제 `EditorCore`, step/segment commands, undo/redo를 구동 |
| junction parity | editor + engine + domain | authored writer → relayout → compile → stateAt 연결을 비교 |

따라서 Phase 1의 정확한 경계는 **domain + engine + editor, Node/Vitest-only**다. `src/ui`, `src/renderer`, DOM, browser는 읽기 경계 목록만 남기고 검증 범위에서 제외한다.

## Verifiable End State

1. G0가 PASS하여 기본 `npm test`가 전량 녹색이고, 이동 실패의 root cause와 회귀 방어가 고정돼 있다.
2. I1~I10 각각에 최소 한 개의 의도적 test-only mutant가 있고, 기대 detector가 이를 잡는지 독립 결과가 있다.
3. detector가 mutant를 놓치면 숨기지 않고 `Detector Gap` Finding으로 남긴다. 감사를 완료하기 위해 즉석에서 I11~I20을 양산하지 않는다.
4. 공 정션의 모든 저장값, constraint, derived value, reader, writer, production reachability가 graph에 분류된다. 미분류 reader/writer는 0개다.
5. 대표 core fixture에서 authored document, relayout result, compiled schedule, `stateAt` 경계가 같은 의미를 갖는지 parity 결과가 있다.
6. resolver/writer/relayout/compile 횟수, fixed-point round와 wall time은 **측정값**으로 보고된다. 개수나 p95만으로 PASS/FAIL을 정하지 않는다.
7. 기본 tacticFuzz campaign과 새 mutation/parity suite, 표준 5게이트가 실행된다. 초안의 7200-session soak는 이 Phase의 필수 게이트가 아니다.
8. 최종 판정은 `Core Closure Supported`, `Core Closure Not Supported`, `Insufficient Evidence` 중 하나다. 어느 판정도 UI/브라우저/UX 폐쇄를 뜻하지 않는다.
9. D1 2안은 권고만 산출하며 사용자 결정과 별도 L3 계획 전에는 구현하지 않는다.

## Current Baseline — 교체된 사실

| 실행 주체/순서 | 명령 | 결과 |
|---|---|---|
| 사용자 제공 최신 재실행 | `npx vitest run src/ui/AppShell.test.tsx` | **PASS 12/12**, 6.07s |
| 사용자 제공 최신 재실행 | `npx vitest run` | **FAIL 1 / PASS 290**, 44 files 중 1 FAIL. `AppShell.test.tsx:186`, `step chip preview...`, `playing` expected true/received false |
| Codex 재확인 2026-08-23 | `npx vitest run src/ui/AppShell.test.tsx` | **PASS 12/12**, 9.06s |
| Codex 재확인 직후 | `npx vitest run` | **FAIL 2 / PASS 289**, 44 files 중 1 file FAIL. `AppShell.test.tsx:186`과 `:359` 동시 실패 |
| 이전 병렬 preflight | 전량 반복 | `:296`, `:359`, fuzz timeout 등 실패가 실행마다 이동했음 |

현재 확정할 수 있는 사실은 “`:359` 한 건의 지속 실패”가 아니라 다음이다.

- 기본 전량 gate는 빨갛다.
- 최신 통제된 두 번의 AppShell 단독 실행은 모두 초록이며 현재 isolated baseline은 PASS로 분류한다.
- 전량 환경에서는 같은 AppShell file의 playback 관련 assertion이 이동하거나 복수로 실패한다.
- `AppShell.test.tsx`는 real rAF가 없을 때 `setTimeout(..., 16)`으로 대체하고, `usePlaybackController`는 실제 경과 시간으로 playback을 완료시킨다. suite 부하가 assertion 전에 재생을 끝낼 수 있다는 가설이 있다.
- `afterEach`는 store 전체가 아니라 일부 필드만 reset한다. 공유 상태 정리 누락 가능성도 가설이다.
- root cause는 아직 확정하지 않는다. 두 가설과 test ordering/worker isolation을 G0에서 분리한다.

추가 전제:

- `package.json`에 Playwright/Puppeteer가 없다.
- 저장소에 `pw/`와 tracked `*.cjs`가 없다.
- tacticFuzz는 고유 op 17종, 가중 항목 22개, invariant I1~I10이다.

## Decision Gates

### G0 — BLOCKING: 전량 테스트 안정화 및 수리

M1/M2보다 먼저 별도 선행 수리 항목으로 실행한다. 빨간 게이트 위에서 새 FAIL을 귀속하지 않는다.

1. **무엇을 검증/수리하는가**

- AppShell playback test의 real rAF/wall-clock 의존, store reset 누락, component cleanup, file ordering/worker 영향을 분리한다.
- 원인이 test harness라면 deterministic clock/complete reset으로 고정한다.
- 원인이 production lifecycle이라면 최소 product fix와 정확 회귀 test를 별도 변경으로 남긴다.
- timeout 증가, assertion 삭제, 임의 wait 추가만으로 닫지 않는다.

2. **어떻게 검증하는가**

- AppShell 단독, 기본 전량, `--maxWorkers=1`을 깨끗한 process에서 실행해 실패 조건을 나눈다.
- playback 시작 직후 rAF 예약/취소, store의 `playing/playScope/rangeEnd/completion/boostFactor`, mount/unmount 후 pending handle을 test-only로 관찰한다.
- deterministic fake clock을 쓴 variant와 real clock variant를 비교한다. full store initial-state restore와 현재 부분 reset도 A/B 비교한다.
- 최소 재현이 정해진 뒤에만 test harness 또는 production lifecycle 중 실제 원인 쪽을 최소 수정한다.

3. **통과 기준**

- root cause가 한 문장과 최소 재현으로 설명된다.
- AppShell 단독 3회 연속 PASS.
- 기본 `npm test` 3회 연속 PASS.
- `npx vitest run --maxWorkers=1` 1회 PASS로 worker 경쟁과 무관함을 확인한다.
- typecheck/lint/build/harness도 PASS한다.

4. **예상 산출물**

최소 재현, root-cause note, 변경 전/후 반복 실행표, 회귀 test, 수정 파일 목록과 rollback. 반복 횟수는 성능 합격선이 아니라 이동성 flake를 “한 번 우연히 초록”으로 닫지 않기 위한 표본이다. G0 예상 규모는 **0.5~1일, 1~4개 파일, 회귀 test 1~3개**다. 이 계획 작성 단계에서는 수리하지 않는다.

### DG-BROWSER — 사용자 결정 필요, 브라우저 후속 PLAN 진입 차단

AMB-03에서 제거했다. **G0/M1/M2는 이 결정 없이 실행 가능하지만, D의 실제 pointer/CTM 검증과 E는 결정 전 착수할 수 없다.**

사용자 선택지는 다음 세 가지다.

1. **Tracked Playwright (권고):** Playwright를 devDependency로 승인하고 version-locked runner, `pw/` manifest, probe source를 저장소에 둔다.
2. **External harness:** 의존성은 저장소 밖에 두되 정확한 runtime/version/command와 probe source·artifact를 재현 가능한 위치에 보존한다.
3. **Browser audit 생략:** Phase 1과 browser-free 문서/정적 감사만 수행한다. 이 경우 UI gesture, render/hit, UX/HCI와 전체 제품 폐쇄는 `NOT VERIFIED`다.

이 Decision Gate의 선택은 브라우저 후속 PLAN을 만들기 전에 기록한다. 승인 없이 dependency를 추가하지 않는다.

## Scope and Non-goals

### In scope

- `src/domain/**`
- `src/engine/ballContinuity.ts`, `carry.ts`, `compile.ts`, `stateAt.ts` 및 직접 의존 순수 모듈
- `src/editor/tacticFuzz.harness.ts`, `tacticFuzz.test.ts`, `stepCommands.ts`, `segmentCommands.ts`, `EditorCore`, persistence/validator
- test-only mutation fixtures, parity tests, 정적 read/write graph, 측정 로그

### Out of scope

- C 문서 drift 전수 정리
- R5/R7/R12-D/R12-E의 실제 브라우저 재현
- SimplePitch gesture, SVG renderer/hit, pathPresentation 시각 parity
- E1/E2/E3 UX/HCI, contrast/CLS, viewport/Zen polish
- D1 2안 구현, schema/migration, product refactor
- dependency 추가, 7200-session soak, 600-gesture marathon

## 실행 묶음 분리

| 묶음 | 포함 | 브라우저 결정 | 가능한 최종 주장 |
|---|---|---|---|
| A — Browser-free | G0, 이 계획의 M1/M2/M3, 후속 C, 후속 D-static | 불필요 | core document/engine/editor 재현 폐쇄와 정적 위험까지 |
| B — Browser-required | D-browser, E-core, 선택적 E-polish | `DG-BROWSER` 필수 | 실제 pointer dispatch, SVG render/hit, 화면 재생, UX/HCI |

묶음 A는 독립적으로 완결 가능하다. 묶음 B를 실행하지 않으면 전체 제품의 “사용자가 만든 그대로 화면·재생된다”는 주장은 `NOT VERIFIED`로 남는다.

## M1 — I1~I10 Mutation-kill 감사

1. **무엇을 검증/발굴하는가**

   각 invariant가 정상 fixture에서 PASS하기만 하는 장식인지, 해당 결함을 의도적으로 넣었을 때 실제로 FAIL하는 detector인지 확인한다. detector 간 중복과 한 detector의 넓은 실패가 다른 detector의 공허함을 가리는지도 본다.

2. **어떻게 검증하는가**

   새 mutation framework dependency를 넣지 않는다. 최소 문서를 clone한 test-only fixture transformer로 한 번에 한 계약만 깨고 `violation()`의 결과를 확인한다.

| Invariant | 최소 mutant | 기대 관찰 |
|---|---|---|
| I1 compile errors | dangling/불가능 trigger 또는 compile error fixture | I1이 먼저 원인을 보고 |
| I2 finite | interior waypoint/handle, offset, timing 중 하나에 non-finite 삽입 | 현재 검사 범위가 놓치면 Detector Gap |
| I3 entity-step uniqueness | 같은 entity의 authored segment 두 개를 같은 step에 배치 | I3 검출 |
| I4 player chain geometry | 두 연속 run의 end/start를 분리 | I4 검출 |
| I5 B1 continuity | junction에 알려진 jump 삽입; unrelated fast segment도 함께/없이 비교 | jump 검출력과 전역 속도 예산 masking 판정 |
| I6 travel launch | authored travel start만 실제 release에서 이동 | I6 검출 및 현재 tolerance 기록 |
| I7 travel landing | authored travel end만 실제 landing에서 이동 | I7 검출 및 현재 tolerance 기록 |
| I8 travel overlap | ball travel 두 개의 schedule을 겹치게 구성 | I8 검출 |
| I9 relayout idempotence | 한 번 더 relayout하면 byte가 바뀌는 pre-fixed-point 문서 | I9 검출 |
| I10 validate/round-trip | validator 또는 serialize/parse가 의미 차이를 내는 최소 문서 | I10 검출 여부와 구조/의미 한계 기록 |

   각 mutant는 기대한 detector 외에 먼저 실패한 detector도 기록한다. I1이 모든 malformed fixture를 선점하면, 후속 invariant용으로 compile 가능한 semantic mutant를 따로 만든다. mutation은 production source에 남기지 않는다.

3. **통과 기준**

   - I1~I10 전부에 실행 결과가 있다.
   - 기대 detector가 잡은 경우 `KILLED`, 다른 detector만 잡으면 `MASKED`, 아무도 못 잡으면 `SURVIVED`로 분류한다.
   - `SURVIVED` 0일 때만 detector coverage를 지지한다. `MASKED`는 독립 detector 증거가 아니므로 별도 gap 판단을 한다.
   - 기본 tacticFuzz 360-session campaign이 PASS한다. 더 큰 soak는 결과상 필요할 때 후속 범위로 제안한다.

4. **예상 산출물**

   I1~I10 mutation matrix 10행, 최소 mutant fixture/test, KILLED/MASKED/SURVIVED 결과, detector gap Findings. 예상 규모는 **1~2일, test 1~2개 파일, mutant 10~15개**다.

## M2 — Junction Read/Write Graph와 Core Parity

1. **무엇을 검증/발굴하는가**

   같은 공 정션을 정하는 저장값과 계산 경로가 몇 개인지 역할별로 측정하고, 실제 editor command가 relayout을 거쳐 compile/stateAt과 같은 결과를 만드는지 확인한다. “개수가 하나여야 한다”가 아니라, 복수 값이 서로 다른 역할인지 같은 의미를 중복 소유하는지가 핵심 질문이다.

2. **어떻게 검증하는가**

   먼저 다음 후보를 `authoritative input`, `identity/time constraint`, `derived/cache`, `presentation boundary`로 분류한다.

   - `ball.home`, `initialHolderId`
   - `possessed.offset`, `offsetLocked`
   - `move.carryEnd`
   - travel 첫/끝 waypoint
   - `receiverId`, `target {entityId, step}`
   - `carryVecAt`, `carryAheadFor`, `heldBallPos`
   - relayout arrival/origin rewrite
   - UI로 넘어가는 `pathPresentation/attachedStart`는 boundary로만 기록하고 Phase 1 parity 판정에서는 제외

   `rg`와 수동 call graph로 reader/writer, exported command, production callsite, relayout 전/후를 기록한다. test-only 계측으로 command별 relayout 호출 수, compile 호출 수, fixed-point rounds/cap hit, wall time을 수집하되 product source에 영구 instrumentation을 넣지 않는다.

   parity fixture는 다음 6개로 제한한다.

   1. initial possession → 첫 pass.
   2. 달리는 receiver에게 pass → possession.
   3. explicit future `target` through-pass.
   4. `carryEnd`와 `offsetLocked`가 있는 run/receive 경계.
   5. receive 직후 다음 pass가 이어지는 relay.
   6. receiver/target 삭제 → 재편집 → save/load → relayout 재실행.

   각 fixture에서 authored inputs, relayout 후 document, compiled segment start/end, `stateAt(start/end 및 경계 양옆)`, holder/receiver identity, 두 번째 relayout byte를 같은 표에 놓는다. player/track 배열을 뒤집은 variant는 receiver 동률 fixture 하나에만 제한해 순서 의존 신호를 본다.

3. **통과 기준 — 측정 우선**

   사전 개수·성능 목표를 두지 않는다.

   - graph의 모든 reader/writer가 역할과 reachability를 갖고 미분류 항목이 0이면 inventory PASS다.
   - 같은 semantic junction을 독립적으로 쓸 수 있는 두 writer가 발견되면 개수와 무관하게 위험 후보로 기록하되, parity 재현 전에는 결함으로 단정하지 않는다.
   - byte idempotence, deterministic compile/stateAt, identity/target 같은 exact 계약은 기존 코드 계약대로 exact 비교한다.
   - 좌표/시간 tolerance는 실행 전에 기존 constant·기존 strict test·수치 알고리즘을 근거로 별도 measurement note에 정한다. 초안의 임의 `≤0.05m`, `≤1ms`를 자동 적용하지 않는다.
   - resolver 수, relayout 호출 수, rounds, compile 수, p50/p95 시간은 결과 표일 뿐 PASS/FAIL 기준이 아니다. 측정 뒤 중복 역할·재현 위험·비용을 근거로 후속 목표를 제안한다.
   - fixed-point cap 도달이나 순서 변경에 따른 semantic 결과 변화는 그 자체로 Finding이다.

4. **예상 산출물**

   junction authority/read/write graph, production reachability 표, 6-fixture parity matrix, 호출/수렴/시간 baseline, tolerance measurement note, D1 1안 유지 또는 2안 검토 권고. 예상 규모는 **1~2일, test 1~3개 파일, 정적 보고서 1개**다.

## M3 — Phase 1 통합 판정

1. **무엇을 검증/발굴하는가**

   G0, mutation-kill, parity 결과가 core 수준의 재현 폐쇄를 지지하는지 판정한다.

2. **어떻게 검증하는가**

   표준 게이트, mutation suite, parity suite, 기본 tacticFuzz를 깨끗한 process에서 실행하고 모든 FAIL을 Findings에 연결한다. 역사적 PASS나 단독 재실행으로 현재 FAIL을 덮지 않는다.

3. **통과 기준**

   - `Core Closure Supported`: G0 및 표준 gate PASS, I1~I10 `SURVIVED` 0, 6 parity fixture semantic mismatch 0, 미분류 writer 0.
   - `Core Closure Not Supported`: 재현 가능한 detector survivor, parity mismatch, order dependence, cap hit, core gate 실패 중 하나 이상.
   - `Insufficient Evidence`: G0 미해결, fixture/graph 누락, 실행 불가 항목이 남음.

4. **예상 산출물**

   Phase 1 감사 보고, Findings Register, core closure 판정, D1 권고, C/D/E 후속 착수 여부. 예상 총규모는 G0 제외 **2~4일**이다.

## 브라우저 없이 답할 수 있는 범위

| 질문 | Phase 1 답변 가능 여부 |
|---|---|
| 저장된 junction과 compiled schedule이 같은가 | 가능 |
| relayout 뒤 stateAt playback 위치·ownership이 같은가 | 가능 |
| I1~I10이 의도 결함을 실제로 잡는가 | 가능 |
| command 순서·undo/save-load 후 core document가 고정점인가 | 제한된 6 fixture + 기본 fuzz 범위에서 가능 |
| 사용자가 클릭한 대상과 실제 dispatch가 같은가 | 불가 — UI/browser 후속 |
| 선택 여부에 따라 보이는 path/hit geometry가 달라지는가 | 불가 — renderer/browser 후속 |
| blur/lost capture에서 transaction이 닫히는가 | component 일부는 가능하지만 실제 browser 보장은 불가 — D 후속 |
| replay 화면이 flicker/teleport 없이 정확한가 | 불가 — browser 후속 |
| UX/HCI 인식률·의도 이행률·가독성 | 불가 — E 후속 + DELEGATED |

따라서 Phase 1만 PASS해도 표현 가능한 결론은 “core document/engine pipeline에서 재현 결함 폐쇄가 지지된다”까지다. “사용자가 만든 전술이 화면과 재생에서 그대로 보인다”는 전체 제품 주장은 D/E까지 끝나야 한다.

## Measurement Policy

- **먼저 측정:** resolver/writer/relayout/compile 수와 latency distribution을 기록한다.
- **역할 우선:** 수가 2여도 authoritative input과 derived adapter처럼 역할이 다르고 parity가 고정되면 허용 가능하다.
- **semantic conflict 우선:** 수가 1이어도 selection/load/order에 따라 결과가 달라지면 실패다.
- **기존 계약 재사용:** byte idempotence, deterministic output, valid reference 같은 기존 exact 계약은 그대로 쓴다.
- **새 수치 기준 절차:** 기존 상수/테스트 근거 → baseline 분포 → 오차 원인 → 제안 threshold 순으로 measurement note를 만들고, remediation 전에 승인한다.
- **성능:** Phase 1에서는 p50/p95를 관찰만 한다. 성능 Finding은 명백한 timeout/cap/비정상 증폭 또는 기존 gate 회귀가 있을 때만 연다.

## Findings Register

| ID | 단계/축 | 증상 | 원인 가설 | 심각도(P0~P3) | 재현 방법 | 수정 후보 | 회귀 방어 |
|---|---|---|---|---|---|---|---|
| F-000 | G0/A/B | 이행 시 작성 | 검증 전 단정 금지 | P? | command/seed/fixture | 후속 변경 | test/invariant |

보조 메타데이터는 `KILLED/MASKED/SURVIVED`, status, commit, evidence path, 재현율, 관련 ADR/CHG를 포함한다.

### 심각도

- P0: 저장 손실/오염, 복구 불가능한 문서 변형, 앱 사용 불능.
- P1: core 저장·compile·stateAt 위치/ownership 불일치, 결정론 실패, 열린 transaction/undo 손상.
- P2: detector gap, 제한 fixture의 순서 의존, 반복 flake, 관리성 위험.
- P3: 의미를 바꾸지 않는 문서·측정·정리 개선.

## Gate Matrix

| Gate | 명령 | 시점 | PASS 기준 |
|---|---|---|---|
| G0 targeted | `npx vitest run src/ui/AppShell.test.tsx` | G0 | 3회 연속 12/12 |
| G0 full | `npm test` | G0 | 3회 연속 전량 PASS |
| G0 serial | `npx vitest run --maxWorkers=1` | G0 | 1회 전량 PASS |
| Mutation | 신규 I1~I10 mutation suite | M1 | 10개 결과, `SURVIVED` 0이 closure 조건 |
| Core parity | 신규 6-fixture parity suite | M2 | semantic mismatch 0이 closure 조건 |
| tacticFuzz | `npx vitest run src/editor/tacticFuzz.test.ts` | M1/M3 | 기본 campaign PASS |
| Typecheck | `npm run typecheck` | artifact 변경 후/M3 | exit 0 |
| Lint | `npm run lint` | artifact 변경 후/M3 | exit 0 |
| Test | `npm test` | M3 | 전량 PASS |
| Build | `npm run build` | M3 | exit 0 |
| Harness | `npm run harness:verify` | plan/artifact 변경 후/M3 | exit 0, warning 0 |

브라우저 probe, marathon, contrast, CLS, viewport matrix는 이 Gate Matrix에 없다.

## 후속 PLAN 후보와 예상 규모

| 후보 | 범위 | 선행 조건 | 예상 규모 |
|---|---|---|---|
| C — 문서 drift/회귀 ledger | CHG-139~184 매핑, CURRENT_STATE/PROJECT_MAP/CODEX_BRIEF/Known Issues 정리 | Phase 1 결과 권장, browser 불필요 | 0.5~1일, production 0개, 문서 4~6개, ledger 1개 |
| D-static — 구조 위험 재판정 | R5/R7/R12-D/R12-E call path, pure/component characterization | G0 PASS | 0.5~1일, test 2~4개 파일 |
| D-browser — 실제 interaction/CTM | overlap dispatch, cancel, hit scale, receiver tie 실제 probe | DG-BROWSER 결정 | 0.5~1일, probe 약 4개 |
| E-core — UX/HCI 핵심 여정 | E1/E2/E3를 주어 선택→목적지→재생의 6~10상태로 축소 | DG-BROWSER 결정 | 1~2일, probe 3~5개 + 사용자 DELEGATED 1회 |
| E-polish — 선택적 시각 품질 | contrast, CLS, ultrawide/tall, Zen 전환, 광범위 viewport | E-core 이후 별도 승인 | 0.5~1일; 핵심 정션 폐쇄와 분리 |

역사적 22개 probe를 무조건 복원하지 않는다. D/E 계획에서 현재 Accepted 계약에 필요한 probe만 선별하고, 나머지는 historical inventory로 보존한다.

## Priority

1. G0 전량 gate 안정화.
2. M1 detector mutation-kill.
3. M2 junction graph/parity.
4. M3 core 판정.
5. C 문서 drift.
6. D 구조 재판정.
7. E 핵심 UX, 이후 선택적 polish.

감사에서 확인된 P0/P1은 후속 기능보다 우선한다. 수정은 재현 test 고정 → 별도 remediation 범위 → 최소 변경 → 전체 gate 순이다.

## Ambiguity Register

- **AMB-01 — D1 2안 구현 여부:** M2 측정과 parity 결과 전에는 결정하지 않는다. 구현은 migration을 포함한 별도 L3다.
- **AMB-02 — 새 numeric tolerance:** 기존 계약으로 exact 판정할 수 없는 항목만 measurement note 뒤 사용자/ADR 결정을 받는다.

브라우저 runtime은 Ambiguity가 아니라 `DG-BROWSER` Decision Gate다.

## Rollback

- G0와 감사 artifact 외 production 변경을 하지 않는다.
- mutant는 test-only fixture이며 production source에 남기지 않는다.
- 실패 detector를 PASS시키기 위해 assertion/tolerance를 약화하지 않는다.
- Phase 1 범위가 다시 확대되면 이 계획을 늘리지 않고 새 PLAN을 만든다.
- 계획을 되돌릴 때는 PLAN-014/ACTIVE_PLAN만 역패치하고 직전 완료 계획은 `completed/PLAN-20260822-013-moment-grammar.md`에서 복원한다.

## Plan Reversal Log

| 날짜 | 변경 | 이유 | 영향 |
|---|---|---|---|
| 2026-08-23 | v1 총검증 단일 계획 → v2 G0 + core M1/M2 독립 계획 | 이동 flake, browser 전제 자기모순, 과대 범위, 사전 수치 기준 | C/D/E 분리, browser gate 승격, 7200 soak/600 marathon/UX polish 제거 |
