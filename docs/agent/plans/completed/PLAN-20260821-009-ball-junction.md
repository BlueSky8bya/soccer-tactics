# ExecPlan Archive

Plan ID: PLAN-20260821-009
Status: Completed (2026-08-21 — M1~M5 전체 게이트 PASS(167 tests) + s1_orbit Playwright probe ALL PASS)
Task Risk: L3 (엔진·에디터 구조 변경)
Created: 2026-08-21
Updated: 2026-08-21
Execution Owner: Claude Code

## Objective

Codex 구조 감사(`docs/agent/handoffs/REVIEW-ball-carry-structural.md`)의 **1안(최소 봉합)** 실행.
확정 결함 S1/S3/S5, R1/R2/R9/R12-B/C를 구조적으로 제거한다. 결정 근거는 ADR-0010.

## 고정 결정 (ADR-0010)

D1 1안 실행(2안 조건부) · D2 공용 carry resolver + 경계 연속·핀 통과 · D3 도착 고스트 드래그 중 receiver 고정 ·
D4 스키마 v1 additive · D5 attach threshold 단일 상수 · D6 자기 골든 3종 감사 ±8.

## 완료 Milestones

- M1: 공용 carry resolver와 경계 연속성.
- M2: 도착 고스트 전용 command.
- M3: bend 국소화.
- M4: relayout 단일 pass와 멱등성.
- M5: validator 보강과 threshold 단일화.

세부 구현·검증 증거는 `docs/agent/CURRENT_STATE.md` CHG-112~115와 ADR-0010을 따른다.

## Out of scope

- 2안 BallJunction 스키마 — 동종 결함 재발 시 이행.
- R5 pick dispatch 재설계, R12-D letterbox 7px, R12-E receiver tie-break.
- GIF 좌표 parity 테스트 — stateAt 공유로 자동 반영.

