# ADR-0001: Product Identity and Core Principles

Status: Accepted
Date: 2026-08-19
Decision Owners: User (초기화 프롬프트에서 확정) / Agent-assisted 정리
Related Change IDs: —
Supersedes: —
Superseded By: —

## Context

새 프로젝트 "Soccer Tactics" 초기화. 사용자가 2026-08-19 초기화 프롬프트에서 제품 정체성과 설계 원칙을 확정함.
이 결정들은 이후 모든 아키텍처·UX 결정의 상위 제약이며 세션 기억이 아닌 저장소에 남아야 함.

## Decision

다음을 프로젝트 불변 원칙으로 확정한다.

1. **정체성**: 정적 전술판이 아니라 **Dynamic Football Tactical Sequencer** (Tactical Board + Motion Path Editor + Timeline Sequencer + Scenario Player).
2. **Animation / Timeline이 최우선 핵심 기능**이다. MVP를 정적 보드로 끝내지 않으며 Animation Core를 milestone 뒤로 밀지 않는다.
3. **Formation은 Preset이지 Constraint가 아니다.** 적용 후 모든 엔티티 자유 이동. Preset은 data-driven.
4. **Player와 Ball은 각각 독립 Animation Track**을 가질 수 있다. Ball은 Player와 다른 엔티티(possession attach/detach, pass/shot/cross 등 이벤트 모델).
5. **Simultaneous animation으로 제한하지 않는다.** Delay, sequential, triggered(event-relative) 관계를 데이터 구조가 표현한다.
6. **Apple-like UX = 시각 복제가 아닌 interaction quality** (direct manipulation, progressive disclosure, feedback, continuity, accessibility, reduced-motion). glass/blur 장식 남발 금지.
7. **Tactical Motion과 Interface Motion을 구분**한다. 전술 모션은 deterministic·reproducible·path/time-accurate. spring/overshoot는 UI 모션에만.
8. **직접 조작 우선.** Inspector는 정밀 조정용.
9. **Engine ↔ Renderer 분리.** `stateAt(t)`로 임의 시점 상태 재구성 가능. Renderer는 진실이 아님.
10. **Serializable Domain Model** (JSON). 렌더링/브라우저 state에 종속 금지.
11. **Undo/Redo는 핵심 기능.** transactional history.
12. **좌표는 Canvas pixel에 종속 금지** (domain coordinate).
13. **Non-goals(v1)**: 로그인, 소셜, 서버, 실시간 협업, AI 생성, 3D, tracking, DB, 영상 서버, 과도한 WebGL. 단 Domain Model은 확장을 막지 않음.
14. **첨부 Tactical Board 이미지는 초기 Project-Owned Evidence** → VDR-0001.
15. **판단 기준**: "사용자가 축구 상황을 더 쉽고 정확하고 즐겁게 설명하도록 돕는가?" / "머릿속 장면(먼저·다음·그 순간·이후 반응)을 Timeline에 거의 그대로 표현할 수 있는가?"
16. UX 평가 틀: Harmony(Visual/Functional/Contextual) × Immersion(Focus/Continuity/Control) × Fun(Response/Discovery/Completion).

## Rationale

사용자 명시 요구. 프롬프트 §2, §5–§13, §17, §19–§21, §24, §29, §30, §34.

## Consequences

- (+) 모든 하위 ADR은 이 원칙과 충돌하면 안 된다. 충돌 시 이 ADR을 Supersede하는 절차 필요.
- (+) Animation 데이터 모델이 초기에 설계되어 후속 기능(trigger, scene, export)을 막지 않음.
- (−) 정적 보드만 원하는 단기 데모보다 초기 설계 비용 큼 — 사용자가 수용함.

## Revisit Conditions

- 제품 방향이 "설명용 sequencer"에서 다른 것(예: 실경기 분석, 멀티플레이)으로 바뀔 때.
- 사용자가 명시적으로 원칙 변경을 요청할 때.

## Validation

- `docs/product/PRODUCT_BRIEF.md`가 이 원칙을 반영한다.
- 후속 ADR(렌더링·엔진·좌표·상태)이 이 ADR을 Related로 참조한다.
