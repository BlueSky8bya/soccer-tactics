# PLAN-014 M3 — Phase 1 최종 감사 보고

날짜: 2026-08-23 (밤 자율 실행, 사용자 위임 "계획서 내용 차례로 다 해놔")
실행: Claude (Opus 5). 계획: Codex 초안 → Claude 리뷰 → Codex v2 개정.

## 판정: **Core Closure Supported**

근거 (M3 통과 기준 전 항목):

| 기준 | 결과 |
|---|---|
| G0 및 표준 gate PASS | ✅ typecheck/lint/test/build/harness 전부 PASS; `npm test` 전량 3회 연속 + serial 1회 (46 files/316 tests) |
| I1~I10 `SURVIVED` 0 | ✅ 17핀 mutation matrix — [M1 보고](./PLAN-014-M1-mutation-report.md) |
| 6 parity fixture semantic mismatch 0 | ✅ 전 junction Δ=0.0000 — [M2 보고](./PLAN-014-M2-junction-graph.md) |
| 미분류 writer 0 | ✅ authority graph 전 항목 분류 |

**판정의 한계 (계획서 명시)**: 이 판정은 core document/engine/editor 계층에 한한다.
"사용자가 클릭한 대상 = 실제 dispatch", SVG render/hit, 화면 재생 충실도, UX/HCI는
DG-BROWSER 결정 전 `NOT VERIFIED`.

## Gate Ledger (전부 2026-08-23, 이 checkout)

| Gate | 명령 | 결과 |
|---|---|---|
| G0 targeted | `npx vitest run src/ui/AppShell.test.tsx` ×3 | PASS 12/12 ×3 |
| G0 full | `npm test` ×3 | PASS 316/316 ×3 |
| G0 serial | `npx vitest run --maxWorkers=1` | PASS 316/316 |
| Mutation | `npx vitest run src/editor/invariantMutation.test.ts` | PASS 17/17, SURVIVED 0 |
| Core parity | `npx vitest run src/editor/junctionParity.test.ts` | PASS 8/8, Δ=0 |
| tacticFuzz smoke | `npx vitest run src/editor/tacticFuzz.test.ts` | PASS 4/4 (360세션) |
| TypeScript / Lint / Build / Harness | 표준 | 전부 exit 0, warning 0 |
| 브라우저 probe / marathon / 7200 soak | — | **NOT RUN** — Phase 1 비-gate (계획서 명시), DG-BROWSER 미결 |

## G0 Root Cause (한 문장)

vitest jsdom은 `pretendToBeVisual`이라 실-타이머 rAF가 존재하고, suite 부하 중 `await act` 동안
그 타이머가 발화해 빈 보드의 0.2s 재생 범위를 assertion 전에 완주시켜(`holdResult` → `playing:false`)
실패 위치가 실행마다 이동했으며, `afterEach`의 부분 리셋(playScope/rangeEnd/completion/boostFactor 누락)이
이를 증폭했다. 수리: 테스트 전용 프레임 삼킴 큐 + `getInitialState` 전체 리셋 (`AppShell.test.tsx`만 수정,
production 무변경). commit 73cbb00.

## Findings Register (미해결 P0/P1: 0)

| ID | 축 | 심각도 | 증상 | 회귀 방어 |
|---|---|---|---|---|
| F-M1-01 | A | P2 | I2가 내부 waypoint 미검사 (I9 경유 검출) | mutant 핀 `I2b` |
| F-M1-02 | A | P2 | B1 예산 전역 — 극단 segment가 검출 마스킹 | mutant 핀 `budget masking` |
| F-M1-03 | A | P2 | validator가 receiverId 생존성 미검사 | mutant 핀 `deadReceiver` |
| F-M1-04 | A | P2 | 중복 segment id → compile 크래시(issue 아님) | mutant 핀 `duplicate id` |
| F-M2-01 | B | P2 | import/load가 relayout 안 함 — 외부 비-fixed-point 문서는 첫 편집에서 의미 변경 | parity F6 + AMB-06 결정 대기 |
| F-M2-02 | D | P2 | receiver 정확-동률이 players 배열 순서 의존 (R12-E Confirmed) | parity 특성화 핀 |

## D1 권고

**1안(공용 resolver) 유지, 2안(BallJunction 스키마) 비권고.** resolver 1개·우회 0·parity Δ=0으로
2안의 트리거 조건이 하나도 재현되지 않음. 상세: M2 보고 §5.

## 후속 (사용자 결정 대기)

1. **DG-BROWSER**: ① tracked Playwright(권고) ② external harness ③ 생략(NOT VERIFIED 수용).
2. Findings remediation 착수 여부 — 전부 P2, 별도 소형 PLAN 1개로 묶음 가능(예상 0.5일).
3. C 문서 drift / D-static은 결정 없이 착수 가능.

---

# 최종 갱신 (2026-08-23, 전 축 완주)

사용자 지시("계속 이어서 해 끝까지")로 감사 범위를 넘어 **모든 Finding 수정까지 완료**했다.
아래는 감사 시작 이후 최종 상태다.

## 판정

- **Core Closure Verified** — 자동 게이트 전부 PASS, B1 mutation/junction parity PASS, 미해결 P0/P1 0.
- 계층 범위도 확장됨: core(A/B) + 문서(C) + 구조·브라우저(D) + UX 핵심 여정(E-core).
- 남은 `NOT VERIFIED`: 사용자 체감(DELEGATED), E-polish(contrast/CLS/광범위 viewport), 포인터 마라톤.

## Finding 최종 처리 — 7건 전부 Fixed 또는 Rejected

| ID | 심각도 | 처리 | 회귀 방어 |
|---|---|---|---|
| **F-D-01 (R5)** | **P1** | **Fixed** — 호버와 프레스가 `pressSubject` 하나를 공유 | `pickTarget.test.ts` 진리표 전수 + `pw/r5-diagnose.cjs` |
| F-M1-01 | P2 | Fixed — I2가 전 waypoint·handle 검사 | mutant 핀 `I2b` (I9→I2로 재핀) |
| F-M1-02 | P2 | Fixed — B1 예산이 순간별(홀더 기준) | mutant 핀 `budget masking` 반전 |
| F-M1-03 | P2 | **Rejected(오진)** — validator는 dead receiver를 이미 거부. I9가 I10보다 먼저 발화한 순서 문제였음 | `validateDocument` 직접 호출 단언 |
| F-M1-04 | P2 | Fixed — 중복 id는 issue로 보고하고 skip(크래시 제거) | mutant 핀 `duplicateSegmentId` |
| F-M2-01 | P2 | Fixed — 자동저장 복원 시 relayout 통과 | `autosave.test.ts` 2건 |
| F-M2-02 | P2 | Fixed — 수신자 동률은 id로 tie-break | `junctionParity.test.ts` R12-E |
| F-D-02 | P3 | Fixed — probe 비공허성 검사 | `reduced-motion.cjs` |
| F-D-03 | P3 | Fixed — blur가 제스처 취소 | `gesture-cancel.cjs` |

R5는 감사가 존재한 이유 그 자체다: 코어는 완벽히 일관됐지만(Δ=0.0000) **화면이 약속한 것과 손이 한 것이 달랐다.**
core만 봤다면 절대 나오지 않았을 결함이다.

## 구조 위험 최종 disposition

| 항목 | 판정 | 근거 |
|---|---|---|
| R5 pick dispatch | **Resolved** | 단일 `pressSubject`, 스캔라인 mismatch 0 |
| R7 gesture cancel | **Resolved** | blur/pointercancel/Esc 전부 revert, 다음 편집 정상 |
| R12-D 7px hit | **Resolved** | 7 viewport 실측 6~7px, CTM 등방, dead strip 0 |
| R12-E receiver tie | **Resolved** | id tie-break 명문화 |
| S1~S5 / R1~R12 나머지 | PLAN-009에서 Resolved, 본 감사에서 반증 없음 | — |
| D1 2안 | **비권고** | resolver 1, 우회 0, parity Δ=0 |

## 최종 게이트 (2026-08-23)

| Gate | 결과 |
|---|---|
| typecheck / lint / build / harness | 전부 exit 0, warning 0 |
| `npm test` | **324 PASS** (46 files) |
| 브라우저 probe 6종 `node pw/run.cjs` | **102 checks ALL PASS** |
| tacticFuzz 기본(360) + 강화(1800세션) | 위반 0 |
| marathon | NOT RUN (소스 미작성) |

## E-core 결과 (신규)

`pw/ux-core.cjs` 14 checks PASS:
- **E1** 호버가 주어를 약속하고, 벗어나면 철회한다. 너무 짧은 드래그도 침묵하지 않는다.
- **E2** Alt-드래그 1회 = 움직임 1개 = undo 1단계, redo 복원, 주어가 약속과 일치.
- **E3** 화면에 칠해진 공과 시계가 말하는 공이 **정지·재생 중·결과 프레임에서 모두 Δ=0.000m**.
  (초기 측정의 0.64m는 왕복 지연이었다 — 페이지 안 단일 동기 실행으로 재측정해 바로잡음.)
