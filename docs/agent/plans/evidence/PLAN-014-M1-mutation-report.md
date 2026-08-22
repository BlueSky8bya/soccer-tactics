# PLAN-014 M1 — I1~I10 Mutation-kill 결과

실행: 2026-08-23 밤, commit 기준 G0 이후. 명령: `npx vitest run src/editor/invariantMutation.test.ts` (17/17 PASS, 172ms).
suite: [invariantMutation.test.ts](../../../../src/editor/invariantMutation.test.ts) — 모든 분류가 테스트 핀으로 고정되어, detector 지형이 바뀌면 스위트가 붉어진다.

## 판정 매트릭스

| Invariant | Mutant | 결과 | 잡은 detector |
|---|---|---|---|
| I1 compile | danglingTrigger (`afterSegment` → 없는 id) | **KILLED** | I1 |
| I2 finite | 마지막 waypoint NaN | **KILLED** | I2 |
| I2 finite | 내부 waypoint NaN | **MASKED** | I9 (F-M1-01) |
| I3 step 유일성 | 같은 entity·step 중복 segment | **KILLED** | I3 |
| I4 chain 연속 | 토큰 이탈 2.8m / 체인 tear 2.5m | **KILLED** ×2 | I4 |
| I5 B1 연속 | 착지점 3.5m 이동 (resolved tear) | **KILLED** | I5 |
| I6 발사점 | 발사점 3m 이동 (authored tear) | **KILLED** | I6 |
| I7 착지점 | 착지점 3.5m 이동 | **MASKED (구조적)** | I5가 항상 선행 — 두 번째 울타리 |
| I8 flight 비중첩 | 문서 mutation으로 도달 불가 → predicate 단위 검증 | **KILLED(합성)** | I8 predicate |
| I9 멱등성 | home 0.5m 이동 (pre-fixed-point) | **KILLED** | I9 |
| I10 export | pitch.width = -5 | **KILLED** | I10 |
| I10 export | ghost initialHolderId | **검출** | (validator) |

**SURVIVED: 0.** 보조 관찰: sub-tolerance authored tear(1m)·dead receiver·내부 NaN은 전부 I9가 잡는다 — relayout self-heal과 멱등성 검사가 사실상 광역 2차 방어선이다.

## Findings

| ID | 심각도 | 내용 | 재현 |
|---|---|---|---|
| F-M1-01 | P2 | I2가 first/last waypoint만 검사 — 내부 NaN은 I9 경유로만 검출. I2를 전 waypoint로 확장하면 독립 방어가 된다 | mutant `I2b interiorWaypointNaN` |
| F-M1-02 | P2 | B1 예산이 전역: 0.06s segment 하나가 allowance를 1.2m tear 위로 인플레이션 → B1 단독으로는 마스킹. 문서 전체로는 I9가 잡음 | mutant `B1 budget masking` (allowed 0.86m → tear 미검출) |
| F-M1-03 | P2 | validator가 receiverId 생존성 미검사 — dead receiver 저장 파일은 import 후 첫 relayout에서 의미가 바뀜(pass→loose) | mutant `deadReceiver` |
| F-M1-04 | P2 | 중복 segment id는 compile error issue가 아니라 **compile 크래시**(TypeError in `scheduleDuration`) | mutant `duplicate segment id` |

넷 다 detector-계층 개선 후보이며 제품 동작 결함이 아니다(사용자 커맨드로는 재현 경로 미확인). 수정은 감사 후 remediation 계획에서.

## 게이트

- mutation suite 17/17 PASS
- `npx vitest run src/editor/tacticFuzz.test.ts` 기본 campaign 4/4 PASS
- typecheck / lint PASS

부기: 밤 사이 실행 중 머신 절전으로 vitest import 단계가 스톨한 기록(표기 duration 17033s)이 있으나 테스트 자체는 341ms — 환경 이벤트이지 suite 결함이 아님.
