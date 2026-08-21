# Active ExecPlan

Plan ID: PLAN-20260821-011
Status: Completed
Task Risk: L2 (모든 예시 전술의 좌표·경로·단계·타이밍 행동 변경)
Created: 2026-08-21
Updated: 2026-08-21
Execution Owner: Codex

## Objective

현재 제공되는 예시 전술 8개를 전수 감사하고, 현재 Accepted 단일 단계 모델(ADR-0009)에 맞는
선수 위치·공 소유·패스 시점·수비 반응·경로·단계로 다시 저작한다. 예시를 불러와 한 번 편집해도
단계와 타이밍이 붕괴하지 않아야 한다.

## Fixed Decisions

- 예시 수는 8개를 유지한다. 새 기능·새 UI는 추가하지 않는다.
- 정밀 trigger showcase보다 현재 사용자 UI의 1~9 단계 의미와 편집 안정성을 우선한다.
- 같은 단계에서 긴 선수 이동과 짧은 패스를 묶어 공이 비정상적으로 느려지지 않도록 장면을 분절한다.
- 공격 마무리 예시는 골키퍼와 수비 복귀 위치를 포함한다.
- 모든 위치는 105×68m domain 좌표이며 실제 전술 의도가 읽히는 간격을 사용한다.

## Milestones

### M1 — Audit and timing diagnostics

- 8개 예시별 시작 구조, segment/step, compiled time, pass receiver, arrival distance를 표로 확인.
- 현재 모든 path가 implicit step 1인 편집 붕괴 위험을 회귀 테스트로 고정.
- **완료** — 기존 path의 implicit step 1 집중과 relayout 후 타이밍 붕괴 원인을 확인하고 계약 테스트로 고정.

### M2 — Re-author scenarios A–D

- 2v2 패스&압박, 원투&침투, 세 번째 선수, 오버랩/언더랩.
- 전술 의도별 2~4단계, 자연스러운 support/cover 경로, 명시적 step.
- **완료** — 폭 확보→패스→압박 탈출, 원투, 제3자 침투, 오버랩/언더랩을 단계별로 재저작.

### M3 — Re-author scenarios E–H

- 4-3-3 빌드업, 전방 압박, 수비→공격 전환, 컷백.
- 롱볼/압박/컷백 동기화, GK·수비 복귀, 명시적 step.
- **완료** — 빌드업, 압박 트리거, 전환, 컷백의 선수 간격·수비 반응·GK·공 시점을 재저작.

### M4 — Scenario quality contracts

- 모든 authored path에 유효한 step.
- 각 step의 compiled start/end가 `stepWindow`와 일치.
- 모든 수신 패스 도착 시 receiver가 endpoint 근처에 존재.
- pass/shot origin이 release 시 ball position과 일치.
- 좌표/경로가 pitch safety 범위 안이며 compile error가 없음.
- 예시를 `relayoutStepsInDraft` 재실행해도 byte-idempotent.
- **완료** — 5개 전수 회귀 테스트로 step/동기화/좌표/간격/멱등성을 검증.

### M5 — Visual playback acceptance

- 8개 예시를 실제 UI에서 중간/결과 frame으로 캡처해 겹침·텍스트·경로 가독성 확인.
- 자동 재생과 단계 칩이 저작된 단계에 맞게 진행되는지 확인.
- **완료** — 1440×1000 로컬 UI에서 8개 자동 재생의 중간·종료 frame과 단계 칩을 확인. 런타임 오류 없음(개발 서버의 기존 404 리소스 메시지 1건 제외).

## Verification

`npm run typecheck && npm run lint && npm test && npm run build && npm run harness:verify && npm run format:check`

추가로 scenario 전수 테스트와 가능하면 로컬 브라우저 playback probe를 실행한다.

## Ambiguity Register

- “완벽”은 주관적이므로 전술적 개연성, 단계 편집 안정성, 수신 동기화, 화면 가독성을 객관 계약으로 사용한다.
- ADR-0009의 same-step same-end는 유지한다. 실제 이벤트 지연이 필요한 장면은 다음 step으로 분리한다.

## Plan Reversal Log

- 2026-08-21: PLAN-010 장기 로드맵을 parked하고, 사용자 요청에 따라 예시 8개 품질 개선을 우선 실행.
- 2026-08-21: M1~M5 완료. PLAN-010은 별도 parked 문서로 유지하며 자동 재개하지 않는다.
