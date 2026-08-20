# ADR-0007: Reactive Opponent ("Auto-play" for the non-authored team)

Status: Accepted (2026-08-20 — 사용자 "end to end 전체 다 만들어봐" 지시로 Phase 1 구현: `src/engine/opponent.ts`, UI "자동 대응")
Date: 2026-08-20
Decision Owners: User request / Agent proposal
Related: ADR-0001 (원칙 2,4,7,9 — 결정론 유지), ADR-0003 (segments가 산출물), PRODUCT_BRIEF §6
Project-Owned Evidence: `../../../../football-marl-lab` (사용자 이전 프로젝트) — `components/seasonal/worldcup-ball-goal.tsx`에 **규칙 기반 press/cover/balance/support/shape 역할 배정 AI**(PPDA 기반 압박 인원: 게겐≥.82→3, 하이≥.68→2, 미드/로우 1, 카운터프레스 +1), `lib/football/tactics/profiles.ts`(전술 스타일 20종, press 강도), `docs/football-rl-training-benchmark-report.ko.md`(결론: **scripted baseline 먼저, RL은 그 다음**). 학습된 모델(.onnx/.pt)은 **없음**.

## Context

사용자: "내가 만든 팀이 아닌 상대 팀이 '자동 플레이' 버튼을 누르면 실제 경기처럼 뺏으러 오는 플레이가 가미되면 더 재미있겠다. 학습된 모델이 있으면 벤치마킹 추천."

## Considered Options

### A. 규칙 기반 반응 생성기 (추천 — Phase 1)

상대 팀 선수별 역할 배정(ball-nearest → press, 2nd → cover, 나머지 → shape 복귀/마킹) + 스티어링(목표점 = 공 위치 예측, 패스 레인 차단, 라인 유지). 사용자 팀의 compiled timeline을 입력으로 **이벤트 시각마다(ball.released/received, 0.5s tick)** 상대 선수의 move segment를 **생성해 문서에 기록**한다.

- (+) 결정론 유지(같은 입력 → 같은 segments). 생성물이 일반 segment이므로 **사용자가 곧바로 편집 가능**(ADR-0001 원칙 "Formation은 preset" 과 같은 정신: 생성은 preset, 구속 아님).
- (+) 의존성 0, 브라우저에서 즉시. football-marl-lab 로직 이식 가능(순수 TS).
- (+) 압박 강도/라인 높이 슬라이더로 "스타일" 조절(profiles.ts STYLES 재사용).
- (−) "진짜 AI"처럼 창발적이진 않음. 상대 공격(역습)까지 생성하려면 규칙이 커짐 → v1은 수비 반응(압박·마킹·커버)만.

### B. 학습 정책 (Phase 2 후보)

- Google Research Football(GRF) / Light-MALib 정책 — Python·C++ 엔진, 브라우저 실행 불가, 관측 공간 불일치 → 직접 이식 불가. 개념(Football Academy 커리큘럼)만 참고.
- DeepMind×Liverpool **TacticAI**(2024, 코너킥 GNN) — 공개 모델 없음, 세트피스 한정.
- Pitch control / EPV(Spearman 2018, Fernández & Bornn) — 모델이 아니라 **평가 함수**. A의 목표점 선택(어디로 뛰어야 공간을 닫나)에 쓰기 좋음. 추천: A에 pitch-control 근사(거리/속도 기반 Voronoi)를 목표점 heuristic으로 채택.
- 자체 학습(football-marl-lab): 사용자 보고서대로 scripted baseline(=A)이 선행 조건. 학습 후 **소형 정책 → ONNX → onnxruntime-web**로 브라우저 추론 가능(M6+).

### C. 물리 시뮬 풀게임

non-goal(ADR-0001 §13). 제외.

## Decision (Proposed)

1. **Phase 1 (M3.5)**: 옵션 A. `src/engine/opponent/`(순수) — 입력: doc + compiled + 옵션{team, pressIntensity(0..1), lineHeight, reactionDelay(0.2–0.5s)} → 출력: 해당 팀 tracks(segments). 에디터 command `generateReaction(core, teamId, opts)`가 기존 해당 팀 segments를 교체(undo 1 step). UI: 상단 "자동 대응 ▾"(팀·강도) 버튼 + Inspector 토글. 생성 segment는 `meta.generated=true`로 표시(향후 재생성 시 사용자 수정분 보존 여부 결정 — Open).
2. 목표점 선택 heuristic: 공 보유자 예측 위치(0.3s 앞), 패스 레인 차단점(보유자↔가장 가까운 동료 선분에 투영), 커버 포지션(골문–공 직선 상 6–8m 뒤), 라인 복귀(formation home + 공 x 따라 시프트). 속도 preset run/sprint.
3. **Phase 2**: football-marl-lab 정책 학습 → ONNX. 별도 ADR.
4. 결정론·편집 가능성 불변: 생성은 항상 문서에 기록되는 segments. 재생 중 실시간 계산 없음.

## Implementation Note 2026-08-20 (PLAN-003 M4)

- provenance는 `meta.generated` 대신 **segment id prefix `gen-`**(A-07 (a)). 위험: import 문서에 같은 prefix의 사용자 segment가 있으면 "생성분 제거"가 지울 수 있음 → 스키마 메타데이터 도입 시 별도 ADR.
- Phase 1 planner 보정: 동일 선수 연속 생성은 직전 끝점에서 시작(연속성), 이전 생성 이동이 끝나기 전 새 이벤트가 오거나 왕복(leg≥5m, cos≤−0.8)이면 **새 segment를 쌓지 않고 직전 segment를 재타깃**(coalesce), 압박 담당 교대는 2m hysteresis + 문서 순서 tie-break. 테스트 `src/engine/opponent.test.ts`.
- 공격 측 반응은 ADR-0008(Proposed)로 분리.

## Consequences

- (+) Fun: Completion/Discovery Delight 상승, "상대가 반응"하는 설명 영상 가능.
- (+) 엔진 원칙 유지. 테스트 가능(입력 고정 → 출력 고정).
- (−) 규칙 품질이 체감을 좌우 → 사용자 체감 테스트 필요. 11v11 풀 반응은 segments 수 증가(타임라인 가독성 → 팀 필터 필요).

## Revisit Conditions

- Phase 1 체감이 부족하면 Phase 2 착수. 사용자가 공격 측 자동 플레이(역습)까지 원하면 범위 재정의.

## Validation

- 단위테스트: Scenario A 입력 → Red 1 press segment가 ball.released 직후 생성, Red 2 cover segment 존재, 결정론.
- DELEGATED: 사용자 체감("뺏으러 오는 느낌").
