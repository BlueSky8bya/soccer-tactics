# Active ExecPlan

Plan ID: PLAN-20260820-007
Status: In Progress (사용자 승인 2026-08-20 — Codex 수정안 전면 수용. A-01 6px/1.2s+즉시 리셋, A-02 하이라이트만(라벨은 체감 후 dwell 재논의), A-03 같은 종류 내 후순위, A-04 수정자 호환 계층)
Task Risk: L2
Created: 2026-08-20
Updated: 2026-08-20
Execution Owner: Claude Code (작성자 겸 구현자 — 본 계획은 Codex가 검증한다)

## Objective

22명 + 다중 경로가 엉킨 화면에서 **원하는 엔티티를 예측 가능하게 선택**하게 한다. pitch content hit는 DOM 페인트 순서 대신 순수 기하 후보 목록으로 계산하되, badge/picker/accessibility DOM과 현 modifier·drag 계약은 보존하는 **hybrid routing**을 사용한다. 사용자 스크린샷은 M0에서 파일 위치·viewport·fixture를 등록하기 전까지 참고 설명이지 검증 증거로 간주하지 않는다.

## 문제 정의 (현 구조의 한계)

- 현재 pointerdown은 단일 `e.target`의 ancestor에 대해 ghost/segment/token `closest`를 각각 조회한다. 세 query의 코드 순서가 sibling 우선순위를 만드는 것이 아니라, **브라우저가 페인트 순서로 정한 단 하나의 target sibling만 보인다**는 점이 문제다.
- 예외 처리(보유 공 vs 홀더 정규화 거리, 고스트 밑 라이브 토큰 양보)가 이미 2건 — 겹침 케이스마다 패치가 늘어나는 구조.
- 시각 계층(현재 단계 외 0.55 감쇠)과 히트 계층이 **불일치** — 흐리게 보이는 것이 클릭을 가로챈다.

## Scope and Guardrails

- ADR-0009(v4 + 2026-08-20 확정: 같은 단계 동시 시작·종료, Alt=그리기, Ctrl=선택 토글/투입, Shift+마퀴=추가)의 **제스처 의미는 불변**. 바뀌는 것은 "무엇이 잡히는가"뿐.
- `src/engine`/`src/domain` 불변. schema 불변. 새 의존성 없음. 배지 인라인 피커·마퀴·벤딩 동작 유지.
- pitch content 후보 계산은 **순수 함수**다. DOM control routing/pointer capture는 `SimplePitch`에 남고, content candidate는 명시적 rank tuple과 stable tie-break로 정렬한다.
- 흐린(다른 단계) 요소는 **후순위이지 제외가 아니다**(발견성 유지) — A-03 참조.

## Codex Review

### 종합 판정: 조건부 승인

문제 정의(페인트 순서에 종속된 sibling SVG hit와 누적 예외)는 타당하지만, 원안의 **단일 스칼라 점수**, **top 후보 하나로만 HitFlags 생성**, **pointerdown 재클릭 순환**, **상시 hover 라벨**은 현 제스처 계약과 CHG-046/049/055/066/067을 되돌린다. 아래 CR-01~CR-09와 수정된 M0~M4 조건을 충족하기 전 구현 착수는 반려한다.

### 실제 코드 검증 근거

- `SimplePitch.onPointerDown` 전체(414~607행)를 확인했다. step picker는 422~426행에서 DOM `closest('[data-step-picker]')`로 먼저 삼키고, badge는 931~936행의 child handler가 `stopPropagation()`한다. 일반 content hit는 467~469행의 ghost/segment/token DOM target에서 파생된다.
- 누적된 정확한 예외 두 건은 ① 475~485행의 **보유 공/홀더 비대칭 정규화 거리**(`ball 0.9m`, `holder 1.8m`, t=0 initial holder fallback), ② 486~494행의 **ghost 아래 live player 1.2m / ball 0.9m 양보**다. 계획의 “자연 흡수” 주장은 수치로 성립하지 않는다.
- `gestureIntent.ts`의 우선순위는 `ghost+Alt → draw-from-ghost`, ghost+live overlap→live token, Alt chain+non-token→chain, token>segment, plain segment→bend, empty grass→marquee, Ctrl grass→투입이다. `top 후보 kind` 한 개만 전달하면 이 truth table의 동시 hit/context 정보를 잃는다.
- Ctrl click/drag 계약은 `pressToken`(428~464행)과 `endGestureImpl`(279~282행)에 걸쳐 있다. 이미 선택된 token의 plain pointerdown은 multi-selection을 유지하고 threshold를 넘으면 그룹 이동, Ctrl no-drag pointerup만 toggle-off한다.
- Shift+추가 marquee는 584~590행에서 **후보가 없는 빈 잔디**일 때만 시작된다. Alt는 502행에서 draw modifier, Shift는 marquee additive로 서로 분리돼 있다.
- selected path의 waypoint는 `data-segment`를 공유하고 `bendGrabWaypointInDraft`가 threshold 이후 실제 waypoint를 잡는다. attached pass start는 `pointer-events:none`이다. geometric picker가 표시 path와 attached-start/full-hit geometry를 맞추지 않으면 ISSUE-006과 CHG-064를 되돌린다.

### 발견 결함과 판정

| ID | 결함/반증 | 회귀 대상 | 판정 | 필수 수정 |
|---|---|---|---|---|
| CR-01 | `3/2/1 × stepWeight − normalizedDistance`는 차원이 불명확하고 동률 규칙이 없다. 같은 kind·같은 거리, 교차 path, 동일 endpoint에서 JS sort/input 순서가 결과를 결정한다. “종류 우선”도 보장하지 않는다. 예: 타단계 token 최대 1.35, 현재 ghost 최대 2.0이면 원안 설명과 반대로 ghost가 이긴다. token에는 step 자체가 없어 weight 정의도 불가능하다. | 결정론, A-04 | **반려** | 스칼라 점수를 폐기하고 명시적 rank tuple+stable ID tie-break를 쓴다. token에는 step weight를 적용하지 않는다. |
| CR-02 | player와 ball을 모두 2.4m token으로 두면 CHG-055의 발끝 2.0~2.6m에서 판별 경계가 midpoint가 된다. 2.6m 간격이면 새 경계는 holder에서 1.30m지만 현 `.9/1.8` 비교의 경계는 1.73m다. holder가 확보한 0.43m 띠를 공이 가로챈다. ball hit도 현 1.76m보다 2.4m로 커져 grass/path를 과도하게 막는다. | CHG-046/055/058/064 | **반려** | possession pair는 현 `.9/1.8` comparator와 t=0 initial-holder fallback을 그대로 순수 helper로 옮겨 golden test한다. player/ball radius 분리. |
| CR-03 | `top 후보 kind → HitFlags`는 overlap context를 삭제한다. ghost 위에 live token이 있고 Alt면 현재는 ghost branch가 먼저라 `draw-from-ghost`; token을 top으로 만들면 `draw-from-token`이 된다. 반대로 plain은 live token 양보가 필요하다. | CHG-065/066/070, `gestureIntent` | **반려** | `PickResult { primary, overlaps, domControl }`로 반환하고 modifier/context adapter가 기존 truth table을 보존한다. `gestureIntent.ts`는 변경하지 않고 golden matrix를 추가한다. |
| CR-04 | 반경을 pitch metre로 고정하면 zoom/viewport에 따라 hit px가 달라진다. 현 path hit는 `vector-effect: non-scaling-stroke` 14px이고 token hit는 player 2.2m/ball 1.76m다. 원안 path 1.4m는 화면에 따라 기존 7px half-width보다 훨씬 크거나 작다. | Fitts, bend/marquee, CHG-064 | **반려** | input에 `metresPerPixel`/pointerType을 넣고 path distance는 screen-px tolerance로 비교한다. token/ghost는 현 시각·hit 상수를 source of truth로 공유한다. |
| CR-05 | curve distance 알고리즘, full hit path, attached-start presentation delta, trim 전/후 기준이 없다. waypoint/Bezier handle을 polyline으로만 보면 보이는 곡선과 click 영역이 어긋난다. | bending, ISSUE-006, CHG-064/065 | **조건부** | `Path` cubic geometry에 대한 deterministic closest-distance helper와 tolerance/error test를 명시. hit는 trim 전 full path, selected waypoint는 현 grab helper, attached start는 non-draggable 유지. |
| CR-06 | 재클릭 index를 pointerdown에서 올리면 두 번째 press가 token 대신 ghost/path로 바뀐 뒤 drag threshold에 들어가 그룹 이동을 되돌릴 수 없다. “drag가 시작되면 순환 무효”는 이미 잘못 시작한 capture/intent를 복구하지 못한다. | CHG-049 | **반려** | selected live token은 pointerdown drag anchor로 고정한다. 반복 **no-drag pointerup**에서만 다음 후보를 선택하고, threshold를 넘으면 cycle state를 버린다. Ctrl/Alt/Shift/right-click에는 cycle 금지. |
| CR-07 | 60ms throttle+React hover state는 최대 16.7Hz라 pointer에 늦게 붙고, candidate마다 전체 `SimplePitch`를 재렌더할 수 있다. 22+20에서 상시 cursor label은 token 번호·badge·path를 가리며 M2의 목표와 충돌한다. long task 0만으로 render churn/지연을 못 잡는다. | PLAN-006 판독성, CHG-059/060 | **조건부** | rAF coalescing, candidate ID가 바뀔 때만 state update, render-count/95p latency 측정. 기본은 highlight-only; label은 ambiguous count≥2에서 350ms dwell 뒤 하나만 표시하거나 제거. 재생/viewingFrame/touch에서 hover off. |
| CR-08 | DOM을 “완전히 버린다”는 표현은 잘못이다. picker/badge child handler와 SVG role/accessibility tree는 유지해야 한다. geometry-only는 browser의 `pointer-events`, transform, pointer capture, touch contact tolerance를 자동 상속하지 않는다. | CHG-044/045, a11y/touch | **반려** | **hybrid routing**으로 명시: interactive controls는 DOM 최우선, pitch content만 geometry. DOM 요소/role/aria/stopPropagation/pointer capture는 보존하고 pointerType별 test를 추가. |
| CR-09 | 후보 목록 “동일”의 정의와 invalidation이 없다. doc edit, currentStep, selection, playback frame, hover geometry 변화 뒤에도 2.5s ref가 남으면 다른 대상을 순환할 수 있다. 사용자 screenshot 증거 경로도 없다. | 예측 가능성/증거성 | **조건부** | ordered candidate keys+geometry revision을 fingerprint로 사용하고 doc revision/currentStep/selection/modifier/playback/pointerleave에서 reset. screenshot 파일/viewport/fixture를 M0에 기록. |

### CHANGELOG CHG-043~074 회귀 감사

| 잠금 결정 | 위험 | 보호 조건 |
|---|---|---|
| CHG-043 재생 중 route/arrow 완전 숨김 | hover가 hidden path를 다시 highlight/label할 수 있음 | `playing || playback.t>0`이면 hover/picking decoration off. |
| CHG-044/045 badge picker 최상위·DOM handler | root geometry가 picker 밖 click/child press를 가로챌 수 있음 | badge child `stopPropagation`, picker DOM early return을 M1 이전/이후 동일하게 유지. |
| CHG-046/055/058 보유 공 판별·발끝 거리 | 동일 token radius가 holder click 면적 축소 | CR-02 golden numeric boundary test. |
| CHG-047/051 공 방향·holder 동행/부착 | geometric ball 후보가 visual offset/초기 holder와 달라질 수 있음 | `resolved.ball.pos`, initial-holder fallback, holder offset을 fixture에 포함. |
| CHG-049 Ctrl toggle/add+group drag | cycle이 selected member drag를 빼앗음 | CR-06 pointerup-only cycle; Ctrl cycle 금지. |
| CHG-059 단계 감쇠/CVD | 0.45 multiplier가 보이는 계층과 다른 비선형 결과 | step은 같은 kind 안 tie-break만; selected/possessed live token보다 앞서지 않음. |
| CHG-060 press feedback | hover/cycle rerender가 `pressedId`를 덮거나 깜박일 수 있음 | pressed/dragged가 hover보다 항상 우선, pointerdown 시 hover freeze. |
| CHG-064 full path hit/arrow trim | geometric distance가 trimmed visible path만 쓰면 끝부분 bend 불가 | hit geometry는 원본 full path. |
| CHG-065 path 평행이동 | cached geometry가 edit 후 stale | editor revision을 fingerprint/cache key에 포함. |
| CHG-066 Alt authoring | generic kind rank가 ghost/token 출발점을 바꿈 | modifier-aware adapter golden tests. |
| CHG-067 Shift additive marquee | 넓어진 경로 반경이 빈 grass를 빼앗음 | px-equivalent tolerance와 Shift empty-grass fixture. |
| CHG-070/071 ghost chain/중복 제거 | ghost identity/step rank가 stale/중복될 수 있음 | rendered ghost list를 단일 source로 쓰고 `(segId, entityId, position)` stable key. |
| CHG-073/074 GIF | 직접 영향 없음 | M4에서 unrelated regression으로 GIF test/filename 유지만 확인. |
| CHG-048/050/052~054/056~063 | variants, tour entry, header/GIF, visual system, playback/a11y 완료분 | 직접 routing 대상은 아니지만 hover label/새 DOM이 shell·a11y·visual hierarchy를 침범할 수 있음 | 새 shell control/의존성/모드 추가 0, existing focus/visual regression suite PASS. |
| CHG-068~072 단계 timing/ghost sequence | picker 자체가 timing을 바꾸면 안 되고 ghost step rank만 읽어야 함 | picker/hit은 document mutation 0; `stepOf`는 rank tie-break에만 사용, compile/stateAt snapshots 동일. |

## 수정된 설계 (Codex 조건 반영)

### 새 모듈 `src/ui/pitch/pickTarget.ts` (순수)

```ts
type Candidate =
  | { kind: 'player'; id: Id; distancePx: number }
  | { kind: 'ball'; id: Id; distancePx: number }
  | { kind: 'ghost'; entityId: Id; segId: Id; step: number; distancePx: number }
  | { kind: 'segment'; entityId: Id; segId: Id; step: number; distancePx: number }
type PickResult = {
  ordered: Candidate[]
  primary: Candidate | null
  overlaps: { livePlayerIds: Id[]; liveBall: boolean; ghostKeys: string[]; segmentIds: Id[] }
  fingerprint: string
}
pickTargets(input: {
  doc, editorRevision, resolvedPositions, renderedGhostSpots, displayedPaths,
  pt, metresPerPixel, pointerType, currentStep, selection, selectedSegmentId,
}): PickResult
```

스칼라 점수는 사용하지 않는다. 후보 포함 여부는 현 hit footprint를 screen px로 환산해 정하고, 정렬은 `(gesture-compatible tier, selected/sticky tier, same-kind current-step tier, normalizedDistance, stableKey)`의 사전식 tuple이다. `stableKey`는 `kind:id`이며 모든 동률의 최종 결정자다. 단계는 같은 ghost끼리 또는 같은 segment끼리만 우선순위를 조정하고 live token보다 앞서는 전역 배율로 쓰지 않는다.

`onPointerDown` routing 순서는 고정한다.

1. badge child handler와 열린 picker의 `[data-step-picker]` early return은 DOM 최우선으로 유지한다.
2. content에 대해 `pickTargets`를 계산한다.
3. `adaptPickToIntent(pick, modifiers, chain, possession)`가 `PointerHit + PointerContext + concrete IDs`를 만들고 기존 `resolvePointerIntent`를 호출한다. top kind 하나만 flags로 바꾸지 않는다.
4. possession pair는 현 `dBall/0.9 > dHolder/1.8`과 t=0 initial-holder fallback을 보존한다. ghost/live 양보도 player 1.2m, ball 0.9m golden boundary로 보존한다.
5. `setPointerCapture`와 begin/update/commit/cancel 경계는 기존 intent handler에 남긴다.

Path distance는 trim 전 full displayed path(attachment delta 포함)의 cubic closest distance로 구하고, screen-space 오차가 0.5px 이하가 되도록 deterministic subdivision/analytic helper를 선택해 테스트한다. attached first waypoint는 후보에서 제외하고 `bendGrabWaypointInDraft` 계약을 유지한다.

### M0 — 계약 동결·증거 등록 (P0, 구현 전 차단)

- 사용자 overlap screenshot을 `docs/agent/evidence/PLAN-20260820-007/BASE-overlap.png`로 등록하고 viewport, zoom, fixture document/revision, currentStep, selection, playback.t를 manifest에 기록한다.
- 아래 golden table을 기존 DOM 동작으로 먼저 캡처한다: holder-ball 경계 `d=2.0/2.3/2.6m`, ghost+player/ball `r=threshold−0.01/equal/+0.01`, token+segment, ghost+token Alt/plain, selected token click/drag, Ctrl click/drag, Alt chain, Shift empty-grass marquee, badge/picker press, selected waypoint, attached start.
- 각 fixture의 `pointerType='mouse'|'pen'|'touch'`, 1280×800/1440×900, 100%/200%를 기록한다. touch가 현 제품의 공식 수용 범위가 아니라면 동작 보존 smoke만 하고 hover는 적용하지 않는다.
- **통과:** 현재 동작의 기대값이 테스트 이름과 표로 확정되고 CR-01~09가 구현 checklist에 매핑됨. 증거 없이는 M1 금지.

### M1 — 기하 히트 + 단계 필터 (P0)

- 파일/함수: `pickTarget.ts` 신규(`pickTargets`, `closestDistanceToPath`, `rankCandidates`, `resolvePossessionPair`, `fingerprintCandidates`)와 테스트; `SimplePitch.onPointerDown`의 466~504행만 hybrid adapter로 치환; `gestureIntent.ts` 본문 불변, 테스트 확장.
- badge/picker DOM handler, SVG role/aria/tabIndex, path/token/ghost DOM nodes와 `pointer-events`, pointer capture, `pressToken`, marquee/bend handlers는 삭제·이동하지 않는다.
- player/ball/ghost/path hit size는 `TOKEN_HIT_R`, `BALL_R` 및 현재 ghost/path hit 계약과 공유한다. path는 14px full path, touch tolerance 확대가 필요하면 pointerType별 별도 값으로 명시한다.
- `adaptPickToIntent`는 Alt/plain에서 ghost/live overlap을 구분하고, Ctrl/Shift/right button을 임의로 rank에 흡수하지 않는다.
- 테스트: rank tuple 완전 동률 stableKey, 교차 cubic path, viewport/zoom px equivalence, attachment delta/full path, possession numeric boundaries, ghost live thresholds, M0 modifier matrix.
- **통과:** `gestureIntent` 기존 truth table 100% + M0 golden tests + Playwright holder/ghost/bend/marquee/badge/picker 모두 PASS. geometric primary가 다르더라도 최종 intent/ID가 golden과 같아야 한다.
- **롤백:** `onPointerDown` adapter만 기존 466~504행 DOM routing으로 복원. DOM node/handlers를 보존했기 때문에 즉시 rollback 가능.

### M2 — 호버 예고 (P0)

- `pointermove`에서 gesture가 없고 `pointerType==='mouse'`, `!playing`, `playback.t===0`일 때만 rAF coalescing으로 계산한다. ordered primary key가 바뀔 때만 React state를 갱신하고 pointerdown 동안 freeze한다.
- 기본 presentation은 대상 하나의 기존 hover ring/path emphasis/ghost opacity만 사용한다. 라벨은 A-02 확정 전 구현하지 않는다. 승인 시 후보 2개 이상+350ms dwell에서만 하나를 표시하고 badge/token 번호를 피하도록 offset/clamp한다.
- 파일: `SimplePitch` hover state, `PathLayer.hoverSegmentId`, 기존 `Token.hovered`, pitch CSS. label 승인 시에만 `describeCandidate`와 i18n 추가.
- 테스트: same key move의 state update 0, rAF coalescing, playing/viewing/touch off, pressed/dragged 우선, unmount/pointerleave cleanup.
- 성능 수용: 22명+20 cubic paths에서 hover 10초의 95p input→paint ≤50ms, React commit 수 ≤candidate key 변화 수+2, >50ms long task 0. 단순 O(n) 주장만으로 통과 금지.
- 롤백: hover 레이어 제거만.

### M3 — 재클릭 순환 (P0)

- pointerdown에서는 selected live token을 drag anchor로 고정하고 기존 `pressToken`/capture를 시작한다. threshold를 넘기기 전에는 cycle selection을 확정하지 않는다.
- **no-drag pointerup**에서만 `lastPick { clientPt, fingerprint, index, at, docRevision }`를 평가해 다음 후보를 선택한다. drag가 시작되면 기존 대상 gesture를 계속하고 lastPick을 reset한다. 이미 시작한 gesture를 다른 kind로 전환하지 않는다.
- Ctrl/Meta, Alt, Shift, right-click, badge/picker, playback/viewing frame에서는 cycle을 사용하지 않는다. doc revision/currentStep/selection(except cycle's own selection result)/candidate fingerprint/modifier/pointerleave가 바뀌면 reset한다.
- A-01 승인 전 거리/시간은 상수화하지 않는다. 거리 기준은 client px이며 zoom과 무관해야 한다.
- 테스트: token 첫 click→선택, 같은 위치 두 번째 **click**→다음 후보, 같은 두 번째 press→drag는 기존 selection 그룹 이동; Ctrl selected click toggle-off; Ctrl drag group; Alt ghost/token; Shift marquee; fingerprint/revision/timeout reset.
- Playwright는 3연클릭 순환뿐 아니라 “click 후 같은 위치 drag”와 “선택된 3명 중 overlap member 재press drag”를 필수로 한다.
- 롤백: lastPick 로직 제거.

### M4 — 검증 마감

- M0 overlap fixture Playwright probe + before/after screenshot과 ordered candidates/intent/selected IDs 로그.
- 성능은 M2의 95p latency/commit count/long task 세 지표를 모두 기록한다.
- mouse/pen/touch pointerdown→capture→cancel/up 경계, SVG keyboard focus와 badge/picker role/aria snapshot을 검증한다.
- CHG-043~074 보호표 전 항목을 실제 test/evidence에 연결한다. 특히 재생 hover off, full path 끝부분 bend, Ctrl click/drag, Alt chain, Shift marquee, GIF 색/파일명을 확인한다.
- 전체 게이트 + CHANGELOG/CURRENT_STATE/ADR-0009 Amendment(선택 계약) 기록.

## Ambiguity Register — Codex 독립 의견, 사용자 확정 필요

| ID | 질문 | 원안 | Codex 판정/추천 | 구현 영향 |
|---|---|---|---|---|
| A-01 | 순환 리셋 기준 | (a) 8px·2.5s | **조건부 반려.** 2.5s는 우발 순환 창이 길고 후보/문서 변화 reset이 없다. client 6px·1.2s를 초기값으로 하고 fingerprint, revision, step, modifier, pointerleave에서 즉시 reset을 추천한다. 브라우저 실측 후 6~8px/1.0~1.5s 안에서 조정. | M3 상수와 reset matrix; 반드시 no-drag pointerup 전용. |
| A-02 | 호버 라벨 | (a) 항상 `#9 이동 · 2단계` | **반려. (c) 하이라이트만 추천.** 22+20의 커서 라벨은 번호/badge를 가리고 60ms 갱신은 늦다. 필요하면 후보≥2에서 350ms dwell 뒤만 label을 보이는 제4안. | M2 label/i18n은 승인 전 제외. |
| A-03 | 타단계 요소 | (a) 0.45 후순위 | **취지는 승인, 공식은 반려.** 타단계 후보를 제외하지 않되 단계는 같은 kind 안에서만 tie-break하고 scalar 0.45는 사용하지 않는다. selected/possessed live token과 modifier-compatible target이 먼저다. | M1 rank tuple/golden table. |
| A-04 | 종류 vs 단계 | (a) token>ghost>path | **반려.** blanket kind 순위는 Alt ghost와 plain live-token 양보를 동시에 보존하지 못한다. modifier-aware gesture-compatible tier + sticky selected token drag + same-kind step tier를 추천한다. | `PickResult.overlaps`와 adapter 필수; `gestureIntent` 불변. |

## 검증 매트릭스

| 검증 | 방법 | 통과 |
|---|---|---|
| 제스처 계약 불변 | gestureIntent 테스트 + 기존 Playwright 회귀 | 전부 PASS |
| 결정론 | pickTargets 동일 입력 deep-equal | PASS |
| 겹침 우선순위 | 우선순위 표 단위 테스트 + 겹침 fixture probe | 표와 일치 |
| 성능 | rAF hover + input→paint/React commit/long task 측정 | 95p ≤50ms, commit≤key change+2, >50ms 0건 |
| 전체 게이트 | typecheck/lint/test/build/harness/format | PASS |

## Plan Reversal Log

| ID | Previous Plan / Assumption | New Evidence | Replacement |
|---|---|---|---|
| REV-01 | 히트 판정은 DOM 페인트 순서 + 개별 예외 패치로 충분하다는 가정(PLAN-005 M3 유산) | 겹침에서 sibling paint order가 후보를 숨기며 예외 2건이 누적됨; screenshot은 M0 등록 전 참고 자료 | DOM control은 보존하고 pitch content만 순수 기하 후보 tuple로 교체. 예외의 **행동 계약과 수치 경계는 삭제하지 않고** 순수 comparator/context adapter로 이전 |
| REV-02 | 한 scalar 점수와 top kind 하나면 기존 gesture를 보존한다는 PLAN-007 원안 | CR-01~04 수치 반증과 `gestureIntent` overlap truth table | ordered candidates+overlaps+stable tie-break+modifier-aware adapter로 대체 |
| REV-03 | pointerdown 재클릭 순환 후 drag 시 무효화 가능 | intent/capture가 threshold 전에 이미 정해져 그룹 drag를 빼앗음 | no-drag pointerup에서만 순환; drag anchor sticky |

## Rollback

M0(golden/evidence)·M1(hybrid hit)·M2(hover)·M3(cycle) 독립 단위. badge/picker DOM과 기존 content DOM node를 유지하므로 M1 adapter만 466~504행의 기존 routing으로 복원할 수 있다. M2/M3는 각각 state/handler를 제거해 독립 rollback한다. M0 golden tests는 rollback하지 않고 이후 회귀 보호로 남긴다.

## Out of Scope (후속 후보)

엔티티 우클릭 후보 목록 팝업(P1), 휠 줌+팬(P1), 팀 필터 토글(P2) — 본 계획 체감 후 별도 결정.
