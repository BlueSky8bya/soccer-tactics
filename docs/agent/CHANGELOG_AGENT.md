# Agent Change Log — Soccer Tactics

> 에이전트가 수행한 의미 있는 변경. formatting/import 정렬/사소한 오타는 기록하지 않는다.
> Change ID 형식: `CHG-YYYYMMDD-NNN`. 코드 annotation: `[WH-CHANGE vX.Y.Z | TYPE | YYYY-MM-DD | CHG-...]`.

## v0.1.0 — 2026-08-19

### CHG-20260819-001 — INIT — Harness bootstrap + project skeleton (M0)

Problem:
빈 저장소. 세션 기억에 의존하지 않는 장기 운영 구조 필요.

Change:

- WHITEHAVEN Harness 생성: `AGENTS.md`, `CLAUDE.md`, `agent-harness.yaml`, `docs/agent/{CONSTITUTION,CURRENT_STATE,PROJECT_MAP,RISK_PROFILE,DEFINITION_OF_DONE,CHANGELOG_AGENT}`, decisions(ADR-0001~0006, VDR-0001, DECISION_INDEX), plans/ACTIVE_PLAN, handoffs/, decision-assets/VDR-0001.
- 제품 문서: `docs/product/{PRODUCT_BRIEF,UX_LAYOUT_PROPOSAL,UX_RESEARCH}`.
- Skeleton: Vite 8 + React 19 + TS 6 + Vitest 4 + oxlint + Prettier, Zustand/immer deps. `src/domain/types.ts`(ADR-0003 스키마), `src/domain/factories.ts`, `src/engine/vec.ts`, `src/ui/tokens.css`, `src/app/*`.
- Scripts: `scripts/agent-harness/{verify-harness,state-drift-check,create-handoff,session-brief}.mjs`. `.claude/settings.json` hooks + permissions deny.

Files:

- (위 전체 — 초기 커밋 범위)

Validation:

- `npm install` → (아래 CURRENT_STATE Last Verified 참조)
- `npm run typecheck` / `lint` / `test` / `build` / `harness:verify` → CURRENT_STATE 참조

Related:

- ADR-0001~0006, VDR-0001, PLAN-20260819-001

Rollback:

- 초기 커밋 이전: 폴더 내용 삭제(사용자 기존 자산 없음). 커밋 후: 해당 커밋 revert.

Documentation Updated:

- CURRENT_STATE, PROJECT_MAP, DECISION_INDEX, ACTIVE_PLAN

### CHG-20260819-002 — FEAT — M1 Tactical Board Foundation

Problem:
코드 기능 0. 전술판 기반(배치·선택·drag·undo·formation) 필요 (PLAN-20260819-002).

Change:

- `src/editor/`: `EditorCore`(transactional history, begin/update/commit/cancel, coalesce, 상한 200), `commands.ts`(addPlayer/removeEntities/nudge/setPosition/setNumber/setLabel/applyFormation/clearTeam/ensureDefaultTeams), `snap.ts`(정렬선+랜드마크, 그리드 없음), `geometry.ts`(IFAB 마킹·랜드마크·fraction→m·clamp), `uiStore.ts`, `EditorContext.tsx`.
- `src/renderer/`: `PitchMarkings`(줄무늬+IFAB 라인), `Token`(순수), `pointer.ts`(px→m), `pitch.module.css`.
- `src/ui/`: `AppShell`(Option 3: 44px top bar, 48px rail, pitch 중심, Inspector 슬라이드, 1줄 bottom bar placeholder), `FormationPicker`(검색·최근·popover spring), `Inspector`(폭 spring in/out, 번호·이름·X/Y·삭제), `useEditorKeyboard`(V/A/Esc/Del/Ctrl+Z/Shift+Z/Y/화살표 nudge/Tab), `i18n/`(ko), `motion/spring.ts`(duration+bounce → stiffness/damping, `SpringAnimator` 재타깃 속도 보존, reduce-motion), `pitch/PitchStage`(drag 지연 0, 3px 임계, Esc cancel, Alt 스냅 해제, 스냅 가이드, drop 시 스냅 오프셋 spring), `pitch/AnimatedToken`.
- `src/presets/formations.json`(12종) + `formations.ts`(검증·검색).
- devDeps: `@testing-library/react`, `@testing-library/dom` (jsdom 스모크 테스트).

Files:

- 위 전체(신규). `src/app/App.tsx` 교체.

Validation:

- `npm run typecheck` → PASS · `npm run lint` → PASS · `npm test` → PASS (9 files / 37 tests: core 11, snap 4, geometry 3, pointer 2, spring 6, formations 5, shell 3, domain 1, vec 2) · `npm run build` → PASS · `npm run harness:verify` → PASS (중간에 renderer spring import 1회 FAIL → AnimatedToken으로 분리) · dev server 모듈 서빙 200.
- DELEGATED(사용자): drag 체감·스냅 "달라붙음"·Esc·Pitch 비율·reduce-motion — DoD §3.

Related:

- ADR-0004, ADR-0005(Amendment), ADR-0006, PLAN-20260819-002.

Rollback:

- M1 커밋(들) revert. domain/engine 변경 없음.

Documentation Updated:

- PROJECT_MAP, ADR-0005, ACTIVE_PLAN, CURRENT_STATE

### CHG-20260820-003 — FEAT — M2 Motion Path + Timeline Core + UX feedback round 1

Problem:
사용자 피드백(2026-08-20): ① 단축키 모름 ② 좌표 숫자 무의미 ③ 애니메이션 적용법 모름 ④ 불편 ⑤ 상대 자동 반응 요청. ③④ 근본 원인 = M2 부재.

Change:

- Engine(순수): `engine/path.ts`(polyline/bezier LUT, arc-length, RDP simplify, Catmull-Rom→bezier, SVG d), `engine/compile.ts`(trigger 그래프 → 절대시각, hold, ball travel 시작=보유자 위치, 파생 이벤트, 순환 오류), `engine/stateAt.ts`(ResolvedState). Scenario A 테스트 PASS.
- Editor: `segmentCommands.ts`(addMoveSegment/addBallTravel/removeSegment/setTiming/setTrigger/setEasing/moveWaypoint/setHold/giveBallTo/clearTimeline, 속도 preset walk/jog/run/sprint, short/firm/driven), uiStore playback/selectedSegment/pathDraft/shortcuts/onboarding, `useCompiled`(revision memo), `usePlayback`(rAF UI clock).
- Renderer: `PathLayer`(순수: 경로·arrowhead·선택 시 waypoint/handle), tokens = resolved 위치.
- UI: 경로 도구(P) — 선수/공 위 드래그 = 프리핸드 → 단순화·스무딩 → segment(시작 = 재생 위치, 이전 동작 뒤면 체인), 공 = 패스(끝점 근처 선수 = 수신자, 보유 세그먼트 자동), waypoint drag, 경로 클릭 선택. Timeline 바(재생/정지/처음/scrubber/이벤트 틱/속도/반복/트랙 펼침 spring) + 트랙 블록(드래그=시작 시각, 우측 리사이즈=길이). SegmentInspector(시작 조건: 시각/이전 동작 뒤/공 받을 때/놓을 때, 속도 pill, 길이, easing, 수신자, 경유지 대기, 삭제). EntityMiniBar(선택 위: 경로·공 주기/패스·삭제). ShortcutsOverlay(?). Onboarding 3단계 카드. 툴 레일 라벨. Inspector: 좌표 → 접힌 "정밀", 행동 우선. 키보드: Space/Home/End/,/./L/T/I/P.
- ADR-0007(Proposed) 반응형 상대 — 피드백 ⑤.

Validation:

- typecheck/lint PASS · `npm test` 46 PASS(engine 10 incl. Scenario A, shell M2 스모크) · build PASS · harness:verify PASS · dev 200.
- DELEGATED: 경로 그리기 체감, 타임라인 블록 드래그, 패스 수신 자동 연결.

Related: ADR-0003, ADR-0005, ADR-0006(D4-3 mini-bar, D5), ADR-0007, PLAN-20260819-002

Rollback: M2 커밋 revert. domain 스키마 변경 없음.

Documentation Updated: CURRENT_STATE, ACTIVE_PLAN, DECISION_INDEX, PROJECT_MAP

### CHG-20260820-004 — FEAT — Sequence UX round 2: ball visuals, convenience selection, docked help

Problem:
사용자(2026-08-20): 순차 시나리오(B1→B2 패스 중 R1 접근, B1 침투, R2 압박 전 B2→B1 리턴) 표현 가능성 + 간편 조작 요구, 공 UI 밋밋, 편의 조작(드래그·Ctrl 선택), 고정 단축키 구역.

Change:

- Engine: travel `flight`(ground/lofted, cross/clearance 기본 lofted) → `ResolvedBall.height/spin/progress` (결정론). **Scenario B** 테스트(사용자 시나리오 그대로) PASS.
- 공 비주얼(renderer 순수): 32패널 패턴 + 회전(거리 기반) + 로빙 높이 스케일/그림자 드리프트 + 스페큘러. 이동 중 선수 heading 쐐기. 공 비행 잔상(과거 stateAt 5샘플).
- UI 모션: 킥/리시브 순간 공·선수 pulse spring(0.32s b0.45).
- 조작: 빈 곳 드래그 = 마퀴 선택(Ctrl/Shift 추가), **그룹 드래그**(선택 전체 이동, 잡은 토큰만 스냅), Ctrl/Cmd/Shift 클릭 토글, **더블클릭 = 경로 도구**, Ctrl+A, 패스 생성 후 **재생 위치 = 도착 시각**(다음 동작 체인).
- SegmentInspector: 종류(패스/스루/크로스/슛), 궤적(땅볼/로빙), "다른 동작 기준"(기준 동작·시작/끝 앵커), 여러 패스 중 기준 패스 선택.
- **HelpPanel** 우측 고정 구역(현재 도구 팁 + 전역 키, localStorage 기억, 1600px 미만+Inspector 열림 시 탭으로 접힘), ShortcutsOverlay 항목 갱신, 온보딩 문구.

Validation: typecheck/lint PASS · test 47 PASS(Scenario B 포함) · build PASS · format PASS · harness:verify PASS · dev 200. DELEGATED: 체감.

Related: ADR-0003, ADR-0006(D2/D3/D4), PLAN-20260819-002. Rollback: revert. Docs: CURRENT_STATE, ACTIVE_PLAN.

### CHG-20260820-005 — FIX/UX — Light theme default, docked inspector, single right column

Problem: 사용자 "디자인 너무 어둡고 난잡 / 선택마다 우측 창이 나왔다 들어갔다 불편".
Change: tokens.css 라이트 기본 + `[data-theme=dark]` 토글(☾/☀, localStorage) · Inspector 상시 도킹(spring 제거, 내용만 교체) · HelpPanel을 우측 컬럼 하단 접이식으로 통합(별도 컬럼 제거) · shell.module.css 재작성(대비↓, 카드 배경화, 그림자 토큰) · 도움말 행 flex(줄바꿈 제거) · 포메이션 버튼 "팀명 · 포메이션".
Validation: typecheck/lint/test 47/build/harness PASS. DELEGATED: 체감.
Related: ADR-0006 Amendment 2026-08-20. Rollback: revert.

### CHG-20260820-006 — FEAT — End-to-end: persistence/export, annotations, examples, reactive opponent

Problem: 사용자 "end to end 전체 다 만들어봐, 온보딩 카드는 제거".
Change:

- 온보딩 카드 제거.
- M5 persistence: `editor/persistence.ts` — localStorage 자동저장(600ms 디바운스, 시작 시 복원), JSON 저장/열기(schema guard), SVG/PNG 내보내기(computed style 인라인). ☰ 문서 메뉴(새 전술/열기/저장/PNG/SVG/예시).
- 주석: `renderer/DrawingLayer`(순수) + 도구 구역(Z, Shift=타원)·화살표(R)·텍스트(T, 인라인 입력) + 선택/드래그 이동/삭제(Inspector·Delete). 트랙 토글 키 T→M.
- 예시 시나리오 프리셋 `presets/scenarios.ts`(A: 2v2 패스&압박, B: 원투&침투) — 테스트로 컴파일 보장.
- ADR-0007 Phase 1: `engine/opponent.ts` generateReaction(press/cover/shape, onEvent 앵커, 결정론·멱등) + `applyReaction/clearReaction` + 상단 "⚡ 자동 대응" 패널(팀·강도·지연).
  Validation: typecheck/lint PASS · test 50 PASS(opponent·scenarios·e2e shell 포함) · build PASS · harness:verify PASS · dev 200.
  Related: ADR-0007(Accepted), ADR-0001 §13(서버 없음 유지). Rollback: revert.

### CHG-20260820-007 — FEAT/UX — Left-hand keymap, Alt-drag paths, fling physics, drag-at-time, stroke beautify, Codex brief

Problem: 사용자 라운드 4 — 공을 잡고 휙 던지면 물리처럼 / 경로 있어도 드래그로 고치기 / 경로 선 전처리 / 왼손 단축키(Alt+드래그) / 단축키 재정의 / Codex 프롬프트.
Change:

- `src/ui/keymap.ts` 단일 소스 + `useEditorKeyboard`/`HelpPanel`/`ShortcutsOverlay`/툴 레일 재작성. Alt 는 드래그 전용, Ctrl = 스냅 해제.
- `engine/path.ts` beautifyStroke(+resample/smooth), `engine/compile.ts` decel 운동학(`Timing {speed, decel}` 추가 — 스키마 v1 유지, 선택 필드), scheduleEndDistance.
- `segmentCommands.ts`: shiftTailInDraft, addBallFling, addPlayerFling, FLING 상수. `commands.setEntityHome`: 첫 waypoint 동행.
- PitchStage: Alt+드래그 경로, Shift 직선, 릴리즈 속도 샘플링 → fling, t>0 드래그 = tail 편집(재생 위치 유지), Ctrl 스냅 해제.
- `docs/agent/CODEX_BRIEF.md` — Codex 붙여넣기 프롬프트(읽기 순서·절대 규칙·피드백 이력·할 일 템플릿).
  Validation: typecheck/lint PASS · test 53(beautify 2, decel 1 추가) · build · harness PASS. DELEGATED: 던지기 감각(FLING 상수 튜닝), Alt 드래그, tail 편집 체감.
  Related: ADR-0006 Amendment(라운드 4), ADR-0003(Timing 확장). Rollback: revert.

### CHG-20260820-008 — FEAT/FIX — PLAN-20260820-003 M1–M6 (Codex plan, Claude implementation)

Problem: Codex 상세 계획(Harness Audit + M1~M6) 승인 후 구현.
Change:

- M1 ISSUE-006: `ui/pitch/pathPresentation.ts`(compiled 시작점 → 표현 복사), `PathLayer.attachedStart`(잠긴 마커, 첫 waypoint hit 제거), PitchStage 이중 가드. + `commands.pruneDanglingHolder`(applyFormation/clearTeam/removeEntities) — dangling `ball.initialHolderId` 버그 수정.
- M2 Timeline: `timeline/trackView.ts`(팀 그룹·필터·접기·선택 row 강제 노출), 필터 바·그룹 헤더·row 버튼·generated 카운트.
- M3 path-scrub(ADR-0006 D4-1): `ui/pitch/pathScrub.ts`(stateAt 샘플 역산, 교차 시 현재 재생 위치 근접), 선택 도구 Shift+드래그, `keymap.MOUSE_POLICY`(Shift=스크럽/직선/타원, Ctrl=선택 토글/스냅 해제, Alt=경로), ghost 링.
- M4 자동 대응 품질: 연속성·coalesce·anti-shuttle·presser hysteresis, `engine/opponent.test.ts`(7 tests). ADR-0008 Proposed(공격 반응, 구현 금지).
- M5 접근성: inert+aria-hidden(단축키 오버레이·포메이션 팝오버·미니바·접힌 트랙), 단축키 다이얼로그 포커스 진입/복귀, aria-label(레일·undo/redo·테마·도움말·닫기·reset/loop), 슬라이더 aria-valuetext+Home/End, 트랙 블록 role=button 키보드 선택, 도움말 헤더 native button, 포커스된 컨트롤의 Space는 전역 재생 토글 안 함, focus-visible CSS, 테스트 `ui/accessibility.test.tsx`.
- M6: ADR-0003 Amendment(decel), ADR-0007 Implementation Note, PROJECT_MAP, CURRENT_STATE, Handoff.
  Validation: 각 마일스톤 후 typecheck/lint/test/build/harness PASS (M1 58 → M2 63 → M3 68 → M4 74 → M5 78 tests). DELEGATED: 브라우저 체크리스트(CURRENT_STATE).
  Related: PLAN-20260820-003, ADR-0003/0006/0007/0008. Rollback: 마일스톤 단위 파일 복원(uncommitted — 커밋 권장).

### CHG-20260820-009 — FIX/REFACTOR — Codex Audit hygiene backlog (PLAN-004 R1)

Problem: Codex Harness Audit(PLAN-003)이 범위 밖으로 남긴 P0/P1: import 검증 얕음, Inspector 입력이 키 입력마다 undo entry(ADR-0005 위반), renderer→editor 역참조, Timeline→PitchStage 결합, 낡은 문서.
Change:

- `editor/validateDocument.ts`(중첩 구조 검증: teams/players/ball/drawings/scenes/tracks/segments/trigger/timing/path, 참조 무결성) + `persistence.parseDocument`가 `DocumentValidationError`(문제 목록) throw. autosave 복원도 같은 경로.
- ADR-0005 준수: `setPlayerNumber/Label`, `setDocumentTitle`, `setWaypointHold`, `updateDrawingText`에 필드별 coalesceKey(500ms 병합).
- `engine/geometry.ts`로 이동(순수), `editor/geometry.ts`는 re-export. `ui/teamColor.ts` 신설 — Timeline이 PitchStage를 import하지 않음.
- 문서: `src/ui/AGENTS.md` 라우팅 갱신, Constitution 불변조건 1에 createdAt 예외 명문화.
  Validation: typecheck/lint/test 81/build/harness PASS.
  Related: PLAN-20260820-004, ADR-0005, Codex Audit(completed/PLAN-003). Rollback: revert.

### CHG-20260820-010 — FIX/UX — First-visit walkthrough (PLAN-004 R2): launcher, checklist, fling bug

Problem: 첫 방문 시뮬레이션(Playwright, 빈 localStorage)에서 (1) 빈 필드 + 작은 힌트 pill뿐 → 뭘 해야 할지 안 보임, 예시는 ☰ 안에 숨음 (2) **일반 드래그가 fling 경로로 오인** — 멈췄다 놓아도 마지막 이동 샘플로 속도 계산(22 m/s 임계 = 220 px/s) → 선수 재배치 불가 (3) 포메이션 후 공이 아무도 안 가짐(센터 서클에 #10과 겹침) (4) 자동 대응 기본 팀이 Home(선수 있는 팀), Away 0명이어도 경고 없음 (5) `?` 오버레이에 개발자 문구(`src/ui/keymap.ts`) 노출.
Change:

- `ui/EmptyState.tsx` — 빈 필드 중앙 런처(액션만, 튜토리얼 아님): **양 팀 채우고 시작**(Home 4-3-3 · Away 4-4-2, 1 undo step) · 예시 2종 · "직접 배치: W" 한 줄. 선수 생기면 사라짐, 비모달.
- `ui/GettingStarted.tsx` — Inspector 빈 상태를 라이브 4단계 체크리스트로(배치/달리기/공/재생, 문서·재생 상태로 자동 ✓; `uiStore.hasPlayed`). 전부 완료 시 한 줄로 축소.
- `ui/pitch/fling.ts` — `releaseVelocity(samples, now)`: 마지막 이동 후 **100 ms 이상 지나 놓으면 fling 아님**(stale). `FLING.minCursorSpeed` 22 → **45 m/s**. [WH-CHANGE]
- `commands.applyFormationInDraft` + `applyFormations(core, picks)` — 빈 필드 첫 채움이면 공을 그 팀에서 공에 가장 가까운 선수에게(킥오프 느낌). 이후 변경은 재배정 안 함(기존 테스트 유지).
- `AutoReactPanel` — 보유자 없으면 authored 움직임이 적은 팀(동률 → Away) 기본, 선수 0명이면 경고 + "4-4-2 채우기" 버튼, 생성 비활성.
- `FormationPicker` ▾ chevron(드롭다운 어포던스), ShortcutsOverlay 개발자 문구 제거.
  Validation: typecheck/lint/test 89 (+8: fling 4, quick start 2, first-visit e2e 2)/build/harness PASS. Playwright 스크린샷 워크스루(첫 방문 → 채우기 → 느린 드래그=이동 확인 → Alt+드래그 런/패스 → 재생) 수행.
  Related: PLAN-20260820-004 R2, ISSUE-008(fling 상수 일부 확정), ADR-0006 D4. Rollback: revert.

### CHG-20260820-011 — FEAT/UX — Interactive first-visit tour (PLAN-004 R3)

Problem: 첫 방문자가 "뭘 어떻게" 해야 하는지 화면에서 직접 안내받지 못함. 사용자 요청(2026-08-20): 쿠키로 첫 방문 감지, 실제 버튼·단축키·토큰을 **화면에서 동적으로 하이라이트**하며 **직접 해보게** 하는 튜토리얼.
Change:

- `src/ui/tour/` — `tourSteps.ts`(8단계: 양 팀 채우기 → 선수 옮기기 → Alt+드래그 달리기 → 공 Alt+드래그 패스 → Space 재생 → 트랙(V) → ⚡ 자동 대응 생성 → 끝; 각 단계 `target` 셀렉터 + `done` 술어(문서/재생 상태) + 선택적 `anchor`/`placement`), `TourOverlay.tsx`(SVG 마스크 스포트라이트 + 펄스 링 + 카드; rAF로 대상 bbox 추적 → 스프링 토큰·패널 이동 따라감; **비차단**(카드만 pointer-events); 행동 수행 시 ✓ 후 자동 진행, 이미 끝난 단계 자동 건너뜀, 다음/건너뛰기/완료), `tourStorage.ts`(localStorage `st:tour:seen:v1` + 쿠키 `st_tour_seen` — 둘 중 하나면 본 것으로).
- 앵커: `data-tour="quick-start|launcher|play|tracks|auto-react|help"`, 토큰은 `[data-entity=id]`, 공은 `[data-kind=ball]`.
- uiStore `tour {active, step}` + `startTour/setTourStep/endTour`, `hasPlayed`. AppShell 마운트 시 `!hasSeenTour()` → 시작. HelpPanel "🎓 튜토리얼 다시 보기".
- reduce-motion: 전환/펄스 제거.
  Validation: typecheck/lint/test **94**(+5 tour)/build/harness/format PASS. Playwright `pw/tour.cjs`: 8단계 전부 실제 행동으로 자동 진행, 완료 후 reload 시 미표시(cookie `st_tour_seen=1`) 확인.
  Related: PLAN-20260820-004 R3, ADR-0006 D5(disclosure — 튜토리얼은 일시 레이어, 3단계 아님). Rollback: revert.

### CHG-20260820-012 — FIX/UX — QA 루프 1라운드 수정 (PLAN-004 R4)

Problem: QA 에이전트(첫 방문자 역할, Playwright 스크린샷) 1라운드 보고 — P0 3: ① 기본 팀 추가가 undo 항목이라 Ctrl+Z로 팀이 사라지고 런처가 무반응 ② 새 전술/예시/JSON 열기가 history를 비움(되돌릴 수 없음, 확인 없음) ③ 패스 도착 시각에 공을 끌면 끝점만 옮겨지고 수신자는 그대로 → 순간이동. P1 5: 패스 직후 Space가 도착 시각부터 재생, 예시 로드 후 정지 화면, ⚡ 팝오버 Esc 안 닫힘/`?` 위에 남음, Inspector가 도움말 패널에 잘림, 투어가 `?` 위에 그려지고 대안 CTA를 어둡게 함. P2: 자동 대응 제거가 팀별, 영어 프리셋 라벨, 테마가 OS 설정 무시, 텍스트 더블클릭 편집 없음, 포메이션 라벨 stale 등.
Change:

- `commands.seedDefaultTeams`(순수) — 부트스트랩/새 전술은 문서에 팀을 심어 history 밖. `replaceDocument` = **단일 undo 항목**(`transaction(() => doc)`), Ctrl+O도 동일. DocMenu 새 전술: 작업물 있으면 **인라인 확인**(모달 아님), `hasPlayed` 리셋.
- `segmentCommands.syncTravelReceiverInDraft` + `RECEIVE_RADIUS_M` — 공 경로 끝/경유지 드래그 커밋 시 도착 시각 위치로 수신자 재해석(pass↔loose, 뒤따르는 possessed 동기화). tail 드래그는 드롭(공 주기) 로직을 타지 않음.
- uiStore `playFrom` + `setPlayheadAuto(t, from)`; 수동 seek가 지움; `usePlayback.play()`는 `playFrom`부터 재생(방금 그린 패스를 봄). rAF tick은 setState 직접(플래그 보존).
- 예시 로드(런처·메뉴) → 자동 재생. 제목 input 폭 clamp.
- AutoReactPanel Esc 닫기 + `?` 열면 닫힘(FormationPicker도 store 구독). 생성분 **모두** 제거. 라벨 폭.
- CSS: inspector `min-height 52%` + thin scrollbar, help `max-height 44%`; tour z-index 45(<overlay 50) + `?` 열리면 숨김; 1단계는 런처 전체 스포트라이트.
- 카피: 속도 프리셋 걷기/조깅/달리기/전력질주 · 짧게/보통/강하게 · 가감속 일정/가속/감속/가속→감속 · 움직임 목록 "움직임 1 · 0.0s→4.7s" · 체크리스트/투어 "이동 경로" 통일 · 팀 0명이면 포메이션 "없음".
- 테마: 저장값 없으면 `prefers-color-scheme`. 텍스트 주석 더블클릭 → 인라인 편집.
  Validation: typecheck/lint/test **98**(+4)/build/harness/format PASS; `pw/tour.cjs` 8단계 PASS.
  Related: PLAN-20260820-004 R4, QA round 1 report. 미수정(보류): Shift+클릭 additive(키맵 결정 유지), 미니바 가장자리 flip, t=0에서 패스 중인 공 드래그 힌트, 필터 빈 상태 문구, 체크리스트 "행동 기반만 ✓". Rollback: revert.

### CHG-20260820-013 — FIX/UX — QA 루프 2라운드 수정 (PLAN-004 R5)

Problem: QA 2라운드 — 1라운드 11건 중 9 FIXED, 잔존 2(Space 단축키 경로가 `playFrom` 무시 / 텍스트 더블클릭: Chromium pointerdown `detail`=0), 신규 P1 3(Tab이 pitch SVG에 갇힘, 마우스로 버튼 클릭 후 Space가 그 버튼 재실행, 저장/열기 토스트가 제목 위에 겹침), P2 9.
Change:

- useEditorKeyboard: Space — 키보드 포커스(`:focus-visible`) 컨트롤만 Space 소유, 마우스 포커스 버튼은 blur 후 재생/정지; `playFrom` 존중. Tab — 마지막 토큰 다음(또는 Shift로 첫 토큰 앞)에서 pitch를 벗어남(포커스 트랩 해소).
- PitchStage: 텍스트 주석 더블클릭을 자체 타이머(350ms)로 판정 → 인라인 편집.
- `.status` 토스트를 헤더 아래 pill로. 제목 input Enter=확정+blur, Esc=되돌리기+blur.
- 타임라인 `.rows` `max-height: clamp(140px, 30vh, 420px)` + thin scrollbar. 팀 필터에 행이 없으면 빈 문구(● 행 설명).
- 투어: `avoid`(토큰 단계는 공을 가리지 않게 후보 위치 선택), `onEnter`(마지막 단계: ⚡ 닫고 도움말 열고 🎓 버튼으로 scrollIntoView, 타깃=🎓 버튼), 예시 로드 시 마지막 카드로 점프. `?` 열면 ☰도 닫힘. `?` 대화상자 Tab 포커스 트랩.
- 체크리스트: 투어 중 숨김(안내 중복 방지), 제목 "지금 상태", 문구를 상태 서술로.
- 시작 조건 카피: "오프셋(초)", 옵션 끝 "+ " 제거, 연결 후 힌트 숨김.
  Validation: typecheck/lint/test 98/build/harness/format PASS; `pw/tour.cjs` 8단계 PASS(마지막 단계 🎓 스포트라이트 확인).
  Related: PLAN-20260820-004 R5, QA round 2. Rollback: revert.

### CHG-20260820-014 — FIX — QA 루프 3라운드 수정 (PLAN-004 R6)

Problem: QA 3라운드 — 2라운드 11건 중 10 FIXED. **P0**: 첫 채움(initialHolder=#10) 후 패스 1(10→8) 다음 패스를 그리면 `holderId` 힌트가 초기 보유자로 떨어져 `possessed(#10)`이 open-ended `possessed(#8)` 뒤에 afterSegment로 체인 → 순환("unresolvable trigger") → 재생 불가. P1: 마우스로 누른 버튼 뒤 Space — Chromium은 keydown 시점에 이미 `:focus-visible`=true라 이전 수정이 무효. P2: Ctrl+S 토스트 없음, 타임라인 문제 배너가 영어 개발자 문구, 빈 필드에서 투어 "다음" 시 2~3단계가 타깃 없이 런처를 가림, S 도구에서 기존 라벨 더블클릭이 새 상자, 1280 다크에서 7단계 카드가 Inspector를 가림, 4단계 "공을 선수 위에 놓으면" 안내가 ✓로 안 이어짐.
Change:

- `segmentCommands.passerFor/possessTrigger` — 패서는 트랙의 마지막 open-ended possessed 보유자가 진실(힌트·initialHolder는 후순위); open-ended possessed 뒤에는 afterSegment 대신 `at: playhead`로 possessed 삽입(순환 불가). addBallTravel/addBallFling 공통. PitchStage 힌트도 트랙 우선. 회귀 테스트(잘못된 힌트를 줘도 issue 0).
- useEditorKeyboard: 입력 모달리티 추적(pointerdown → 'pointer', Tab/화살표 → 'keyboard'); 포인터 포커스 버튼은 Space를 가로채지 않음(blur 후 재생), 키보드 포커스는 버튼이 소유. a11y 테스트는 Tab으로 모달리티 지정.
- uiStore `toast/flashToast` + DocMenu 표시; Ctrl+S → "다운로드 시작".
- Timeline 문제 배너 한국어화·중복 제거·개수.
- 투어: `available`(선수 없으면 2~7단계 건너뜀 → 마지막 카드), 4단계 done에 보유자 변경(핸드오버) 포함, ⚡ 단계 카드는 옆(`side`)에.
- S 도구에서 기존 텍스트 라벨 클릭 → 그 라벨 편집.
  Validation: typecheck/lint/test **99**(+1)/build/harness/format PASS; headless 체인 패스(10→8→7) 재생 확인, `pw/tour.cjs` PASS.
  Related: PLAN-20260820-004 R6, QA round 3. 보류: 달리는 수신자 위 재배치 시 수신자 유실(ISSUE-009 범위), 투어 중 fling 감도(헤드리스 저신뢰). Rollback: revert.

### CHG-20260820-015 — FIX — QA 루프 4라운드 수정 (PLAN-004 R7)

Problem: QA 4라운드(실전 11v11 편집) — 3라운드 6/6 FIXED. **P0**: `PitchStage.endGesture`가 `useCallback([core])`로 첫 렌더의 `finishDraw`(→ `resolved`/`compiled`)를 고정 → 패스 수신자를 t=0 위치로 판정(달려간 선수에게 "—"), 두 번째 런의 prevEnd=0(오프셋 오류), 루즈볼 fling 시작점이 stale. P1: 보유 중인 공 드래그가 커서에서 ~3 m 어긋나 핸드오버 실패(grab이 `home`=센터 기준). P2: 공 주기가 authored 첫 possessed를 못 바꿈, 비행 중 공 tail 드래그가 커서를 안 따라감, 순환 세그먼트가 트랙에서 사라짐, 토스트 live region 누락.
Change:

- PitchStage: `endGestureImpl`은 매 렌더 재생성(최신 상태), 리스너는 ref 래퍼(`endGesture = useCallback(ref, [])`)를 잡음. 블록을 `finishDraw/syncBallReceivers` 뒤로 이동(TDZ lint).
- 공 드래그 grab = 렌더 위치 기준(보유자 발), tail 모드(비행 중)는 패스 END를 커서로(`tailEndAt`) → 드롭한 선수로 수신자 재해석.
- `giveBallTo`: 첫 possessed@0 보유자도 교체. Timeline: 미해석 세그먼트도 명목 시각에 빗금 블록(`blockUnresolved`)으로 표시·선택 가능. 토스트 `role=status`.
- 펄스 effect deps 정리, a11y 테스트는 투어 비활성+여유 대기(플레이크).
  Validation: typecheck/lint/test 99/build/harness/format PASS; headless: 달려간 #9에게 End에서 패스 → 수신자 #9, 보유 공 드롭 → #8 보유, 투어 8단계 PASS.
  Related: PLAN-20260820-004 R7, QA round 4. 보류(P2): 타임라인 블록 키보드 조작, 미니바가 이웃 토큰 가림. Rollback: revert.

### CHG-20260820-016 — FIX — QA 루프 5라운드 수정 (PLAN-004 R8)

Problem: QA 5라운드(최종 검증) — 4라운드 7건 중 5 FIXED. 잔존: 루즈볼 fling 시작점이 놓은 지점, 보유 공 드래그 중 토큰이 안 움직임. 신규 P1: 포메이션 변경이 그 팀 움직임을 확인 없이 지우고 공 트랙에 사라진 선수 참조(고스트 패스)를 남김; 트랙 패널 래퍼가 180px 고정(rows 30vh 클램프 무의미) → 마지막 행 도달 불가. P2: 모든 세그먼트가 순환이면 트랙 패널이 빈 문구, 패스 종료 후 공 flick이 tail 재편집, 8/8 카드가 스포트라이트와 멀리.
Change:

- PitchStage: 보유 공(authored 트랙 없음) 드래그 중 draft에서 보유자 해제 → 토큰이 커서를 따라감(드롭이 결정); authored 트랙이 있으면 **고스트**(점선+점) 표시. 루즈볼 fling은 드래그 전 위치에서 시작. `ballAfter`(공의 마지막 움직임이 끝난 시각): 드래그 = **그 시각의 새 패스**(드롭 지점 수신자, 도착으로 playhead), flick = 킥; tail 모드는 활성 구간에서만.
- `commands.pruneDanglingBallSegments` — 포메이션 적용/팀 비우기 시 사라진 보유자 possessed 제거, 사라진 수신자 패스는 loose, 끊긴 afterSegment는 at 0. FormationPicker: 팀에 움직임이 있으면 **인라인 확인**("움직임 N개가 지워져요").
- Timeline: 래퍼 높이 = 내용 측정(ResizeObserver) × 스프링 진행률; rows `clamp(120px, 26vh, 380px)`; `hasSegments`는 문서 기준(순환 시에도 빗금 블록 유지).
- 투어 8/8: anchor 제거(카드가 🎓 옆).
  Validation: typecheck/lint/test **100**(+1)/build/harness/format PASS; headless: 보유 공 드래그 토큰=커서, 도착 시각 드롭 → 새 패스 수신자 #11, 루즈볼 fling t=0 위치 유지, 트랙 높이 123→305px(내용), 투어 8단계 PASS.
  Related: PLAN-20260820-004 R8, QA round 5. Rollback: revert.

### CHG-20260820-017 — FIX — QA 루프 6라운드 수정 + 루프 종료 (PLAN-004 R9)

Problem: QA 6라운드 — 5라운드 7/7 FIXED, 스윕 전부 OK. 신규 P1: 패스 삭제 시 수신자 possessed가 고아로 남아 open-ended possessed 뒤에 체인 → 순환, 이후 패스 재생 불가. P2: 공 드롭 핸드오버가 undo 2회, authored 패스가 있을 때 빈 잔디에 드롭하면 보이지 않는 상태 변경. P3: 1280×720 트랙 패널 20px 넘침, sticky 필터 바 위로 행이 비침.
Change:

- `removeSegment`: travel 삭제 시 그 패스가 만든 수신자 possessed도 제거; 재체인은 open-ended possessed 뒤로는 at(offset)로.
- `giveBallToInDraft` — 드롭 핸드오버를 드래그 transaction 안에서 처리(undo 1회). authored 트랙이 있을 때 빈 잔디 드롭은 cancel(숨은 상태 변경 없음).
- rows `max-height: clamp(100px, calc(34vh - 120px), 380px)`(720에서도 패널이 뷰포트 안), 필터 바 배경/z-index.
  Validation: typecheck/lint/test **101**(+1)/build/harness/format PASS; headless: 패스 삭제 → 배너 없음, 새 패스 재생 OK, 핸드오버 undo 1회.
  Loop result (R2~R9, QA 6라운드): 발견 P0 5 · P1 14 · P2 30+ → 설계 결정·범위 밖 제외 전부 수정. 보류 목록: ISSUE-009 리드 패스, Shift+클릭 additive(키맵 결정), 타임라인 블록 키보드 조작, 미니바가 이웃 토큰 가림, 루즈볼이 번호 가림, 스프링/플링 체감(DELEGATED).
  Related: PLAN-20260820-004 R9. Rollback: revert.

### CHG-20260820-018 — FEAT/BREAKING-UX — 단일 간편 모드 전환 (ADR-0009, PLAN-004 R10)

Problem: 사용자 판정 "사용법이 너무 복잡해 … 기본 하나만" — 도구 레일·인스펙터·트랙·트리거 UI가 효용을 막음. 사용자 제안 모델: 좌클릭=우리팀, 우클릭=상대팀, 더블클릭=경로, 단계 번호 1~10.
Change:

- **도메인(additive)**: `Segment.step?: number`. validateDocument에 step 검사.
- `editor/stepCommands.ts`: `relayoutStepsInDraft`(단계→트리거 파생: 같은 단계 같이 시작, 다음 단계는 가장 느린 동작 끝), `addStepRun/addStepPass`(수신자=도착 시각 위치, 1 undo), `setSegmentStep/removeStepSegment/stepCounts/stepStart`. `gen-` 제외.
- **UI 교체**: `SimplePitch`(클릭/우클릭 추가·드래그 이동·더블클릭 드로우·플링·공 고스트·단계 배지), `StepBar`(①~⑩ 칩+개수), AppShell 단순화(상단 바 + 필드 + 재생 바). 제거: 도구 레일, Inspector/SegmentInspector, HelpPanel, GettingStarted, FormationPicker, Timeline 트랙 패널, EntityMiniBar, TextEditOverlay, PitchStage, pathScrub. keymap/도움말/튜토리얼(5장) 재작성.
- 그린 직후 선택 해제(칩 클릭이 방금 그린 것을 재배정하는 footgun 방지). 유지: 런처, ☰, ⚡, undo/redo, 테마, ?, 자동저장/JSON/PNG/SVG, 예시.
  Validation: typecheck/lint/test **90**(간편 모드 기준 재작성: stepCommands 4, AppShell 4, tour 5, a11y 3 등)/build/harness/format PASS. Playwright: 좌/우클릭 배치 → 더블클릭 런 → 핸드오버 → 단계2 패스 → 재생 → 투어 5장 완주, 콘솔 클린.
  Related: ADR-0009(Accepted), ADR-0006 부분 Superseded. Rollback: revert(구 UI는 git 히스토리에).

### CHG-20260820-019 — UX — 간편 모드 v2: Ctrl 투입 · 사이드 패널 · 애니메이션 모드 토글 · 경량화 (PLAN-004 R11)

Problem: 사용자 지시 — 새로고침은 완전 클린, 좌/우 상시 사이드 패널(기능/조작법), Ctrl+클릭으로만 선수 투입(일반 클릭과 구분), 공 투입 버튼, 하단 애니메이션 모드 토글(켜야 더블클릭·애니메이션 바), "마지막 작업 불러오기·PNG 저장 같은 것 싹 제거(가벼운 사이트)".
Change:

- `SidePanels.tsx`(ActionsPanel: 양 팀 채우기·⚽ 공 투입(placeBallCenter)·⚡ 자동 대응·새로 시작 / GuidePanel: 배치·애니메이션·재생 조작법, 모드 꺼짐 시 흐림), 3열 그리드.
- SimplePitch: 잔디 클릭은 **Ctrl(⌘) 필수**, 더블클릭 드로우·플링은 `animMode`에서만(꺼짐 더블클릭 → 토스트). uiStore `animMode`.
- AppShell: ☰(DocMenu) 삭제, 하단 = [🎬 애니메이션 모드] 토글 + (켜짐 시) ▶·스크럽·반복·단계 칩.
- 경량화: 자동저장 제거(새로고침=클린), JSON/PNG/SVG/Ctrl+S/O 제거. persistence 모듈은 미노출로 잔존.
- 튜토리얼 6장(anim-mode 단계 추가), keymap/조작법 문구 갱신.
  Validation: typecheck/lint/test **90**/build/harness/format PASS. Playwright: 일반 클릭 무반응 → Ctrl 투입 3명 → 공 투입 → 모드 꺼짐 더블클릭 차단 → 모드 켜고 런+2단계 패스 → 재생 → 투어 완주 → 새로고침 클린, 콘솔 클린.
  Related: ADR-0009 Amendment v2. Rollback: revert.

### CHG-20260820-020 — UX — 마퀴 다중 선택 + 그룹 드래그 · 밝은 웜 톤 배경 (PLAN-004 R12)

Problem: 사용자 지시 — 드래그로 여러 엔티티 선택; 배경을 밝게(순백은 말고).
Change:

- SimplePitch: 빈 잔디 드래그(Ctrl 없이) = 마퀴 박스 선택(선수+공, 재생 위치 기준), 선택된 멤버를 잡고 끌면 **그룹 이동**(1 undo). 핸드오버/플링은 단일 드래그에서만. 조작법 패널 문구 추가.
- tokens.css: 라이트 테마를 웜 크림(#f2eee2 bg / #faf7ee surface)으로, 잔디 한 톤 밝게(#4aab6d).
  Validation: typecheck/lint/test 90/build/harness/format PASS; Playwright: 마퀴로 4명 선택 → #3 드래그 시 #5 dx=100 동반 이동, 콘솔 클린.
  Related: ADR-0009 v2. Rollback: revert.

### CHG-20260820-021 — UX — 시작 런처 창 제거 (PLAN-004 R13)

Problem: 사용자 지시 — "어떻게 시작할까요?" 중앙 창 제거.
Change: `EmptyState.tsx` 삭제(예시 로드 포함). 시작 동선 = 왼쪽 패널 [양 팀 채우기] 또는 Ctrl+클릭 직접 배치. 튜토리얼 1장이 [양 팀 채우기] 버튼을 비춤. 예시 프리셋은 UI 미노출(모듈 잔존).
Validation: typecheck/lint/test 90/build/harness/format PASS; Playwright 첫 방문 확인(창 없음, 투어 1/6 정상).
Related: ADR-0009 v2. Rollback: revert.

### CHG-20260820-022 — UX — 재생바 제거 · 단계 1~9 끝 동기화 · 라이트 고정 · 배지 흐림 (PLAN-004 R14)

Problem: 사용자 지시 — 애니메이션 모드의 재생바(스크럽) 불필요; 단계는 1~9; **같은 단계는 길이가 달라도 같이 끝나야**; 배경이 아직 검정(다크 저장값); 경로 배지가 애니메이션을 방해.
Change:

- 하단 바 = 🎬 토글 · ▶ · ↺ · ⟳ · 단계 칩(스크럽/시간 표시 제거).
- `MAX_STEP` 9, 숫자키 1~9. `relayoutStepsInDraft`: 단계 지속시간 = 구성원의 자연 길이(경로 길이/기본 속도) 중 최댓값, 전원 `timing.duration = stepDur` — **같이 시작·같이 끝남**(짧은 동작은 느려짐). compile 루프 제거(결정적 파생).
- 테마 라이트 고정(uiStore 'light', dataset 'light', ☾ 토글 제거 — 저장된 다크 무시). OS 다크에서도 웜 크림 확인.
- 경로 단계 배지 opacity 0.45(호버 시 1), 축소.
  Validation: typecheck/lint/test 90/build/harness/format PASS; Playwright(OS dark): bg rgb(242,238,226), 스크럽 없음, 두 런(짧/긴) 동시 종료 재생, 콘솔 클린. ADR-0009 v2의 "같이 시작(자연 속도)" 항목을 본 결정으로 대체.
  Related: ADR-0009. Rollback: revert.

### CHG-20260820-023 — UX — 자동 대응 제거 · 선수 정보 카드 · 포메이션 선택 · 조작법 가독성 · 단계 칩 1~9 상시 (PLAN-004 R15)

Problem: 사용자 지시 5건 — ⚡ 버튼 제거; 선수 클릭 시 이름·포지션 편집(기본 표시는 등번호만); 양 팀 채우기에 포메이션 선택; 오른쪽 조작법 가독성; 단계 칩이 1~3만 보임.
Change:

- AutoReactPanel 삭제(엔진 `applyReaction`은 잔존, UI 미노출). 투어 마지막 문구 갱신.
- `PlayerCard.tsx`: 선수 1명 선택 시 필드 상단에 번호/이름/포지션(GK·DF·MF·FW) 카드. `setPlayerRole`(coalesce). 토큰 기본 표시는 등번호(이름 설정 시 아래 표시).
- ActionsPanel: Home/Away 포메이션 셀렉트(12종) → 채우기.
- GuidePanel: 그룹 카드 + 줄 단위(칩 위·설명 아래) 레이아웃, 카피 축약.
- StepBar: 1~9 상시 표시.
  Validation: typecheck/lint/test 90/build/harness/format PASS; Playwright: 3-5-2/4-2-3-1 채우기, 카드에서 이름 "손흥민" 편집·토큰 표시, ⚡ 버튼 없음, 칩 9개, 콘솔 클린.
  Related: ADR-0009. Rollback: revert.

### CHG-20260820-024 — UX — 세분화된 포지션 + 이름(포지션) 표시 (PLAN-004 R16)

Problem: 포지션 4개로 단조로움; 이름 A + 포지션 B면 토큰에 A(B) 표시 요청.
Change: PlayerCard 포지션 그룹 셀렉트 19종(GK/CB/LCB/RCB/LB/RB/LWB/RWB/SW/CDM/CM/CAM/LM/RM/LW/RW/SS/CF/ST). 토큰 라벨 = 이름(포지션).
Validation: test 90/build/harness/format PASS; Playwright 손흥민(LW) 확인.

### CHG-20260820-025 — UX — 휙 던지기 제거 · 팀색 하이라이트 · 연속 패스 체인 (PLAN-004 R17)

Problem: 사용자 지시 — 그리기는 더블클릭만(휙 던지기 제거); 선택 하이라이트 = 공 흰색·선수 팀 색; A→B 패스 후 B가 이어서 패스하는 식의 연속 그리기가 안 됨(경로 시작이 항상 t=0 위치).
Change:

- 휙 던지기 제거(fling.ts/test 삭제, 제스처·안내·투어 문구 정리).
- 선택 링: 공 = 흰색, 선수 = 팀 색(드롭섀도로 동색 토큰에서도 가시).
- `startDraw` 시작점 = `lastKnownPosition`(모든 authored 움직임 이후 위치) → 공 재더블클릭 시 마지막 수신자에서 이어 패스, 선수 재더블클릭 시 이전 런 끝에서 이어 달림. 패서는 트랙 마지막 보유자(기존 passerFor).
- 라벨: 이름+포지션 = 이름(포지션) · 이름만 = 이름 · 포지션만 = 포지션 (사용자 확정).
  Validation: test 86(-4 fling)/build/harness/format PASS; Playwright: 10→8(1단계) 후 공 더블클릭 → 8에서 시작해 7로(2단계), 재생 끝 공=7, 링 색 흰/팀색 확인, 콘솔 클린.

### CHG-20260820-026 — UX — 고스트 체인 · Shift+드래그 그리기 · 모드 토글 제거 (PLAN-004 R18)

Problem: 사용자 지시 — 원래 위치는 선명하게, 진행 순서대로 점점 흐린 엔티티를 두고 그걸 잡아 이어 그리기; 더블클릭 대신 Shift+클릭(드래그); 애니메이션 모드 버튼 제거.
Change:

- SimplePitch: authored 경로마다 끝 위치에 **고스트 토큰**(팀색/공 흰색, 순서대로 opacity 0.55→0.22, 번호 표시). 고스트 Shift+드래그 = 그 위치에서 이어서 그리기(`data-ghost` 히트). 라이브 토큰 Shift+드래그 = 원래 위치에서 그리기. 더블클릭 제스처 제거.
- 애니메이션 모드 토글 제거 — 재생 바·단계 칩 상시. 투어 5장(anim-mode 장 삭제), 조작법 병합.
  Validation: test 86/build/harness/format PASS; Playwright: 패스1(10→8) → 고스트 Shift+드래그로 8→7(2단계) → 재생 체인 확인, 고스트 2개, 콘솔 클린.

### CHG-20260820-027 — FIX/UX — 포메이션 포지션 표시 · 고스트 최상위(Shift 게이트) (PLAN-004 R19)

Problem: 사용자 — ① 양 팀 채우기 후 카드 포지션이 "—"(포메이션 role DF/DM/AM/MF/FW가 셀렉트 목록에 없음) ② 움직인 위치(고스트)가 선수 토큰 아래 깔려 다시 클릭 불가, 특히 공 고스트가 수신자 밑에 숨어 "공이 클릭이 안 돼".
Change:

- PlayerCard ROLE_GROUPS에 포메이션 계열(DF/MF/DM/AM/FW) 포함 + 미지 값도 옵션으로 표시.
- 고스트 레이어를 토큰 **위**로 이동, **Shift 누른 동안만** pointer-events(+투명도 강조) — 평소 클릭은 토큰이 받고, Shift+드래그는 겹친 선수 위에서도 고스트를 잡음. 공 고스트 반경 1.3m.
  Validation: test 86/build/harness/format PASS; Playwright: #9 카드 포지션 FW 표시, 선수 8 위에 겹친 공 고스트를 Shift+드래그 → 8→7 패스 체인 재생(공 최종 7), 콘솔 클린.

### CHG-20260820-028 — FEAT/FIX — 지그재그 체인 드로잉 · 공 시작점 이동 (PLAN-004 R20)

Problem: 사용자 — ① 공이 패스를 그린 뒤에는 드래그로 안 움직임(시작 보유 세그먼트 우선 + 잔디 드롭 취소 정책) ② 지그재그: Shift를 계속 누른 채 누르고-끌고-놓기를 반복하면 다리(leg)가 이어지고, 원위치 선명 → 다리마다 점점 흐린 고스트, 경로 순서 배지 1,2,3.
Change:

- `segmentCommands.moveBallStartInDraft`: 공 드래그 = 시작 지점 이동 — 휴식 위치·initialHolder(선수 위 드롭=보유, 잔디=루즈)·첫 possessed@0·첫 패스 원점이 함께 이동. 취소 정책 제거.
- SimplePitch 체인: Shift 유지 중 각 press-drag-release = 새 다리, **단계 자동 +1**(1,2,3…), 다음 press는 마지막 위치에서 시작(빈 곳을 눌러도). Shift 떼면 체인 종료. 고스트는 다리마다 0.55→0.44→0.33….
  Validation: test 86/build/harness/format PASS; Playwright: #2 지그재그 3다리(배지 1,2,3 · 고스트 3단 흐림), 패스 authored 상태에서 공 150px 이동, 재생 무경고, 콘솔 클린.

### CHG-20260820-029 — FIX/UX — 재생 후 원위치 복귀 · 그룹 드래그가 경로도 이동 (PLAN-004 R21)

Problem: 사용자 — ① 재생이 끝나면 토큰이 마지막 위치에 선명하게 남아 고스트와 겹침(선명=시작, 흐림=끝이어야) ② 마퀴로 묶어 끌 때 공/선수의 그린 경로도 같이 이동해야.
Change:

- usePlayback: 재생 종료(비반복) 시 playhead 0. uiStore.setPlaying(false): **어떤 정지든**(일시정지·토큰 클릭·종료) playhead 0 — 편집 화면에선 선명 토큰=시작 위치 불변.
- `shiftEntityPathsInDraft` + SimplePitch 그룹 드래그(2개 이상): 홈 + 모든 authored 경로 waypoint(공 트랙 포함)를 증분 이동 — 묶은 플레이 전체가 통째로 이동.
  Validation: test 86/build/harness/format PASS; Playwright: 재생 후 #2 원위치(0px)·고스트 유지, 그룹(공+8+9+10) 80,60 이동 시 경로 고스트도 80,60 이동, 콘솔 클린.

### CHG-20260820-030 — FEAT — 보유자 이동 후 공 고스트 · 고스트 호버 하이라이트 (PLAN-004 R22)

Problem: 사용자 — 보유 선수가 1단계에서 달린 뒤 그 위치에서 패스하고 싶음: 보유 중이면 선수 고스트 옆에 공 고스트도 흐리게 보이고, 그걸 잡아 경로를 그릴 수 있어야. 고스트는 호버 시 하이라이트.
Change:

- 고스트 생성 시 선수 경로 끝 시각을 엔진(stateAt)으로 조회 — 그 시각에 공을 보유 중이면 같은 자리(발 옆)에 공 고스트 추가. Shift+드래그 = 그 미래 지점에서 패스 시작.
- `.ghostToken:hover` — opacity 1 + accent 테두리(Shift 유지 중 = 클릭 가능 상태에서 호버 반응).
  Validation: test 86/build/harness/format PASS; Playwright: #10 런 → 런 끝에 선수+공 고스트, 공 고스트에서 #9로 패스(2단계) → 재생 끝 공=#9, 콘솔 클린.

### CHG-20260820-031 — FIX — 패스 후 수신자 연속 소유 (PLAN-004 R23)

Problem: 사용자 — A가 B 위치에 놓아 패스하면 B가 이어서 공을 소유해야(달리면 공도 함께). 실제 원인 2개: ① 패스 끝 공 고스트가 수신자 정중앙에 겹쳐 B를 Shift+드래그하면 런 대신 공 고스트(재패스)를 잡음 ② 수신자 판정이 도착 시각 위치만 봐서 놓친 케이스.
Change:

- 수신자 있는 패스의 공 고스트는 수신자 **발 옆**(+1.1,+0.7)에 렌더 — 중앙 = B의 런, 발 옆 공 = 이어 패스.
- addStepPass 수신자 판정 폴백: 도착 시각 위치 → t=0 위치 → 각 선수의 최종 authored 위치 순으로 반경 검사(놓은 곳의 선수가 받도록).
  Validation: test 86/build/harness/format PASS; Playwright: 패스→#9(1단계), #9 런(2단계) 재생 중 공이 #9와 8px 이내 동행(200px 런), 콘솔 클린.

### CHG-20260820-032 — UX — 공 고스트 시인성 · 연결 스냅 피드백 · 경로 마퀴 (PLAN-004 R24)

Problem: 사용자 — ① 공 중간 거점 고스트가 화살촉과 겹쳐 공처럼 안 보임 ② 흰 하이라이트 뭉침 ③ 마퀴가 공 경로를 못 잡음 ④ 고스트에 이었는지 잔디에 놓았는지 인식 불가.
Change:

- 공 고스트를 공 모양(흰 원 + 어두운 링 + 점 3개)으로, 수신 패스는 발 옆 오프셋 유지.
- 그리는 중 **연결 스냅**: 끝점이 선수(현재)·모든 미래 지점(고스트) 2.5m 안이면 그 지점으로 흡착 + 점선 링 표시, 호버된 고스트는 선명+파란 테두리 — 이어짐이 명확.
- 수신자 후보에 **중간 고스트 위치** 추가(도착 시각 → t=0 → 고스트 → 최종 순).
- 마퀴가 경로 **선분**을 지나면 그 엔티티 포함(경유점만이 아니라 선분-박스 교차).
  Validation: test 86/build/harness/format PASS; Playwright: 경로 중간 마퀴 → 공 선택, 고스트 근처 릴리즈 → 수신자=#9로 스냅·소유 동행(run 200px 중 8px 이내), 콘솔 클린.

### CHG-20260820-033 — FEAT — 경로 잡아 곡률 휘기 (PLAN-004 R25)

Problem: 사용자 — 경로도 잡아서 곡선으로 휠 수 있어야.
Change: 경로 선 드래그 = **벤딩** — 잡은 지점에 부드러운 경유점 삽입(기존 점 1.2m 내면 재사용) 후 당기는 대로 Catmull-Rom 재스무딩(`bendGrabWaypointInDraft`/`bendMoveWaypointInDraft`). 커밋 시 단계 재계산(길이 변화) + 패스 끝이면 수신자 재해석(`resolvePassReceiverInDraft` 추출). 1 undo. 클릭만 하면 기존대로 선택. 조작법에 "경로 드래그 = 휘기" 추가.
Validation: test 86/build/harness/format PASS; Playwright: 직선 런 중간을 당겨 곡선(bbox h 3→11m), Ctrl+Z 복원, 콘솔 클린.

### CHG-20260820-034 — FIX/UX — 고스트 미세조정 · 선택 플레이 통째 드래그 · 공 크기 통일 (PLAN-004 R26)

Problem: 사용자 — ① 마퀴로 잡은 플레이의 경로를 드래그해도 안 움직임 ② 고스트 공이 실제 공보다 큼 ③ 미래 엔티티(고스트) 위치 미세조정 불가.
Change:

- 고스트 pointer-events 상시 활성(Shift 게이트 제거). **일반 드래그 = 그 움직임의 끝 위치 미세조정**(bend 제스처 재사용: 끝 경유점 이동+재스무딩, 커밋 시 단계·수신자 재계산). 라이브 토큰과 겹치면 토큰에 양보(pressToken 재사용, 마퀴로 새던 버그 수정).
- 선택된 엔티티의 **경로를 드래그 = 선택 전체 이동**(홈+경로, translate 플래그) — 마퀴 후 플레이 통째 끌기.
- 고스트 공 시각 반경 0.75m(실제 공과 동일), 히트 1.0m.
  Validation: test 86/build/harness/format PASS; Playwright: 고스트 +60,40 미세조정, 마퀴 후 경로 드래그 시 플레이 60,50 이동, 벤딩 회귀(h3→11→undo 3), 콘솔 클린.

### CHG-20260820-035 — UX — 단계 배지를 경로 중앙에 흐리게 (PLAN-004 R27)

Problem: 사용자 제안 — 끝점에 고스트·화살촉·배지가 몰려 복잡; 배지를 경로 중앙에 흐릿하게.
Change: 배지 위치 = 경로 호 길이 중간(pointAtDistance), 위로 1.9m 띄움; 기본 opacity 0.35(호버 1). 끝점은 고스트만.
Validation: test 86/build/harness/format PASS; Playwright 회귀(지그재그·미세조정·이동) PASS, 스크린샷 확인.

### CHG-20260820-036 — FEAT — 단계 미리보기·구간 재생·결과 유지 (PLAN-005 M1)

Problem: 수정 확인마다 전체 재생을 처음부터 기다려야 했고, 종료/일시정지가 즉시 t=0으로 튀어 결과를 볼 수 없었다 (A-01, A-02, FRAG-01).
Change:

- `stepWindow(doc, step)` (stepCommands): 단계의 compiled 시작~가장 느린 멤버 종료 창. stepStart는 이를 재사용.
- uiStore: `playScope('all'|'step'|'from-step')`, `rangeStart/rangeEnd`, `completion('idle'|'held-result')`, `startRange/holdResult/returnToAuthoringStart`. `setPlaying(false)`=frame 유지(암묵 t=0 제거), `playFrom/setPlayheadAuto` 삭제(구간 재생이 대체).
- usePlayback: 순수 `advanceClock` + 공용 action(`playAll/playWindow/pausePlayback/togglePlayback/returnToStart`) — footer 버튼·Space·Home이 같은 함수 사용(RULE-03). 자연 종료 = 구간 끝 frame 유지(held-result), loop는 rangeStart로 복귀.
- StepBar: chip = 단계 선택 + 사용 단계면 시작 장면 preview(문서 불변, A-01/A-03 chip 부분). 사용 단계에 `▶ 이 단계만`/`▶ 여기부터` 문맥 버튼.
- AppShell: held-result 시 footer에 "결과 화면 — ↺(Home)으로 원위치" status.
- SimplePitch: 문서를 바꾸는 제스처 시작(토큰 이동/그리기/벤딩/고스트 조정/선수 추가) = `returnToAuthoringStart()`. 고스트/배지는 t>0(재생·정지 frame·preview)일 때 숨김.
  Validation: typecheck/lint/test 97/build/harness/format PASS; Playwright(m1.cjs): chip2 preview 180px 지점·고스트 0, 이 단계만 재생 중 타 단계 드리프트 0, 종료 후 배너+frame 유지, Home 원위치 0px, held 중 편집 시 자동 복귀+배너 소거, 콘솔 클린.

### CHG-20260820-037 — FEAT — 명시적 단계 편집·부분 삭제·선택 액션 바 (PLAN-005 M2)

Problem: 배지 오클릭이 즉시 단계 +1(역방향 수정 번거로움, C-02), chip이 선택된 경로를 암묵 재배정(A-03), 삭제 단위가 경로 하나/전체 판뿐(A-06), 단계 상한이 uiStore에서 10으로 남음(DOC-04).
Change:

- 배지 클릭 = 선택만. 단계 지정은 SelectionActionBar(신규)의 1~9 picker 또는 숫자키.
- SelectionActionBar: 선택한 움직임의 소유자·종류(이동/패스)·단계 picker·`▶ 이 단계만`·삭제·선택 해제 — native 컨트롤(C-06). PlayerCard와 같은 anchor, 동시에 하나만 렌더.
- `clearStep`/`clearEntityMovements`/`clearAllMovements` (stepCommands): 각각 1 transaction·1 undo, gen- 보존, relayout 포함. 좌측 패널에 `움직임 전체 지우기`(새로 시작과 분리, undo 안내 toast, A-06(a) 확인창 없음).
- uiStore `setCurrentStep` clamp를 MAX_STEP(9)로 통일(DOC-04).
  Validation: typecheck/lint/test 101/build/harness/format PASS; Playwright(m2.cjs): 배지→액션바, picker 1→5(chip5 used), 바에서 단계 재생, 삭제→segments 0, 전체 지우기→segments 0·선수 22 유지, Ctrl+Z 한 번에 2개 복원, 콘솔 클린.

### CHG-20260820-038 — REFACTOR/FEAT — 순수 제스처 intent 판정·경로 드래그=항상 휘기·체인 상한 안내 (PLAN-005 M3)

Problem: SimplePitch 포인터 라우팅이 target/modifier 분기에 얽혀 있고(FRAG-02), path drag가 선택 상태에 따라 이동/휘기로 갈라졌으며(C-01), 지그재그 체인이 9단계에서 조용히 같은 단계에 누적됐다(A-05). toast 상태는 있는데 렌더러가 없었다.
Change:

- 신규 `gestureIntent.ts`: DOM 없는 `resolvePointerIntent(hit, mods, ctx)` — 한 press = 한 intent(10종 truth table). SimplePitch pointerdown은 flag 축약 → resolver → switch로 단일 제스처만 시작.
- **path drag = 항상 bend** (C-01, 계획대로): 선택된 소유자의 경로 드래그 시 전체 이동하던 분기·translate 플래그 제거. 그룹 이동은 라이브 토큰 드래그 전용(마퀴 후 토큰 잡아 끌기, 기존 유지).
- 체인 오버플로 가드(A-05): 9단계 다음 leg는 생성 전 차단 + 이유 toast(`simple.stepLimit`). 명시적 9단계 병렬 작성은 허용. `nextChainStep` 순수 함수.
- AppShell에 toast 렌더러 추가(role=status, aria-live) — flashToast가 실제로 보이게 됨(기존 공백 수정).
- keymap: 배지 클릭 안내를 "움직임 선택 — 단계·재생·삭제 카드 표시"로 갱신.
- A-04 보류에 따라 route handle·ghost handle 분리는 구현하지 않음(Shift 유지).
  Validation: typecheck/lint/test 107(gestureIntent 6 신규)/build/harness/format PASS; Playwright(m3.cjs): 소유자 선택 중 경로 드래그 bbox h 0→90(휘기)·홈 0px(이동 없음), 그룹 토큰 드래그 60,40(홈+경로), 체인 8→9 후 3번째 leg 차단(segments 불변)+toast 표시, 콘솔 클린.

### CHG-20260820-039 — UX — 재생 중 active 경로 강조·전역 고스트 감쇠·배지 충돌 회피 (PLAN-005 M4)

Problem: 재생 중 지금 움직이는 경로를 찾기 어려웠고(B-01, dimOthers는 selection만 인지), 고스트 농도가 entity별 순번이라 22명일 때 계층이 무너지며(B-02/FRAG-04), 배지가 겹칠 수 있고(B-03), 얇은 경로가 피치 라인에 묻혔다(B-04).
Change (모두 UI-only·순수 helper, 문서/엔진 불변):

- pathPresentation: `deriveActiveSegmentIds`/`derivePathPhase`(past·active·future), `ghostOpacityForStep`(전역 step rank 감쇠, 바닥 0.18, 선택 부스트), `placeStepBadges`(결정적 후보 링, 2.6m 간격, 4m 한계).
- PathLayer: `pathPhase` prop — active는 casing 강조·선 굵게, past 0.22·future 0.45로 후퇴. 반투명 흰 casing을 모든 경로 밑에 렌더(B-04). 렌더러는 표시 전용 유지.
- SimplePitch: viewingFrame(재생·정지 frame·preview)에서 compiled segmentTimes로 phase 계산해 전달; 고스트 opacity를 전역 rank로; 배지 위치는 placeStepBadges 경유.
- StepBar: 재생 중 진행 중인 단계 chip에 `aria-current="step"` + 시각 링.
  Validation: typecheck/lint/test 111(pathPresentation +4)/build/harness/format PASS; Playwright(m4.cjs): 재생 중 phase active/future→past/active 전환, aria-current chip 표시, casing 2, 배지 간격 확보, 콘솔 클린. 감쇠 수치의 최종 체감(A-05)은 사용자 브라우저 확인 대기.

### CHG-20260820-040 — FEAT — 세션 한정 A/B 변형 (PLAN-005 M5, A-03a)

Problem: A안을 복제해 B안과 빠르게 비교·독립 수정할 수 없었다(A-07). 저장 기능 재도입 없이(RULE-05) 세션 안에서만.
Change:

- 신규 `variantSession.ts`: `VariantSession` — A/B 각각 독립 EditorCore(문서+undo history), 메모리 전용. clone=현재 문서로 새 core 생성(fresh history) 후 전환. schema/JSON/localStorage 접점 없음.
- `EditorContext`에 `VariantProvider`/`useVariantSession` seam; `App`이 세션 수명 소유, 전환 시 `key`로 에디터 서브트리 remount(stale 구독 원천 차단).
- AppShell 헤더: `A | B` chip(+aria-pressed)과 `→ B안 복제` — 전환/복제 시 재생 정지·선택 해제, 복제 toast. 저장/파일 용어 없음, 새로고침이면 소멸.
  Validation: typecheck/lint/test 115(variantSession 3, AppShell A/B 1 신규)/build/harness/format PASS; Playwright(m5.cjs): A 1개→복제 B 1개→B 추가 2개→A 복귀 1개→A undo 0개·B 2개 유지, 새로고침 후 B 비활성·빈 판, 콘솔 클린.

### CHG-20260820-041 — UX — 이유 있는 피드백·미니 투어·모션 폴리시 (PLAN-005 M6)

Problem: 짧은 드래그가 조용히 무시됐고(C-03), 기본 투어가 만들기까지만 가르치며(C-04), 재생 경계에서 고스트/배지가 한 frame에 사라지고(D-02), 공 드롭 스프링이 배선되지 않았고(D-03), 안내가 제거된 "애니메이션 모드"를 전제했다(DOC-05).
Change:

- finishDraw 1.5m 미만 → `너무 짧아요` toast(문서 불변, C-03).
- 옵트인 미니 투어 `MINI_TOUR_STEPS`(굽히기→이 단계만 재생→Ctrl+Z), 조작법 패널 버튼으로 시작. tour state에 set('main'|'mini'), TourContext에 playScope 추가. 기본 투어는 그대로 5단계.
- 고스트/배지를 마운트 유지 + `.decorShown/.decorHidden` opacity 160ms 페이드(D-02), hidden은 pointer-events none, prefers-reduced-motion이면 즉시(D-05).
- 공 드래그 커밋 시 보유자 스냅 오프셋을 `AnimatedToken dropFrom` 스프링으로 수렴(D-03, 문서 좌표는 즉시 확정, reduced-motion은 스프링 immediate 기존 지원).
- 안내 언어: "애니메이션 모드" 그룹 → "경로 그리기·다듬기"(DOC-05).
  Validation: typecheck/lint/test 116(mini tour 1 신규)/build/harness/format PASS; Playwright(m6.cjs): 짧은 드래그 toast+segments 0, 재생 중 decorHidden 2·복귀 후 decorShown 2, 미니 투어 3단계 자동 진행(굽히기→단계 재생→되돌리기), M1 회귀 재실행 PASS, 콘솔 클린. 드롭 스프링 체감은 사용자 브라우저 확인 대기.

### CHG-20260820-042 — DOCS/CLEANUP — dead state 제거·문서 정합화 (PLAN-005 M7)

Problem: 제거된 모드의 state/CSS/문구가 남아 유지보수 표면을 키웠고(DOC-03/FRAG-05), CURRENT_STATE 머리말이 낡았으며(DOC-01), 승인된 상호작용 계약이 ADR에 없었다.
Change:

- uiStore에서 `animMode`/`setAnimMode`/`timelineExpanded`/`autoReactOpen`/`theme`/`setTheme`/`inspectorPinned` 제거(전부 참조 0 확인 후). TourContext를 `{doc, entry, hasPlayed, playScope}`로 축소.
- dead CSS 제거: `.scrubGhost`(pitch), `.animToggle`(shell). dead i18n 키 4개 제거(needAnim/animMode/animOff/animOffNote).
- ADR-0009 **Amendment v4**: PLAN-005 승인 계약(칩=preview, 구간 재생, 결과 유지, 경로 드래그=휘기, 배지=선택, 체인 상한, 세션 A/B, A-04 보류) 기록.
- CURRENT_STATE 머리말·상태 갱신(DOC-01), PROJECT_MAP에 신규 파일 반영.
  Validation: `rg "animMode|timelineExpanded|autoReactOpen|scrubGhost|animToggle" src` → 0건(역사적 ADR 언급만 잔존); typecheck/lint/test 116/build/harness/format PASS.

### CHG-20260820-043 — UX — 재생 중 경로/화살표 숨김 (사용자 지시)

Problem: 사용자 — "애니메이션 진행할 때는 이거 화살표 안 보이게 해줘" (재생 중 경로 화살표가 움직임을 방해).
Change: PathLayer 전체를 재생 중(`playing`) `.decorHidden`으로 페이드 아웃(160ms, reduced-motion 즉시) — M4의 "재생 중 active 경로 강조"를 사용자 결정으로 대체(ADR-0009 v4 해당 항목 수정). 일시정지·결과 화면·단계 미리보기 frame에서는 phase 감쇠로 다시 표시. dimOthers 재생 분기 제거.
Validation: typecheck/test 116/build/harness/format PASS; Playwright(m8.cjs): authoring path 1.0 → playing path 0·badge 0 → held-result path 0.22(past) → Home 1.0, 콘솔 클린.

### CHG-20260820-044 — UX — 배지 인라인 단계 피커·셰브론 화살촉·애플식 UI 재디자인 (사용자 지시 3건)

Problem: ① 단계 변경이 번거로움(선택→상단 카드까지 이동) ② 화살촉이 크고 투박(채운 삼각형 2.2m) ③ 제목 입력 불필요, 패널/하단바가 밋밋하고 기능 그룹핑 없음.
Change:

- **인라인 단계 피커**: 배지 클릭 → 그 자리에 1~9 흰 알약 피커(현재 단계 하이라이트), 숫자 클릭 즉시 변경·닫힘, 바깥 클릭/재생 시 닫힘. 상단 액션 바·숫자키도 유지.
- **화살촉**: 코칭보드 스타일 벤치마킹 — 채운 삼각형 → 선 굵기에 맞춘 **가는 열린 셰브론**(stroke-only, 선수 1.4m/공 1.2m, 둥근 캡).
- **재디자인**: 제목 입력 제거(정적 브랜드 "⚽ 전술 보드"), 헤더/하단바 frosted(blur+hairline), 하단바=중앙 부유 알약(재생 그룹 | 구분선 | 단계 칩+구간 재생), 좌측 패널=카드 2장(팀 구성: 포메이션+채우기(파랑)+공 투입(초록) / 정리: 전체 지우기·새로 시작(빨강 틴트)), 우측 조작법·미니 투어도 카드화. 토스트 위치 하단 바 위로.
  Validation: typecheck/lint/test 116/build/harness/format PASS; Playwright(r9.cjs): 피커 열림→5 지정→닫힘·chip5 반영, 제목 input 부재, 스크린샷 육안 확인(카드/부유 바/셰브론), m8 회귀(재생 중 경로 숨김) PASS, 콘솔 클린.

### CHG-20260820-045 — FIX — 단계 피커 최상위 렌더·좌측 패널 비율 (사용자 지시 2건)

Problem: ① 인라인 단계 피커가 다른 경로의 배지/토큰에 가려짐(SVG 페인트 순서) ② 좌측 패널 버튼/셀렉트 비율이 안 맞음(열 176px에 라벨이 빠듯).
Change: 피커를 SVG 마지막 child로 이동(항상 최상위); 좌측 열 212px·우측 244px, panelBtn 높이 34·패딩 12·12.5px 통일, select 높이 30·전체 너비, 라벨 열 44px.
Validation: typecheck/lint/test 116/build/harness/format PASS; Playwright: 피커=svg last child 확인+스크린샷(배지 위에 렌더), 좌측 패널 스크린샷 육안 확인, 콘솔 클린.

### CHG-20260820-046 — FIX — 보유 선수 프레스 시 공 가로채기 해소·액션 바 라벨 줄바꿈 (사용자 지시 2건)

Problem: ① 공을 보유한 선수를 Shift+드래그하면 위에 그려진 공이 프레스를 가로채 런 대신 패스가 그려짐 ② 선택 액션 바 "단계" 라벨이 세로로 줄바꿈.
Change:

- 공이 보유 상태일 때 토큰 프레스를 **시각 반경 정규화 거리**로 판정: 선수 몸통(1.8m 기준)을 누르면 선수(런/이동), 발 옆의 작은 공(0.9m 기준)을 직접 누르면 공(패스). draw/이동/선택 모두 동일 규칙.
- `.playerCard label`에 white-space: nowrap.
  Validation: typecheck/lint/test 116/build/harness/format PASS; Playwright: 보유 상태에서 중심 드래그=move 1/travel 0, 공 드래그=travel 1, 라벨 높이 30px(1줄), 콘솔 클린.

### CHG-20260820-047 — FEAT — 보유 공 360도 방향 (사용자 지시)

Problem: 보유 공이 항상 홀더 오른쪽(+1.1,+0.7) 고정 — 어느 방향으로 잡고 있는지 표현 불가.
Change:

- `carryOffset(v)` (engine/compile, 순수): 홀더→공 벡터의 방향 유지, 거리 [0.8,1.6]m 클램프, 퇴화 시 기존 오프셋.
- 공 드롭(moveBallStartInDraft): 놓은 방향 그대로 rest/첫 possessed.offset에 반영 — 같은 홀더 주위로 끌면 각도 재조정.
- 수신 소유(syncTravelReceiver): 패스가 떨어진 지점의 상대 방향으로 offset; 스냅으로 정중앙이면 **공이 온 방향**(진행 반대) 폴백.
- 엔진 stateAt의 initial-holder 폴백도 ball.home 방향 파생. 수신 공 고스트는 엔진 위치(stateAt end+0.05) 사용.
- 스키마 변경 없음(기존 optional `possessed.offset` 활용).
  Validation: typecheck/lint/test 119(+3)/build/harness/format PASS; Playwright: 왼쪽 드롭=왼쪽 유지(dx -13px), 위로 재배치(dy -14px), 스냅 패스 후 수신자 왼쪽(온 방향) 유지(dx -13px), 콘솔 클린.

### CHG-20260820-048 — FEAT/UX — 정리 단축키·전술안 A/B/C 세그먼트·팀 색 표시 (사용자 지시 3건)

Problem: ① 움직임 전체 지우기/새로 시작에 단축키 없음, 버튼에 표기도 없음 ② A/B 2안뿐이고 복제 버튼이 별도라 어색 ③ 팀 구성 카드에 홈/어웨이 색 구분 없음.
Change:

- **Shift+Delete** = 움직임 전체 지우기, **Shift+R** = 새로 시작(패널 버튼과 동일 동작·토스트). 버튼 우측에 희미한 ⇧Del/⇧R 표기(.btnKbd), ? 오버레이 편집 그룹에도 추가.
- 전술안 **A/B/C** 세그먼트 컨트롤(헤더 알약): 채워진 슬롯 클릭=전환(활성 하이라이트), **빈 슬롯(점선 +) 클릭=지금 판을 그 안으로 복제 후 전환** — 별도 복제 버튼 제거, HCI 단순화. VariantId에 'C' 추가(세션 메모리 전용 동일).
- 팀 구성 Home/Away 라벨 앞에 팀 색 점(teamDotSmall).
  Validation: typecheck/lint/test 120(variant C +1)/build/harness/format PASS; Playwright: 팀 점 2색(blue/red), Shift+Delete로 segments 1→0+토스트, Shift+R로 선수 0→undo 22, kbd 표기 2개, A→B→C 복제·C 활성, 스크린샷 육안 확인, 콘솔 클린.

### CHG-20260820-049 — UX — 전체 지우기 단축키 X로 교체·버튼 글자 넘침 수정·Ctrl+클릭 추가 선택 (사용자 지시 3건)

Problem: ① Shift+Delete가 누르기 힘듦 ② 정리 버튼 라벨+단축키 표기가 버튼 밖으로 뚫림 ③ 선수 다중 선택이 마퀴뿐 — 엔티티를 하나씩 추가 지정 불가.
Change:

- 움직임 전체 지우기 = **X** 한 키(Shift+Delete 대체). 버튼 표기/타이틀/? 오버레이 갱신.
- panelBtn: overflow hidden·패딩/폰트 축소, btnKbd flex none — 라벨+표기가 항상 버튼 안(scrollWidth 검증).
- **Ctrl+선수 클릭 = 선택에 추가**, 이미 선택된 멤버 Ctrl+클릭 = 빼기(토글), **Ctrl+누른 채 드래그 = 추가 후 그룹 전체 이동**. gestureIntent에 press-token-additive 추가(truth table 테스트 포함). 잔디 Ctrl+클릭=선수 투입은 그대로.
  Validation: typecheck/lint/test 120/build/harness/format PASS; Playwright: 클릭 1→Ctrl+클릭 2→재클릭 1(토글), Ctrl+드래그로 3명 추가·그룹 60,36px 이동, X로 segments 0, 버튼 overflow 없음, 콘솔 클린.

### CHG-20260820-050 — FIX — 조작법 상단 실선(미니 투어 버튼) 제거 (사용자 지시)

Problem: 조작법 패널 상단에 실선처럼 깨져 보이는 요소 — 미니 투어 진입 버튼이 잘못 렌더링됨.
Change: 버튼 제거(사용자: 없애줘). MINI_TOUR_STEPS 자체는 보존(진입점 없음, 추후 ? 오버레이 등으로 재노출 가능).
Validation: typecheck/lint/test 120/build/harness/format PASS; 조작법 패널 스크린샷 육안 확인(라벨 아래 바로 카드), 콘솔 클린.

### CHG-20260820-051 — FEAT/UX — 보유 공이 홀더 드래그를 따라감·부착 피드백 강화 (사용자 지시)

Problem: ① 공을 선수 왼쪽에 붙여도 그 선수를 옮기면 공이 제자리에 남아 방향이 틀어짐 ② 공이 붙었는지 땅에 떨어진 건지 구분이 안 됨.
Change:

- 토큰 드래그 제스처에 ballOrigin: 드래그 그룹에 초기 보유자가 있고 공이 그룹에 없으면 ball.home을 같은 delta로 이동(단일/그룹 드래그 모두) — 선택한 방향 그대로 동행.
- 부착 순간: 보유자+공 동시 펄스 + "#N 공 보유 — 선수를 옮기면 공도 같이 갑니다" 토스트.
- 보유 중 상시 표시: 공에 홀더 팀색 **holderRing**(0.28m 스트로크) — 루즈볼과 즉시 구분.
  Validation: typecheck/lint/test 120/build/harness/format PASS; Playwright: 왼쪽 부착 후 단일 드래그·마퀴 그룹 드래그 모두 상대 오프셋 동일(-13.1,-0.3 유지), 토스트·링 확인, 스크린샷 육안, 콘솔 클린.

### CHG-20260820-052 — UX — 헤더 중앙 정렬(브랜드+전술안)·버전 배지·Ctrl 안내 사이드바 이동 (사용자 지시)

Problem: 전술안 A/B/C와 "전술 보드"가 작게 흩어져 있고, 배포 버전 확인 수단이 없고, Ctrl 안내가 헤더에 낑겨 있음.
Change:

- 헤더를 3열 그리드로: 중앙에 **⚽ 전술 보드(17px)** + **A/B/C 세그먼트(칩 34px)** 나란히, 우측 undo/redo/?.
- 좌상단 **버전 배지**: `v0.1.0 (커밋해시)` — vite define(**APP_VERSION**, package.json+git rev-parse), 흐릿(opacity .55)·호버 선명·클릭 시 클립보드 복사+토스트.
- 헤더의 Ctrl+클릭/우클릭 안내 제거 → 좌측 팀 구성 카드 하단에 두 줄 들여쓰기(panelHintLine).
  Validation: typecheck/lint/test 120/build/harness/format PASS; Playwright: 배지 "v0.1.0 (844bab3)"·클릭 복사 토스트, 사이드바 안내 2줄, 스크린샷 육안(중앙 정렬), 콘솔 클린.

### CHG-20260820-053 — FEAT — 플레이 GIF 내보내기 (사용자 지시)

Problem: 만든 애니메이션을 시간 압축해 GIF로 뽑아 보관/공유하고 싶음.
Change:

- 신규 `exportGif.ts`: 엔진 stateAt 기반 캔버스 렌더(재생 뷰와 동일 — 잔디+선수+공만) → gifenc 인코딩. 기본 2배속·12fps·640px, 진행률 콜백, 8프레임마다 yield. `sampleTimes` 순수(테스트 2).
- 하단 바 재생 그룹에 **GIF** 버튼: 진행률 토스트 → 파일 다운로드(`tactic-YYYY-MM-DD.gif`). 파일이 곧 보관함 — 앱 내 저장 없음(클린 보드 원칙 유지).
- 의존성 gifenc 추가(8KB, 무의존) — 사용자 기능 지시로 정당화, 기록.
  Validation: typecheck/lint/test 122(+2)/build/harness/format PASS; Playwright: 다운로드 파일 GIF89a 매직·412KB, 콘솔 클린.

### CHG-20260820-054 — UX — Ctrl+좌클릭 표기·글로시 토큰·결정적 런 바운스·심도 폴리시 (사용자 지시)

Problem: "Ctrl+클릭" 표기가 모호, 디자인이 밋밋(애플 심도 부족), 이동이 뻣뻣함.
Change:

- 모든 안내 문구 Ctrl+클릭 → **Ctrl+좌클릭**.
- 토큰: 상단광 radialGradient 캡 + 지면 그림자(ellipse) — 말이 잔디 위에 떠 보이는 글로시 룩.
- **결정적 런 바운스**: 이동 중 선수에 전술시간 f(t) 사인 bob(진폭 0.22m, 선수별 위상) — UI 표현 전용, 엔진/스크럽 정확성 불변(RULE-04 준수).
- 심도: 피치 프레임 3중 그림자·라운드 20px, 카드/부유 바 blur 강화+흰 헤어라인+2중 그림자, 재생 버튼 그라디언트+글로우+호버 리프트.
  Validation: 위 게이트 동일 PASS; Playwright: 재생 중 y 진폭 1.1px 관측(결정적), 스크린샷 육안, 콘솔 클린.

### CHG-20260820-055 — UX — 공을 발끝 거리로·부착 "탁!" 링 플래시 (사용자 지시)

Problem: 보유 공이 선수 원판을 덮어 선수 클릭을 뺏고, 공을 대줬을 때 붙었다는 순간 피드백이 약함.
Change:

- carryOffset 반경 [0.8,1.6] → **[1.6,2.1]m**(기본 오프셋 1.45,0.95) — 공이 원판 밖 발끝에 위치, 등번호·클릭 안 가림. 관련 테스트 3곳 기대값 갱신.
- 부착 순간: 기존 펄스+토스트에 **확장 링 플래시**(0.55s bounce ease, onAnimationEnd 자동 제거, reduced-motion 즉시) 추가.
  Validation: typecheck/lint/test 122/build/harness/format PASS; Playwright: 링 발화·자동 소거, 부착 후 중앙 클릭=선수 카드, 스크린샷 육안(공이 가장자리), 콘솔 클린.

### CHG-20260820-056 — REFACTOR — PLAN-006 M0·M1: 기준 증거 + 시맨틱 토큰·재질 계층

Problem: (M0) 리디자인 비교 기준 없음. (M1) blur 남용(AUD-01), CSS 임의값(AUD-02), depth 평탄(AUD-03), 모션 값 제각각(AUD-07), 화면·GIF 상수 분리(AUD-06).
Change:

- M0: BASE-01~~08 스크린샷 + manifest를 `docs/agent/evidence/PLAN-20260821-006/`에 고정(콘솔 클린). Ambiguity A-01~~A-06 사용자 확정(전부 (a), A-03은 절충 — bob 유지+다수 이동 시 감쇠 예정).
- M1 tokens.css: 시맨틱 **depth 4단계**(rest/raised/drag/overlay), **radius 역할**(control 8/card 14/stage 20/pill), **모션 의미**(instant 80/feedback 140/transition 220/settle 320/emphasis 480 + standard/out/pop easing), reduced-motion 전부 0ms. 구 토큰은 alias 유지.
- A-04a 적용: 헤더·패널 카드 **solid**(blur 제거), blur는 footer 바+오버레이 1종만. pitchFrame·toast·decor 페이드·attach 링·tour spotlight 모두 토큰 소비, module CSS에서 cubic-bezier 0.
- `renderer/visualDefaults.ts`: 화면·GIF 공용 시각 상수(AUD-06) — exportGif가 소비.
- SPRINGS를 의미 역할(press/pickup/drop/overlay)로 정리(레거시 alias 유지, ShortcutsOverlay 이행).
- 신규 `designTokens.test.ts` 4건: 토큰 정의·reduced 커버리지·bezier 0·blur 상한(A-04a).
  Validation: typecheck/lint/test 126(+4)/build/harness/format PASS; 스크린샷 비교(BASE-01 대비 카드 solid·피치 단일 depth), 콘솔 클린.

### CHG-20260820-057 — UX — PLAN-006 M2: 첫 3초 계층·로컬 SVG 아이콘·파괴 버튼 절제

Problem: 셸 컨트롤이 텍스트 글리프(↶↷▶↺⟳?) 혼용, 정리(파괴) 버튼이 상시 빨강 강조, 구간 재생 버튼이 본 재생과 같은 무게(AUD 격차표 header/actions/footer 항목).
Change:

- 신규 `UiIcon.tsx`: 로컬 stroke SVG 7종(undo/redo/play/pause/home/loop/help, currentColor·24 viewBox) — 외부 의존성 0, 셸 한 목소리.
- 정리 카드: `btnQuietDanger` — 평시 무채색, hover/focus-visible에서만 빨강(파괴는 의도 시점에만 강조).
- 양 팀 채우기 `panelPrimary`(38px) — 빈번 행동 크게(Fitts).
- StepBar 구간 재생 버튼을 pill 세컨더리(28px, hover 시 accent)로 — footer Play가 유일한 primary.
- 테스트: 랜드마크·핵심 액션 존재 + 레거시 크롬(스크럽/모드 토글/range) 부재 단언 1건 추가.
  Validation: typecheck/lint/test 127(+1)/build/harness/format PASS; 스크린샷 육안(아이콘·계층), 콘솔 클린.

### CHG-20260820-058 — UX — 보유 공 간격 확대·토큰 단색 (사용자 지시)

Problem: 보유 공이 아직 선수와 붙어 보이고, 토큰 그라데이션이 취향에 안 맞음.
Change: carryOffset [1.6,2.1]→**[2.0,2.6]m**(기본 1.75,1.15 — 관련 상수·테스트 일괄 갱신), 토큰 gloss 그라데이션 제거 → **단색**+지면 그림자만(M3a 선결정으로 계획 Decision Log 기록).
Validation: typecheck/lint/test 127/build/harness/format PASS; Playwright: 간격 확대·gradient 요소 0, 스크린샷 육안(플랫 단색), 콘솔 클린.

### CHG-20260820-059 — UX — PLAN-006 M3: 22명 판독성 (away 키라인·rest 단계 계층·bob 감쇠)

Problem: 팀 구분이 색뿐(CVD 취약), 대기 화면에서 모든 경로가 같은 대비로 경쟁, 22명 동시 이동 시 bob이 떨림(AUD-05, A-02/A-03/A-05).
Change:

- **A-02a**: away 선수 안쪽 흰 키라인(화면 Token + GIF 렌더러 동일 — parity 유지).
- **A-05a**: 대기(t=0) 화면에서 현재 단계 외 경로 opacity 0.55(선택 세그먼트는 항상 선명) — 순수 helper deriveRestMutedIds(+테스트 2).
- **A-03 절충 구현**: run bob 진폭이 동시 이동 4명까지 0.22m, 그 이상 4/n 비례 감쇠(하한 0.08) — 결정적 f(t) 유지.
  Validation: typecheck/lint/test 129(+2)/build/harness/format PASS; Playwright: away 키라인 11개, 단계 전환 시 mute 플래그 [true,false]↔[false,true], 콘솔 클린.

### CHG-20260820-060 — UX — PLAN-006 M4: 직접 조작 마이크로 인터랙션

Problem: press/drag/drop 장식이 한 상태 모델 없이 흩어짐(AUD-04); 누르는 순간·잉크 시작·커밋 순간의 확인 피드백 부재.
Change:

- 신규 : 순수 phase 머신(idle→pressed→dragging→settling→idle, cancel 경로 포함, 비정상 이벤트 무시) — 장식의 단일 진실(+테스트 4).
- **프레스 리프트**: 토큰 pointer down 즉시 scale 1.035(스프링, reduced=즉시), 드래그 시작하면 기존 1.08 픽업 — 입력 1프레임 내 반응.
- **잉크 시작/커밋 확인**: Shift 드로우 시작 시 주체 토큰 1회 펄스, 경로 커밋 순간 다시 1회 펄스(화살표가 누구 것인지 즉시 인지).
  Validation: typecheck/lint/test 133(+4)/build/harness/format PASS; Playwright: 프레스 중 해당 토큰만 scale 1.035, 드로우 회귀 정상, 콘솔 클린.

### CHG-20260820-061 — UX — PLAN-006 M5: 재생 무대 전환

Problem: 재생 중에도 좌우 패널·헤더가 같은 대비로 남아 시선이 분산.
Change: shell에 data-playing 부착 — 재생 중 헤더·양 패널 opacity 0.45로 물러남(위치 이동 없음, transition 토큰, 정지/종료 시 복귀). 경로 숨김·GIF parity·A/B/C 즉시 교체는 기존 유지.
Validation: typecheck/lint/test 134(+1)/build/harness/format PASS; Playwright: 재생 중 패널 0.45 → held에서 1로 복귀(attr true→false 확인), 콘솔 클린.

### CHG-20260820-062 — A11Y — PLAN-006 M6: 포커스 가시성·forced-colors

Problem: 단계/전술안 칩·버전 배지가 .btn 포커스 링 밖, 고대비 모드 무대응.
Change: stepChip/variantChip/versionBadge focus-visible 아웃라인, forced-colors에서 컨트롤 보더(ButtonText)·포커스(Highlight) 보장. 토스트(status)·컴파일 오류(alert)·GIF 진행(status)의 역할 구분은 기존 유지 확인.
Validation: typecheck/lint/test 134/build/harness/format PASS.

### CHG-20260820-063 — DOCS — PLAN-006 M7: 사후 증거·성능·감사 마감

Change: M7-01~08 재캡처(BASE 1:1, 콘솔 클린), 재생 중 long task(>50ms) 0건 관측, 감사(순수성/레거시/의존성/bezier) 전부 클린, manifest에 차이 요약. 계획 Status Completed — 브라우저 수용 체크리스트는 사용자 몫(EXTERNAL-VERIFICATION-PENDING).
Validation: typecheck/lint/test 134/build/harness/format PASS (최종 게이트 아래 커밋에서 재실행).

### CHG-20260820-064 — FIX — 홀더 이동 시 패스 동행·재생 5초 패딩 제거·화살촉 트림 (사용자 지시 3건)

Problem: ① 공 보유+패스 상태에서 홀더를 옮기면 패스가 안 따라오고, 1단계 패스면 t=0에 공 상태가 travel이라 홀더 프레스가 공 드래그로 새어 소유가 풀림 ② compile의 MIN_SCENE_DURATION(5s) 바닥값 때문에 짧은 플레이도 5초 재생(느림) ③ 화살촉이 끝점의 엔티티/고스트에 가려짐.
Change:

- 프레스 홀더 판별에 t=0 폴백(initialHolderId) — 홀더 몸통 프레스가 항상 선수. 홀더 드래그 시 ball.home과 **패스 원점(wp0)** 동행(`moveBallPathOriginInDraft`, 단일/그룹). addStepPass가 만드는 소유가 carry 방향 상속(공 점프 제거). t=0 정지 상태 공은 possessed로 렌더(홀더 링 유지).
- `playableEnd(compiled)` = 마지막 세그먼트 끝 — 재생/Space/GIF가 5초 패딩 대신 실제 끝까지만. 기본 속도 상향(선수 5→7, 패스 16→20 m/s).
- 표시 경로 끝을 트림(선수 2.15m/공 1.15m, `trimPathEndD`+세그먼트 identity 캐시) — 화살촉이 토큰·고스트 밖에 뜸. 히트 경로는 원래 길이 유지.
  Validation: typecheck/lint/test 134/build/harness/format PASS; Playwright: 홀더 +13.6m 드래그 후 상대 오프셋(−1.7,+0.9)·wp0=ball.home 유지·소유 유지, 18m 런 재생 5.0→**2.61s**, 화살촉 클리어런스 스크린샷, 콘솔 클린.

### CHG-20260820-065 — FIX — 미래 보유자 이동 시 공 앵커 동행·곡선 경로 평행이동 (사용자 지시)

Problem: ① 패스를 받을(또는 받은 뒤 이어 찰) 선수를 옮겨도 패스 끝/재패스 원점이 제자리 ② 곡선 경로를 가진 선수를 옮기면 시작점만 붙어가 경로가 과도하게 꺾임.
Change:

- `shiftBallAnchorsForPlayerInDraft`: 선수 이동 시 그 선수가 **받을 패스의 끝** + **이어 찰 패스의 원점**(직전 소유 기준)을 같은 delta로 동행(핸들 포함). 커밋 시 relayout으로 타이밍 재계산.
- 선수 드래그(단일 포함)를 그룹과 동일한 **경로 전체 평행이동**으로 통일 — 경유점+양 핸들이 같이 움직여 곡선 형태 완전 보존. 공 단독 드래그만 기존 절대 이동(드롭이 보유/루즈 결정) 유지.
  Validation: typecheck/lint/test 134/build/harness/format PASS; Playwright: 수신자 +11.4,+5.7m 드래그 후 패스 끝 delta 불일치 **0.00m**·수신자 유지, 곡선 런 드래그 후 형태 시그니처(구간 거리) 동일, 콘솔 클린.

### CHG-20260820-066 — UX — 경로 작성 수정자 Shift → Alt (사용자 지시)

Problem: Shift가 누르기 불편 — 왼쪽 Alt가 편하다는 사용자 결정.
Change: 경로 작성 계열 전부 Alt로 교체 — 토큰/고스트 드로우, 지그재그 체인(Alt 유지), 고스트 활성 표시(drawKeyHeld). gestureIntent의 수정자 필드를 `draw`로 일반화(호출부가 Alt 바인딩). Alt keydown/up preventDefault로 브라우저 메뉴 포커스 차단. 안내(조작법/투어/? 오버레이) 전부 갱신. Shift+드래그는 이제 일반 이동과 동일. ADR-0009 v4 항목 갱신.
Validation: typecheck/lint/test 134/build/harness/format PASS; Playwright: Alt+드래그=경로 1개, Shift+드래그=이동(경로 불생성), Alt 체인 2leg steps [1,2], 콘솔 클린.

### CHG-20260820-067 — FEAT — Shift+마퀴 = 선택에 추가 (사용자 지시)

Problem: 마퀴가 항상 선택을 교체 — 떨어져 있는 여러 무리를 한 선택으로 묶을 수 없음.
Change: Alt 전환으로 비게 된 Shift를 활용 — **Shift+빈 잔디 드래그 = 기존 선택에 박스 합집합**(교체 없음, 경로 교차 포함 규칙 동일). 일반 마퀴는 기존대로 교체. 조작법에 행 추가.
Validation: typecheck/lint/test 134/build/harness/format PASS; Playwright: 박스1=2명 → Shift+박스2=5(합집합) → 일반 박스=교체, 콘솔 클린.

### CHG-20260820-068 — FIX — 단계 내 짧은 움직임 속도 밸런스 (stretch cap 2x, 사용자 지시)

Problem: 같은 단계의 "같이 끝남" 규칙이 1m 움직임을 30m 스프린트와 같은 시간으로 늘여 기어가게 만듦.
Change: relayout에서 멤버 duration = min(단계 길이, 자연 길이×2) — 같이 시작은 유지, 2배 이내 차이는 기존대로 같이 끝나고, 그 이상은 자연스러운 속도로 **먼저 도착**. 다음 단계 시작(가장 느린 멤버 끝)은 불변. ADR-0009 v3 규칙 보완 기록.
Validation: typecheck/lint/test 135(+1)/build/harness/format PASS; Playwright: 2m+20m 동일 단계 → 창 [0,0.64] vs [0,3.25], 재생 중 짧은 쪽 조기 정지 확인, 콘솔 클린.

### CHG-20260820-069 — TWEAK — stretch cap 2배 → 3배 (사용자 지시)

Change: MAX_STRETCH 2→3 — 같은 단계에서 3배 길이 차이까지는 같이 끝나고, 그 이상만 조기 도착. 테스트·ADR 갱신.
Validation: typecheck/test 135 PASS.

### CHG-20260820-070 — FIX — 단계 내 자연 속도(늘림 폐지)·고스트 이어 그리기 자동 단계+1 (사용자 지시)

Problem: ① "같이 끝남" 규칙(cap 3배 포함)이 여전히 짧은 움직임을 늘임 — 사용자 최종 결정: 각자 평소 속도, 짧으면 먼저 끝 ② 고스트에서 이어 그려도 새 움직임이 현재 칩 단계(예: 1)로 들어가 두 경로가 같은 단계 — 컴파일이 이른 시각의 홀더(과거 위치)에 패스를 부착하는 버그 + 매번 칩 수동 변경 필요.
Change:
- relayout: 멤버 duration = **자연 길이 그대로**(늘림 없음). 같이 시작만 유지, 단계 경계=가장 느린 멤버 끝(불변).
- 고스트(Alt+드래그) 이어 그리기: 새 움직임 step = **원본 움직임 step+1**(칩이 더 크면 칩 우선, MAX 9 클램프) — 사진의 연쇄 런/패스가 자동으로 1,2,… 순서. 과거 홀더 부착 버그 원인 제거.
Validation: typecheck/lint/test 135/build/harness/format PASS; Playwright: 고스트 연쇄 → steps [1,2]·시작 0→1.95 순차, 같은 단계 20px+200px → 지속 0.32s/3.25s 자연 속도, 콘솔 클린.

### CHG-20260820-071 — FIX — 스루패스 도착 동기화 (유령 공 제거, 사용자 버그 리포트)

Problem: 미래 지점(수신자의 런 끝)으로 꽂는 패스가 공 속도(20m/s)로 1초 만에 도착 — 수신자는 아직 뛰는 중이라 엔진이 소유를 즉시 넘겨 공이 중간 지점의 선수에게 순간이동, 화면엔 공이 2개처럼 보임.
Change: relayout에 스루패스 동기화 — 패스 끝이 수신자 움직임의 끝(1.5m 내)과 일치하면 **패스 duration을 수신자 도착 시각에 맞춰 연장**(자연 비행보다 빨라지진 않음). 수신자 해석 직후 relayout 재실행(순서 버그). 같은 지점에 겹치는 공 고스트(수신+보유 런 끝) 중복 제거.
Validation: typecheck/lint/test 136(+1)/build/harness/format PASS; Playwright: 런·스루패스 종료 3.27s 동시, 재생 후 공-수신자 19px, 유령 공 없음, 콘솔 클린.

### CHG-20260820-072 — REVERT — 같은 단계 동시 종료 재확정 (사용자 최종)

Change: CHG-070의 "단계 내 자연 속도"를 폐기하고 v3 규칙 복원 — 같은 단계는 가장 느린 멤버 길이에 맞춰 **같이 시작·같이 끝남**. (원래 불만의 원인이던 5초 패딩은 playableEnd로 이미 해결. 고스트 이어 그리기 자동 단계+1·스루패스 동기화는 유지.) ADR·테스트 갱신.
Validation: typecheck/lint/test 136/build/harness/format PASS; Playwright: 20px+200px 같은 단계 → 두 창 모두 [0, 3.25] 동일.

### CHG-20260820-073 — FIX — GIF 선수 색 누락 (CSS 변수 해석)

Problem: 팀 색이 var(--st-team-a) 형태라 캔버스 fillStyle이 무시 — GIF에서 선수가 흰 원으로 나옴.
Change: exportGif에 resolveColor — var()면 documentElement 계산값(폴백: var 기본값 → VISUAL.teamHome/Away)으로 해석.
Validation: typecheck/lint/test 136/build/harness/format PASS; 실제 GIF 추출 육안 확인(파랑/빨강+번호+away 키라인), 콘솔 클린.

### CHG-20260820-074 — UX — GIF 파일명 {안}안_YYMMDD_HHMM.gif (사용자 지시)

Change: tactic-날짜.gif → 활성 전술안 접두(예: B안_260820_1714.gif) — 어떤 안의 장면인지 파일명만으로 식별.
Validation: typecheck/lint/test 136/build/harness/format PASS; Playwright: B안 활성 상태에서 내보내기 → 'B안_260820_1714.gif' 확인.

### CHG-20260820-075 — REFACTOR — PLAN-007 M1: 기하 후보 히트(하이브리드 라우팅)

Problem: 히트가 DOM 페인트 순서에 종속 — 겹침에서 위에 그려진 요소가 무조건 승, 예외 패치 누적(PLAN-007 문제 정의).
Change:
- 신규 pickTarget.ts(순수): 겹치는 모든 후보(선수/공/고스트/경로)를 거리와 함께 수집, (sticky 선택 > 같은 종류 내 현재 단계 > 정규화 거리 > stableKey) 순위 튜플 정렬 + fingerprint. 역사적 수치 계약 보존: 소유 비교 .9/1.8, 고스트 양보 1.2/0.9m, 토큰 반경 2.2/1.76m, 경로는 화면 7px 허용(CR-02/04).
- SimplePitch pointerdown: DOM closest 3종 → pickTargets 어댑터(배지/피커 DOM 우선 유지, gestureIntent 불변). 고스트에 원본 step 부여, 경로는 full path 0.6m 샘플(세그먼트 identity 캐시).
Validation: typecheck/lint/test 142(+6)/build/harness/format PASS; M0 골든 G1~G7 재실행 전부 동일; 개선 데모 — 고스트가 라이브 토큰을 덮은 지점에서 중심 클릭=#8 선수·1.5m 링 클릭=움직임 선택(페인트 순서 무관), 콘솔 클린.

### CHG-20260820-076 — FEAT — PLAN-007 M2·M3·M4: 호버 예고·재클릭 순환·마감

Problem: 겹친 지점에서 무엇이 잡힐지 누르기 전엔 모르고, 잘못 잡히면 대안이 없음.
Change:
- **호버 예고(M2, A-02 하이라이트만)**: 마우스 이동 시 rAF 병합으로 pickTargets 최상위 후보를 계산, 키가 바뀔 때만 상태 갱신 — 잡힐 선수(호버 링)/공/경로(글로우)/고스트(선명)를 누르기 전에 표시. 마우스 전용, 재생/프레임 조회 중·프레스 중 꺼짐(CR-07).
- **재클릭 순환(M3, CR-06/A-01)**: 드래그 없는 pointerup에서만, 같은 지점(6px)·1.2s·같은 후보 지문·같은 문서 리비전·**직전 결과가 아직 선택돼 있을 때만** 다음 겹침 후보 선택(선수→고스트→경로…). 드래그·수정자·문서 변경 시 즉시 무효. 가드 덕에 골든 G1(소유 판별)과 충돌하지 않음(회귀 잡고 수정).
- fingerprint를 정렬 무관 정규형으로(선택 sticky 재정렬이 순환을 깨지 않게).
- 조작법에 "겹친 곳 다시 클릭 = 다음 대상" 추가. lint TDZ 이슈로 pick/hover 클로저를 선언 이후 단일 effect에서 ref 배선.
- M4: 골든 G1~G7 재실행 전부 일치, 22명+5경로 호버 스윕 2초+ long task(>50ms) 0건, 콘솔 클린.
Validation: typecheck/lint/test 142/build/harness/format PASS; Playwright: 호버 링 표시, 겹침 스택 클릭1=선수8→클릭2=움직임 순환, Escape 후 재클릭은 순환 안 함(새 의도 존중).


### CHG-20260820-077 — FIX — 고스트(움직임 끝) 드래그 시 정션 앵커 동반 이동

Problem: 단계 2·3을 잇는 선수 고스트를 드래그하면 그 지점에 정박한 공 앵커(도착 패스 끝, 그 지점에서 차는 패스 원점)와 같은 선수의 체인된 다음 움직임 원점이 남아 공이 떨어져 보임(사용자 스크린샷 "선수를 옮겼는데 공은 같이 안 옮겨져"). 라이브 토큰 드래그는 shiftBallAnchorsForPlayerInDraft로 이미 처리됐지만 ghost-end(bend 마지막 웨이포인트) 경로는 미처리.
Change:
- stepCommands.ts bendMoveWaypointInDraft: 마지막 웨이포인트 이동 시 shiftJunctionAnchorsInDraft 호출(신규). 정션 근처의 (1) 같은 엔티티 체인 다음 움직임 원점(0.75m), (2) 이 선수가 받는 패스의 끝·이 선수가 그 지점에서 차는 패스의 원점(3.5m=RECEIVE_RADIUS_M, 캐리 오프셋 ≤2.6m 포함)을 같은 델타로 평행이동(웨이포인트+양 핸들). 먼 앵커(패스 원점·다음 목적지)는 불변 — 사용자가 조준한 곳 유지.
Validation: typecheck/lint/test 144(+2)/build/harness/format PASS. 단위 2건(체인 원점+도착 패스 끝 동반, 나가는 패스 캐리 원점 동반·타깃 불변). Playwright junction.cjs: 스루패스+체인 런 구성 후 고스트 6.65/4.33m 드래그 → passEnd·run2Start 동반, passStart·run2End 불변, 콘솔 클린.

### CHG-20260820-078 — FIX — 패스 도착점이 수신 선수에게 부착(캐리 지점 스냅)

Problem: 패스가 수신 반경(3.5m) 안에 떨어져 수신자·소유권은 만들어지지만 저작된 끝 웨이포인트는 릴리스 지점에 그대로 남음 → 공 고스트가 중간 거점 선수 옆에 둥둥 떠서 "소지" 느낌이 없음(사용자: "중간 거점 선수에게 공이 안 소지되어있어").
Change:
- segmentCommands.ts syncTravelReceiverInDraft: 수신자 확정 시 끝 웨이포인트를 수신자 도착 위치+캐리 오프셋(2.0~2.6m)으로 스냅(웨이포인트+핸들 평행이동). 옛 끝점 0.75m 내에서 시작하던 이후 공 경로(그 고스트에서 이어 그린 다음 패스) 원점도 같은 델타로 동반 이동 — 체인 안 끊김.
- stepCommands.ts 스루패스 도착 동기화 허용 오차 1.5m → 3.0m (스냅된 끝점이 수신자 이동 끝에서 캐리 오프셋만큼 떨어지므로).
Validation: typecheck/lint/test 145(+1)/build/harness/format PASS. 단위: 3m 짧게 릴리스 → 끝점이 캐리 밴드(1.9~2.7m) 스냅+수신자+소유 오프셋, 체인 패스 원점 부착(≤0.8m). Playwright attach.cjs: 릴레이 선수에게 공 고스트 발밑 부착(2.60m), possessed offset 생성, 이어 그린 패스 원점 glue 0.00m, 콘솔 클린. (QA 부산물: 프로브 좌표 변환을 viewBox 선형→getScreenCTM으로 교정 — letterbox 오차로 1.0m 공 고스트를 놓치던 문제)

### CHG-20260820-079 — FIX — 수신 공 안착을 릴리스 지점이 아닌 "들어오는 쪽"으로

Problem: 수신 오프셋이 릴리스 방향을 따라감 — 토큰을 지나쳐 놓으면 공이 반대편(먼 쪽)에 앉아, 트림된 도착 화살표 끝·공 고스트·다음 패스 시작이 세 군데로 엇갈림(사용자: "축구공이 내가 원하는 곳에 안 렌더돼서 화살표 끝과 다음 화살표 시작이 엇갈려").
Change:
- segmentCommands.ts syncTravelReceiverInDraft: recvOffset을 접근 방향(끝에서 역방향으로 수신자에게서 3m 이상 떨어진 첫 웨이포인트로의 현)으로 계산 — 퍼스트터치처럼 공이 온 쪽에 안착. 릴리스 산포는 무시(폴백: rel ≥0.3m → 기본 오른발 방향). 결과: 화살표 끝 = 공 = 다음 원점이 한 접점.
- 기존 테스트 "side the pass arrived from"이 실제로는 릴리스 쪽을 단언하고 있었음 — 이름대로 접근 방향 내적 >0으로 교정.
Validation: typecheck/lint/test 146(+1)/build/harness/format PASS. 단위: 오버슛 릴리스(수신자 지나 2.5m) → 접근쪽 캐리 밴드 안착. Playwright approach.cjs: 오버슛+체인 아웃패스 → approach-side true, 부착 2.60m, 접합 0.00m, 콘솔 클린.

### CHG-20260820-080 — FIX — 드리블→패스 경계에서 캐리 공 잔상 소실

Problem: 선수가 공을 끌고 이동(1단계)한 뒤 그 지점에서 패스(2단계)하면, 이동 잔상 선수 옆의 캐리 공 잔상이 사라짐 — 잔상 판정이 stateAt(tm.end) 정확히 경계 시점 샘플이라 그 순간 패스가 이미 시작돼 소유가 해제된 상태(사용자: "미래시점 2번 선수한테도 잔상 공이 있어야지"). 체인 런만 있을 땐 소유가 유지돼 드러나지 않던 결함.
Change:
- SimplePitch.tsx 캐리 공 잔상: 홀더 판정을 tm.end − 0.05s 샘플로, 위치는 이동 종착점 + 그 시점 캐리 오프셋으로 고정. 패스가 경계에서 출발해도 잔상 유지.
Validation: typecheck/lint/test 146/build/harness/format PASS. Playwright dribblepass.cjs: 드리블 후 잔상 공 생성 → 그 잔상에서 Alt+드래그로 패스(원점 접합 0.00m, step 자동 2, 수신자 확정) → 패스 존재 상태에서도 잔상 공 유지, 콘솔 클린.

### CHG-20260821-081 — FEAT — PLAN-008: 축구장 자유 그리기(펜·지우개)

Problem: VIC Schedule Studio의 "일정 그림판"을 이 보드에 이식 요청. VIC은 canvas 픽셀 엔진(필압·destination-out·flood fill·레이어) — 그대로 이식하면 SVG 보드·EditorCore undo·GIF 내보내기와 전부 어긋남.
Change:
- VIC의 UX 문법만 차용, 구현은 기존 Drawing 도메인(스키마·DrawingLayer·moreCommands) 위 SVG 벡터로.
- 사용자 결정: 하단 애니메이션 바 ↔ 그리기 바 전환(D-01), 펜+지우개만·색/굵기 유지(D-02), 획 단위 지우개(D-03), 레이어 없음(D-04).
- uiStore.annotate{on,tool,color,width}; AppShell 푸터 스왑 바(펜/지우개, 4색, 굵기 3단, 전체 지우기, X)·진입 버튼·D 토글; SimplePitch annot-pen/annot-erase 제스처(0.3m 단순화, 프리뷰 폴리라인, Esc 종료, 호버/보드 제스처 정지); addFreehand 커맨드(1획=1 undo); 획 단위 지우개(10px 폴리라인 판정, 1드래그=1 undo); DrawingLayer freehand 굵기/투명도 반영+히트 스트로크; GIF drawFrame에 주석 렌더; keymap 가이드 '자유 그리기' 그룹.
Validation: typecheck/lint/test 146/build/harness/format PASS. Playwright annotate.cjs 7건 ALL PASS: 바 전환, 획 저장(freehand+style), 선수 위 드로잉에도 선수 안 끌림, 색/굵기 반영, 획 단위 지우개, Ctrl+Z 복원, Esc 후 바 복귀·보드 소생. 콘솔 클린.

### CHG-20260821-082 — FIX/FEAT — 그리기: 검정 덩어리 버그 수정 + VIC 레퍼런스 문법 그대로 이식

Problem: (1) 지그재그 획이 검정으로 채워진 덩어리로 렌더 — 히트용 polyline에 fill:none 누락(SVG polyline 기본 fill=black). (2) 사용자: "레퍼런스처럼 필압·디자인 똑같이 해달라니까 왜 창조했어" — 자체 4색/3굵기/균일 굵기는 VIC 문법 위반.
Change:
- pitch.module.css .annotHit에 fill:none — 덩어리 소멸.
- 신규 src/ui/pitch/inking.ts — VIC 그대로: 팔레트 17색+직접 고르기(네이티브 색상판), 굵기 6단 [2,3,5,8,12,18], 스타일러스 필압(감마 0.65·플로어 0.12·시간 EMA τ12ms), 마우스 속도 역산(target=clamp(1−v/1.7, 0.3, 1), EMA 0.65/0.35, 시작 0.8), 점 간소화 2px, 조각 굵기 = width×(0.45+p×0.85), 중점 쿼드러틱 렌더 기하(head/body/tail).
- Drawing freehand 스키마에 pressures?: number[](옵션, 하위호환). SimplePitch 펜 제스처가 이벤트마다 필압 갱신·2px 게이트로 점 채집. DrawingLayer/드래프트가 공용 PenStroke(조각별 stroke-width SVG path)로 렌더. GIF도 같은 penSegments 기하.
- 툴바: 2줄 17색 트레이+무지개 '직접 고르기' 셀+6단 굵기. 기본값 검정/5px(레퍼런스 동일).
Validation: typecheck/lint/test 152(+6 inking 골든: 감마·EMA·속도 역산·wOf·조각 기하)/build/harness/format PASS. Playwright inkref.cjs: 색 18칸·굵기 6·pressures 기록(0.63~0.89 변동)·fill 있는 요소 0(덩어리 회귀)·조각 63개 전부 상이한 굵기·컬러 피커 1 — ALL PASS, 콘솔 클린.

### CHG-20260821-083 — FEAT — 골대·골망 렌더 (탑다운, 보드+GIF)

Problem: 골대가 단순 직사각형 윤곽뿐 — 실제 경기장감 부족(사용자: "골대 골망도 구현해줘").
Change:
- PitchMarkings: GoalNet 컴포넌트 — IFAB 실측(입구 7.32m, 깊이 2m) 위에 포스트 2개(r 0.3m)·골라인 크로스바(3.5px)·뒤로 0.8m씩 좁아지는 골망 사다리꼴 + 0.4m 대각 메시 패턴(pattern#goal-net, 미터 단위라 줌과 함께 스케일).
- GIF: 캔버스에 GIF_PAD_M(3m) 서라운드 추가(translate) — 경기장 밖 골망이 프레임에 들어옴. 같은 사다리꼴·메시·포스트를 canvas로 동일 렌더.
Validation: typecheck/lint/test 152/build/harness/format PASS. Playwright: net fill 2·frame 2·post 4·crossbar 2·pattern 존재, 스크린샷 양쪽 골대 확인, 콘솔 클린.

### CHG-20260821-084 — FIX — 골망 사다리꼴 → 직사각형 (사용자 지시)

Change: GoalNet(보드)·GIF 골대의 0.8m 테이퍼 제거 — 골라인에서 뒤 2m까지 직각 상자. 메시·포스트·크로스바 불변.
Validation: typecheck/test 152 PASS, Playwright 골대 요소 카운트 동일 + 확대 스크린샷 직사각 확인.

### CHG-20260821-085 — UX — 토큰 바깥 링 전부 제거 (사용자: 거추장)

Problem: 선택 링(선수 팀색/공 흰색)·호버 예고 링·소유 링(공 주변 팀색)이 전부 토큰 테두리 밖 별도 원 — 공 잔상 몇 개만 있어도 화면이 어수선.
Change: Token.tsx에서 selectionRing/hoverRing/holderRing 요소 제거(+CSS). 선택 피드백은 토큰 자체 테두리 두께 증가로 대체(선수 2→3.5px, 공 1.2→2.4px) — 바깥 기하 추가 0. 호버 예고는 경로·고스트 하이라이트로 유지(PLAN-007 A-02 토큰 링 부분만 폐기). CHG-055의 소유 링 명시 폐기(가까운 오프셋 배치가 부착감 전달).
Validation: typecheck/lint/test 152/build/format PASS. Playwright: 선택 상태에서 링 요소 0, tokenBodySelected 적용 확인, 콘솔 클린.

### CHG-20260821-086 — UX — 그리기 모드: 레이아웃 안정·모드 배지·선택 도구·단축키 표시

Problem: (1) 바 전환 시 푸터 높이 차(62↔54px)로 경기장이 리플로우하며 깜빡임. (2) 지금 어떤 모드인지 불명확. (3) 그리다가 선수/공을 옮기려면 모드를 나가야 함. (4) 단축키가 툴팁에만 있음.
Change:
- simpleBar min-height 62px — 재생 바·그리기 바 동일 높이, 전환 시 경기장 픽셀 이동 0.
- 하단 좌측 세그먼트 모드 배지 [애니메이션|그리기 D] — 양쪽 바 공통, 클릭 토글(기존 펜 진입 버튼 대체).
- 그리기 도구에 '선택'(커서 아이콘) 추가 — annotate.tool 'select'는 보드 포인터 그대로(선수/공 드래그·호버 프리뷰 동작), 그리기 바는 유지.
- 단축키 표시: 종료 버튼에 Esc 칩, 도구 옆 희미한 "D 전환 · Ctrl+Z 취소" 힌트, keymap 가이드에 선택 도구 행.
Validation: typecheck/lint/test 152/build/harness/format PASS. Playwright drawmode2.cjs: 전환 전후 svg 크기 픽셀 동일, 배지 활성='그리기', 선택 도구로 선수 이동 성공, 이후 펜 정상, 복귀 시 재생 바·크기 동일 — ALL PASS, 콘솔 클린. (교훈: python 다중 hunk 스크립트는 assert 실패 시 전체 미적용 — 재적용으로 해결)

### CHG-20260821-087 — UX — 골포스트 점 제거 + 포메이션 드롭다운 애플식 정돈

Problem: (1) 골대·골라인 접점의 포스트 점 2개가 걸리적거림(사용자). (2) 포메이션 select가 네이티브 그대로 — 주변 카드 디자인과 어긋남.
Change:
- GoalNet(보드)·GIF에서 포스트 원 제거 — 크로스바·프레임·메시만.
- .panelSelect: appearance none + 커스텀 셰브론(데이터 URI), surface-2 배경·라운드·호버/포커스 링, color-scheme light(팝업 밝게), option 색 지정.
Validation: typecheck/lint/test 152/build/harness/format PASS. Playwright: goalPost 요소 0, select computed appearance none·커스텀 배경 확인, 크롭 스크린샷 양쪽 검수.

### CHG-20260821-088 — UX — 커스텀 드롭다운 메뉴 + 그리기 바 다이어트 + 도구 단축키 V/P/E

Problem: (1) 네이티브 select 팝업은 스타일 불가 — 파란 하이라이트 리스트가 디자인과 충돌. (2) 그리기 바가 재생 바보다 훨씬 넓음 — 힌트 텍스트·Esc 버튼·긴 '전체 지우기' 문구. (3) 도구 단축키 부재.
Change:
- 신규 SelectMenu 컴포넌트(자체 listbox 팝업: 라운드 카드·그림자·현재 항목 ✓·호버 행·바깥 클릭/Esc 닫힘) — 포메이션 Home/Away에 적용.
- 그리기 바: "D 전환·Ctrl+Z" 힌트·Esc 종료 버튼 제거(D/Esc 단축키가 담당, 모드 배지로 복귀 가능), 전체 지우기는 휴지통 아이콘으로. 굵기 버튼 폭 축소. 재생 바와 폭 743↔799px.
- 도구 단축키 V(선택)/P(펜)/E(지우개) + 아이콘 위 9.5px 흐릿한 키 라벨. keymap 가이드 갱신.
Validation: typecheck/lint/test 152/build/harness/format PASS. Playwright: 팝업 열림·3-5-2 선택 반영, 힌트/Esc 부재, 키 라벨 V,P,E, e/v 키로 도구 전환 — ALL PASS, 콘솔 클린.

### CHG-20260821-089 — UX — 선택 = 말이 들리는 리프트+팝 / D 칩 목적지 표시 / Esc 복귀 제거

Problem: (1) 링 제거 후 공을 집었는지 인지 불가(사용자). (2) 애니메이션 복귀 단축키가 배지에 안 보임. (3) Esc가 그리기 모드를 나가버림 — 사용자: D만 토글, Esc는 복귀 금지.
Change:
- AnimatedToken: 선택된 말은 스프링으로 상시 리프트(공 ×1.16, 선수 ×1.05, 드래그·프레스와 max 결합) + 선택 순간 원샷 팝(공 1.35/선수 1.22). 선택 테두리에 그림자 심도 추가. 해제 시 1.0 복귀. 측정: 1.005→1.123(상승)→1.160(안착)→1.000.
- 모드 배지 D 칩을 "누르면 갈 곳" 세그먼트에 표시(그리기 중엔 애니메이션 쪽에 D).
- Esc의 그리기 모드 종료 제거 — 획 취소만. keymap 가이드에서 Esc 종료 행 삭제.
Validation: typecheck/lint/test 152/build/harness/format PASS. Playwright liftsel.cjs 6건 ALL PASS(리프트·팝·복귀·칩 위치·D 왕복·Esc 유지), 콘솔 클린.

### CHG-20260821-090 — UX — 사이드 패널 확장(260/304px)·글자 확대 + 지우개 원형 커서

Problem: (1) 좌 212·우 244px 사이드가 좁고 글자 10.5~12px — 답답함(사용자). (2) 지우개 커서가 십자 — 지울 반경이 안 보임.
Change:
- simple 그리드 212/244 → 260/304px. sideRight 12→13px, guideHint 12.5→13.5, guideTitle·sectionLabel 11→12, kbd 11.5→12.5, panelBtn 34px/12 → 37px/13, panelPrimary 38/13 → 42/14, panelCard 패딩 13→15, panelHintLine 11.5→12.5.
- 지우개 도구 커서 = 지우개 판정 반경(10px)에 맞는 지름 21px 링(SVG data URI, 흰 링+어두운 외곽) — 펜은 십자 유지, 선택은 기본.
Validation: typecheck/lint/test 152/build/harness/format PASS. Playwright(1920×950): 사이드 260/304 실측, 오버플로 0, 도구별 커서 crosshair/url(ring)/auto 확인, 스크린샷 검수, 콘솔 클린.

### CHG-20260821-091 — UX — 커스텀 컬러 피커·칩 힌트·헤더 대개편·토큰 축소

Problem: (1) 네이티브 색상판(OS 크롬)이 디자인과 충돌. (2) 정리 카드 단축키·Ctrl 안내가 맨 텍스트. (3) 헤더 브랜드 글씨 작고 A/B/C 칩의 짜친 + 버튼(사용자). (4) 선수 토큰이 경기장 대비 과대(반지름 1.5m).
Change:
- 신규 ColorPicker: SV 사각형+휴 바+헥스 입력 팝오버. 하단 바의 overflow 클리핑·backdrop-filter의 fixed 탈취 때문에 **body 포털**로 렌더(교훈: filter/backdrop-filter 조상은 fixed의 containing block이 된다).
- 좌측 패널 힌트 전부 키캡 칩 구조([Ctrl+좌클릭] 우리팀 선수 추가, [Ctrl+Z] 되돌리기), 버튼 단축키(X·⇧R)도 칩 스타일.
- 헤더: 브랜드 17→20px. A/B/C를 하단 모드 배지와 같은 세그먼트 컨트롤로(반복·정렬·비례) — 빈 안은 0.38 투명, 호버 시 +가 나타남(상시 + 제거).
- 토큰 축소: 선수 r 1.5→1.2m, 공 0.62m(고스트·GIF·폰트·어웨이 키라인 동반 조정). 히트 반경(2.2/1.76)·소유 비교·캐리 계약은 불변 — 골든 유지.
Validation: typecheck/lint/test 152/build/harness/format PASS. Playwright round3: 토큰 r 1.2, 칩 렌더, 피커 열림·사각형→휴 드래그로 #24b3b3 반영, 스크린샷 3종 검수, 콘솔 클린.

### CHG-20260821-092 — FEAT — 공 던지기 물리 (관성 굴림·벽 튕김)

Problem: 공을 휙 던지는 물리 감각 요청(사용자: "공을 잡고 휙 던지면 날라가듯이").
Change:
- 신규 src/ui/pitch/ballFling.ts(순수·결정론): 릴리즈 속도 추정(최근 110ms 창, 릴리즈 전 120ms 정지 시 배치로 간주), 지수 감쇠 굴림(k=1.9), 경기장 경계 반발 0.55 바운스, 속도 상한 26m/s, 120Hz 고정 적분. 최종 정지점만 문서 커밋(moveBallStartInDraft 재사용 — 선수 2.6m 내 정지 시 보유 스냅). 엔진/도메인 불변(ADR-0006 D1: 인터페이스 모션은 UI).
- SimplePitch: 공 단독 드래그에 속도 샘플(최근 10), 릴리즈 ≥10m/s면 시뮬 궤적을 rAF로 재생(굴린 거리→스핀), 도착 시 안착 스프링·보유 연출·토스트. reduced-motion은 즉시 점프.
Validation: typecheck/lint/test 156(+4 골든: 속도 추정·정지 배치 구분·감속 정지·경계 바운스·상한·결정론)/build/harness/format PASS. Playwright: 플릭 23.9m 굴러감(중간 프레임 검증), 250ms 멈춘 뒤 놓기=제자리 배치, 부착 일관성(2.6m ⟺ holder) — ALL PASS, 콘솔 클린.

### CHG-20260821-093 — TUNE — 재생·패스·던지기 전반 속도 상향 (사용자: 너무 느려)

Change:
- 기본 속도: 선수 7 → 10 m/s, 패스 20 → 28 m/s (단계 동시 종료 규칙상 전체 재생 페이스 직결).
- 던지기: 상한 26→30 m/s, 감쇠 k 1.9→2.4, 정지 속도 0.6→1.5 m/s — 굼뜬 저속 꼬리 제거, 스냅한 정지감.
- 속도 결합 테스트(28/7 하드코드)를 DEFAULT_PLAYER_SPEED 참조로 교정.
Validation: typecheck/lint/test 156/build/harness/format PASS.

### CHG-20260821-094 — UX — 결과 화면 설명 필 제거 + Home/G 키 라벨을 아이콘 위로

Change: 하단 바의 "결과 화면 — ↺(Home)으로 원위치…" 설명 필 삭제(i18n·CSS 정리). 처음으로(Home)·반복(G) 버튼에 그리기 도구(V/P/E)와 동일한 아이콘 위 흐릿한 키 라벨.
Validation: typecheck/lint/test 156/build/harness/format PASS. Playwright: toolKey Home·G 표시, 자연 종료 후 설명 필 부재, 스크린샷 검수.

### CHG-20260821-095 — FEAT — 골 그물 캐치 + 던지기 비행감 (2단 감쇠)

Problem: (1) 골대에 들어가도 경계선처럼 튕김 — 그물 감기는 맛 없음. (2) 세게 던져도 또르륵 굴러가는 느낌(사용자).
Change:
- simulateFling에 골 지오메트리: 골 마우스(7.32m)를 골라인 밖으로 통과하면 GOAL — 그물 흡수(k=12), 뒷·옆 그물 반발 0.05, 그물 상자 안에서 정지. 캐치 순간(t·위치·입사 속도) 리포트.
- 그물 출렁 FX: 캐치 시점에 입사각으로 회전한 메시 아크 2겹이 바깥으로 펀치(scaleX 0.15→1.18→0.85, --st-ease-pop, 0.48s) 후 소멸 — 촤르륵.
- 2단 감쇠: 12m/s 초과 = 비행(k 1.2, 쭉 뻗음) / 이하 = 잔디(k 3.2, 빠른 정지). 상한 40m/s. 세게 던지면 ~25m 캐리.
Validation: typecheck/lint/test 157(+1 골 캐치 골든: 마우스 안=캐치·안착, 밖=바운스)/build/harness/format PASS. Playwright: 골 방향 플릭 → netFx 표시, 공이 그물 안(-1.8, 34) 안착, 스크린샷 검수, 콘솔 클린. (교훈: designTokens 테스트가 raw cubic-bezier 금지 — 이징은 토큰만)

### CHG-20260821-096 — FIX/FEAT — 그물 캐치 FX를 실제 그물 접촉점으로 + 탄성 촤르륵

Problem: 캐치 FX가 골라인 위에서 발생(사용자: 골망 있는 곳이어야지) + 출렁임이 밋밋.
Change:
- 시뮬이 그물(뒤판·옆그물) 첫 접촉점(t·위치·입사 속도)을 기록 — FX가 골라인이 아니라 메시 접촉점에서 발화. 그물에 안 닿는 약슛은 정지점에서.
- FX 강화: 포켓(공을 감싸며 1.45배까지 늘었다 탄성 스냅백) + 메시 아크 4겹이 시차(0/50/100/160ms)로 바깥 전파(탄성 키프레임, --st-ease-pop/out) + 접촉 순간 공 팝 펄스. 0.7s.
- 접촉 시점이 궤적 마지막 스텝과 겹칠 때 완료 분기가 FX를 삼키던 레이스 수정(완료 시 플러시).
Validation: typecheck/lint/test 157/build/harness/format PASS. Playwright: FX 앵커 (-1.85, 34) = 뒷그물, 공 그물 안 안착, 콘솔 클린.
