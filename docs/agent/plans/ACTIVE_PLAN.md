# Active ExecPlan

Plan ID: PLAN-20260821-010
Status: Draft — Proposed 로드맵, 사용자 우선순위·결정 게이트 승인 전 구현 금지
Task Risk: L3 예상 (Scene/Phase·Trigger authoring·영속 Variant·공유 경계)
Created: 2026-08-21
Updated: 2026-08-21
Execution Owner: Unassigned

## Objective

축구 전술 보드·코칭 제품 13종과 스포츠/멀티미디어 학습 연구를 바탕으로, 현재의 결정론적
타임라인 우위를 `설명 → 인과 저작 → 재사용 → 선수 학습` 흐름으로 확장한다.

상세 근거와 후보 비교: `docs/product/BENCHMARK_RESEARCH_2026-08-21.md`.

## Product Bets

1. 초보는 순차적 `설명 모드`, 숙련자는 동시 관계가 보존된 `전체 전개 모드`를 선택할 수 있어야 한다.
2. Trigger는 Inspector의 숨은 고급 데이터가 아니라 pitch 위에서 연결하는 직접 조작이어야 한다.
3. annotation도 시간축을 가져야 하며, 신호는 한 시점에 소수만 보여야 한다.
4. 전술 품질 자동 점수보다 검증 가능한 거리·시간·오프사이드와 코치 저작 원칙을 우선한다.
5. 선수 학습은 AI 정답 생성이 아니라 코치가 만든 선택지·이유·Variant에서 시작한다.

## Decision Gates — 구현 전 사용자 확정 필요

- G1 주 사용자: **권장 — 코치/분석가 저작 → 선수 전달**. 대안은 콘텐츠 제작자 우선.
- G2 Scene/Phase: **권장 — Scene은 불연속 장면, Phase는 같은 timeline의 연속 구간**.
- G3 Release A: **권장 — Phase + timed cue + 설명/전체 재생을 한 묶음으로**.
- G4 공유: **권장 — Release C까지 local-first·no-login 유지**, link/응답 수집은 별도 L3.
- G5 학습 주장: **권장 — 이해·대화·mental reps 보조까지만**, 경기력 향상 문구는 검증 전 금지.

## Milestones

### M0 — Baseline research and task benchmark

- 초보 3명, 코치/분석가 3명으로 현재 Scenario A 기준선을 수집한다.
- 측정: 저작 시간, 순서 회상, 이유 설명, 재생 횟수, mental effort 1~7, undo/오류 수.
- 과업 스크립트와 익명 결과를 `docs/product/`에 남긴다.
- Exit: 세 집단이 없더라도 최소 5명, 초보/숙련 구분을 유지한 기준선.

### M1 — Phase/Chapter additive domain

- 기존 `Scene[]`의 의미를 고정하고 동일 timeline 안 `Phase`/marker 모델을 additive로 설계한다.
- Phase: id, title, start/end anchor, coaching point, optional pause/loop 정책.
- 기존 schema v1 문서는 단일 unnamed phase처럼 재생하되 저장 시 불필요한 migration 금지.
- compile/stateAt 결과는 Phase 유무와 무관하게 동일해야 한다.
- Exit: JSON round-trip, invalid overlap/reference, old fixtures, determinism tests.

### M2 — Explain mode / Full-play mode

- 설명 모드: Phase nav, 구간 반복, 끝 멈춤, 현재 행동 cue.
- 전체 모드: authored timing과 모든 동시 관계 보존.
- 기존 StepBar를 대체하지 않고 Phase가 한 단계 위의 narrative layer가 되게 한다.
- Exit: 3-Phase 전술을 키보드·포인터로 작성/재생; 720/1440px; reduced-motion.

### M3 — Timed Coaching Layer

- 기존 drawing `visible`을 저작하는 `항상 / 현재부터 / 이 Phase` 프리셋.
- spotlight, entity highlight, callout의 최소 세트. `followEntityId`는 별도 schema 판단.
- 설명 모드 중 signal budget과 focus hierarchy를 정의한다.
- Exit: scrub/replay/GIF parity, annotation undo transaction, 최대 2 cue 샘플.

### M4 — Canvas Trigger Link

- segment/event anchor와 start pill을 직접 연결한다.
- `at`, `afterSegment`, `onEvent` ↔ 자연어 pill을 lossless 변환한다.
- cycle, dangling, ambiguous endpoint는 commit 전에 차단하고 이유를 표시한다.
- simple Step relayout과 advanced trigger truth의 precedence를 ADR로 고정한다.
- Exit: Acceptance Scenario A를 Inspector 없이 작성, undo 1 link=1 step, old JSON parity.

### M5 — Tactical overlays and factual lint

- pure TS metre 기반 overlays/metrics: thirds, five lanes, half-spaces, Zone 14, 거리, 폭·길이.
- 1차 lint: offside-at-event, impossible speed, out-of-pitch. 경고만, 자동 수정 없음.
- 코치의 전술 평가와 기하/규칙 사실을 데이터·UI에서 분리한다.
- Exit: renderer pixel 독립, scrub deterministic, engine/domain purity.

### M6 — Playbook and persistent variants

- 태그: 상황, 인원, 원칙, 난이도, Phase, 코칭 포인트.
- 10~15개 hand-authored pattern, 복제하여 변형, 나란히/ghost compare.
- session-only `VariantSession`을 영속 관계로 확장할 migration/ownership ADR.
- Exit: 복제→한 반응 변경→비교→원본 복귀 2분 usability task.

### M7 — Player learning mode

- 역할별 focus, temporal-occlusion question marker, coach-authored choices/answer/reason.
- 답 뒤 전체 전개와 관련 Variant를 비교한다.
- 점수/서버 없이 local session부터 검증한다.
- Exit: 기존 전술을 5분 이내 1-question 학습 장면으로 변환, 응답·이유 표시.

### M8 — Delivery boundary (별도 승인)

- local/offline read-only player package 먼저.
- 그 뒤에만 share link, 권한, 비동기 comment/response, privacy를 L3로 재계획한다.
- browser-side MP4/WebM, 16:9/1:1/9:16 framing은 성능 spike 후 결정한다.
- 3D/VR, video tracking, generative tactic authoring, real-time collaboration은 범위 밖.

## Verification

각 milestone 기본 게이트:

`npm run typecheck && npm run lint && npm test && npm run build && npm run harness:verify`

추가:

- Domain: old document round-trip, deterministic `stateAt`, trigger cycle/dangling, Phase boundary.
- UI: keyboard-only, pointer/touch hit, screen reader label, 720/1440px, reduced-motion.
- Performance: 22 players, 10 phases, 100 segments에서 편집·재생 frame budget 기록.
- Research: 초보/숙련 분리, 동일 과업 전후 비교. 유의성 없이 학습 효과를 주장하지 않는다.

## Stop / Reversal Criteria

- Phase 저작이 기존 단계 과업 시간을 25% 이상 늘리면 StepBar 통합 방식을 재설계한다.
- timed cue가 이해를 높이지 않고 mental effort만 높이면 자동 cue를 제거한다.
- Trigger Link가 simple mode 오류를 늘리면 Advanced timeline에만 격리한다.
- quiz 준비가 전술당 5분을 넘으면 선택지 템플릿을 단순화한다.
- server/auth가 필요해지는 순간 M8을 새 L3 계획으로 분리하고 사용자 승인을 받는다.

## Ambiguity Register

- A1 Phase가 Scene에 속하는 marker 범위인지 별도 객체인지 — M1 전 G2 확정.
- A2 timed cue의 entity attachment가 v1 additive field인지 UI 파생인지 — M3 spike.
- A3 Step와 explicit Trigger 충돌 시 authoritative source — M4 ADR 필수.
- A4 Variant를 같은 document 내부 branch로 둘지 document relation으로 둘지 — M6 ADR 필수.
- A5 player response 저장 위치/개인정보 — M8 전 서버 경계 승인.

## Plan Reversal Log

- 2026-08-21: 벤치마크에서 흔한 3D/AI/video tracking을 선행하지 않고, 현재 엔진 우위를 살리는
  Phase/Trigger/learning 순으로 제안. 사용자 승인 전 Proposed 유지.
