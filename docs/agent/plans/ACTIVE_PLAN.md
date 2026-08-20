# Active ExecPlan

Plan ID: PLAN-20260821-009
Status: Completed (2026-08-21 — M1~M5 전부 게이트 PASS(167 tests) + s1_orbit Playwright probe ALL PASS. 커밋 ae84469/2300005/b10680f/956dae2/+M5. 브라우저 체감은 사용자 몫)
Task Risk: L3 (엔진·에디터 구조 변경)
Created: 2026-08-21
Updated: 2026-08-21
Execution Owner: Claude Code

## Objective

Codex 구조 감사(`docs/agent/handoffs/REVIEW-ball-carry-structural.md`)의 **1안(최소 봉합)** 시행.
확정 결함 S1/S3/S5, R1/R2/R9/R12-B/C를 구조적으로 제거한다. 결정 근거는 ADR-0010.

## 고정 결정 (ADR-0010)

D1 1안 시행(2안 조건부) · D2 공용 carry resolver + 경계 연속성(핀 정확 통과 후 0.35s 보간) ·
D3 도착 고스트 드래그 중 receiver 고정 · D4 스키마 v1 additive(migration fixture 없음) ·
D5 attach threshold 단일 상수 · D6 폐기 골든 3종(감사 §8).

## Milestones

### M1 — 엔진 공용 carry resolver + 경계 연속성 (S3·S5·R2·R12-C)
- `src/engine/carry.ts` 신설(pure): `carryAheadFor(moves, t)`(활성 run + standing 통합, carryEnd
  blend, 체인 `from` 통과), `heldBallPos(...)`(offsetLocked/carryAhead/offset 우선순위),
  `endCarryVec`. 입력은 `{start, end, lut, carryEnd?}` 최소형 — compile↔stateAt 순환 import 회피.
- `stateAt.ts`: resolvePlayer/standingCarry/holderPos를 resolver 호출로 교체. **`chainIn →
  edge=Infinity` 폐기**(ramp는 항상 lt 기준, from=이전 run end-carry → 경계 연속). lastEnded
  possessed에 `offsetLocked` 전달(R12-C).
- `compile.ts`: travel release를 `possession offset` 고정값 대신 resolver 결과로 계산(R2/S3).
- 테스트: dribble.test.ts — 방향 전환 체인 경계 연속(90°), carryEnd 핀 통과 연속; engine.test.ts —
  구 골든(252-287) 교체: release anchor ≈ stateAt(launch−ε) (default/moving/pinned/chained 표).
- 게이트 + 커밋.

### M2 — 도착 고스트 전용 command (S1·R9)
- `moveTravelEndInDraft(draft, segId, to)` 신설: 끝 waypoint + 그 handle만 평행이동, resmooth 금지,
  hold 보존, receiver 불변. follow possession offset만 링 clamp로 갱신.
- SimplePitch: travel 도착 고스트 orbit → 새 command 라우팅(bendMoveWaypointInDraft 경유 제거).
- `syncTravelReceiverInDraft`: 제스처 경로에서 receiver 재선택 차단(고정 receiverId 옵션).
- 테스트: receive-junction orbit 국소성(비인접 handle·hold·receiverId·타 경로 byte 불변).
- Playwright probe: S1 시나리오(도착 고스트 회전 → 이전 패스 `d` 문자열 불변). 게이트 + 커밋.

### M3 — bend 국소화 (R12-B)
- `bendMoveWaypointInDraft`: 전체 `smoothWaypoints` 교체 → 잡은 점 ±1 이웃만 Catmull 재계산.
  waypoint id·hold·비인접 handle 보존.
- 테스트: bend 후 hold 배열/비인접 handle 완전 동일. 게이트 + 커밋.

### M4 — relayout 단일 pass + 멱등성 (R1·Q4)
- 순서 재배열: 구조 정규화(self-heal·possession trigger) → step timing → **origin anchor를 공용
  resolver로 산출**(`t-0.001` 트릭 폐기) → through-ball constraint → timing 재산출 1회.
- 재진입 제거: command 내부 relayout 호출 정리(commit 지점에서 1회). dead `durs` 제거.
- 테스트: `relayout(relayout(doc)) === relayout(doc)` byte 멱등성, self-heal 선행. 게이트 + 커밋.

### M5 — validator 보강 + threshold 단일화 (R8·R10)
- validateDocument: `carryEnd`/`offset`/`offsetLocked`/`pressures`(길이=points)/`receiverId`·
  `holderId` 참조 검사.
- attach 상수 단일화: 캐리 링 max = commit 반경(semantic 상수 1곳), screen-px slop 분리(D5).
- 테스트: malformed 거부 표, r−ε/r/r+ε 경계 표. 게이트 + 커밋 + CURRENT_STATE/CHANGELOG 갱신.

## Out of scope (명시 보류)

- 2안(BallJunction 스키마) — 1안 검증 후 재발 시(D1).
- R5 pick dispatch 재설계, R12-D letterbox 7px, R12-E receiver tie-break — 위험 항목, 후속.
- GIF 좌표 parity 테스트 — stateAt 공유로 자동 반영(R6 무결 판정).

## Verify

마일스톤마다: `npm run typecheck && npm run lint && npm test && npm run build && npm run harness:verify`
+ M2는 headless Playwright probe. 각 마일스톤 커밋 후 push(위임).

## Ambiguity Register

- 없음 — 감사 보고서 §9의 결정 4개는 ADR-0010 D2~D5로 확정됨.

## Plan Reversal Log

- (없음)
