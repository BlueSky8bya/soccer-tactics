# Active ExecPlan

Plan ID: PLAN-20260820-007
Status: Draft (Codex 검증 대기 → 사용자 승인 후 착수)
Task Risk: L2
Created: 2026-08-20
Updated: 2026-08-20
Execution Owner: Claude Code (작성자 겸 구현자 — 본 계획은 Codex가 검증한다)

## Objective

22명 + 다중 경로가 엉킨 화면(증거: 사용자 스크린샷 2026-08-20, 중앙원 부근에 토큰·고스트·배지·경로 6종 중첩)에서 **원하는 엔티티를 한 번에, 예측 가능하게 선택**하게 한다. 방법: 히트 판정을 DOM 페인트 순서에서 떼어내 **순수 기하 후보 스코어링**으로 구조 개편하고, 그 위에 ① 단계 필터 히트 ② 호버 예고 ③ 재클릭 순환을 얹는다.

## 문제 정의 (현 구조의 한계)

- 현재 pointerdown은 `e.target.closest('[data-ghost]') → [data-segment] → [data-entity]` 순 DOM 질의 — **맨 위에 그려진 요소가 항상 이긴다**. 겹침이 깊을수록 선택은 페인트 순서 운.
- 예외 처리(보유 공 vs 홀더 정규화 거리, 고스트 밑 라이브 토큰 양보)가 이미 2건 — 겹침 케이스마다 패치가 늘어나는 구조.
- 시각 계층(현재 단계 외 0.55 감쇠)과 히트 계층이 **불일치** — 흐리게 보이는 것이 클릭을 가로챈다.

## Scope and Guardrails

- ADR-0009(v4 + 2026-08-20 확정: 같은 단계 동시 시작·종료, Alt=그리기, Ctrl=선택 토글/투입, Shift+마퀴=추가)의 **제스처 의미는 불변**. 바뀌는 것은 "무엇이 잡히는가"뿐.
- `src/engine`/`src/domain` 불변. schema 불변. 새 의존성 없음. 배지 인라인 피커·마퀴·벤딩 동작 유지.
- 후보 스코어링은 **순수 함수**(doc + resolved 위치 + 클릭 좌표 → 정렬된 후보 목록) — 결정론, DOM 없음, 단위 테스트 대상.
- 흐린(다른 단계) 요소는 **후순위이지 제외가 아니다**(발견성 유지) — A-03 참조.

## 설계

### 새 모듈 `src/ui/pitch/pickTarget.ts` (순수)

```ts
type Candidate =
  | { kind: 'token'; id: Id }            // 라이브 선수/공
  | { kind: 'ghost'; entityId: Id; segId: Id }
  | { kind: 'segment'; segId: Id }
pickTargets(input: {
  doc, resolvedPositions, ghostSpots, pt,
  currentStep, selectedSegmentId,
}): Candidate[]  // 스코어 내림차순
```

스코어 = 종류 가중치(토큰 3 > 고스트 2 > 경로 1) × 단계 가중치(현재 단계 1.0 / 다른 단계 0.45) − 정규화 거리(대상 시각 반경 대비). 반경 밖 후보는 제외(토큰 2.4m·고스트 1.9m·경로는 스트로크 1.4m). 보유 공/홀더 정규화 규칙과 "고스트 밑 라이브 토큰" 규칙은 이 스코어에 **자연 흡수**(별도 예외 삭제).

### M1 — 기하 히트 + 단계 필터 (P0)

- `SimplePitch.onPointerDown`: DOM closest 3종 질의 제거 → `pickTargets(...)[0]`으로 대상 확정 후 기존 `resolvePointerIntent`에 전달(HitFlags는 top 후보 종류에서 파생). 배지·피커·잔디(후보 없음→마퀴/투입)는 기존 경로 유지.
- 파일: `pickTarget.ts`(신규+테스트), `SimplePitch.tsx`(라우팅 치환), `gestureIntent.ts` 불변.
- 테스트: 우선순위 표(동일 지점 케이스 고정), 거리 타이브레이크, 결정론, 기존 예외 2건(보유 공/홀더, 고스트 밑 토큰)의 회귀 케이스.
- 수용: 기존 Playwright 회귀(홀더/고스트/벤딩/마퀴) 전부 PASS + 겹침 fixture에서 top 후보가 표와 일치.
- 롤백: pickTarget 호출부만 DOM 질의로 복원.

### M2 — 호버 예고 (P0)

- pointermove(제스처 없음일 때)에서 `pickTargets(...)[0]`을 60ms 스로틀로 계산 → 대상 하이라이트(토큰 링/경로 글로우/고스트 선명) + 커서 옆 라벨(`#9 이동 · 2단계`) 렌더.
- 파일: `SimplePitch.tsx`(hover state+라벨 g), `pitch.module.css`, i18n 라벨 포맷.
- 테스트: 라벨 포맷 순수 함수(`describeCandidate`) 단위 테스트; hover 자체는 브라우저 수용(Playwright).
- 성능 가드: pickTargets는 O(엔티티+세그먼트) 단순 순회 — 22명+20경로에서 미미, M4에서 실측.
- 롤백: hover 레이어 제거만.

### M3 — 재클릭 순환 (P0)

- 상태: `lastPick { pt, index, at }`(ref). 새 클릭이 직전 클릭과 8px 이내·2.5s 이내·후보 목록 동일하면 index+1 후보 선택(모듈로). 그 외 초기화.
- 드래그가 시작되면 순환 무효(그 시점 대상으로 제스처 진행).
- 테스트: 순환/초기화 조건 순수 로직 분리(`cycleIndex`), Playwright로 겹침 지점 3연클릭 → 토큰→고스트→경로 순환 확인.
- 롤백: lastPick 로직 제거.

### M4 — 검증 마감

- 겹침 fixture(사용자 스크린샷 재현: 중앙 6종 중첩) Playwright probe + 스크린샷 증거.
- 성능: pointermove 프레임 예산(hover 스로틀 포함) — 50ms 초과 long task 0.
- 전체 게이트 + CHANGELOG/CURRENT_STATE/ADR-0009 Amendment(선택 계약) 기록.

## Ambiguity Register (Codex 의견 요망 → 사용자 확정)

| ID | 질문 | 선택지 | 추천 |
|---|---|---|---|
| A-01 | 순환 리셋 기준 | (a) 8px·2.5s (b) 8px·무제한 (c) 후보목록 변경 시만 | (a) |
| A-02 | 호버 라벨 표기 | (a) `#9 이동 · 2단계` (b) 아이콘+번호만 (c) 라벨 없음(하이라이트만) | (a) |
| A-03 | 타단계 요소 | (a) 후순위(0.45 가중) (b) 히트 제외 | (a) — 발견성 |
| A-04 | 종류 vs 단계 우선 | (a) 종류 우선(토큰>고스트>경로) (b) 단계 우선 | (a) — 만질 수 있는 것 먼저 |

## 검증 매트릭스

| 검증 | 방법 | 통과 |
|---|---|---|
| 제스처 계약 불변 | gestureIntent 테스트 + 기존 Playwright 회귀 | 전부 PASS |
| 결정론 | pickTargets 동일 입력 deep-equal | PASS |
| 겹침 우선순위 | 우선순위 표 단위 테스트 + 겹침 fixture probe | 표와 일치 |
| 성능 | hover 스로틀 + long task 측정 | >50ms 0건 |
| 전체 게이트 | typecheck/lint/test/build/harness/format | PASS |

## Rollback

M1(히트 치환)·M2(호버)·M3(순환) 독립 커밋. pickTarget은 추가 모듈이라 호출부 복원으로 즉시 롤백.

## Out of Scope (후속 후보)

엔티티 우클릭 후보 목록 팝업(P1), 휠 줌+팬(P1), 팀 필터 토글(P2) — 본 계획 체감 후 별도 결정.
