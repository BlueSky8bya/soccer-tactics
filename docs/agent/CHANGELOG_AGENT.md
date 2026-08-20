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

