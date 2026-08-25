# Current State

Last Updated: 2026-08-25 (세션 22, PLAN-017 — 전면 캔버스: 고정 컬럼 0개) (직전: PLAN-016 인터페이스 재단장)
Project Version: 0.1.0
Harness Protocol: project-initializing_260712.md (schema 1.1) — `agent-harness.yaml`

## Current Objective

**보드가 화면이고, 크롬은 그 위에 뜬다 (2026-08-25, PLAN-017 / ADR-0009 v31 완료).**

사용자 지적: "애플 형식으로 다 했다고 하는데, 레이아웃 비율 수정을 좀 더 개혁적으로." 색·반경·
스프링은 애플 어휘였지만 골격은 2010년대 IDE였다 — 좌 도구 컬럼, 우 인스펙터 컬럼, 하단 도킹 바.
실측: 사이드 크롬이 1440에서 **32%**, 1280에서 **36%**, 그 안 카드 6장 중 5장이 `?` 오버레이와
중복된 정적 설명문.

- **고정 컬럼 0개.** 셸 = 상단바(48) + 캔버스(1fr). 재생바는 격자에서 나와 보드 위에 뜬다.
- **팀 구성 ▾** 상단바 팝오버(포메이션 + 양 팀 채우기). **정리·동작 설정은 오른쪽 아래 열**
  (아이콘+캡, v36) — 왼쪽 열에 쌓았더니 펼칠 때 보드를 129px 넘었다.
- **열 폭은 슬랙의 몫**(v37~v38, `sideColumns.ts`): 왼 0.55 / 오른 0.45, 하한 136/52 · 상한
  320/280. 실측 1280 **136/70** · 1440 **136/79** · 1920 **231/192** · 1885×842 **320/280**.
  좁으면 **오른쪽이 먼저 양보**하고, 열은 **창틀에 붙어**(inset 16) 남는 잔디를 열↔피치 사이 한
  곳으로 모은다(v39). 두 열은
  **같은 선에서 시작**하고, 단계 패널은 오른쪽 아래로 비켰다. 한 번의 측정이 CSS 변수 여섯 개를
  심고 피치도 그 값을 읽는다.
- **키 가이드**(`KeyGuide`, v33~v36): **왼쪽 여백**(피치가 높이 제약이라 영원히 남는 잔디)의 200px 열.
  만들기/보기 2그룹 7행, 행마다 `[캡] 낱말`(38px). 키를 실제로 쥐면 그 행만 열리며 강조되고
  (ExposeHK 리허설), **클릭·포커스로도 열린다. 호버는 색만 바꾼다** — 열던 시절엔 포인터가 스치는
  것만으로 아래 행이 전부 밀려 어지러웠다(v34). 상세는 **열 안에서만** 열려 피치를 덮지 않는다.
  예약은 슬랙 상한이라 **보드 점유율은 그대로**(마킹 1102 @1440). 근거: `docs/product/
  DISCOVERABILITY_RESEARCH_2026-08-25.md`. (v31 "상시 노출 0" → v32 상단 레일 → v33 여백 열,
  사용자 지적 2라운드 — CHG-214, CHG-215.)
- **피치는 바 위에서 끝난다**(`BOARD_SAFE_BOTTOM_PX = 72`, 유도값). 잔디는 창 끝까지 — 좌표 손실 없음.
- **F(zen) = 떠 있는 크롬 감추기**(접을 패널이 없다). zen은 72px을 피치에 돌려준다.

그려진 피치 폭 실측: 1024 ~540→**910**, 1280 767→**957**, 1440 921→**1102**(zen 1208), 1920 **1365**.

### 이전 목표(완료): 보여주는 것을 줄이고, 그림이 말 못 하는 것만 말한다 (PLAN-015 v2)
1차 요청 4건(공 굴림 토글·단계별 표시·다크모드) 위에 사용자 2차 피드백 5건을 얹어 재설계했다.
핵심 전환: 단계 격리는 "이전 단계를 흐리게 그리는 것"이 아니라 **보드를 그 단계가 열리는 시각에
세우는 것**이다. 이전 단계의 결과는 잔상이 아니라 토큰 자신으로 보인다.

- **단계 격리 v2**(기본 켜짐): 고른 단계에서 **보드가 그 단계가 열리는 시각에 선다**. 이전 단계들의
  결과는 잔상이 아니라 토큰 자신으로 보이고, 그려지는 것은 그 단계의 경로·배지·도착 잔상뿐이다.
  시계 정박은 `uiStore.authoringT`(press가 킥오프로 튀지 않게) + SimplePitch 핀 이펙트(편집이
  타이밍을 바꿔도 사후 정정). "보기: 전체"가 상시 탈출구.
- **경로 방향 언어 통일**: 선수·공 경로 모두 점선 + 목적지 쪽으로 **행진하는 대시**(같은 속도),
  리듬만 다르게(런=긴 보폭, 패스=틱, 루즈볼=점). 작성 중인 단계만 흐른다. 흰 케이싱도 같은 대시라
  틈이 흰색으로 메워지지 않는다.
- **StepPanel**(보드 우상단, 3행): `보기: 이 단계/전체` + `N단계만 재생` + `N단계부터 재생`.
  전부 푸터에 있던 것으로, 상태에 따라 나타나고 사라지며 바 너비를 바꿔 단계 칩을 좌우로 밀었다.
  이제 푸터에는 칩만 남아 **언제나 같은 픽셀**에 있다. 우상단에 있던 시계 캡션은 폐기(사용자 지적).
- **배속 창**은 ▶를 누르는 순간 열린다(이동 후가 아니라). 이동 없는 press는 그대로 play/pause.
- **플링 게이트 완화**: 옵트인이 된 이상 의심할 이유가 없다 — MIN_SPEED 6, SWEEP 2.5m, TRAVEL 1.2m,
  굴림 저항도 낮춤.
- **공 휙 던지기**: 헤더 1행 스위치, 기본 **꺼짐**. 상수(ISSUE-008)는 그대로.
- **다크모드**: 헤더 버튼 시스템 → 라이트 → 다크 순환, localStorage, React 마운트 전 도색.

**자율 QA 캠페인(사용자 위임, CHG-200)**: 시드 랜덤으로 전술 **600 세션**(200+60+40+300)을 실제 포인터 제스처로
작성하며 결과 기준을 검사(`pw/lab/tactic-lab.cjs`)하고, 대비·히트·모션 어휘를 양 테마에서 계측
(`pw/lab/feel-lab.cjs`)하고, 스크린샷을 읽는 리뷰 에이전트 3종을 붙여 **수정→재캡처→재리뷰 3라운드**를
돌렸다. 기계 판정 실 결함 **0**(토큰-시계 오차 0.000m). 사람 층이 지목한 것 중 확인된 것은 전부 수정 —
재생 중 편집 팝오버·푸터 딤, 배지 1.4:1 및 격리 중 무의미, 잔상의 빨강이 갈색으로 합성, 다크 잔디 광원,
스위치 노브가 트랙보다 어두움, 푸터 세 그룹 중심선 불일치와 보드 대비 8px 이탈, 짧은 경로가 화살촉뿐 등.
오독 1건은 기계 검증으로 기각(소유 중 공은 홀더에서 최소 2.6m).

증거: `node pw/run.cjs` **143 checks ALL PASS**, feel-lab **207/208 양 테마**.
상세: CHG-20260824-194~200.

### 이전 목표(완료): 핵심 재현 무결성 감사 Phase 1

**핵심 재현 무결성 감사 Phase 1 (2026-08-23, PLAN-014 완료) — 판정: Core Closure Supported.**
사용자가 "신뢰가 아닌 현재 증거로 총검증"을 요청, Codex 초안(총검증 단일 계획)을 Claude 리뷰로
G0+core M1/M2로 축소 개정 후 실행. **G0**: AppShell 전량-실행 flake의 root cause는 vitest jsdom
(pretendToBeVisual)의 실-타이머 rAF가 부하 중 `await act` 사이에 발화해 빈 보드 0.2s 재생을 완주시킨
것 + afterEach 부분 리셋 leak — 프레임 삼킴 큐 + `getInitialState` 전체 리셋으로 종결(전량 3회+serial
연속 PASS). **M1**: I1~I10 전부에 mutant, SURVIVED 0 — 자기 detector KILL 8종, I9(relayout self-heal
+멱등)가 사실상 광역 2차 방어선, I7은 I5에 구조적으로 가려짐(2차 울타리), I8은 문서 mutation 불가로
predicate 단위 검증. **M2**: semantic resolver 1개(heldBallPos), 우회 조립 0, 커밋 문서의 relayout
우회 0, 6 fixture 전 junction parity Δ=0.0000(계약 0.25m), relayout 0.07~0.58ms, 저장 왕복 byte 동일.
Findings 6건 전부 P2(detector 계층·import 정책·tie-break) — 제품 결함 아님, remediation 후보.
증거: `plans/evidence/PLAN-014-M1-mutation-report.md`, `PLAN-014-M2-junction-graph.md`,
계약: `invariantMutation.test.ts` 17핀, `junctionParity.test.ts` 8. **범위 한정**: core
document/engine/editor만.

**D-browser (2026-08-23, DG-BROWSER 1안 채택 — 사용자 "당연히 설치해")**: Playwright 1.62.1 tracked +
`pw/` probe 4종. **R12-D Resolved** — 전 viewport(DPR2·ultrawide·tall 포함) CTM 등방, pick의 m/px가
실제 1/ctm.a와 일치, 히트 밴드 실측 6~7px, dead strip 0. **R7 Resolved** — blur/lostcapture/cancel/Esc
모두 열린 transaction 없음(단 blur는 취소가 아니라 이후 pointerup에서 커밋 — F-D-03 P3).
**R5 Confirmed (P1)** — 호버는 전역 rank(norm), 프레스는 카테고리+intent 우선순위(고스트>경로)를 써서
**모든 런 끝점 ±2m 띠에서 호버 약속≠실제 대상**: 경로를 휘려 겨눴는데 런 도착점이 끌려간다.
증거·원인·수정 후보: `plans/evidence/PLAN-014-D-browser-report.md`, 재현: `pw/r5-diagnose.cjs`.

### 이전 목표(완료): 순간 문법

**순간 문법 (2026-08-22, PLAN-013 완료) — Alt 경로 지정의 구조 수술.** 사용자가 사진 3장으로 "찍은
곳으로 안 간다 + 설명이 2배 + 마지막 고스트에선 안내선이 안 나온다"를 보고. 원인: 목적지가 무저장이라
3중 유도(단계 창 강제 × 리시버 4중 추측 × 앵커 이동)의 고정점 = **리시버의 최종 위치**가 됐다.
결정: **클릭은 순간을 고르고, Alt+클릭은 순간으로 보낸다** — travel `target:{entityId,step}` 저장
(additive), 정확 동기화(늘림·줄임), 물리 리시버만, aim 무장 상태 삭제, `deriveSubject` 하나로 주어 유도.
ADR-0009 v27 / ADR-0010 D9 / CHG-161. 계약: `destinationMoment.test.ts` 8 + `pw/altcases.cjs`.

### 이전 목표(완료): 전술 퍼즈

**전술 퍼즈 확립 (2026-08-22, 세션 19) — "어떠한 전술 재현에도 의도하지 않은 버그가 없도록" 검증.**
사용자 요청으로 **조작 순서를 무작위화하는 퍼즈** 2단을 만들었다: `tacticFuzz`(커맨드 층, 360세션)와
`pw/marathon.cjs`(포인터 층 — 의도 해석·픽·오빗·슬링까지). 둘 다 **매 조작 직후** 같은 결과 기준
불변식 10개(I1~I10)를 본다: 컴파일 오류 0 / NaN 없음 / 한 엔티티 한 단계 하나 / 선수 체인은 토큰에서 출발하고
이음매가 벌어지지 않음 / 공 연속성(B1) / 패스는 공이 실제로 있는 곳에서 출발 / 도착점은 공이 멎는 곳 /
패스 비중첩 / 파이프라인 멱등. 세션의 1/3은 **내장 예시**에서 시작한다.

결함 9종이 나왔고 전부 손으로 재현 가능한 실제 버그였다 — 단계 클램프로 두 움직임이 9단계에 겹침,
파이프라인이 자기 고정점이 아님, 공 이동/플링이 파이프라인 없이 커밋, 헤어핀에서 공이 소유자를 가로지름,
리시버 없는 패스 뒤 엉뚱한 선수에게서 발사, 앵커가 명목 시각을 읽음, 첫 다리를 지우면 선수가 순간이동,
삭제된 선수를 공이 계속 탐, 고정한 캐리 면이 되살아남. 상세: ADR-0010 D8 / CHG-152·153.

그리고 **공은 '정체'가 아니라 '순간'으로 잡힌다**(ADR-0009 v25 / CHG-151): 선수 체인은 늘어나기만
하지만 공은 하나뿐이라, 이른 순간에 잡는 것은 분기가 아니라 **덮어쓰기**다.

### 이전 목표(완료): 불변식 B1

**불변식 B1 확립 (2026-08-22) — "패스가 수신자의 출발 지점에서 발사"되던 고질 결함 종결.**
사용자가 "고쳤다고 몇 번을 말해도 꾸준히 생긴다"고 지목한 결함. 원인 3건 확정: (1) compile 고정점이
**저작 순서**에 의존해 아직 배치 안 된 수신자의 home을 앵커로 굳힘, (2) "선수 발밑 공 위치" 공식이
`syncTravelReceiverInDraft`와 `heldBallPos` 두 벌, (3) 앵커·타이밍 단계의 순차 실행으로 앞 단계가 낡음.
핵심 산출물은 개별 수정이 아니라 **불변식**: `src/engine/ballContinuity.ts`가 "공은 순간이동하지 않는다"를
resolver 구현이 아닌 **결과**로 검사하고, 퍼즈가 저작 순서를 무작위화한다(3000세션 0건; 수정 전 35시드 내 3건).
브라우저 재현 4.19m→0.00m. **내장 예시 8개 전부**가 캐치마다 2.0~7.04m 순간이동 중이었고 지금은 전부 연속.
ADR-0010 D7 / CHG-20260822-139.

### 이전 목표(완료): PLAN-011

**PLAN-011(예시 전술 품질 개선, 2026-08-21) 완료** — 8개 예시의 모든 이동/공 경로에 명시적
단계를 부여하고, 선수 간격·지원/압박/커버 위치·공 소유권·패스/슈팅 도착을 다시 저작했다. 모든 예시는
production `relayoutStepsInDraft`를 거쳐 첫 편집 후에도 단계가 무너지지 않으며, 전수 회귀 테스트와
1440×1000 실제 UI 중간/종료 frame 점검을 통과했다. 구현: `src/presets/scenarios.ts`, 계약:
`src/presets/scenarios.test.ts`.

### Parked: PLAN-010

**PLAN-010(설명 가능한 전술 시퀀서 로드맵, 2026-08-21) Parked** — 저장소 현황과 전술 보드·코칭·
비디오 분석 제품 13종, 축구 동적 시각화·video-based decision training·multimedia learning 연구를 조사했다.
권장 순서: `Phase/설명 모드 → timed coaching layer → Trigger Link → 전술 오버레이 → Playbook/Variant → 선수 학습 → 공유`.
3D/VR, 실경기 tracking, 생성형 AI, 실시간 협업은 보류. 상세 근거는
`docs/product/BENCHMARK_RESEARCH_2026-08-21.md`, 실행안은
`docs/agent/plans/PLAN-20260821-010-feature-roadmap-draft.md`.
**사용자가 다시 요청하기 전 자동 재개하지 않는다.** 구현 전 Decision Gates G1~G5 사용자 확정 필요.

### 이전 목표(완료): PLAN-009

**PLAN-009(공 정션 구조 봉합, 2026-08-21) 완료** — Codex 구조 감사(handoffs/REVIEW-ball-carry-structural.md)
채택(ADR-0010). M1 공용 carry resolver(`src/engine/carry.ts`, compile release=stateAt, 경계 연속·핀 통과),
M2 도착 고스트 전용 command(`moveTravelEndInDraft`+`orbit-receive`, 곡률·hold·receiver 불변),
M3 bend 국소화(±1 창만 재스무딩), M4 relayout 단일 파이프라인(구조→timing→anchor(정확 t)→제약, byte 멱등,
재진입 제거), M5 validator 보강(carryEnd/offset/offsetLocked/pressures/hold/receiver 참조)+
attach 상수 단일화(`CARRY_RING_MIN/MAX_M`, `ATTACH_RADIUS_M`). 감사 확정 결함 S1/S3/S5·R1/R2/R9/R12-A/B/C 전부 해소.
**2안(BallJunction 스키마)은 조건부 보류** — 동종 결함 재발 시 이행(ADR-0010 D1). 감사 '위험' 항목
R5(pick dispatch)/R7(blur·lostpointercapture cancel)/R12-D(letterbox 7px)/R12-E(tie-break)는 후속 후보.
**EXTERNAL-VERIFICATION-PENDING(사용자)**: 도착 고스트 회전 체감(곡률 불변), 방향 전환 드리블 경계, 패스 원점 화면=재생 일치.

### 이전 목표(완료): PLAN-008

**PLAN-008(자유 그리기, 2026-08-21) 완료** — 펜(freehand)+획 단위 지우개, 하단 바 전환(D/Esc),
색 4·굵기 3, GIF 포함. 사용자 결정 D-01~D-04는 ACTIVE_PLAN에 기록. QA 후속(2026-08-20):
고스트 정션 동반 이동(CHG-077), 패스 도착 부착(CHG-078), 접근측 안착(CHG-079), 드리블→패스
경계 캐리 잔상(CHG-080). PLAN-006 리디자인은 **M0~M7 전부 완료·AGENT-VERIFIED** (토큰·재질 → 셸 계층 → 22명 판독성 → 마이크로 인터랙션 → 재생 무대 → a11y → 사후 증거/성능/감사). 다음: 사용자 Browser Acceptance Checklist → 피드백 라운드. **PLAN-007(겹침 선택 대개편) M0~M4 완료** — 기하 후보 히트·호버 예고·재클릭 순환, 골든 G1~G7 보존(ADR-0009 v5). PLAN-005는 완료·배포됨(Vercel 자동 배포, GitHub push 상시 위임).

### PLAN-005 요약 (2026-08-20, 커밋 d246f43…)

- M1: 단계 칩=시작 장면 preview(문서 불변) · `▶ 이 단계만`/`▶ 여기부터` · 일시정지/종료=frame 유지("결과 화면"), Home/편집 시작 시 복귀 · Space/버튼 공용 action.
- M2: 배지 클릭=선택만 · SelectionActionBar(단계 picker·재생·삭제) · `움직임 전체 지우기`(1 undo) · clearStep/clearEntity/clearAll · 단계 상한 9 통일.
- M3: `gestureIntent.ts` 순수 intent 판정 · **경로 드래그=항상 휘기**(그룹 이동은 토큰 드래그) · 체인 9단계 초과 차단+토스트 · toast 렌더러 추가.
- M4: 재생 중 active 경로 강조(casing)·past/future 후퇴 · 고스트 전역 단계 감쇠 · 배지 충돌 회피 · chip aria-current. **후속(CHG-043): 재생 중에는 경로/화살표 전부 숨김(사용자 지시)** — 강조는 일시정지/미리보기 frame에서만.
- M5: 세션 A/B 변형(독립 EditorCore/undo, 메모리 한정, 새로고침 소멸).
- M6: 짧은 드래그 이유 토스트 · 옵트인 미니 투어(굽히기→단계 재생→undo) · 고스트/배지 160ms 페이드(reduced-motion 즉시) · 공 드롭 스프링 배선.
- M7: dead state(animMode·timelineExpanded·autoReactOpen·theme)·dead CSS·dead i18n 제거, ADR-0009 Amendment v4, 문서 정합화.
- 검증: `npm run typecheck && npm run lint && npm test`(116) `&& npm run build && npm run harness:verify && npm run format:check` 전부 PASS + Playwright 헤드리스 probe(m1~m6) PASS.
- **EXTERNAL-VERIFICATION-PENDING(사용자)**: 결과 유지/복귀 체감, 경로 드래그=휘기 적응, A/B 흐름, 고스트 감쇠 수치(A-05), 드롭 스프링·페이드 체감, 미니 투어 문구.
- A-04(route handle) 보류 — Shift 유지. 재론 시 ADR-0009 Amendment로.
- 후속 사용자 지시(CHG-043~~044): 재생 중 경로/화살표 숨김 · 배지 클릭=인라인 1~~9 피커 · 셰브론 화살촉 · 제목 입력 제거·애플식 카드 UI(패널/하단 부유 바).

## Current Status

**동작하는 전체 플로우** (`npm run dev`):

- 왼쪽 사이드바 **예시 전술 8종**: 2v2 압박 탈출 · 원투 · 제3자 침투 · 오버랩/언더랩 · 4-3-3 빌드업 · 전방 압박 · 전환 · 컷백. 클릭 시 로드·자동 재생. ☰ 문서 메뉴: 새 전술 · JSON 열기/저장 · PNG/SVG 내보내기 · 자동 저장.
- 배치: 포메이션 12종 · 선수 추가(W) · drag/스냅/그룹 드래그/마퀴/Ctrl 클릭/Ctrl+A · 공 주기(드롭 또는 버튼).
- 움직임: Alt+드래그 / 더블클릭 / E → 드래그 = 이동 경로(시작=재생 위치) · 공 선택 후 드래그 = 패스(수신자 자동, 패스 후 재생 위치=도착) · waypoint 편집 · 세그먼트 인스펙터(시작 조건 5종·속도·길이·easing·종류·궤적·수신자·경유지 대기) · 트랙 블록 드래그/리사이즈.
- 재생: Space/scrub/속도/반복, 공 패턴·회전·로빙·잔상, 킥/리시브 pulse, 이동 중 방향 쐐기.
- 주석: 구역(A, Shift 타원)·화살표(R)·텍스트(S) — 선택/이동/삭제.
- **⚡ 자동 대응**(ADR-0007 P1): 팀·압박 강도·지연 → press/cover/shape 움직임 생성(공 이벤트 앵커, 편집 가능, 재생성/제거).
- 라이트 테마 기본(☾ 토글), 우측 단일 컬럼(속성 + 도움말 접기), `?` 단축키 오버레이.
- **라운드 4**: 왼손 키맵(`src/ui/keymap.ts`: Q/W/E/R/A/S/D, Z/X/C/V/G, Space, Alt+드래그=경로, Shift=직선, Ctrl=스냅해제), **휙 던지기**(공: 감속 굴러감→패스/루즈볼, 선수: 런), **재생 위치에서 드래그 = 그 시각 움직임 끝 수정**, 스트로크 전처리(직선 스냅/부드러운 곡선), `docs/agent/CODEX_BRIEF.md`.
- **PLAN-003 (라운드 5)**: ISSUE-006 패스 시작점 잠금 마커 · dangling 공 보유자 버그 수정 · 타임라인 **팀 필터/접기**(선택 선수 행은 항상 표시) · **Shift+드래그 path-scrub**(경로 따라 끌면 재생 위치 이동, Ctrl=선택 토글로 변경) · 자동 대응 **연속성·coalesce·anti-shuttle·hysteresis** · 접근성(inert·aria·포커스 복귀·슬라이더 키보드·블록 키보드 선택·Space 가드) · ADR-0003 Amendment(decel) · ADR-0008 Proposed(공격 반응).
- **PLAN-004 R1**: import 중첩 검증(잘못된 JSON은 문제 목록과 함께 거부), Inspector 입력 undo 병합, geometry→engine, teamColor 분리, 문서 정합화.
- **PLAN-004 R2 (첫 방문 UX)**: 빈 필드 **런처**(양 팀 채우고 시작 · 예시 2종 · W 안내) · Inspector **시작하기 체크리스트**(자동 ✓) · **fling 오인 버그 수정**(멈췄다 놓으면 이동, 임계 45 m/s) · 첫 채움 시 공 보유자 자동 · 자동 대응 기본 팀 = 상대/빈 팀 경고+채우기 · 포메이션 버튼 ▾ · 오버레이 개발자 문구 제거.
- **PLAN-004 R3 (튜토리얼)**: 첫 방문(쿠키/localStorage 미설정) 시 8단계 **스포트라이트 투어** — 실제 버튼/토큰을 하이라이트, 사용자가 행동하면 ✓ 후 자동 진행, 비차단, 건너뛰기/다음/완료, HelpPanel에서 다시 보기.
- **PLAN-004 R4 (QA 1라운드)**: 기본 팀 history 밖 · 문서 교체 undo 가능 + 새 전술 인라인 확인 · 패스 끝 드래그 시 수신자 재해석 · 패스 직후 Space는 그린 지점부터 · 예시 자동 재생 · 팝오버 Esc/`?` 정리 · Inspector 우선 높이 · 투어 z-order · 한국어 프리셋 · OS 테마 · 텍스트 더블클릭 편집.
- **PLAN-004 R5 (QA 2라운드)**: Space 경로 통일(playFrom, 마우스 포커스 버튼 무시) · Tab 포커스 트랩 해소 · 텍스트 더블클릭 편집 · 토스트 위치 · 제목 Enter/Esc · 트랙 높이 30vh · 투어 keep-out/onEnter/🎓 타깃 · `?` 포커스 트랩 · 필터 빈 문구 · 시작 조건 카피.
- **PLAN-004 R6 (QA 3라운드)**: 체인 패스 순환 버그(passerFor/possessTrigger) · Space 모달리티 추적 · Ctrl+S 토스트 · 배너 한국어 · 투어 available/핸드오버/⚡ 카드 위치 · S 도구 라벨 편집.
- **PLAN-004 R7 (QA 4라운드)**: PitchStage stale closure(수신자/런 체인/플링) · 보유 공 드래그 커서 추종 · 비행 중 패스 끝=커서 · 공 주기 첫 possessed 교체 · 미해석 블록 표시 · 토스트 live region.
- **PLAN-004 R8 (QA 5라운드)**: 보유 공 드래그 시각 피드백/고스트 · 공 마지막 움직임 후 드래그=새 패스·flick=킥 · 루즈볼 fling 시작점 · 포메이션 변경 시 고스트 패스 정리+인라인 확인 · 트랙 패널 내용 높이 · 순환 시 빗금 블록 유지.
- **PLAN-004 R9 (QA 6라운드, 루프 종료)**: 패스 삭제 시 수신자 possessed 동반 삭제 · 핸드오버 undo 1회 · authored 트랙 시 빈 잔디 드롭 no-op · 720 트랙 높이.
- **PLAN-004 R27**: 단계 배지를 경로 중앙에 흐리게(끝점은 고스트 전용).
- **PLAN-004 R26**: 고스트 일반 드래그=끝 위치 미세조정 · 선택 플레이 경로 드래그=통째 이동 · 고스트 공 크기 통일.
- **PLAN-004 R25**: 경로 드래그로 곡률 벤딩(스무스 경유점 삽입·재스무딩, 1 undo).
- **PLAN-004 R24**: 공 고스트 공 모양 · 그리기 스냅 피드백(흡착+링+고스트 하이라이트) · 수신자 후보에 고스트 위치 · 마퀴 선분 교차.
- **PLAN-004 R23**: 패스 수신자 연속 소유(공 고스트 발 옆 오프셋 · 수신자 판정 3단 폴백) — 받은 선수가 달리면 공 동행.
- **PLAN-004 R22**: 보유자 이동 끝 지점에 공 고스트(그 자리에서 패스 시작 가능) · 고스트 호버 하이라이트.
- **PLAN-004 R21**: 재생 종료 시 원위치 복귀(선명=시작·흐림=끝 유지) · 그룹 드래그 시 경로(공 포함) 동반 이동.
- **PLAN-004 R20**: 지그재그 체인(Shift 유지 + 누르고-끌기 반복 = 다리마다 단계 +1·고스트 점층 흐림) · 공 드래그 = 시작점 이동(패스 있어도).
- **PLAN-004 R19**: 포메이션 포지션 카드 표시(DF/DM/AM/MF/FW) · 고스트 최상위 + Shift 게이트(겹친 토큰 위에서도 이어 그리기).
- **PLAN-004 R18**: 고스트 체인(진행 위치마다 흐린 토큰, Shift+드래그로 이어 그리기) · 그리기 = Shift+드래그(더블클릭 제거) · 애니메이션 모드 토글 제거(상시).
- **PLAN-004 R17**: 휙 던지기 제거 · 선택 링 공=흰/선수=팀색 · 연속 체인 그리기(다음 경로는 마지막 위치에서 시작).
- **PLAN-004 R16**: 포지션 19종(그룹 셀렉트), 토큰 라벨 = 이름(포지션).
- **PLAN-004 R15**: ⚡ 자동 대응 버튼 제거 · 선수 클릭=번호/이름/포지션 카드 · 채우기 포메이션 선택(Home/Away) · 조작법 패널 가독성 개선 · 단계 칩 1~9 상시.
- **PLAN-004 R14**: 스크럽 제거 · 단계 1~9 · 같은 단계 같이 시작·같이 끝남(느린 쪽에 맞춤) · 라이트 웜 톤 고정(다크 제거) · 배지 흐림 · 마퀴 선택·그룹 드래그.
- **PLAN-004 R13**: 중앙 시작 런처 창 제거 — 시작은 왼쪽 [양 팀 채우기] 또는 Ctrl+클릭.
- **PLAN-004 R12**: 빈 잔디 드래그 = 박스 다중 선택 + 그룹 드래그 · 라이트 테마 웜 크림 배경(순백 아님) · 잔디 밝게.
- **PLAN-004 R11 (간편 모드 v2)**: Ctrl+클릭=우리팀·Ctrl+우클릭=상대팀 투입 · 좌 기능 패널(채우기/공 투입/⚡/새로 시작) · 우 조작법 패널 · 하단 🎬 애니메이션 모드 토글(켜야 더블클릭·재생 바·단계) · 새로고침 클린(자동저장·JSON·PNG·SVG 제거).
- **PLAN-004 R10 (간편 모드, ADR-0009)**: 좌클릭=우리팀·우클릭=상대팀·더블클릭=경로/패스·드래그=이동·휙=달리기, **단계 1~10**(같은 번호 같이 시작, 다음 번호는 앞이 끝나면), 경로 배지로 번호 변경, 화면=필드+재생바+단계 칩(도구 레일/인스펙터/트랙 제거), 튜토리얼 5장.
- 검증: **90 tests**(간편 모드 재작성) · build · harness PASS. QA 루프 결과: 6라운드(Playwright 에이전트), 발견 P0 5 · P1 14 · P2 30+ 수정, 마지막 라운드 신규 발견 P1 1·P2 2·P3 2 → 수정 후 종료. Playwright 하네스(scratchpad `pw/`: `lib.cjs`, `baseline.cjs`, `tour.cjs`)로 첫 방문·투어 워크스루 PASS.

미구현/후순위: Record 모드, Scene/Phase 복제, 상대 공격 반응(ADR-0008 Proposed), Playwright, Inspector transaction coalescing(ADR-0005), playback 렌더 프로파일링, schema nested validation.

저장소: `c0ae17c` (R1~R21, 2026-08-20 사용자 지시로 커밋). push 0 — 지시 시만.

## Active Work

`plans/ACTIVE_PLAN.md` PLAN-20260825-017 — **완료**(2026-08-25). 전면 캔버스 M1~M5 충족:
5게이트 PASS(359 tests), 브라우저 216 checks ALL PASS(`pw/full-bleed` 37 — 레이아웃·발견성 계약 상시 감시).
직전 완료: `plans/completed/PLAN-20260825-016-interface-refit.md`.

과거(참고): PLAN-20260823-014 — **전 축 완료**(A 재현 무결성 / B 단일 진실원 / C 문서 drift /
D 구조·브라우저 / E UX core). 모든 Finding 수정·회귀 방어 완료, 미해결 P0/P1 0.
남은 것은 사용자 체감(DELEGATED)과 선택적 E-polish(contrast/CLS/광범위 viewport)뿐이다.
직전 완료: `plans/completed/PLAN-20260822-013-moment-grammar.md`.

## Known Issues

### ISSUE-002 — Claude hooks/deny 활성 — **Resolved**: 이 세션에서 SessionStart hook 출력과 harness:verify 게이트가 모두 동작 확인됨

### ISSUE-003 — node engine 경고 — **Not Reproduced**(2026-08-23, node v22.12.0에서 설치·빌드·테스트 전 게이트 경고 0). 재현되면 다시 연다

### ISSUE-004 — spring/pulse 강도 체감 미판정 — Open (공 1.45×, 선수 1.18×, drop b0.25)

### ISSUE-006 — 패스 경로 시작점 시각화 — Resolved (PLAN-003 M1, 잠긴 마커)

### ISSUE-008 — fling 상수 — Open(체감). **주의**: player fling은 이후 결정으로 제거됨 — player gain 문구는 과거 기록이다(PLAN-014 AMB-05)

### ISSUE-009 — 리드 패스 — **Resolved**(v27 목적지 순간 + PLAN-014 M2 F2/F3 parity로 확인). 달리는 수신자에게 보낸 패스는 도착 시각이 그 순간에 동기되고 수신자가 실제로 소유한다

### ISSUE-007 — 자동 대응 품질 — 연속성/coalesce/anti-shuttle 테스트로 고정(PLAN-003 M4), 트랙 팀 필터(M2). 체감 확인만 남음 → Open(체감)

## Locked / Stable Areas

ADR-0001~0007 Accepted, VDR-0001. `src/domain/types.ts` shape 불변. engine/domain 순수성·renderer spring 금지(MACHINE).

## Open Decisions

- 커밋 시점(C-01). 리뷰 후 우선순위.
- **여러 전술 보관·기기 간 이동** — 자동 저장은 1칸(눈앞의 판)만 한다(ADR-0009 v26). 보관함이나
  JSON 저장/열기 UI 복구는 아직 결정 안 됨(사용자가 "기본"을 선택하며 보류).

## Next Exact Steps

PLAN-017(전면 캔버스)은 구현·검증 완료다.

0. (사용자) `npm run dev` → 새 골격 체감:
   - 보드가 커진 만큼 **선수·경로가 읽기 편한지**(1440에서 마킹 921 → 1102).
   - `팀 구성 ▾`/`보드 ▾`가 손에 붙는지 — 상시 패널이 없어져 아쉬운 컨트롤이 있는지.
   - **맥락 힌트**(Ctrl/Alt 누를 때 좌상단 3줄)가 도움이 되는지, 아니면 방해되는지.
   - `F`로 크롬을 감췄을 때 보드가 더 커지는 것이 자연스러운지.

아래는 PLAN-015 이후 반영된 이전 라운드 기록이다.

1. (해결됨, CHG-206) 공 경로가 고른 단계가 아니라 1단계로 가던 문제 — **전체 보기**에서
   시계가 킥오프에 고정돼 있어 공의 "순간"이 항상 step 0으로 읽혔다. 순간은 사용자가 보드를
   세워 둔 곳에만 있다(`parkedBallMoment`).
2. (해결됨, CHG-207 / ADR-0009 **v28**) 단계 레이어를 넘기다 전술이 섞이던 문제 3건.
   **숫자키·칩은 보기만 한다**(재배치는 Shift+1~9), 결과 화면은 자기가 서 있는 단계를
   가리키며, 단계 핀은 자기 치유 전용이라 일시정지가 프레임을 붙잡는다.
   상시 감시: `pw/step-view-fuzz` (보기 조작만 시드 순서로 100회, 매 조작 뒤 불변식 12개).
3. (사용자) `npm run dev` → 체감 확인:
   - 숫자키로 단계를 넘길 때 **한 단계만** 깨끗하게 보이는지.
   - `Shift+숫자`로 경로 단계 옮기기가 손에 붙는지(패널에 안내 있음).
   - 행진하는 대시의 **속도(26 units/s)와 리듬**(런 11/5, 패스 6/5)이 읽기 좋은지.
   - 다크모드 대비, 보라색 액센트, 라이트 잔디 색(둘 다 되돌리기 가능한 실험).
4. (선택) E-polish — contrast/CLS/광범위 viewport. 두 테마 모두 대상.
5. (선택) 포인터 마라톤 재작성 — 과거 `pw/marathon.cjs`는 소스가 없다.

## DELEGATED 체크리스트 (사용자, 라운드 6 — 첫 방문)

- [ ] 시크릿 창(또는 DevTools에서 localStorage `st:tour:seen:v1`·쿠키 `st_tour_seen` 삭제) → 튜토리얼 1/8이 런처 버튼을 비추며 시작. 버튼을 누르면 ✓ 후 2/8로 넘어가 #9를 비춤. 끌어 놓으면 3/8 …. 8/8 완료 후 새로고침 시 안 나옴. 우측 도움말 패널 "🎓 튜토리얼 다시 보기"로 재시작.
- [ ] 투어 중에도 모든 조작 가능(카드만 클릭 가로챔), 카드가 조작 대상을 가리지 않는지(토큰 단계는 옆, 런처 단계는 아래).

- [ ] 새 브라우저 프로필(또는 ☰ 새 전술)로 열기 → 중앙 런처 보임 → **양 팀 채우고 시작** 한 번에 22명 + #10 공 보유. Ctrl+Z 한 번에 되돌아감.
- [ ] 선수를 천천히 끌어 놓기 = 이동(경로 안 생김). 빠르게 휙 놓기 = 달리기 경로. 경계가 자연스러운지.
- [ ] 우측 "시작하기" 4단계가 하면서 ✓ 되는지, 다 하면 한 줄로 줄어드는지.
- [ ] Home만 채우고 ⚡ → Away 기본 선택 + "Away 4-4-2 채우기" 경고 버튼.

## DELEGATED 체크리스트 (사용자, 라운드 5)

- [ ] 예시 불러오기 → 공 선택 → 패스 클릭: 시작점이 보유자에 붙은 **점선 링 잠긴 점**, 드래그 안 됨. 두 번째 점은 드래그 됨.
- [ ] 트랙 패널(V): 상단 **전체 · Home · Away** 필터, 그룹 헤더 ▸ 접기. 접힌/필터된 팀의 선수를 pitch에서 클릭하면 그 행만 ● 표시로 나타남.
- [ ] 경로 있는 선수 위에서 **Shift+드래그**: 장면 전체가 그 시각으로 이동(흰 점선 링 = 경로 위 위치). 왕복 경로 교차에서 튀지 않음. Ctrl+클릭 = 선택 추가(Shift는 이제 스크럽·직선·타원).
- [ ] ⚡ 자동 대응 → 빠른 패스 장면(예시 "원투")에서 재생성: 순간이동·제자리 왕복 없음, 압박 담당이 필요할 때만 교대.
- [ ] 키보드만: Tab 순회(상단 → 레일 → pitch → 우측 → 타임라인), ? 키로 열면 포커스가 대화상자로, Esc로 원래 버튼 복귀. 포커스된 버튼에서 Space = 그 버튼(재생 아님). 슬라이더 포커스 후 ←/→/Home/End.
- [ ] 공 던지기(휙), Alt+드래그, 재생 위치에서 드래그 = 끝점 수정 — 라운드 4 항목 재확인.

## Last Verified

- `npm run typecheck` → PASS — 2026-08-24 (세션 21)
- `npm run lint` → PASS — 2026-08-24
- `npm test` → PASS (49 files / **346 tests**) — 2026-08-24
- `npm run build` → PASS — 2026-08-24
- `npm run harness:verify` → PASS (0 warnings) — 2026-08-24
- 브라우저 probe `node pw/run.cjs` (7종) → **144 checks ALL PASS**, 콘솔 클린 — 2026-08-24
- tactic-lab 누적 **600 세션** 실 결함 0 (토큰-시계 오차 0.000m, 공 최고 28.5 m/s, 배지 충돌 0) — 2026-08-24
- feel-lab 대비 **206/207 양 테마**, 모션 어휘 이탈 0, 히트 미달 2(텍스트 링크) — 2026-08-24
  (테마 순환·리로드 유지·다크 실도색 / 2단계에서 1단계 trace / 1단계에서 2단계 **트리 제거** /
  격리 해제 복귀 / **자동으로 밀려난 움직임이 보드에 남는다(CHG-195 회귀)** /
  플링 기본 꺼짐 overshoot 1.60m / 켜면 조작법 행 복귀)
- 나머지 probe 6종은 이번 세션 **NOT RUN** — 2026-08-23 결과는 그 날짜의 증거다.

### 이전 세션 (2026-08-23, 세션 20)

- `npm run typecheck` → PASS — 2026-08-23 (세션 20)
- `npm run lint` → PASS — 2026-08-23
- `npm test` → PASS (46 files / **324 tests**), 전량 3회 연속 + `--maxWorkers=1` 1회 — 2026-08-23
- `npm run build` → PASS — 2026-08-23
- `npm run harness:verify` → PASS (0 warnings) — 2026-08-23
- mutation-kill 스위트 (`invariantMutation.test.ts`, 17핀) → PASS, SURVIVED 0 — 2026-08-23
- junction parity 스위트 (`junctionParity.test.ts`, 8) → PASS, 전 junction Δ=0.0000 — 2026-08-23
- `npx vitest run src/editor/tacticFuzz.test.ts` 기본 campaign(360세션) → PASS — 2026-08-23
- 브라우저 probe 6종 `node pw/run.cjs` → **102 checks ALL PASS** (hit-scale 42 / gesture-cancel 17 /
  pick-overlap 13 / reduced-motion 5 / r5-diagnose 11 / ux-core 14) — 2026-08-23
- 강화 퍼즈 `ST_FUZZ_SHORT=1500 ST_FUZZ_LONG=300` (1800세션, 좁힌 B1 예산) → 위반 0 — 2026-08-23
- marathon(무작위 포인터 마라톤)은 **NOT RUN** — 소스 미작성, 후속 후보
  아래 2026-08-22 브라우저 결과는 HISTORICAL이며 현재 PASS로 재인용하지 않음)

### 이전 세션 (2026-08-22, 세션 19)

- `npm run typecheck` → PASS — 2026-08-22 (세션 19)
- `npm run lint` → PASS — 2026-08-22
- `npm test` → PASS (39 files / 261 tests) — 2026-08-22
- `npm run build` → PASS — 2026-08-22
- `npm run harness:verify` → PASS (0 warnings) — 2026-08-22
- **전술 퍼즈 7200세션** (짧은 6000 × 12조작 + 긴 1200 × 40조작, 세션 1/3은 내장 예시에서 시작,
  조작 19종 + 세션 끝 undo→redo 되감기, 결과 기준 불변식 10개) → **위반 0** — 2026-08-22
  (`ST_FUZZ_SHORT=6000 ST_FUZZ_LONG=1200 npx vitest run tacticFuzz`, 415초)
- **브라우저 마라톤** 실제 포인터 제스처 19종 무작위, 매 제스처 후 페이지 안에서 같은 불변식 →
  최종 빌드에서 **1800 제스처/30세션 + 600 제스처/12세션 위반 0** — 2026-08-22 (`pw/marathon.cjs`)
- 내장 예시 8종 B1 연속 (`scenarioContinuity.test.ts`) → PASS — 2026-08-22
- 브라우저 프로브 22종(ballmoment/ballrest/midghost/throughball/steps/aimclick/passland/orbit/
  identity/colors/homeanchor/overhaul/fling/cues/panelbtns/launchorigin/throughplayer/gif/
  render/carrylook/receiveside/autosave) → 전부 PASS(최종 빌드 전수 재실행) — 2026-08-22
- 렌더 대조(`render.cjs`) — 재생 중 토큰의 실제 SVG transform vs 시계: 최대 0.22m(스프링 정착),
  m↔px 왕복 1.4e-14m → PASS — 2026-08-22

### 이전 세션 (2026-08-21)

- `npm run typecheck` → PASS — 2026-08-21
- `npm run lint` → PASS — 2026-08-21
- `npm test` → PASS (29 files / 176 tests) — 2026-08-21
- `npm run build` → PASS — 2026-08-21
- `npm run format:check` → PASS — 2026-08-21
- `npm run harness:verify` → PASS (0 warnings) — 2026-08-21
- 예시 8종 UI 자동 재생(1440×1000, 중간/종료 frame) → PASS — 2026-08-21
- dev 서버 모듈 200 — 2026-08-20
- Playwright 첫 방문 워크스루(빈 localStorage, 1440×900, 라이트/다크) → PASS (스크린샷 육안, R2) — 2026-08-20
- 브라우저 체감(스프링/fling/scrub) → NOT VERIFIED (사용자 리뷰)
