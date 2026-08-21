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

---

## Amendment D7 — 불변식 B1: 공은 순간이동하지 않는다 (2026-08-22)

Trigger: 사용자 재보고(스크린샷 2장) — "3번 선수의 마지막 시점에 있는 공을 잡아 골대로 드래그했는데
왜 3번의 **첫 시점**에서 공이 나가?" 그리고 "예~전부터 있었던 버그인데 고쳤다고 몇 번을 말해도 꾸준히
생긴다. 이번에 구조적으로 아예 안 나오게 해달라."

### 왜 반복 재발했는가

발사점이 **두 곳에 저장**돼 있었다: 좌표(`travel.path.waypoints[0]`)와 소유 체인(possession + 캐리
규칙). 둘을 맞추는 화해 코드가 다섯 군데(relayout 원점 스냅, 고스트 렌더, `shiftJunctionAnchorsInDraft`,
`moveTravelEndInDraft`, `syncTravelReceiverInDraft`)였고 허용오차(0.75 / 2.6 / 3.5 m)와 샘플링 시각이
제각각이었다. 지금까지의 수정은 매번 그 중 하나였다.

확정된 결함 세 가지 (전부 재현 후 수정):

1. **compile 고정점의 순서 의존.** `heldBallPosAt`이 읽는 `playerPosAt`은 아직 배치되지 않은 세그먼트를
   만나면 그 선수의 **home**을 답한다. 트랙은 문서 순서로 풀리므로 **공 트랙이 수신자 트랙보다 먼저
   만들어진 경우**(패스를 먼저 그리고 그 선수에게 나중에 이동을 그림) travel 스케줄이 home 앵커로
   굳는다. 스케줄은 한 번 만들면 다시 계산되지 않는다 → 영구. **저작 순서 의존이라 간헐적으로 보였고,
   손으로 만든 시나리오로는 계속 빠져나갔다.**
2. **"선수 발밑 공 위치" 공식이 두 개.** `syncTravelReceiverInDraft`는 `수신자.pos + carryOffset`으로
   도착점을 찍는데, `heldBallPos`는 캐리가 있으면 `offset`을 **무시**한다(D2 우선순위). 달려온 수신자에게
   가는 모든 패스에서 저장된 도착점과 실제 정지 위치가 어긋났다.
3. **앵커 단계의 순차 실행.** 도착 앵커 → 원점 앵커 → 스루패스 지연이 순서대로 돌아, 뒤 단계가 앞
   단계의 전제(도착 시각)를 바꿔 앞 단계를 낡게 만들었다.

### Decision

- **D7-a — 불변식 B1.** 공은 한 물체다. 인접한 두 순간 사이에 **자기 속도가 허락하는 거리 이상 움직일 수
  없다.** `src/engine/ballContinuity.ts`가 이 결과를 직접 검사한다 — 특정 resolver의 구현이 아니라
  결과를 보므로 다음 리팩터가 허용오차·에폭·반경을 다 옮겨도 계속 잡는다.
- **D7-b — 앵커는 파생값이다.** 패스의 양 끝은 **`heldBallPos` 하나**로만 만든다. 어떤 호출부도
  `pos + offset`을 직접 조립하지 않는다.
- **D7-c — 앵커·타이밍은 고정점까지 함께 돈다.** 도착 앵커·발사 원점·스루패스 지연은 **하나의 compile을
  공유하는 한 라운드** 안에서 계산하고, 움직인 것이 없을 때까지(최대 4회) 반복한다. 시계와 경로가 서로를
  움직이므로 순차 실행은 원리적으로 낡은 값을 남긴다.
- **D7-d — compile 고정점은 홀더를 기다린다.** travel 스케줄은 홀더 트랙이 전부 배치된 뒤에만 만든다.
  한 라운드가 전혀 진전이 없으면(참조 순환) 대기를 풀어, 교착 대신 기존 동작 + 기존 error issue로
  떨어진다.

### 검증

- `ballContinuity.test.ts` 3종(정지 공에서 그린 패스 / 달리는 중 도착 / 3연속 패스) — 수정 전 전부 FAIL.
- `ballContinuityFuzz.test.ts` — **저작 순서**를 무작위화(시드 LCG). 수정 전 35번째 시드 안에 3건 검출,
  수정 후 **3000세션(최대 11수) 0건**.
- 브라우저 재현(Playwright): 발사점 오차 4.19m → **0.00m**.
- **내장 예시 전술 8개 전부**가 매 캐치마다 2.0~7.04m 순간이동하고 있었다. 수정 후 8개 전부 연속.
  `scenarios.test.ts`의 "도착점이 수신자 중심에서 0.05m 이내" 단언은 **B1을 정면으로 위반하는 단언**이라
  "도착점 = 공의 정지 위치"로 교체했다.

### Consequences

- 패스 도착 화살표 끝은 이제 수신자의 **캐리 지점**(달려온 방향 앞)에 붙는다. 중심점이 아니다 — 중심점에
  붙이면 착지 직후 캐리 resolver가 공을 다시 옮겨 반드시 튄다.
- `relayoutStepsInDraft`의 멱등성은 유지된다(프리셋 바이트 동일성 테스트).
- D1의 조건부 2안(명시적 BallJunction)은 **여전히 미이행**. B1이 재발을 잡아내는 한 불필요하다.
