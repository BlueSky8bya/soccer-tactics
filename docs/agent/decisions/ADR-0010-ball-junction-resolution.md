# ADR-0010 — 공 정션 해석의 단일화 (구조 감사 채택)

Status: Accepted (사용자 결정 2026-08-21 "어 해봐 그럼")
Date: 2026-08-21
- Area: engine / editor / interaction
- Basis: `docs/agent/handoffs/REVIEW-ball-carry-structural.md` (Codex 정적 감사, 2026-08-21)
- Supersedes: CHG-104/106의 원점 봉합 접근(도착 고스트=일반 bend, `t-0.001` authored 스냅)을 구현 세부로 격하. ADR-0009는 유지.

## Context

공 정션(패스 발사/수신, 드리블 경계)의 위치를 쓰는 주체가 넷(`possessed.offset(+offsetLocked)`,
travel 끝점+`receiverId`, `move.carryEnd`, stateAt 전방 캐리 규칙)이고, compile과
`relayoutStepsInDraft`가 각자 원점을 다시 계산해 화면·재생·pick이 어긋났다. 감사가 S1/S3/S5,
R1/R2/R9/R12-B/C를 확정 결함으로 판정했고, 스팟체크 4/4로 코드와 일치함을 확인했다.

## Decision

- **D1 — 감사 1안(최소 봉합) 시행.** 2안(명시적 BallJunction + 단일 pin)은 1안 검증 후 재발 시에만
  이행한다(조건부). 구문서가 세상에 없으므로(D4) 이후 이행 비용은 감사 추정보다 낮다.
- **D2 — 정션 프레임 규칙.** 캐리 해석은 엔진의 공용 resolver 하나가 담당한다. 우선순위:
  run 활성 중 `carryEnd`(마지막 0.35s blend) > 정지 시 `offsetLocked` offset > 전방 캐리(1.9m)
  > side offset 기본값. **체인 경계에서 공은 이전 run의 end-carry(핀 있으면 핀)를 정확히 통과한
  뒤** 0.35s에 걸쳐 다음 벡터로 보간한다(순간이동 금지). `chainIn → ramp=1` 즉시 강제는 폐기.
- **D3 — receiver identity 고정.** 도착 고스트 드래그는 위치만 바꾼다. 드래그 중 receiver 재선택
  금지(제스처 시작 시 고정). 재연결은 별도의 명시적 조작으로만.
- **D4 — 스키마 v1 + additive optional 유지.** "새로고침=클린 보드"(ADR-0009)와 import UI 비노출로
  마이그레이션 대상 구문서가 존재하지 않는다. migration fixture는 만들지 않되, validator는 optional
  필드 shape과 참조를 검사한다.
- **D5 — attach threshold 단일화.** 시각 캐리 링 최대 반경과 드롭 commit 반경은 하나의 semantic
  상수에서 파생한다. 포인터 접근성 여유는 별도 screen-px 계층으로 둔다.
- **D6 — 폐기 골든.** (1) "travel release는 possession offset"(engine.test 구 단언),
  (2) "도착 고스트 조정 = 일반 bend", (3) "선택된 패스만 presentation 원점 보정"(ISSUE-006 테스트).
  대체 계약은 감사 §8 매트릭스를 따른다.

## Consequences

- compile의 travel release와 stateAt이 같은 resolver를 호출 → 화면/재생 원점 불일치(S3) 구조 제거.
- relayout은 정규화→timing→anchor→constraint 순의 단일 pass로 재배열하고 멱등성을 테스트로 고정.
- 실행 계획: `docs/agent/plans/ACTIVE_PLAN.md` (PLAN-20260821-009), 마일스톤별 게이트.
