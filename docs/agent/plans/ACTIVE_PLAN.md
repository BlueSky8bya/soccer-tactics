# Active ExecPlan

Plan ID: PLAN-20260822-012
Status: In Progress — M1·M2 landed and measured, M3~M5 awaiting the research brief
Task Risk: L3 (shell layout, motion system, interaction feel — touches ADR-0006 and ADR-0009)
Created: 2026-08-22
Updated: 2026-08-22
Execution Owner: Claude (this session)

## Objective

사용자 요청(2026-08-22): 전체 레이아웃을 "애플처럼 통통 튀고 탁 붙는" 조작감·UI·애니메이션으로
대개편하되 **근거 기반**으로 한다 — HCI 연구·논문·디자인 시스템 문서를 조사해 비율·배치·모션
수치를 정당화한다.

세 축으로 정리한다:

- **조화(Harmony)**: 비례·리듬(간격 스케일), 위계(시각 무게), 통일(모션·색·재질의 단일 언어)
- **몰입(Immersion)**: 콘텐츠 지배(보드가 화면을 차지), 크롬의 후퇴, 공간·시간적 연속성
- **조작감(Feel)**: 즉각성(지각 임계 내 반응), 예측 가능성(직접 조작), 관성과 안착(스프링)

## Non-negotiables

- 상호작용 계약(ADR-0009 v1~v14)의 **동작**은 유지한다. 개편 대상은 비례·모션·시각 위계이지
  제스처의 의미가 아니다. 회귀 테스트 208종이 그 경계다.
- `src/engine` / `src/domain` 순수성 유지 — 모션은 `src/ui/motion`에만.
- reduced-motion에서 신규 모션이 전부 정지해야 한다.

## Milestones

### M1 — 모션 단일 언어 (DONE — commit 27cce5e)

문제: Apple식 `Spring(duration:bounce:)` 모델이 이미 있었으나 **소비자가 2개뿐**이었고 나머지
21개 전환은 cubic-bezier였다. 베지어는 바운스를 표현할 수 없어, 사람이 가장 많이 만지는 컨트롤이
피치 토큰과 **다른 곡선**으로 움직였다.

- `springLinearEasing()` — 스프링을 CSS `linear()`로 샘플링. 전환과 `SpringAnimator`가 오버슈트까지
  동일하게 안착한다.
- `springSettleTime()` — 지속시간은 **지각 임계**(`PERCEPTUAL_EPS` 0.5%) 기준 안착 시간. 애니메이터의
  정확성 임계(0.001)를 쓰면 180ms press가 340ms로 늘어나 보이지 않는 꼬리를 쫓는다.
- `springCss.test.ts`가 4개 역할을 재생성해 토큰과 대조 — 드리프트 불가.
- 버튼: 누를 때 평평하고 빠르게, 뗄 때 스프링 복귀.

Exit: 게이트 PASS + 스프링 유닛 5 PASS. **달성**.

### M2 — 보드 우선 비례 (DONE)

측정: 피치는 105:68 고정비라 이 그리드에서 **모든 노트북 폭에서 width-constrained**이고, 쓰지 못하는
세로 여유가 120~220px 남는다. 즉 사이드 크롬 1px = 보드 1px 손실.

- 고정 260/304 → `clamp(196px,14vw,244px) / clamp(220px,15vw,268px)`.
- 실측 보드 폭: 1280 667→809px(**면적 +47%**), 1440 821→958px(+17%), 1920 1283→1331px(+3.7%),
  2560은 0(거기선 height-constrained라 넓은 패널이 공짜).
- 최소 폭에서 텍스트 잘림 0 · 가로 스크롤 0 · 종횡비 유지 — 4개 해상도 실측.

Exit: layout probe 16/16 PASS. **달성**.

### M3 — 조화: 간격·위계 (PENDING RESEARCH)

- 4pt 그리드 이탈값(15px 카드 패딩, 11px 바 패딩, 3/5/6/7px 산재) 정리 범위 결정.
  주의: 촘촘한 컨트롤의 2px 갭은 의도된 것일 수 있어 일괄 치환 금지.
- 섹션 라벨/본문/힌트의 타입 스케일 정리.
- 대기 근거: 모듈러 스케일의 실증 여부, 그룹으로 읽히는 데 필요한 간격 비율(게슈탈트 근접성).

### M4 — 몰입: 크롬 후퇴와 연속성 (PENDING RESEARCH)

- 재생 중 크롬 후퇴는 이미 있음(`data-playing` opacity 0.45) — 강도·대상 재검토.
- 패널 등장/퇴장과 선택 전환의 공간적 연속성.
- 대기 근거: 애니메이션이 이해를 돕는 조건 vs 비용이 되는 조건, 몰입 저해 요인.

### M5 — 조작감: 직접 조작의 물성 (PENDING RESEARCH)

- 드래그 픽업/드롭 스프링 역할 점검, 스냅 피드백 강화.
- 대기 근거: 지각 임계(100ms/400ms/1s), Apple 시스템 스프링 기본값과의 대조.

### M6 — 검증

- 게이트 + 기존 상호작용 프로브 전부 무회귀(carry/bend/heldball/rate/guide/ctrlcard).
- 다해상도 레이아웃 프로브, reduced-motion 정지 확인.

## Verification

`npm run typecheck && npm run lint && npm test && npm run build && npm run harness:verify`

## Ambiguity Register

- A1 사이드 패널 접기(progressive disclosure) 도입 여부 — 상시 노출 비용 근거 확인 후 결정.
- A2 상단 바 48px 축소·통합 여부 — 세로 여유가 남아 우선순위 낮음.
- A3 다크 테마 포함 여부 — 현재 라이트 고정(ADR-0009 v3). 이번 범위 밖.

## Plan Reversal Log

- 2026-08-22: 병렬 리서치 완료 전에 M1·M2를 먼저 실행했다. 두 항목의 근거가 **이 저장소의 실측**
  (스프링 소비자 수, 해상도별 보드 크기)이라 외부 문헌으로 뒤집히지 않기 때문. M3~M5는 문헌이
  수치를 좌우하므로 대기시켰다.
