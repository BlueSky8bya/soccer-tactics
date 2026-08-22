# PLAN-014 M2 — Junction Authority Graph · Core Parity 결과

실행: 2026-08-23. parity suite: [junctionParity.test.ts](../../../../src/editor/junctionParity.test.ts) (8/8 PASS).
정적 그래프: `rg` 전수 + call graph 수동 추적 (production 파일만, test/harness 제외).

## 1. Junction Authority 분류 (읽기/쓰기 그래프)

| 값 | 분류 | Writers (production) | Readers |
|---|---|---|---|
| `ball.home` | authoritative input | commands(formation/fill), SimplePitch 2228(그룹 이동), moveBallStartInDraft | relayout pickup guard, compile, stateAt |
| `initialHolderId` | authoritative input | commands 61/290/298, segmentCommands 204/548, relayout 0단계(dead prune) | resolver hint chain, compile, relayout 구조 self-heal |
| `possessed.offset` | authoritative input (+relayout 재양자화) | segmentCommands 352(수신측 핀), relayout 341 `q()` | heldBallPos 경유만 |
| `offsetLocked` | authoritative input | segmentCommands 353, SimplePitch 845 | heldBallPos 경유만 (compile 507, stateAt 172/227) |
| `move.carryEnd` | authoritative input | **SimplePitch 2051 유일** (orbit-carry 제스처) | carry.ts 67/102 blend, compile/stateAt 전달 |
| travel 첫/끝 waypoint | derived-앵커 (relayout이 소유) | relayout anchor loop(0.25m 스냅), moveTravelEndInDraft, bend | compile LUT, pick, renderer |
| `receiverId` | identity constraint | syncTravelReceiverInDraft 459/460 유일 원천 + relayout 0단계/앵커의 강등(delete) | compile 519, lastReceivedStep, UI |
| `target {entityId, step}` | identity/time constraint | stepCommands 457(런 그리기 시 retarget), SimplePitch 918/1075, relayout 0단계(dead prune) | syncThroughBall(도착시각 동기), 앵커 exempt |
| `carryVecAt→carryAheadFor→heldBallPos` | derived (단일 resolver) | — (순수 함수) | **6 callsite 전부 이 경로**: relayout 323, segmentCommands 473, compile 374/456, stateAt 156/172/227 |
| `pathPresentation/attachedStart` | presentation boundary | UI만 | 렌더러만 — Phase 1 판정 제외 |

**resolver 밖 `playerPos + ballOffset` 직접 조립: 0곳.** BALL_OFFSET을 읽는 모든 지점은 heldBallPos 인자 또는 그 내부 fallback이다.

## 2. Relayout 우회 감사

- 편집 커맨드(stepCommands/commands/segmentCommands 경유 transaction): 전부 내부에서 relayout. 확인된 호출 15곳.
- SimplePitch `core.update` 16곳 중 relayout 미동반 8곳(1534, 2048, 2083, 2089, 2106, 2116, 2221, 2299)은 **전부 드래그 중(pointermove) 미리보기 갱신**. 해당 제스처의 commit 경로(endGestureImpl)는 모두 최종 update에서 relayout 후 commit (854~925, 1066~1082, 1100, 1179~1202, 1264~1267). annotation(1534)은 tactical junction 무관.
- 드래그 중간 상태의 지속화 차단: `startAutosave`의 `if (core.inTransaction) return` (persistence.ts:84).
- **결론: production 도달 가능한 '커밋되는 문서'의 relayout 우회 = 0.**

## 3. Core Parity (6 fixtures + 파생 2)

계약 허용치는 감사 발명이 아니라 파이프라인 자신의 앵커 스냅 임계 0.25m (stepCommands anchor loop `> 0.25`).

| Fixture | travels | max launch Δ | max land Δ | relayout ms |
|---|---|---|---|---|
| F1 초기 소유→첫 패스 | 1 | 0.0000 | 0.0000 | 0.29 |
| F2 달린 수신자에게 패스 | 1 | 0.0000 | 0.0000 | 0.19 |
| F3 through-pass (target 순간 문법, production 경로) | 1 | 0.0000 | 0.0000 | 0.58 |
| F4 수신측 핀 (offsetLocked, UI 드래그 커밋 재현) | 1 | 0.0000 | 0.0000 | 0.15 |
| F5 릴레이 A→B→C | 2 | 0.0000 | 0.0000 | 0.15 |
| F6a 수신 런 삭제 후 | 1 | 0.0000 | 0.0000 | 0.07 |
| F6b 재저작 후 (+save/load/relayout×2 byte 동일) | 1 | 0.0000 | 0.0000 | 0.08 |

추가 계약 전부 PASS: violation() null(=I9 멱등·I10 round-trip 포함), compile 결정론, stateAt 재샘플 결정론, F3 도착시각=target 런 종료(±10ms), F5 flight 직렬성, 소유는 travel 직후 possessed.holderId 구조 검증.

- 외부 relayout 추가 적용 횟수: 전 fixture 0 (커맨드가 남긴 문서는 이미 byte fixed-point).
- fixed-point cap(8round) 도달 여부는 외부에서 관측 불가 — 계측 훅은 production 수정이라 Phase 1 비범위. 외부 계약(1회 적용 = fixed point)은 전 fixture + fuzz I9로 검증됨.

## 4. Findings

| ID | 심각도 | 내용 | 증거 |
|---|---|---|---|
| F-M2-01 | P2 | **import/load는 relayout하지 않는다** (persistence.parseDocument = validate만). 이 앱이 저장한 문서는 커밋 시점에 이미 fixed-point라 안전하나, 외부/구버전/수정된 JSON이 validator를 통과하면 비-fixed-point로 로드되고 **첫 편집에서 기하가 소리 없이 재작성**된다. F-M1-03(dead receiver 저장 파일)과 결합 시 import 직후와 첫 편집 후 의미가 다름 | persistence.ts:44-57, M1 mutant deadReceiver |
| F-M2-02 | P2 | **receiver 동률은 players 배열 순서로 결정** (stable sort, syncTravelReceiverInDraft:430-432). 정확 동률에서 배열 반전 시 수신자 반전 — R12-E 확인. 실문서에서 float 정확 동률은 드물고 배열 순서는 save/load에 안정적이므로 P2 | parity suite R12-E 특성화 핀 |

## 5. D1 권고

**1안(공용 resolver) 유지. 2안(BallJunction 스키마) 비권고.** 근거:
- semantic junction resolver 수 = 1 (heldBallPos), 우회 조립 0, 커밋 문서의 relayout 우회 0, 전 fixture parity Δ=0.
- 2안 트리거 조건(계획서 M2·4절) 중 어느 것도 재현되지 않음: selection-dependent geometry(코어 계층엔 해당 없음), import 후 의미 변경(F-M2-01은 relayout-on-import 또는 거부로 해결 가능 — 스키마 불필요), dual-write(0), parity 실패(0).
- 남은 위험은 detector 계층(F-M1-01/02/04)과 import 정책(F-M2-01)이며 둘 다 스키마 변경 없이 remediation 가능.
