# REVIEW — Ball Carry / Junction Structural Audit

- 작성일: 2026-08-21
- 역할: 구조 감사(정적 검증만)
- 범위: ADR-0009 v4/v5, CHG-077~107, 지정된 엔진·에디터·UI·내보내기·영속화 코드와 관련 테스트
- 코드 변경: 없음
- 실행 검증: **NOT RUN** — 이 문서는 실행 결과가 아니라 현재 소스의 제어·데이터 흐름을 추적한 근본 원인 보고서다.
- 기준 테스트 수: CHANGELOG가 마지막으로 기록한 **159개**. 이 감사에서 그 통과 여부를 재주장하지 않는다.

## 0. 결론

제보된 결함군은 대체로 한 뿌리라는 가설이 맞다. 다만 뿌리는 하나의 함수가 아니라 다음 두 구조가 결합한 것이다.

1. **공 정션 위치의 쓰기 주체가 넷이다.** `possessed.offset(+offsetLocked)`, travel 끝점/`receiverId`, `move.carryEnd`, `stateAt`의 전방 캐리 규칙이 동일한 시각·위치를 서로 다른 우선순위로 해석한다. 여기에 `compile`이 travel 원점을 다시 덮어쓰고 `relayoutStepsInDraft`가 authored 원점을 또 고쳐 사실상 여섯 번째·일곱 번째 해석이 생긴다.
2. **도착 고스트의 의미와 편집 primitive가 다르다.** UI 의미는 “수신 정션의 공 위치 조정”인데 실제 명령은 일반 경로 bend다. 따라서 끝점 하나를 움직여도 전체 Catmull-Rom handle을 재생성하고, 정션 팔로우·relayout·수신자 재해석이 연쇄 실행된다.

현재 코드에서 가장 큰 미해결 결함은 세 가지다.

- 선택한 travel 도착 고스트를 돌리면 여전히 `bendMoveWaypointInDraft`를 거쳐 패스 곡률과 `hold`를 바꿀 수 있다(S1).
- relayout의 authored 원점과 compile의 재생 원점이 서로 다른 carry 규칙을 사용한다(S3/R2).
- 꺾이는 연속 드리블 또는 `carryEnd`가 있는 중간 정션은 정확한 단계 경계에서 공이 순간 이동한다(S5/R12-A). 기존 테스트는 같은 방향 연속 달리기만 검사한다.

권고 판정은 **정석안(2안) 채택**, 단 1안으로 먼저 결함을 봉합한 뒤 2안으로 이행하는 2단계 접근이다. 기존 패치를 하나 더 겹치는 방식으로는 `relayoutStepsInDraft`의 순서 의존성과 정션 진실 분산을 없앨 수 없다.

---

## 1. 현재 데이터/제어 흐름과 진실 충돌

### 1.1 작성부터 렌더까지

1. 포인터 press는 기하 후보를 만들지만, 실제 dispatch는 전체 1위가 아니라 `ghostTop`, `segTop`, `tokenEntityId`의 boolean 조합을 `resolvePointerIntent`에 넘긴다 (`SimplePitch.tsx:832-868`).
2. 도착 고스트는 `adjust-ghost-end`가 되고, travel이면 bend gesture가 생성된다 (`SimplePitch.tsx:888-936`).
3. drag 중 `bendMoveWaypointInDraft`가 전체 waypoint handle을 재생성한다 (`SimplePitch.tsx:1056-1080`, `stepCommands.ts:364-385`).
4. pointerup에서 `relayoutStepsInDraft` 후 `resolvePassReceiverInDraft`를 호출하고, 후자는 다시 relayout한다 (`SimplePitch.tsx:488-507`, `stepCommands.ts:286-316`).
5. relayout은 단계 timing 산출 → authored pass 원점 스냅 → timing 재산출 → 스루볼 보정 → possession 자가치유/시각 재배치 순으로 실행된다 (`stepCommands.ts:53-198`).
6. compile은 별도로 travel path의 첫 점을 “발사 시각의 선수 중심 + 직전 possession offset”으로 교체한다 (`compile.ts:327-343`).
7. stateAt은 active move/standing move의 전방 캐리 또는 `carryEnd`를 적용한다 (`stateAt.ts:98-171`, `199-216`).
8. 선택된 패스만 `deriveAttachedPathStart`가 compiled 첫 점을 presentation copy에 주입한다 (`pathPresentation.ts:21-48`); 비선택 경로와 pick polyline은 authored path를 쓴다 (`SimplePitch.tsx:1190-1203`, `1346`, `1667`).

즉, 동일 원점이 **문서·선택 렌더·비선택 렌더·pick·재생**에서 서로 달라질 수 있다.

### 1.2 Q1 — “정션에서 공이 어디 있는가” 충돌 전수

| 진실 후보 | 쓰는 곳 | 우선/효력 | 충돌 |
|---|---|---|---|
| `ball.home` + `initialHolderId` | 초기 상태와 live-ball 이동 | ball track 전/부재 시 | 초기점만이어야 하나 `addStepPass`가 후속 possession offset을 전역 home에서 유도한다 (`stepCommands.ts:250-265`). |
| `possessed.offset` | compile·stateAt | 기본 side carry | compile travel release가 언제나 이 값을 사용한다 (`compile.ts:331-339`). active/standing `stateAt`은 앞쪽 carry로 덮을 수 있다 (`stateAt.ts:199-216`). |
| `possessed.offsetLocked` | stateAt active possession | 서 있을 때만 offset 우선 | possession 종료 뒤 경로에서는 인자를 누락해 잠금이 사라진다 (`stateAt.ts:286-294`). receiver 재해석도 기존 flag를 지우지 않는다 (`segmentCommands.ts:390-400`). |
| travel 끝점 + `receiverId`/`recvOffset` | 수신 위치와 follow possession | 수신 명령이 2.0~2.6m 링으로 스냅 | travel 뒤 follow possession이 없으면 stateAt은 끝점/recvOffset 대신 `BALL_OFFSET`을 쓴다 (`stateAt.ts:272-284`). |
| `move.carryEnd` | 해당 run 마지막 0.35초와 정지 뒤 | junction-local pin | 다음 run이 정확히 시작하면 `chainIn`이 ramp를 1로 강제해 이전 pin을 즉시 버린다 (`stateAt.ts:109-138`). |
| v3 전방 캐리 1.9m | 움직임/마지막 run 뒤 | derived default | compile release는 이를 모르고 possession offset을 쓴다 (`compile.ts:327-343`). |
| authored travel 첫 waypoint | 정적 경로/pick | relayout이 `t-0.001` stateAt로 수정 | timing을 바꾼 뒤 재샘플하지 않으며 compile이 다시 다른 값으로 덮는다 (`stepCommands.ts:82-129`). |
| compiled travel 첫 point | 재생과 선택된 경로 presentation | possession offset 기반 | `deriveAttachedPathStart`가 선택된 패스에만 적용돼 선택 여부가 화면 기하를 바꾼다 (`pathPresentation.ts:21-48`). |

#### 단일 소스 모델 비교

| 안 | 모델 | 장점 | 단점/위험 | 판정 |
|---|---|---|---|---|
| A. 엔진 파생 + 기존 필드 우선순위 표 | pure helper 하나가 `carryEnd > pinned offset > heading-ahead > default`를 해석하고 compile/stateAt/editor가 모두 호출 | 스키마 변경 없이 빠른 봉합 | `carryEnd`, offset, travel 끝점이라는 중복 저작값은 남음 | **최소안에 적합** |
| B. 엔진 파생 + 저작값은 `junction.pin` 하나 | 공 정션의 player/time/derived vector를 엔진이 계산하고 사용자가 돌린 경우에만 하나의 pin 저장 | 진실과 gesture 의미가 일치, compile/stateAt/render 공용 | additive schema와 구필드 read migration 필요 | **권고** |
| C. 모든 공 위치를 authored waypoint로 고정 | 화면과 재생이 항상 같은 문서 좌표 | 단순해 보임 | 선수 경로/timing 변경 때 모든 anchor를 연쇄 mutate해야 하고 결정적 파생의 장점을 잃음 | **반려** |

---

## 2. 제보 증상 S 판정

| 항목 | 판정 | 정적 근거 | 근본 원인 |
|---|---|---|---|
| S1 도착 고스트 회전이 이전 패스 곡률 변경 | **문제확정** | travel 도착 고스트가 bend로 생성되고 (`SimplePitch.tsx:911-936`), 매 move마다 `bendMoveWaypointInDraft` 호출 (`SimplePitch.tsx:1056-1080`). 이 함수는 점 하나가 아니라 전체 `smoothWaypoints` 결과로 교체 (`stepCommands.ts:364-385`). | 정션 조정과 경로 bend의 primitive 혼용. `smoothWaypoints`는 모든 handle을 다시 만들고 `hold`도 버린다 (`path.ts:155-182`, `types.ts:200-207`). |
| S2 중간 정션 고스트 회전 시 처음/끝 공 이동 | **현재 경로는 무결, 경계 재생은 문제** | carried ghost는 run path를 bend하지 않고 해당 move의 `carryEnd`만 쓴다 (`SimplePitch.tsx:895-909`, `1036-1046`). 따라서 CHG-107의 “문서의 다른 anchor 불변”은 성립. 단, 다음 run 시작 시 pin이 즉시 무시된다 (`stateAt.ts:109-138`). | 저장 위치 분리는 성공했으나 engine 경계 보간 계약이 미완성. |
| S3 패스 원점 화면≠애니메이션 | **문제확정** | relayout은 `stateAt(t-0.001).ball.pos`를 authored 원점에 씀 (`stepCommands.ts:82-108`), compile은 선수 중심 + 직전 possession offset으로 다시 교체 (`compile.ts:327-343`). 선택된 경로만 compiled 원점을 표시 (`pathPresentation.ts:21-48`). | 원점 계산기가 둘이고 carry precedence가 다름. CHG-104/106은 writer를 교체하지 않고 추가함. |
| S4 정확히 2.6m에서 소유 소실/t0 발사 | **현재 경로는 무결** | drop 판정은 `<=2.7`, carry는 `[2.0,2.6]` clamp (`SimplePitch.tsx:536-555`, `compile.ts:27-33`). `moveBallStartInDraft`는 첫 possession을 유지/갱신 (`segmentCommands.ts:560-588`), relayout self-heal도 존재 (`stepCommands.ts:162-180`). | CHG-105 봉합은 현재 2.6m 사례를 막는다. 다만 2.6/2.7/3.4/3.5 분산은 R10으로 남음. |
| S5 단계 경계 드리블 점프 | **문제확정(부분 재현군 미테스트)** | 동일 방향·pin 없는 chain은 테스트됨 (`dribble.test.ts:62-111`). 그러나 다음 move의 `chainIn`은 ramp=1이고 이전 carry는 `from`에만 넣어 즉시 소거 (`stateAt.ts:109-138`). 방향 전환 또는 `carryEnd`가 있으면 경계에서 vector가 바뀐다. | “연속이면 항상 전방” 규칙이 “정션 pin/방향 전환을 통과” 규칙과 충돌. |

### 수치 반증 예

- S3/R2: +x로 끝난 run의 derived carry는 `(1.9, 0)`, 기본 possession offset은 `(1.75, 1.15)`이다. 동일 player center에서도 원점 차이는 `sqrt(0.15²+1.15²) ≈ 1.16m`이다.
- S5: +x run 끝 `carryEnd=(0,2.6)`에서 다음 +x run이 시작하면 `t=end-ε`에는 `(0,2.6)`에 수렴하지만 `t=end`에는 `(1.9,0)`이 된다. 공이 한 프레임에 약 `3.22m` 이동한다.
- 방향 전환: pin이 없어도 +x 전방 `(1.9,0)`에서 +y 전방 `(0,1.9)`로 즉시 바뀌어 약 `2.69m` 점프한다.

### 2.1 증상 → 원인 매핑

| 증상 | 직접 원인 | 구조 원인 | 관련 패치가 남긴 한계 |
|---|---|---|---|
| S1 곡률 변경 | travel ghost가 일반 bend command 사용 | 정션 편집과 path 편집의 command 미분리 | CHG-104가 orbit 제약은 추가했지만 bend primitive는 유지 |
| S2 다른 정션 이동 | 과거에는 run endpoint/path를 함께 이동; 현재 문서 mutation은 분리됨 | carry pin의 저장과 경계 재생 의미가 분리 | CHG-107은 write scope만 고쳤고 다음 chain에서 pin을 통과시키지 않음 |
| S3 화면/재생 원점 불일치 | relayout `t-0.001`과 compile possession offset의 계산 차이 | release anchor 소유자가 둘 | CHG-104→106이 원점 보정 위치를 옮겼지만 compile writer를 제거하지 않음 |
| S4 2.6m 소유 소실 | 과거 mid-drag holder 제거/첫 possession 단절 | attach/carry/receive 반경과 chain 복구가 분산 | CHG-105가 정확 사례는 봉합했으나 2.7/3.4/3.5 경계는 남음 |
| S5 경계 점프 | chainIn이 다음 vector를 즉시 100% 적용 | 정션 state가 명시되지 않고 전후 segment에서 각자 파생 | CHG-098/102/105는 같은 방향 chain을, CHG-107은 pin 저장을 고쳤지만 두 규칙의 합성은 미검증 |

---

## 3. 유추 위험 영역 R 판정

| 항목 | 판정 | 근거와 반증 결과 |
|---|---|---|
| R1 bend 정션-follow와 relayout 원점 스냅 이중 변형 | **문제확정** | bend endpoint가 근접한 후속 원점을 먼저 translate (`stepCommands.ts:407-442`), commit relayout이 이를 stateAt 위치로 다시 overwrite (`SimplePitch.tsx:497-506`, `stepCommands.ts:82-108`). 원점 이동으로 길이/timing이 바뀌면 timing만 두 번째로 계산하고 원점은 다시 샘플하지 않는다 (`stepCommands.ts:111-129`). 동일 입력의 writer가 둘이며 단일 pass 수렴 보장이 없다. |
| R2 같은 단계 run+pass 발사 원점 | **문제확정(조건부)** | ADR 단계 모델상 첫 run과 pass는 “달리는 중”이 아니라 동일 step 시작에 발사한다 (`stepCommands.ts:60-80`). 첫 run은 ramp 0이라 대체로 맞는다. 그러나 이전 run에서 이어진 holder가 다음 step에서 run+pass를 같이 시작하면 relayout의 `t-0.001`은 이전 전방/pin, compile은 side offset을 사용해 최대 수 m 차이 (`stateAt.ts:109-171`, `compile.ts:327-343`). |
| R3 3.0m 스루볼 허용치와 2.6/1.9/pin 정합 | **무결(수치 범위만)** | receiver ring 최대 2.6, derived ahead 1.9, `carryEnd`도 UI에서 `carryOffset`을 거쳐 2.0~2.6 (`compile.ts:27-33`, `SimplePitch.tsx:1036-1046`). 따라서 center 기준 `<=3.0` 매칭 범위 안이다 (`stepCommands.ts:145-157`). 단, 3.0m 범위 내 다른 run을 고르는 identity 문제는 R9/Q4에 존재. |
| R4 `stateAt(t±ε)` 경계 샘플링 | **문제확정** | engine은 `t===end`를 다음/종료 상태로 분류 (`stateAt.ts:56-67`). UI는 `end+0.05`로 orbit center/settle, `end-0.05`로 holder, `[-0.02,+0.15]`로 relay를 판별 (`SimplePitch.tsx:917-920`, `1221-1261`, `1435-1448`). 0.05초보다 짧은 segment나 같은 시각의 다음 travel이면 샘플이 이웃 segment를 건너뛴다. 정션 identity 대신 시간 휴리스틱을 사용한 것이 문제다. |
| R5 pick hit 계약 vs 도착 고스트/경로 | **문제확정, S1의 직접 원인은 아님** | scorer는 sticky→step→거리→key로 전체 후보를 정렬 (`pickTarget.ts:115-185`). 그러나 press는 `ordered[0]`이 아니라 ghost/segment 각 top을 boolean으로 넘기고, intent는 ghost를 무조건 먼저 처리 (`SimplePitch.tsx:832-868`, `gestureIntent.ts:56-66`). 선택된 path가 global 1위여도 겹친 ghost가 있으면 ghost action이다. 도착 ghost가 선택되는 것 자체보다 그 action이 bend인 것이 S1 직접 원인이다. |
| R6 GIF 패리티 | **무결(전술 좌표)** | GIF와 보드 playback 모두 같은 `compile`/`stateAt`을 사용 (`exportGif.ts:126-213`, `224-244`; `SimplePitch.tsx:1515-1518`). 따라서 carryEnd/v3/offsetLocked는 동일하게 반영되며, stateAt의 버그도 동일하다. transient UI fling과 장식 FX는 문서 timeline이 아니므로 GIF에 없는 것이 현재 계약이다 (`SimplePitch.tsx:532-588`). |
| R7 undo/redo·cancel | **위험** | 정상 pointercancel/Esc는 `core.cancel()`을 호출하고 gesture를 먼저 null 처리해 이중 commit은 막는다 (`SimplePitch.tsx:385-419`, `488-520`, `675-684`, `1176-1179`). `EditorCore` cancel도 before를 복구 (`editorCore.ts:136-165`). 그러나 window blur는 draw-key만 지우며 active gesture를 cancel하지 않고, `lostpointercapture`/unmount cleanup이 없다 (`SimplePitch.tsx:660-684`, `1561-1574`). component/core 교체 중 열린 transaction 잔류 위험은 정적으로 배제할 수 없다. |
| R8 pressures/offsetLocked/carryEnd persistence·validation | **문제확정** | JSON 직렬화는 optional field를 그대로 왕복하고 schemaVersion은 여전히 1이라 구문서 누락은 허용 (`types.ts:9`, `persistence.ts:28-49`). 반면 validator는 freehand `pressures`, waypoint handles/hold, move `carryEnd`, possessed `offset/offsetLocked`, holder/receiver 참조를 검사하지 않는다 (`validateDocument.ts:64-98`, `122-159`). 잘못된 Vec2/string flag가 parse를 통과해 NaN/오염을 만들 수 있다. |
| R9 preserveEndDirection 수신자 탈취 | **문제확정** | 수신자는 endpoint에 가장 가까운 non-passer를 3.5m 안에서 매번 재선택하고 (`segmentCommands.ts:323-330`), `preserveEndDirection`은 그 뒤 offset 방향만 보존 (`337-355`). 원래 receiver 링을 돌리는 중 다른 선수가 더 가까워지면 receiverId와 follow possession holder가 바뀐다 (`356-409`). |
| R10 fling/attach/carry 반경 분산 | **문제확정** | carry ring 2.0~2.6 (`compile.ts:27-33`), drop attach 2.7 (`SimplePitch.tsx:536-555`, `1161-1165`), live orbit UX 3.4 (`1146-1154`), travel receive 3.5 (`segmentCommands.ts:304-329`). `2.6<d<=2.7`은 attach 후 2.6으로 snap, `2.7<d<=3.4`는 drag 중 ring처럼 보이다 drop하면 loose/fling이다. 경계 promise가 서로 다르다. |
| R11 파생 표시층의 side-offset 상수 | **위험** | arrival arc는 trim 1.15, guard 4.2/3.6, next-tail 0.55와 `end+0.05`를 조합 (`SimplePitch.tsx:1233-1277`); carried ghost는 `end-0.05/+0.05` 샘플 (`1435-1448`). 현재 1.9~2.6 값은 guard 안이라 단순 범위 파손은 없지만 semantic token과 연결되지 않아 pin/짧은 relay/즉시 다음 pass에서 누락될 수 있다. 배지 obstacle 2.6과 실제 표시 반경도 별도 상수다. |
| R12-A 꺾이는 chain/carryEnd 경계 | **문제확정** | S5 수치 반증과 동일. 기존 chain test는 같은 +x 방향, carryEnd 없음만 검사 (`dribble.test.ts:80-110`). |
| R12-B bend가 waypoint hold 삭제 | **문제확정** | `Waypoint.hold`는 domain/compile에서 의미가 있으나 (`types.ts:200-207`, `compile.ts:104-140`), `smoothWaypoints`는 id/p/handle만 새로 만들고 (`path.ts:155-182`), bend는 전체 배열을 그것으로 교체한다 (`stepCommands.ts:378-382`). 어느 점이든 bend하면 모든 hold가 사라진다. |
| R12-C offsetLocked 수명 불일치 | **문제확정** | active possessed에는 lock을 넘기지만 (`stateAt.ts:228-240`), lastEnded possessed에는 넘기지 않는다 (`286-294`). 기존 follow possession의 receiver/offset을 바꿀 때 lock을 clear/set하지 않는다 (`segmentCommands.ts:390-400`). 같은 필드가 segment 활성 여부에 따라 다른 결과를 낸다. |
| R12-D 화면 scale과 path hit 7px | **위험** | pointer 좌표는 SVG CTM을 쓰지만 pick tolerance의 metresPerPixel은 bounding width만으로 계산 (`SimplePitch.tsx:1514-1533`). aspect-ratio letterbox/세로 제한에서 실제 SVG scale이 height 기준이면 7px 계약이 깨질 수 있다. 단위 테스트는 고정 mpp만 검사 (`pickTarget.test.ts:99-115`). |
| R12-E receiver 동률 비결정 의미 | **위험** | 후보는 distance만 sort하며 stable id tie-break가 없다 (`segmentCommands.ts:323-330`). 현대 JS sort는 stable이라 문서 player 배열 순서에는 결정적이지만, 전술 의미가 없는 배열 순서가 receiver를 결정하고 candidate set도 현재→home→모든 ghost→final 순으로 조기 종료한다 (`stepCommands.ts:283-313`). |

---

## 4. Q2 — 포인터 계약 표

원칙: press가 선택한 **의미 객체**와 drag가 수정하는 **문서 필드**를 1:1로 만든다. 후보 scoring은 “무엇을 잡았는가”, command는 “무엇만 변하는가”를 책임져야 한다.

| 잡는 대상 | 변해야 하는 것 | 절대 변하면 안 되는 것 | 현재 위반 | 제안 command |
|---|---|---|---|---|
| 라이브 공 | 초기 공 위치/초기 보유자/첫 발사 정션(저작 시작점) | 후속 수신 정션, 모든 후속 pass 곡률, 다른 player | 첫 path origin까지 이동하는 것은 계약상 필요하나, 3.4 drag promise와 2.7 commit 판정이 다름 (`SimplePitch.tsx:1146-1169`, `527-555`). | `moveInitialBallJunction(to, attachCandidate)`; attach threshold 한 상수 사용. |
| 캐리 고스트(run 끝 공) | 해당 junction의 사용자 pin 하나 | run path, 다른 junction, 처음/최종 공, receiver | 문서 mutation은 현재 `carryEnd`만이라 양호 (`1036-1046`). 단 4px threshold가 없어 미세 pointermove도 pin 생성, engine은 다음 chain 경계에서 pin을 무시. | `setJunctionPin(junctionId, offset)`; bend와 동일 drag threshold, 경계 state가 pin을 통과. |
| 도착 고스트(travel 끝 공) | 해당 receive junction pin/표시 끝점 | 이전 패스의 비인접 handle·hold, receiver identity(명시 reattach 전), 다음 pass 목적지 | 전체 resmooth, receiver 재선택, 근접 후속 origin translate (`stepCommands.ts:364-385`, `segmentCommands.ts:323-409`). | `setReceiveJunctionPin(travelId, receiverId, offset)`; endpoint와 그 endpoint handle만 translate, receiver 고정. 별도 “수신자 다시 연결” command만 identity 변경. |
| 경로 선 | grab 지점 근방의 waypoint와 인접 handle | endpoint/정션(끝점 handle을 명시 잡지 않은 경우), hold, receiver, 비인접 곡률 | endpoint 1.2m 내 press는 기존 endpoint를 재사용할 수 있고 전체 resmooth (`stepCommands.ts:318-382`). | `bendPathLocal(segmentId, arcPosition, to)`; endpoint exclusion zone 또는 endpoint 전용 intent. |
| 웨이포인트 | 그 점과 C1 유지에 필요한 양옆 handle | 다른 waypoint의 hold/수동 handle, entity identity, step | UI에 독립 target은 없고 일반 bend가 전체 handle/hold를 교체. | `moveWaypointLocal`; 기존 metadata preserve. |
| 선수 토큰 | 선수 home, 선택 그룹의 동일 delta, 명시적으로 소유한 정션 anchor | 선택되지 않은 선수/공, 무관한 공간 근접 anchor, 패스 목적지 | `shiftBallAnchorsForPlayerInDraft`는 시간/junction id 없이 receiver/직전 possession만 보고 전부 이동 (`segmentCommands.ts:517-543`); commit relayout이 다른 pass 원점까지 self-heal 가능. | `translateEntities(ids, delta)` + 정션 graph의 소유 edge만 translate. |

### hit/dispatch 수정 원칙

- `pickTargets().ordered[0]`를 canonical press target으로 사용한다. 단 possession pair와 ghost-yield는 후보를 제거/치환하는 전처리로 표현한다.
- 도착 고스트와 그 밑 path가 겹칠 때는 명시된 kind priority 또는 endpoint semantic target을 score tuple에 넣는다. 현재처럼 global rank를 계산한 뒤 kind별 boolean으로 다시 우선순위를 덮지 않는다.
- DOM 예외는 step picker/badge처럼 실제 focusable control에만 유지한다 (`SimplePitch.tsx:763-766`, badge 자체 handler `1695`, picker handler `1878`). SVG geometry를 DOM paint order로 되돌리지 않는다.

---

## 5. Q3 — 전체 재스무딩을 국소 변형으로 바꿀 때의 소비자

`smoothWaypoints`의 Catmull-Rom 식상 점 `i` 이동은 실질적으로 `i-1`, `i`, `i+1`의 handle에만 영향을 주면 충분하다 (`path.ts:163-179`). 국소화 시 다음 소비자를 함께 검증해야 한다.

| 소비자 | 의존 내용 | 국소화 시 요구 |
|---|---|---|
| `buildPathLUT`/compile schedule | handle로 곡선 길이·waypoint 도착 시각 계산 (`path.ts:35-78`, `compile.ts:104-140`) | 수정 후 timing relayout 1회. `hold` 보존 및 waypointT 유지 검증. |
| stateAt/GIF | compiled LUT 위치 (`stateAt.ts:242-255`, `exportGif.ts:168-212`) | 같은 문서/시각의 보드-GIF 좌표 동일. |
| PathLayer | `pathToSvgD` handle (`path.ts:185-201`) | 비인접 SVG subpath 문자열/제어점 불변. |
| pick/hover | sampled authored path (`SimplePitch.tsx:1190-1203`, `pickTarget.ts:152-163`) | 렌더와 pick가 동일 국소 geometry 사용. |
| receiver approach | waypoint 좌표를 뒤에서 탐색하며 handle/tangent를 보지 않음 (`segmentCommands.ts:342-355`) | 곡선의 실제 도착 tangent와 waypoint chord가 어긋나는 기존 문제를 함께 고치거나 명시적으로 유지. 권고는 LUT endpoint tangent 사용. |
| junction follow | endpoint와 handle translate (`stepCommands.ts:393-442`) | endpoint drag일 때만 실행. interior bend는 junction graph 불변. |
| selected attached-start | 첫 waypoint presentation delta (`pathPresentation.ts:51-66`) | 첫 waypoint가 locked일 때 bend insertion/이동 금지. |

폐기하면 안 되는 속성은 waypoint `id`, `hold`, 비인접 `handleIn/Out`이다. 자동 생성 handle과 향후 수동 handle을 구분할 필드가 없으므로 최소안은 “인접 세 점만 Catmull 재계산”, 정석안은 handle provenance(`auto|manual`)의 additive 도입을 검토한다.

---

## 6. Q4 — `relayoutStepsInDraft` 순서·재진입·수렴성

### 6.1 현재 순서와 부작용

| 순서 | 단계 | 입력/쓰기 | 문제 |
|---:|---|---|---|
| 1 | authored path step timing | 모든 authored path → trigger/timing | `durs` map은 쓰이지 않음 (`stepCommands.ts:66-80`). |
| 2 | compile + origin snap | 현재 timing → 모든 travel 첫점 | compile은 다른 release 규칙; 0.25m 이하 오차는 의도적으로 남김 (`82-110`). |
| 3 | timing 재유도 | 원점 이동 후 길이 → trigger/timing | 새 timing이 launch state를 바꿔도 origin 재샘플 없음 (`111-129`). |
| 4 | through-ball sync | receiver의 아무 run 끝과 3m 근접 | step/time identity 없이 첫 공간 매치에서 break; 이후 step 경계는 재배치하지 않음 (`132-160`). |
| 5 | self-heal possession | 첫 path 앞 segment 부재 | timing/origin 계산 후 구조를 바꿈; 새 possession을 반영한 재compile 없음 (`162-180`). |
| 6 | possession absolute trigger 조정 | 다음 path 시각 | 역시 재compile 없음 (`183-198`). |

### 6.2 재진입 경로

- `addStepPass`: relayout → `resolvePassReceiverInDraft` → relayout (`stepCommands.ts:246-279`, `286-316`).
- bend travel commit: relayout → receiver resolve → relayout (`SimplePitch.tsx:497-506`).
- `addStepRun`: relayout 후 receiverless pass들을 돌며 각 resolve마다 relayout (`stepCommands.ts:202-234`). loop 중 전역 timing/path가 계속 변한다.

### 6.3 판정

- **순서 의존성: 문제확정.** 구조 self-heal과 possession trigger 조정이 compile/origin 산출 뒤에 있다.
- **재진입: 문제확정.** command 내부에서 relayout을 호출하고 caller도 호출한다.
- **멱등성/수렴성: 보장 없음.** fixed-point loop도, `relayout(relayout(doc))===relayout(doc)` 테스트도 없다. origin 이동 → 길이 → step duration → 이후 launch state → origin의 순환이 가능하다.

### 6.4 권고 파이프라인

1. 구조 정규화(self-heal/참조 정리)를 먼저, 한 번만 한다.
2. step graph로 start/end를 계산한다.
3. junction resolver가 player/ball anchor를 계산한다.
4. authored pin만 적용하고 path schedule을 만든다.
5. through-ball은 공간 3m 탐색이 아니라 명시 receiver + 관련 run/step identity로 arrival constraint를 건다.
6. constraint 결과로 timing을 한 번 재계산한다.
7. debug/test에서 두 번째 실행의 byte equality를 단언한다. production에서 무제한 fixed-point loop를 두지 않는다.

---

## 7. 재설계안

## 7.1 1안 — 최소 봉합(스키마 v1 유지)

### 변경 개념

1. pure engine helper `resolveHeldBallPosition(playerSchedule, possession, moveCarry, t, boundarySide)`를 만들고 compile travel release와 stateAt이 공유한다.
2. travel 도착 고스트는 `bendMoveWaypointInDraft`에서 분리해 endpoint + 해당 endpoint handle만 평행 이동한다. receiverId는 gesture 시작 시 고정하고, 해당 follow possession offset만 갱신한다.
3. chain 경계에서 이전 `carryEnd`/이전 heading vector와 다음 heading vector를 시간 연속적으로 보간한다. 정확한 boundary 값은 정션 pin(있으면 pin, 없으면 명시된 연속 규칙) 하나로 정한다.
4. relayout을 구조 정규화→timing→anchor→constraint 순으로 재배열하고 command당 1회만 호출한다.
5. validation에 optional field shape/reference를 추가한다. schema version은 바꾸지 않는다.

### 폐기/대체되는 패치

| CHG | 처리 |
|---|---|
| CHG-104의 travel ghost orbit→일반 bend | **폐기**, 전용 receive-junction command로 대체 |
| CHG-105의 relayout self-heal 위치/다중 경계 봉합 | 기능은 유지하되 relayout 앞단 normalizer로 이동 |
| CHG-106의 `t-0.001` authored origin 스냅 | **폐기**, 공용 engine anchor resolver 결과 사용 |
| CHG-107의 `move.carryEnd` | 필드는 유지하되 공용 resolver precedence와 boundary continuity를 명문화 |
| CHG-077/078의 거리 기반 anchor follow | 최소안에서는 유지하되 temporal/junction filter 추가 |

### 위험

- 기존 문서의 중복 필드가 서로 모순될 때 precedence 선택이 필요하다.
- compile의 player-first phase와 ball schedule phase를 분리해야 하므로 영향 반경이 엔진 핵심에 닿는다.
- 중복 저작값 자체는 남아 후속 기능에서 재발할 수 있다.

### 롤백 단위

전용 ghost command, shared resolver, relayout pipeline, validation을 각각 독립 commit 단위로 둔다. 단 shared resolver 없이 기존 origin snap만 제거하면 S3가 악화되므로 둘은 배포 단위로 묶는다.

## 7.2 2안 — 정석: 명시적 Ball Junction + 단일 사용자 Pin

### 모델

- additive domain에 `scene.ballJunctions?: BallJunction[]` 또는 의미상 동등한 구조를 둔다.
- junction은 `{ id, playerId, at: { beforeSegmentId?, afterSegmentId? }, pin?: Vec2 }`만 저작한다.
- pin이 없으면 engine이 player path tangent/상태에서 carry vector를 파생한다. pin이 있으면 모든 compile/stateAt/render/editor가 그 하나를 읽는다.
- travel의 `receiverId`는 identity, junction pin은 위치다. 도착 고스트 drag는 identity를 절대 재해석하지 않는다.
- 기존 `possessed.offset/offsetLocked`, `move.carryEnd`, travel 끝 recvOffset은 read migration 입력으로만 지원하고 신규 write는 중단한다.

### 마이그레이션 우선순위(제안)

1. 유효한 `move.carryEnd`가 해당 시간의 junction에 있으면 pin.
2. `offsetLocked===true`인 follow possession offset이면 pin.
3. 둘이 동시에 다르고 0.25m 초과면 자동 선택하지 말고 validation warning/보수적 기존 화면 유지.
4. 잠기지 않은 offset과 travel 끝점은 authored pin으로 승격하지 않고 derived default로 처리.

`SCHEMA_VERSION=1`에서 optional additive read는 가능하지만, 신규 writer가 새 필드만 쓰기 시작하면 구버전 consumer가 의미를 잃을 수 있다. 외부 파일 호환을 실제 지원한다면 version 2 + 명시 migration이 정직하다. 현재 ADR-0009의 “새로고침=클린 보드”가 지속되고 import UI가 비노출이라도 persistence module은 존재하므로 이 결정을 ADR로 남겨야 한다.

### 폐기/대체되는 패치

| CHG | 처리 |
|---|---|
| CHG-077 junction proximity follow | junction id/edge graph로 대체 |
| CHG-078/079 recvOffset snap/approach | derived arrival tangent + optional junction pin으로 대체 |
| CHG-080 `end-0.05` holder 추정 | junction identity로 대체 |
| CHG-098/102/105 v1~v3 carry 분기 | 하나의 engine carry resolver로 통합 |
| CHG-104/106 원점·orbit 봉합 | junction resolver/전용 command로 대체 |
| CHG-107 `carryEnd` write | `junction.pin` write로 대체; legacy read만 유지 |

### 위험

- 가장 큰 migration/테스트 비용. ball track의 possession segment와 junction graph가 일시적으로 이중 표현이 된다.
- 구문서에서 spatial proximity만으로 junction을 복원하면 잘못 연결할 수 있다. segment 순서·trigger identity를 함께 써야 한다.
- renderer/pick가 junction representation을 직접 읽기 시작하면 순수 계층을 다시 어길 수 있다. 반드시 compile/derived presentation을 통해 전달한다.

### 롤백 단위

1. additive type+validator+legacy reader, 2. engine compiled junction, 3. stateAt/compile 전환, 4. editor write 전환, 5. legacy writer 제거 순으로 feature flag 없이도 단계별 byte-compatible하게 만든다. 3과 4 사이에는 dual-write 검증만 허용하고 장기 유지하지 않는다.

---

## 8. 회귀 테스트 매트릭스

아래의 “기존”은 CHANGELOG 기준 159개 중 관련 테스트다. **폐기**는 동작 자체를 없애는 것이 아니라 잘못된 구현 세부를 골든으로 고정한 assertion을 새 계약 assertion으로 교체한다는 뜻이다.

| 영역 | 파일 / 테스트 제목(제안) | 핵심 단언 | 기존 159 처리 |
|---|---|---|---|
| compile/stateAt 원점 | `src/engine/engine.test.ts` — `release anchor equals stateAt held-ball position at first, chained, pinned junctions` | `stateAt(start-ε)`, compiled LUT start, authored/presentation anchor가 허용 오차 내 동일; default/offsetLocked/carryEnd 조합 표 | 기존 `travel start snaps to holder release position when preceded by possession` (`engine.test.ts:252-287`) **대체** — possession offset만 기대하는 assertion 폐기 |
| chain 연속성 | `src/editor/dribble.test.ts` — `turning chained runs are position-continuous at exact boundary` | 직진/90°/180°, `t=end±1e-6/end` 공 위치 연속 | 기존 동일방향 chain 테스트 **유지+확장** |
| pinned chain | 같은 파일 — `carryEnd pin is honored at middle junction without moving endpoints` | pin 전후 경계 연속, 처음/최종 ball 불변, run path byte 동일 | CHG-107 browser 확인을 unit test로 **신규** |
| 도착 ghost 국소성 | `src/editor/stepCommands.test.ts` — `receive-junction orbit changes endpoint pin only` | non-adjacent handles, all holds, path points except endpoint, receiverId, unrelated paths 불변 | 기존 junction-follow 두 테스트 (`371-440`) **분리/대체** |
| hold 보존 | `src/editor/stepCommands.test.ts` — `bend preserves waypoint holds and non-local handles` | bend 전후 hold 배열 완전 동일 | **신규** |
| receiver identity | `src/editor/stepCommands.test.ts` — `preserveEndDirection never reassigns receiver` | 다른 선수가 3.5m 안/더 가까워도 receiver 고정; explicit reattach만 변경 | 기존 “receiver keeps arrival side” **유지+확장** |
| relayout 멱등성 | 같은 파일 — `relayout is byte-idempotent after one pass` | `serialize(after1)===serialize(after2)`; compile errors 없음 | **신규** |
| relayout 순서 | 같은 파일 — `self-heal precedes anchor resolution` | possession 없는 첫 pass를 정규화한 한 번의 relayout에서 원점=재생 시작 | CHG-105 사례 **신규** |
| through-ball identity | 같은 파일 — `syncs only the declared receiver run at the relevant junction` | 공간상 3m 안의 과거/미래 다른 run 무시, 관련 arrival만 constraint | 기존 through-ball test (`347-369`) **유지+확장** |
| 숫자 경계 | `src/editor/stepCommands.test.ts` — `2.6 attach boundary and unified threshold epsilon table` | r−ε/r/r+ε의 preview와 commit 결과 일치 | carryOffset clamp 테스트 **유지**, drop contract 신규 |
| pick dispatch | `src/ui/pitch/pickTarget.test.ts` — `global winner remains pointer target at ghost/segment overlap` | selected segment vs endpoint ghost 동률/근접에서 명시 priority; fingerprint 안정 | 기존 rank 테스트 (`61-97`) **유지+확장** |
| gesture smoke | `src/ui/pitch/SimplePitch.test.tsx` — `arrival ghost drag invokes junction command, path-line drag invokes local bend` | 두 gesture가 서로 다른 command/문서 diff 생성 | **신규** jsdom smoke |
| cancel | 같은 파일 — `pointercancel, Escape, blur/unmount leave no transaction` | `core.inTransaction=false`, doc byte 원복, history 불변 | EditorCore generic cancel 테스트 **유지**, UI 경로 신규 |
| validation | `src/editor/validateDocument.test.ts` — `rejects malformed carryEnd, offsetLocked, offset, pressures and dangling receiver` | NaN/문자열/길이 불일치/unknown id를 구체 path error로 거부 | 기존 nested invalid 테스트 **유지+확장** |
| 구문서 migration | `src/editor/validateDocument.test.ts` 또는 migration test | optional 필드 없는 v1 load, legacy 중복 일치/충돌 정책 | 기존 preset roundtrip **유지+확장** |
| GIF parity | `src/ui/exportGif.test.ts` — `drawFrame ball centre matches stateAt at junction boundary` | fake canvas 기록 좌표가 stateAt과 동일(default/pin/chain) | 기존 sampleTimes 2개는 **유지**, 좌표 parity 신규 |
| 표시 휴리스틱 | `src/ui/pitch/pathPresentation.test.ts` — `selected and unselected path use same canonical release anchor` | 선택 토글로 path 기하가 바뀌지 않음 | 기존 selected attached-start 테스트 **대체** |
| hit scale | `src/ui/pitch/pickTarget.test.ts`/component test — `7px tolerance uses actual CTM scale under letterbox` | width/height 비율이 다른 두 viewport에서 같은 screen 7px 결과 | 기존 고정 mpp 테스트 **유지+확장** |

### 반드시 폐기할 구현 골든

1. “직전 possession offset만으로 travel release를 정한다”는 `engine.test.ts:252-287`의 내부 구현 기대.
2. “도착 고스트 조정도 일반 bend다”라는 암묵 계약. 현재 독립 테스트는 없지만 CHG-104 browser 검증 절차를 그대로 재사용하면 새 구조를 거꾸로 막으므로 폐기한다.
3. 선택된 패스에서만 presentation first waypoint를 바꿔도 된다는 ISSUE-006 테스트 (`pathPresentation.test.ts:14-42`). 새 계약은 선택 여부 불변이어야 한다.

### 유지해야 할 제품 골든

- 동일 step은 같은 시작·끝 (`stepCommands.test.ts:310-344`).
- 수신 공은 접근 방향 측에 놓임 (`stepCommands.test.ts:285-307`, `479+`).
- 같은 방향 연속 드리블은 side-dip이 없음 (`dribble.test.ts:62-111`).
- G1 possession comparator와 G2 ghost yield 수치는 제품 결정이 바뀌기 전 유지 (`pickTarget.test.ts:26-59`).
- transaction은 drag 하나당 history 하나, cancel은 완전 원복 (`editorCore.test.ts`의 begin/update/commit/cancel 군).

---

## 9. 구현 전 결정이 필요한 항목

1. **정확한 정션 프레임:** 다음 run이 방향을 바꿀 때 공은 경계에서 이전 방향 pin을 정확히 통과한 뒤 다음 방향으로 보간할지, player 중심 주위의 최단 원호로 보간할지 결정해야 한다. 권고: pin이 있으면 pin을 정확히 통과, 없으면 이전/다음 tangent의 단위벡터를 짧은 시간 원호 보간.
2. **receiver identity:** 도착 고스트 drag로 receiver가 절대 바뀌지 않게 하고, 재연결은 별도 제스처/명령으로 둘지 결정. 권고: 고정. 현재 자동 탈취는 사용자의 선택 대상을 바꾸는 숨은 부작용이다.
3. **schema:** 정석안에서 optional v1 dual-read로 갈지 v2 migration으로 갈지. 권고: 외부 import/export를 유지할 의도가 있으면 v2. 비노출 모듈로만 남길 경우에도 validator와 migration fixture는 필요하다.
4. **attach threshold:** 2.6 ring과 2.7 commit headroom을 하나의 semantic 상수로 통합할지. 권고: 시각 후보 반경과 commit 반경은 같게 하고 pointer 접근성 hit-slop은 별도 screen-px 계층으로 둔다.

## 10. 정적 감사 한계

- 실제 브라우저 pointer capture 손실, SVG letterbox, 22명 혼잡 상태는 실행하지 않았다. 해당 항목은 “위험”으로만 판정했다.
- CHG의 과거 Playwright PASS는 당시 시나리오의 증거이지 현재 구조의 일반 증명이 아니다. 특히 같은 방향 chain과 선택된 단일 패스 원점만 확인한 검증은 방향 전환·pin·선택 해제 상태를 포함하지 않는다.
- 이 문서는 구현 지시가 아니라 원인·계약·테스트 경계를 고정하는 handoff다. 소스 코드는 수정하지 않았다.
