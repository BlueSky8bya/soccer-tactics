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

### CHG-20260821-097 — FIX/UX — 그물 FX 법선 정렬·옆그물 출렁 + 공 드롭 타깃 하이라이트 + 토큰 재확대

Problem: (1) 출렁 각도가 입사 속도 기준이라 어색, 옆그물은 안 출렁임(첫 접촉만 기록). (2) 공을 든 채 선수 위에 호버해도 표시가 없어 "주는지 땅에 두는지" 불명(사용자). (3) 1.2m 토큰이 과소.
Change:
- 시뮬이 그물 패널별 접촉을 최대 3회(80ms 간격) 기록 — 각 접촉에 표면 법선·속력. FX는 법선 방향으로 회전(뒤판=수평, 옆그물=수직 출렁), 속력 비례 스케일(0.55~1.35), 접촉마다 발화.
- 공 드래그 중 부착 범위(2.6m) 내 선수를 드롭 타깃으로 점등 — 선택과 동일한 리프트+테두리+팝(벗어나면 즉시 해제).
- 토큰 재보정: 선수 r 1.35m·공 0.68m(1.5→1.2→1.35 절충). 고스트 1.5/0.68, 폰트·GIF 동반.
Validation: typecheck/lint/test 157(그물 법선 골든 포함)/build/harness/format PASS. Playwright: 타깃 점등→이탈 해제, r 1.35, 대각 슛 net fx 법선 회전 발화 — ALL PASS, 콘솔 클린.

### CHG-20260821-098 — FEAT — 드리블 시 공이 진행 방향 앞에서 리드 (엔진, 결정론)

Problem: 소유 상태로 달릴 때 공이 옆구리 고정 오프셋에 붙어 어색(사용자: 실제 드리블처럼 앞에).
Change:
- stateAt possessed 계산: 홀더가 이동 중이면 공이 헤딩 방향 1.9m 앞을 리드. 런 시작/끝 0.35s 동안 사이드 캐리 지점과 결정론적 블렌드 — 저작 앵커(고스트·패스 원점)와 시작·도착 자세 일치 유지. ResolvedPlayer에 moveT/moveDur 추가. 순수 함수(t) — 결정론·GIF 자동 반영.
Validation: typecheck/lint/test 158(+1 골든: 초반=사이드, 중반=+1.9m 리드·측면 0.15m 이내, 종료 후=사이드 복귀)/build/harness/format PASS. Playwright: 재생 중반 공이 #7 앞(+x 13.8px, 측면 4px) — ALL PASS, 콘솔 클린.

### CHG-20260821-099 — FEAT/FIX — 손그림 보정·재생 골 그물 FX·그물 밀봉·FX 클리핑

Problem: (1) 손으로 대충 그린 경로의 지터가 재생에 그대로(사용자: 개떡같이 그려도 실제 플레이처럼). (2) 애니메이션 슛 골인엔 그물 FX 없음. (3) FX 아크가 골망 밖으로 새어나옴. (4) 초고속 플링이 그물 안쪽에서 필드로 되튕겨 나올 수 있음.
Change:
- beautifyStroke 기본값 강화: smoothing 2→4패스, epsilon 1.0→1.8m, straightTol 1.2→1.6, maxW 6→5, tension 0.5 — 손 지터 소멸, 의도한 큰 우회는 보존. 40샘플 지터 스트로크 → 5웨이포인트.
- 재생 골 감지: 골 마우스 안(±3.66m)에서 끝나는 저작 패스/슛을 사전 계산, 재생 t가 도착 시각을 '교차'하는 순간 동일 그물 FX+공 팝(도착=재생 종료 틱에서 playing이 이미 false여도 발화 — 교차 감지). 재시작/루프/역스크럽 시 재무장.
- FX를 그물 상자 clipPath(좌/우)로 클리핑 — 골망 밖 유출 0.
- 시뮬: inNet 시 마우스 평면 단방향(들어오기만) — 최고속(40m/s) 로켓도 되튕겨 나오지 않음(골든 추가). 그물 흡수 k 12→16.
Validation: typecheck/lint/test 158/build/harness/format PASS. Playwright: 지터 보정 5wp, 재생 슛 FX(각도 0=우측 뒤판), 플링 FX 클리핑 확인·그물 안착 — ALL PASS, 콘솔 클린.

### CHG-20260821-100 — FIX — 선수 위에 공 놓기 = 무조건 부여 (플링 억제)

Problem: 선수 바로 위에서 놓아도 릴리즈 속도(≥10m/s)가 쉽게 넘어 굴러감 판정 — 드롭 타깃 하이라이트가 약속한 것과 다름(사용자).
Change: 릴리즈 지점이 선수 부착 범위(2.6m) 안이면 플링을 아예 건너뜀 — 하이라이트된 선수에게 부여. 빈 잔디 릴리즈만 던지기.
Validation: typecheck/lint/test 158/build/harness/format PASS. Playwright: 빠른 드래그로 선수 위 릴리즈 → #7 보유·공 2.0m 부착, 빈 잔디 플링 회귀 ALL PASS, 콘솔 클린.

### CHG-20260821-101 — FEAT — 스페이스 홀드 = 3배속 + 재생 골 FX 강도 상향

Problem: (1) 저작 슛은 경로를 그물까지만 그릴 수 있어 경로 속도가 실제 슛 파워를 과소평가 — 재생 골 FX가 약함(사용자). (2) 배속 시청 수단 없음.
Change:
- 재생 골 FX 강도 하한 1.05 (기존 0.55~) — 골인은 항상 찰지게.
- Space 홀드(≥260ms) = 재생 3배속, 떼면 1배속 복귀·재생 유지. 탭 의미는 유지(재생 시작/일시정지 — 일시정지는 keyup으로 이동해 홀드가 먼저 멈추는 일 없음). e.repeat 무시, blur 시 부스트 해제. keymap 힌트 갱신.
Validation: typecheck/lint/test 158/build/harness/format PASS. Playwright: 홀드 중 이동 속도비 3.12×, 릴리즈 후 재생 유지·1×, 탭=일시정지 — ALL PASS, 콘솔 클린.

### CHG-20260821-102 — FEAT/FIX — 릴레이 호 연결·그물 클로스 재설계(프레임 앵커)·드리블 체인 연속성

Problem: (1) 패스 화살표가 토큰에서 1.15m 트림되어 연결 흐름이 끊겨 보임(사용자: 호로 이어달라). (2) 그물 FX가 임팩트 중심의 떠 있는 링 — 실제 그물은 골대 가장자리(프레임)에 고정된 채 늘어짐(사용자, FIFA류 벤치마크). (3) 체인 드리블에서 단계 경계마다 공이 옆구리로 갔다가 다시 앞으로 — 팝.
Change:
- 릴레이 호: 연속 패스에서 인커밍의 '보이는 화살촉 끝'(트림 반영)→아웃고잉 시작점을 홀더 바깥으로 도는 SVG 호로 연결(가드: 팁 쪽 ≤4.2m=캐리 2.6+트림 1.15+슬랙). 점선 스타일 동일.
- 그물 클로스: 링/포켓 폐기 → 그물 라인이 프레임(포스트·백 스탠션)에 핀 고정된 채 임팩트 제어점만 불룩해지는 Q-커브 3겹, 감쇠 진동 진폭 e^(−4.2t)·sin(8.5t)(rAF, 0.95s, 음수 스윙=안쪽 반동) + 전면 플래시. 뒤판/옆그물 각각 자기 벽에서. 클립 확장(늘어남 여유). fling·재생 공용 fireNetImpact.
- 드리블 체인 규칙: 간격 ≤0.8s로 이어지는 런은 한 드리블 — 경계 램프 억제(Infinity edge), 체인 사이 짧은 대기 중에도 직전 헤딩 방향 전방 유지(standingCarry). 옆구리 복귀는 체인의 진짜 시작·끝에서만.
Validation: typecheck/lint/test 159(+체인 경계 촘촘 샘플 골든)/build/harness/format PASS. Playwright: 릴레이 호 렌더, 클로스 앵커=백 코너(−1.85, 30.34) 정합·클립, 재생 골 우측 앵커 L+1.85 — ALL PASS, 콘솔 클린. (goalcatch 시나리오는 CHG-100 부여 규칙과 충돌해 원거리로 재작성)

### CHG-20260821-103 — UX — A/B/C 세그먼트 3상태 가독성 재설계

Problem: 빈 안의 +가 호버에서만 나타나 "B 전환인지 + 복제인지" 인지 불가(사용자).
Change: 상태별 시각 언어 분리 — 활성=흰 필(기존), 존재·비활성=회색 텍스트+호버 배경(전환 초대), 빈 슬롯=inset 링+상시 '+' 접미(만들기 정체성), 호버 시 accent-soft 배경·accent 링/텍스트로 데워짐. 호버 전용 ::after 트릭 제거.
Validation: typecheck/lint/test 159/build/harness/format PASS. Playwright: A 존재·비활성 / B 활성 / C+ 빈(텍스트에 + 포함) 구조 검증 + 확대 스크린샷.

### CHG-20260821-104 — FIX/FEAT — 패스 원점 체인 스냅(늘어남 오류) + 공 고스트 궤도 배치

Problem: (1) 체인이 진행된 상태에서 라이브 공 토큰으로 새 패스를 그리면 저작 원점이 공의 '현재'(과거) 위치 — 선택하면 경로가 시작점까지 늘어나 보이고 애니메이션도 그 지점부터 발사(사용자 사진 1·2). (2) 캐리된 공 고스트의 위치(선수 기준 방향)를 원형으로 조정할 수단 없음(사진 3).
Change:
- addStepPass: 원점이 공의 미래 앵커(소유 홀더의 마지막 위치, 없으면 공 체인 끝)에서 3.2m 초과 이탈 시 캐리 지점으로 스냅 — 링 위(≤3.2m) 어디든 사용자가 그린 원점은 존중, 목표점 불변.
- 공 고스트 드래그 = 홀더 궤도: adjust-ghost-end가 수신자 있는 공 travel이면 드래그를 캐리 링(2.0~2.6m)에 구속(orbitCenter), 커밋 시 preserveEndDirection으로 수신자 재동기화가 접근측 스냅으로 덮지 않음(syncTravelReceiver 옵션 신설). 체인된 다음 원점은 정션 팔로우로 동반.
Validation: typecheck/lint/test 159/build/harness/format PASS. Playwright orbitfix.cjs: 체인 후 라이브 공에서 골로 패스 → 원점=정션(≤3.0m), 고스트를 수신자 위로 드래그 → rel (0.00, −2.60) 링 정각 안착 — ALL PASS, 콘솔 클린.

### CHG-20260821-105 — FIX/UX — 드리블 전방 유지 v3·링 궤도·소유 체인 3중 보호·경합 UI 정돈

Problem(사용자 사진 4+2건): (1) 마지막 런 후 공이 초기 사이드로 되돌아감. (2) 라이브 공 회전 시 경로 곡률 간섭. (3) 편집 후 공이 초기 위치(0초)에서 발사. (4) 공 경로→선수 순서로 그리면 고스트 정확히 겹침. (5) 웨이포인트 점 과대·배지가 밀집 지점에 생성.
Change:
- 캐리 v3: 런 종료 후에도 공은 마지막 진행 방향 앞(1.9m)에 상시 유지(사이드 복귀 폐지). 램프는 드리블 진입에만, 이전 캐리 벡터에서 블렌드(from).
- 라이브 공 드래그가 홀더 3.4m 내면 캐리 링(2.0~2.6m)에 구속 — 회전 배치, 경로는 원점만 강체 이동.
- 소유 체인 3중 보호: ① 정확히 2.6m 경계 부동소수로 부여 실패하던 판정 반경 2.7로(근본 원인: 홀더 소실→패스가 0초 위치에서 발사) ② 드래그 중 initialHolderId 선삭제 제거(커밋이 결정) ③ relayout 자가치유(첫 공 경로 앞 소유 세그먼트 재삽입).
- addStepRun 후 근처 무수신 패스 재해석 — 공이 캐리 링에 부착(고스트 분리 2.6m). 고스트 드로우 원점은 exactOrigin으로 스냅 면제.
- 웨이포인트 점 0.7→0.48m·투명 0.6(선택 시 1), 배지 배치가 토큰·고스트를 장애물로 회피(후보 8방향, 최소 소음 지점).
Validation: typecheck/lint/test 159(드리블 v3 갱신)/build/harness/format PASS. Playwright four.cjs: 재생 종료 시 공 전방(+14.9px)/링 정각 (0,−2.04)/수신 부착 분리 2.60m — ALL PASS, 콘솔 클린.

### CHG-20260821-106 — FIX(구조) — 패스 원점=발사 시각 공 위치 불변식 + 캐리 고스트 전용 궤도

Problem(사용자): (1) 초기 공에서 그린 패스가 화면에선 홀더의 미래 지점부터 그려지고 재생은 초기에서 발사 — 그리는 위치·순서에 따라 화면과 애니메이션이 계속 어긋남(3번째 신고). (2) 캐리 공 고스트를 돌리면 밑에 깔린 런 경로 곡률이 벤딩됨.
Change:
- **구조적 불변식**: relayoutStepsInDraft가 모든 저작 패스의 원점을 "그 패스 발사 시각의 실제 공 위치"(compile+stateAt, 드리블 전방·잠금 오프셋 포함)로 스냅하고 타이밍을 1회 재유도 — 어디서 어떻게 그렸든, 단계를 바꾸든, 정적 화면과 재생이 절대 어긋날 수 없음. 기존 addStepPass 원점 스냅·exactOrigin 폐지(대체).
- 캐리 공 고스트 드래그 = orbit-carry 제스처: 해당 정션 소유 세그먼트의 offset을 캐리 링으로 회전 저장(offsetLocked, 스키마 옵션 필드 추가·하위호환) — 런 경로는 절대 안 건드림. 잠금 오프셋은 정지 시 전방 유지(v3)보다 우선(엔진), 고스트 표시도 종료+0.05s 휴식 상태 기준.
Validation: typecheck/lint/test 159/build/harness/format PASS. Playwright structural.cjs: 원점=발사 위치 소수 일치, 궤도 후 런 웨이포인트 바이트 동일·offset (0,−2.6) 잠금 — ALL PASS, 콘솔 클린.

### CHG-20260821-107 — FIX — 캐리 궤도를 정션-로컬로 (중간 고스트만 이동) + 잡기 하이라이트

Problem: 중간 정션의 공 고스트를 돌리면 체인 전체가 공유하는 소유 오프셋이 바뀌어 처음(t0 공)과 마지막 고스트가 움직이고 정작 중간은 그대로(사용자). 잡고 있다는 피드백도 없음.
Change:
- move 세그먼트에 carryEnd?: Vec2(옵션, 하위호환) — "이 런의 끝 정션에서 공이 앉는 방향"을 세그먼트 단위로 저장. 엔진: 런 종료 0.35s 전부터 전방 캐리→carryEnd 블렌드, 다음 런의 시작 블렌드·정지 휴식도 carryEnd 우선(endCarryVec). carryAhead를 벡터 기반으로 재구성.
- orbit-carry가 소유 오프셋 대신 해당 런의 carryEnd만 기록 — t0 공·다른 정션 완전 불변(바이트 검증). 원점=발사 불변식이 carryEnd를 자동 반영.
- 잡는 동안 해당 고스트 1.3× 리프트+선명+그림자(ghostGrabbed).
Validation: typecheck/lint/test 159/build/harness/format PASS. Playwright midorbit.cjs: 하이라이트 표시, run1 경로 동일, run1.carryEnd=(0, 2.5)만 기록, 초기 공 불변, run2 무영향 — ALL PASS, 콘솔 클린.

### CHG-20260821-108 — FIX — 도착 호 일반화: 패스 1개만 있어도 화살촉→공 안착점 아치 연결

Problem: 릴레이 호가 '연속 패스 쌍'에만 그려져 단일 도착(사진: 화살촉과 공 고스트가 끊겨 보임)에는 부재(사용자 재신고).
Change: passLinks를 수신자 있는 모든 패스로 일반화 — 트림된 화살촉 끝 → 실제 안착점(stateAt: 전방 휴식·핀 반영)을 선수 테두리+0.55m 패딩을 지키는 호로 연결(반경 ≥1.9m, 선수 바깥으로 볼록). 쌍 조건 제거.
Validation: typecheck/lint/test 159/build/harness/format PASS. Playwright: 단일 대각 패스 → 호 1개 렌더 확인, 콘솔 클린.

### CHG-20260821-109 — FIX — 패스↔패스 정션 호 + 꼬리 트림 + 발사 샘플 정밀화

Problem(사용자): (1) 패스1→패스2 정션에서 호 부재(끊김). (2) 패스2 꼬리가 패스1 화살촉 위에 겹침.
Change:
- 근본: 원점=발사 스냅의 샘플이 발사 −0.02s(이전 패스 '비행 중' 지점, 0.56m 부족)였음 → −0.001s로 정밀화. 이 오차가 호 가드(3.4m) 초과의 원인.
- 도착 호에 경계 폴백: 다음 패스가 즉시 발사되는 정션은 안착 대신 다음 패스의 보이는 꼬리(0.55m 지점)로 연결. d2 가드 3.4→3.6.
- 공 패스 표시를 꼬리 0.55m 시작-트림(trimPathEndD에 startTrim 파라미터) — 체인 패스가 이전 화살촉을 덮지 않음. 히트는 전체 경로 유지.
Validation: typecheck/lint/test 159/build/harness/format PASS. Playwright chainarc.cjs: 정션 호 2개(중간+도착), 꼬리 갭 0.55m, 스크린샷 검수 — ALL PASS, 콘솔 클린.

### CHG-20260821-110 — UX — 체인 중간 패스의 화살촉 제거 (마지막만 화살표)

Problem: 정션 이음새에서 이전 패스의 화살촉과 다음 꼬리가 어색하게 만남(사용자 제안: 화살표는 맨 끝에만).
Change: 0.15s 내 다음 패스가 이어지는 '중간' 패스는 markerEnd 생략 — 대시→호→꼬리가 하나의 흐름으로 읽히고 체인의 최종 패스만 화살촉 유지. PathLayer noHeadIds prop.
Validation: typecheck/lint/test 159/build/harness/format PASS. Playwright: [pass1, pass2] 화살촉 = [false, true], 정션 스크린샷 검수 — ALL PASS.

### CHG-20260821-111 — ENGINE — 공용 carry resolver + 정션 경계 연속성 (감사 1안 M1, ADR-0010)

Problem: 공 정션 위치 해석기가 넷(offset/offsetLocked·travel 끝점·carryEnd·stateAt 전방 캐리)이고 compile의 travel release는 possession offset만 사용 — 화면·재생 원점 불일치(감사 S3/R2), chainIn ramp=1 강제로 방향 전환/핀 정션에서 한 프레임 2.7~3.2m 순간이동(S5/R12-A), lastEnded possession의 offsetLocked 소실(R12-C).
Change: src/engine/carry.ts 신설 — carryAheadFor(단일 캐리 해석: 활성 run 전방+carryEnd blend, standing 영구 front-rest, 경계에서 이전 run end-carry를 '정확히 통과' 후 0.35s 보간)와 heldBallPos(offsetLocked>carry>offset 우선순위). stateAt·compile 둘 다 이 resolver 호출(travel release가 stateAt과 동일 계산). chainIn edge=Infinity 폐기. lastEnded possessed에 offsetLocked 전달.
Validation: typecheck/lint/test 161/build/harness/format PASS. 신규 테스트 3: 90° 전환 체인 경계 무점프(0.025s 스텝 <0.9m), carryEnd 핀 정확 통과+세척, release anchor=stateAt(launch−ε) 3케이스(전방/핀/락). 구 골든 'release=possession offset'(engine.test) ADR-0010 D6로 교체.

### CHG-20260821-112 — EDITOR/UX — 도착 고스트 전용 receive-junction command (감사 1안 M2, S1·R9)

Problem: 받은 패스의 도착 고스트를 회전하면 일반 bend(`bendMoveWaypointInDraft`)를 거쳐 전체 waypoint가 `smoothWaypoints`로 재생성 — 이전 패스 곡률·hold 파괴(S1), commit 시 receiver 재선택으로 더 가까운 선수에게 수신자 탈취(R9).
Change: `moveTravelEndInDraft` 신설(segmentCommands) — 끝 waypoint+그 handle만 평행이동, resmooth 없음, receiver 불변, follow possession offset을 ring clamp+`offsetLocked`로 고정, 옛 끝점에서 이어진 체인 원점(≤0.75m)만 동행. SimplePitch에 `orbit-receive` 제스처 신설(도착 고스트 press 라우팅, drag threshold, ring 제약, commit 시 relayout 1회·receiver resolve 없음). bend commit의 receiver resolve는 '끝 waypoint를 잡았을 때'로 조건화 — 내부 곡률 bend는 수신자 재해석 금지.
Validation: typecheck/lint/test 162/build/harness/format PASS. 유닛: 국소성 계약(비인접 waypoint·hold byte 불변, thief 0.4m 근접에도 receiver 고정, offsetLocked, 체인 동행). Playwright s1_orbit probe: 곡선 패스 도착 고스트 90° 회전 → 링 안착(2.53m), interior waypoint/d-prefix byte 불변, 콘솔 클린 — ALL PASS.

### CHG-20260821-113 — EDITOR — bend 국소화: 잡은 점 ±1만 재스무딩 (감사 1안 M3, R12-B)

Problem: `bendMoveWaypointInDraft`가 매 drag마다 전체 waypoint 배열을 `smoothWaypoints` 결과로 교체 — 모든 `hold` 삭제, 비인접 handle 전부 재작성(감사 R12-B). S1의 '곡률이 멋대로 변한다'의 절반이 이 전역 재스무딩.
Change: 잡은 waypoint의 p만 갱신 후 Catmull-Rom handle을 [i−1, i, i+1] 창에만 재계산(smoothWaypoints와 동일 공식·tension 0.5). id·hold·비인접 handle은 in-place라 byte 불변. n<3 폴리라인은 handle 미생성(기존 동일). junction follow(isEnd) 유지.
Validation: typecheck/lint/test 163/build/harness/format PASS. 신규 테스트: wp[3] hold 0.5 + sentinel handle(99,99)·wp[4] handle(77,77)이 wp[1] bend 후 byte 동일, id 안정.

### CHG-20260821-114 — EDITOR — relayout 단일 파이프라인 + 멱등성 (감사 1안 M4, Q4·R1·R4)

Problem: relayout 순서가 timing→원점→재timing→스루볼→self-heal→possession pull로 구조 정규화가 뒤에 있고, `resolvePassReceiverInDraft`가 내부에서 relayout을 재호출해 command당 2~3중 실행(재진입). 원점 스냅은 `t-0.001` 샘플 트릭(R4). dead `durs` map.
Change: 파이프라인 재배열 — ① self-heal(구조) ② step timing ③ 원점=stateAt(정확한 launch t; M1로 compile release=resolver라 ε 불필요) ④ 원점 이동 시 timing 재산출 1회 ⑤ through-ball 제약 ⑥ possession trigger 정규화. `resolvePassReceiverInDraft` 내부 relayout 제거(caller가 마지막에 1회 — addStepPass/addStepRun/bend commit 조정). `durs` 삭제.
Validation: typecheck/lint/test 165/build/harness/format PASS. 신규: relayout byte 멱등성(2회 실행 === 1회, 복합 문서), self-heal 선행(무소유 travel이 한 번의 relayout로 possession+원점 동시 복구). s1_orbit probe 재실행 ALL PASS.

### CHG-20260821-115 — EDITOR/ENGINE — validator 보강 + attach 상수 단일화 (감사 1안 M5, R8·R10)

Problem: validator가 optional 필드(carryEnd/offset/offsetLocked/pressures/waypoint handle·hold)와 holderId/receiverId 참조를 검사하지 않아 NaN/문자열 오염이 parse를 통과(R8). attach/carry 반경이 2.6(clamp)·2.7(drop)·리터럴 산재로 경계 약속 분산(R10).
Change: validateDocument — waypoint handleIn/Out·hold(≥0), move.carryEnd, possessed.offset(Vec)/offsetLocked(boolean)/holderId 참조, travel.receiverId 참조, freehand pressures(숫자·points와 동일 길이) 검사. compile.ts에 `CARRY_RING_MIN_M`/`CARRY_RING_MAX_M`/`ATTACH_RADIUS_M`(=max+0.1 headroom) 단일 정의 — carryOffset clamp와 SimplePitch drop/attach/highlight 판정 전부 이 상수 파생(2.7 리터럴 3곳 제거).
Validation: typecheck/lint/test 167/build/harness/format PASS. 신규: malformed 거부 표(7종 path별) + valid optional 필드 클린 통과, ring 경계 r−ε/r/r+5 clamp 표 + ATTACH>RING 불변식.

### CHG-20260821-116 — UX — GIF 버튼을 도구 열 패턴으로 (흐릿한 GIF 라벨 + 내보내기)

Problem: 하단 바에서 GIF 버튼만 라벨 패턴(단축키/이름 흐릿하게 위, 동작 아래) 미적용 — 이웃(Home·G 반복)과 불일치(사용자 요청).
Change: toolCol/toolKey로 감싸 흐릿한 "GIF" 위 + 버튼 텍스트 "내보내기"(busy 시 … 유지). aria/title 불변.
Validation: typecheck/lint/test 167/build/harness/format PASS. Playwright footer 스크린샷 검수, 콘솔 클린.

### CHG-20260821-117 — FIX — 공 패스 step 단조 강제: 마지막 단계 이후 이어그린 패스가 0단계 발사되던 버그

Problem: 결과 화면(마지막 단계 재생 후)에서 라이브 공을 Alt+드래그해 이어 그리면 `draw-from-token` 경로에 minStep이 없어 새 패스가 step 칩 값(예: 1)을 상속 — relayout이 1단계 시작(t≈0)에 발사시키고 원점 스냅이 초기 보유자 위치로 끌어가 "0단계에서 쭈욱 나가는" 궤적 폭주(사용자 스크린샷 2건).
Change: 공은 하나 — 패스는 물리적으로 순차. `addStepPass`가 `step = max(요청, 기존 공 트랙 마지막 step + 1)` 강제(`lastBallStep` 헬퍼, command 레벨이라 모든 진입 경로 보호). finishDraw도 동일 규칙 미러링(토스트·체인 번호 정합).
Validation: typecheck/lint/test 169/build/harness/format PASS. 신규 ballStepOrder.test 2건: 4단계 체인 각자 시각 발사 + step 1 요청이 4로 승격·t0에 pass A만 비행.

### CHG-20260821-118 — UX — 편집 포커스: 선택한 선수(+공) 타임라인만 선명, 나머지 후퇴

Problem: 복잡한 장면에서 특정 선수 수정 시 모든 경로·고스트·배지가 동일 강도로 보여 구분 불가(사용자: "해당 선수의 타임라인들만 하이라이팅되면 좋겠어. 공도 포함").
Change: focusIds = 선택 토큰 ∪ 선택 세그먼트의 엔티티, 비어있지 않으면 공 자동 포함. PathLayer dimOthers 활성(비포커스 경로 opacity 0.35), 고스트·단계 배지 0.25 감쇠. 공 토큰 단독 선택은 포커스 미발동(공은 모든 플레이 공용).
Validation: Playwright focus probe — 무선택 시 dim 없음, 선수 선택 시 자기 경로+공 경로 선명·타 선수 dim, 콘솔 클린 — ALL PASS. 스크린샷 검수.

### CHG-20260821-119 — UX — 포커스 모드 완성: 클릭=격리 편집, 잔디 클릭=해제 (사용자 확정 스펙)

Problem: CHG-118의 포커스는 시각 감쇠만 — 겹친 다른 엔티티의 경로/고스트가 여전히 press를 가로챘고(오클릭), 잔디 클릭은 편집 중에도 선수를 추가했으며, 공 단독 클릭은 포커스 미발동.
Change: ① press 파이프라인에서 포커스 중 비포커스 엔티티의 ghost/segment 후보 제거(라이브 토큰은 유지 — 포커스 전환 수단) ② 포커스 중 빈 잔디 클릭 = 선택 해제(선수 추가 안 함; 비포커스 상태의 잔디 클릭은 기존대로 추가) ③ 공 클릭도 공 타임라인 포커스(선수 포커스는 공 동반, 공 포커스는 공만).
Validation: typecheck/lint/test 169/build/harness/format PASS. Playwright focus probe 5 시나리오: 잔디 해제+무추가, 선수 포커스 감쇠, 겹친 타 경로 그랩 차단, 비포커스 정상 픽, 공 단독 포커스 — ALL PASS.

### CHG-20260821-120 — UX — 포커스 중 비포커스 엔티티의 라이브 토큰(0번 시점)도 감쇠

Problem: 포커스가 경로·고스트·배지만 흐리게 하고 라이브 토큰은 원래 강도 유지 — "2번 선수의 0번 시점도 흐릿하게 보여야지"(사용자).
Change: 선수 토큰을 focus wrapper `<g.tokenFocusDim>`(opacity 0.4, transition)로 감싸 비포커스 엔티티만 감쇠. 클릭 가능성은 유지(포커스 전환 수단). 공 토큰은 포커스 집합에 항상 포함되므로 불변.
Validation: typecheck/lint/test 169/build/harness/format PASS. focus probe 시나리오 6 추가(포커스 A 선명·B 토큰 감쇠) — ALL PASS.

### CHG-20260821-121 — FIX — 골 마우스를 넘는 공 경로는 골망 안에서 절단 (관통 방지)

Problem: clampToPitch 2m 마진 탓에 슛 경로가 골을 '통과'해 바깥까지 그어짐 — 재생 시 공이 골을 관통하고, 끝점이 골망 판정 창(goalArrivals) 밖이라 캐치 FX 미발화(사용자 스크린샷).
Change: `truncateBallPathAtGoal`(engine/geometry, pure) — 폴리라인이 골라인을 마우스 안(y ∈ 중앙±3.66)에서 넘는 첫 교차점에서 절단, 교차점(골라인 위) + 진입 방향 1.4m 침투점(골망 박스 내부·마우스 내부 clamp)으로 종료. finishDraw에서 공 경로에 적용, beautify 후 끝점 재고정. 마우스 밖(빗나간 슛)·필드 내 패스는 불변(null).
Validation: typecheck/lint/test 172/build/harness/format PASS. geometry 유닛 3(우측 관통 절단·좌측 대칭·와이드/필드 무변경) + goalcut probe: 관통 드로우 → authored 끝 (106.35, 33.04) 골망 내부, 스크린샷 검수, 콘솔 클린 — ALL PASS.

### CHG-20260821-122 — RESEARCH/PLAN — 전술 시퀀서 벤치마크·연구 기반 기능 로드맵

Problem: 현재 제품은 결정론적 timeline·trigger·path 편집이 강하지만, 다음 기능을 경쟁 제품 목록만으로
추가하면 3D/AI/팀 관리로 범위가 분산되고 선수 이해·전달 가치가 검증되지 않을 위험이 있음.
Change: 저장소 기능 기준선과 공식 제품 자료 13종(TacticalPad, TacticBoard, tactical-board.com,
Teloframe, planet.training, Once, Sport Session Planner, Drillboard, Coach Board, KlipDraw/Nacsport,
Coach Paint, Hudl, GoArmy Edge), 축구 시각화·video feedback·decision training·multimedia learning 연구를
교차 조사해 `docs/product/BENCHMARK_RESEARCH_2026-08-21.md` 작성. PLAN-009를 completed로 보존하고
PLAN-010 Proposed를 ACTIVE_PLAN으로 등록. 권장 순서는 Phase/설명 → timed cue → Trigger Link →
overlay → Playbook/Variant → player learning → delivery. 3D/VR·tracking·AI·realtime collab은 보류.
Validation: 문서 변경만. `npm run harness:verify` PASS(0 warnings). 코드 게이트는 NOT RUN(코드 변경 없음).
### CHG-20260821-123 — FEATURE — 예시 전술 2→8종 + 사이드바 원클릭 로드·자동 재생

Problem: SCENARIOS 프리셋(A/B)이 테스트에서만 쓰이고 UI 진입점이 없음('menu.examples' 키 미사용). 첫 방문자가 "무엇을 만들 수 있는지"를 보려면 직접 저작해야 했음.
Change: `src/presets/scenarios.ts`에 6종 추가(세 번째 선수 움직임, 오버랩 vs 언더랩, 4-3-3 후방 빌드업, 전방 압박 트리거, 수비→공격 전환, 컷백 마무리) — 각각 4~9 선수, 이벤트 트리거 체인, 주석 포함 완결 문서. ActionsPanel(왼쪽 사이드바) 하단에 '예시 전술' 카드: 클릭 = replaceDocument(단일 undo) + `playWindow('all', 0, playableEnd(compile(doc)))`로 즉시 재생. i18n 3키 추가. 사용자 후보 중 '코너킥 니어포스트'만 보류(세트피스, 후속 후보).
Validation: typecheck/lint/test 172/build/harness PASS. examples probe(신규): 8버튼 렌더 → 각 클릭 → 재생 시작 → 자연 종료(held-result) → 콘솔 에러 0, 스크린샷 검수 — ALL PASS.

### CHG-20260821-124 — PRESET — 예시 전술 8종 위치·단계·패스 타이밍 전면 재저작

Problem: 8개 예시의 path에 `step`이 없어 단일 단계 UI에서는 전부 1단계로 보였고, 첫 편집/relayout 시 세밀한 trigger 타이밍이 한 단계로 다시 배치될 위험이 있었다. 일부 장면은 짧은 패스와 긴 압박 이동이 같은 창에 묶이거나, 수신자가 먼저 종점에 서 있어 전술 의도와 재생이 조잡하게 보였다.

Change: `src/presets/scenarios.ts`의 8개 예시를 모두 다시 저작했다. 2~3단계의 명시적 simple-mode sequence, 역할별 시작 간격, 공격 지원·수비 압박/커버/복귀, GK 반응, 패스·스루패스·클리어런스·슛의 release/arrival과 연속 소유를 정합화했다. 모든 builder는 production `relayoutStepsInDraft`로 마감해 로드 직후와 첫 편집 후 규칙이 동일하다. `scenarios.test.ts`에 8종 전수 step count·same-step window·release anchor·receiver arrival·pitch bounds·시작 간격·byte-idempotence 계약을 추가했다.

Validation: scenario 전수 5 tests PASS, typecheck PASS, 1440×1000 Playwright 실제 UI에서 8개 중간/종료 frame과 자동 재생·단계 칩 확인 PASS. 전체 게이트는 `CURRENT_STATE`의 Last Verified에 기록.

### CHG-20260821-124 — FIX — Ctrl+클릭 1회 투입 복구 + focus를 '움직임 편집'으로 한정

Problem (사용자 2026-08-21): (1) Ctrl+좌/우클릭이 **두 번 눌러야** 선수가 생김. (2) 선수 하나를
잡으면 다른 모든 엔티티가 흐릿해져 보드가 안 보임. 사용자는 원인을 "애니메이션 모드"로 추정했으나,
실제 원인은 어제 도입한 focus(c31dbf9/a8580fd) 두 곳이다 — ADR-0009 v4에서 `animMode`는 이미
dead state로 제거됐고 현재 보드에는 모드가 없다.
- 원인 1: `SimplePitch` add 분기가 `focusIds.size > 0`이면 클릭을 **삼키고** 포커스만 해제했다.
  선수 투입은 곧바로 그 선수를 select → focus를 만들므로, 두 번째 투입부터 매번 1회를 잃었다.
- 원인 2: `focusIds`가 `selection`에서 파생돼 **토큰을 고르기만 해도** 전체 보드가 감쇠했다.
Change: (1) Ctrl+클릭은 ADR-0009의 명시적 투입 제스처이므로 편집 중에도 항상 첫 클릭에 투입한다.
편집 종료는 평범한 클릭('marquee' → clearSelection)의 역할로 남긴다. (2) focus 판정을 순수 함수
`deriveFocusIds(selectedSegmentId, segmentOwnerId, ballId)`로 추출(`pathPresentation.ts`) —
**선택된 '움직임'이 있을 때만** focus. 토큰 선택·드래그·삭제는 보드를 흐리지 않는다. 경로/고스트/
배지를 선택하면 기존 격리(감쇠 + 히트 우선)는 그대로 동작한다. (3) 푸터 라벨 `mode.anim`
'애니메이션' → '전술 보드' — 기본 보드를 모드로 오인하게 만든 표현을 ADR-0009 v4 방침에 맞춤.
Validation: typecheck/lint/build/harness PASS. `deriveFocusIds` 유닛 4종 추가. Playwright
`modefix.cjs` 구/신 대조 — 수정 전 7 FAIL(Ctrl+클릭 #2~#4·우클릭이 첫 클릭에 실패하고 "second
click DID add it", 토큰 선택 시 5개 중 4개 감쇠), 수정 후 11/11 PASS(움직임 선택 시 감쇠 4개는
의도대로 유지), 콘솔 에러 0.
Note: 같은 시각 Codex 세션이 `scenarios.ts`를 재작성해 scenario A의 `ball-pass` 세그먼트 id가
사라졌고, 이를 하드코딩한 기존 `pathPresentation.test.ts > deriveAttachedPathStart` 2건이 FAIL
상태다. 본 변경과 무관하며(순수 HEAD에서는 9/9 PASS) 해당 파일 소유 세션이 정리해야 한다.

### CHG-20260821-125 — UX — 공 투입 버튼 제거 + Space 홀드 배속을 눈에 보이게

Problem (사용자 2026-08-21): (1) '● 공 투입 (중앙)' 버튼이 불필요. (2) Space를 꾹 누르면 3배속이
되지만 **화면에 아무 표시가 없어** 빨라진 건지 재생이 튄 건지 구분되지 않았다.
Change: (1) 버튼·`panel.ball` 키·`placeBallCenter` import 제거. `createEmptyDocument`가 이미 공을
센터서클에 놓으므로 보드에 공이 없는 상태는 존재하지 않았고, 버튼은 재배치 전용이었다. 투어는 이
버튼을 참조하지 않아 영향 없음(`data-tour="ball-btn"`는 미사용이었다). (2) `playing && speed > 1`
하나로 세 가지 단서를 동시에 켠다 — 보드 상단 pill(`⏩ 3× 빠르게 (Space 누르는 중)`),
`pitchFrame[data-boost]` 강조 링, 푸터 재생 버튼의 ⏩ 아이콘 교체. 정지 중 speed가 남아 있어도
표시하지 않는다(움직이는 게 없으므로). `fastForward` 아이콘을 UiIcon에 추가.
reduced-motion에서는 pill 등장 애니메이션만 끈다.
Validation: typecheck/lint/build/harness PASS, 181 tests PASS(AppShell 부스트 단서 유닛 1종 추가,
shell-hierarchy 테스트를 '공 투입 버튼 부재 + 공 존재' 계약으로 갱신). Playwright `boost.cjs`
8/8 PASS(버튼 부재·공 존재·정지 시 무표시·홀드 시 pill/글로우/버튼 전환·릴리스 시 해제), 콘솔 에러 0.

### CHG-20260821-126 — UX — Space 홀드(배속)를 안내에 독립 항목으로 노출

Problem (사용자 2026-08-21): Space 꾹 = 3배속이 안내에 없다고 느낌. 실제로는 `KEYMAP.playback.toggle`
힌트 꼬리에 '재생 / 일시정지 · 꾹 누르면 3배속'으로 **묻혀 있어** 별도 조작으로 읽히지 않았다.
Change: `KEYMAP.playback.boost`를 독립 항목으로 신설(`Space 꾹` / `누르는 동안 3배속 — 놓으면 원래
속도`)하고 toggle 힌트는 '재생 / 일시정지'로 환원. 우측 조작법 패널 재생 섹션과 `?` 오버레이
(`KEYMAP_GROUPS`가 `Object.values(KEYMAP.playback)`을 쓰므로 자동)에 함께 노출된다. 푸터 재생
버튼을 Home·G와 같은 `toolCol`로 감싸 키 라벨을 표시 — 평시 `Space`, 홀드 중 `Space 꾹`으로 전환.
버튼 tooltip에도 홀드 설명을 덧붙였다. 배속·홀드 임계값은 `usePlayback`의 `BOOST_SPEED`/
`NORMAL_SPEED`/`HOLD_TO_BOOST_MS`로 단일화해 안내 문구와 실제 동작이 어긋날 수 없게 했다
(`useEditorKeyboard`의 하드코딩 3/1/260 제거).
Validation: typecheck/lint/build/harness PASS, 182 tests PASS(안내 행 노출 유닛 1종 추가).
Playwright `hint.cjs` 5/5 PASS(사이드 가이드·`?` 오버레이 양쪽에서 `Space 꾹`·`3배속` 확인,
평문 Space 행은 재생/일시정지만), `boost.cjs` 8/8 PASS 유지. 콘솔 에러 0.

### CHG-20260821-127 — UX — 공 선택 하이라이트 흰색 · 연속 이동 · 슬링샷 조준

Problem (사용자 2026-08-21, 3건): (1) 공 선택 하이라이트가 검정이라 흰색인 선수와 어색. (2) 선수가
소유한 공을 드래그해 놓으면 점선만 늘어나다 **순간이동**. (3) 느슨한 공을 정밀하게 날릴 방법이
빠른 스와이프(flick)뿐.
Change: (1) `.ball.ballSelected { stroke: #fff }` — `.ball`이 파일 뒤라 특이도 한정 필요.
(2) `ballTravelPoints(from,to)` 신설(순수·ease-out·FlingPoint 호환) → 커밋 시 **그려진 위치**와
최종 위치의 간극이 `BALL_TRAVEL_MIN_M`(3m, ATTACH_RADIUS 2.7 초과) 이상이면 기존 roll driver로
연속 재생. 스냅은 기존 스프링 유지, 문서 결과 불변. (3) 신규 `sling` 제스처 — 느슨한 공 더블클릭
(350ms)+드래그로 당긴 반대 방향 조준, 조준선 끝은 `simulateFling` 결과라 실제 착지점과 동일.
`slingVelocity`는 flick과 같은 속도 봉투로 clamp. flick/슬링 커밋을 `launchBall`로 통합.
안내에 '공 더블클릭+드래그' 항목 추가.
Validation: typecheck/lint/build/harness PASS, 192 tests PASS(ballFling 유닛 +10:
travel 시작·도착·ease-out·단조성·결정성·상한, sling 반대방향·최소당김·속도봉투·경기장 내 착지).
Playwright `ballux.cjs` 9/9 PASS — 선택 stroke `rgb(255,255,255)`, 릴리스 70ms 뒤 공이 중간
지점(38.0,31.5)에 있고 최종 (75.0,20.0) 도달(순간이동 아님), 조준선 x2=48.2와 실제 착지 x=48.2
일치, 릴리스 후 조준선 해제. 콘솔 에러 0.
Note: 최초 구현에서 `launchBall`이 열린 트랜잭션 없이 `core.update`를 호출해 'update() without
begin()'으로 발사가 무시됐다 — 프로브가 잡았고 슬링 릴리스에 `core.begin('Sling ball')` 추가로 해결.

### CHG-20260821-128 — FIX/UX — 하단 바 비례 복구 + 배속 안내를 '재생 중'으로 이동

Problem (사용자 2026-08-21): (1) 하단 바가 위/아래로 찌부됨. (2) 'Space 꾹' 안내가 홀드 중에만
떠서 **존재 자체를 알 수 없음**.
Change: (1) 근본 원인은 CHG-126에서 재생 버튼을 `toolCol`로 감싼 것 —
`.toolCol .btn { height: 30px }`이 특이도로 `.playBtn`(44px)을 이겨 **원이 타원으로 눌렸고**,
`min-height: 62px` 바에 55px(11 라벨 + 44 버튼) 콘텐츠가 끼었다. `.toolCol .playBtn`으로 원 복구,
바를 78px·패딩 11px로 상향(두 바 공용 클래스라 높이 동기 유지), `.playCol` 최소 폭으로 라벨 폭
변화가 Home·G를 밀지 않게 고정. (2) 재생 중·비부스트에 무채색 초대 pill
`⏩ Space 꾹 누르고 있으면 3배속`을 부스트 pill과 같은 자리에 띄운다(레이아웃 이동 0). 푸터 키
라벨도 정지 `Space` → 재생 중 `Space 꾹`.
Validation: typecheck/lint/build/harness PASS, 197 tests PASS. Playwright `bar2.cjs` — 재생 버튼
44×44 정원, 바 높이 79px, 정지 시 'Space', 재생 중 'Space 꾹' + 초대 pill 노출, 홀드 시 초대→부스트
pill 교체, 콘솔 에러 0.

### CHG-20260821-129 — UX — 슬링 조준선은 '이동거리'가 아니라 '힘의 세기'

Problem (사용자 2026-08-21): 더블클릭 드래그로 던질 때 공이 **점선 길이만큼만** 가서 조준선이
이동거리처럼 읽힘. "저걸 이동거리라고 하지 말고 힘의 세기라고 생각해줘. 그니까 저것보다 더
나가는거지."
Change: CHG-127/ADR-0009 v7의 "조준선 끝 = 실제 착지점"을 **명시적으로 정정**(ADR-0009 v8).
`slingAimEnd`(순수) 신설 — 당김 벡터를 그대로 미러링한 길이만 그리고, 경기장을 벗어나면
**자기 광선 방향으로만 축소**해 방향을 왜곡하지 않는다. 발사 속도(`slingVelocity`)는 그대로라
`FLING_MIN_SPEED` 하한 덕분에 **모든 합법 당김에서 이동거리 > 선 길이**가 성립한다. 골문 발사 시
골망 FX는 종전과 동일(`goalGeomFor` 경유, 변경 없음). 안내 문구도 '점선 길이는 세기 (공은 그보다
더 나감)'으로 교체.
Validation: typecheck/lint/build/harness PASS, 197 tests PASS(유닛 +5: 미러 길이·모든 당김에서
초과 비행·당길수록 긴 선·광선 방향 클램프·골문 명중 시 net impact). Playwright `bar2.cjs` —
6m 당김에 선 6.00m, 실제 비행 15.9m, 당긴 반대(왼쪽)로 발사. 콘솔 에러 0.

### CHG-20260821-130 — UX/FIX — 예시 전술 폐기 · 조작법 큐레이션 · 재생 중 감쇠 버그

Problem (사용자 2026-08-21): (1) 예시 전술 폐기 요청. (2) 조작법 패널을 지정한 11개 항목만 남기기.
(3) **버그** — 애니메이션 재생 시 보드가 다 흐릿하게 보임.
Change: (1) `ActionsPanel`의 예시 카드와 `panel.examples/exampleLoaded/exampleUndoHint` 키 제거,
`SCENARIOS`/`compile`/`playWindow` import 정리. `scenarios.ts`는 테스트 픽스처 전용으로 강등(문서화)
— 앱이 import하지 않아 번들 385.60 → 370.89 kB(-14.7 kB). (2) `Binding.compact` 플래그 신설 +
`GUIDE_PLACE/ANIM/PLAY_BINDINGS`로 상시 패널을 큐레이션. `?` 오버레이(`KEYMAP_GROUPS`)는 전체
유지 — 문구 단일 소스 보존. 재생 섹션은 Space/Space 꾹만(Ctrl+Z·Delete는 왼쪽 패널에 이미 있음).
(3) 원인은 CHG-124에서 좁힌 focus가 **재생까지 유지**된 것 — 움직임을 선택한 채 재생하면 그
엔티티 외 전부가 `tokenFocusDim`으로 감쇠했다. `deriveFocusIds(..., playing)`이 재생 중 빈 집합을
반환하도록 수정.
Validation: typecheck/lint/build/harness PASS, 198 tests PASS(재생 중 focus 해제 유닛 1종 추가).
Playwright `guide.cjs` 26/26 PASS — 예시 카드 부재, 조작법 11행이 지정 순서·문구와 정확히 일치,
제외 5항목 부재, `?` 오버레이는 전체 유지, 저작 중 감쇠 1 → 재생 중 0. 구/신 대조로 수정 전
'재생 중 1 dimmed' 재현 확인. 콘솔 에러 0.
Note: 사용자가 붙여넣은 목록의 '공 더블클릭+드래그' 문구는 CHG-129 이전(구) 버전이었다. 세기
의미로 바꾼 것이 사용자 본인의 직전 지시이므로 최신 문구를 유지했다.

### CHG-20260821-131 — UX — 재생 단축키 안내를 왼쪽 사이드바로 이동 (+ 힌트 줄바꿈 수정)

Problem (사용자 2026-08-21): 재생 조작법(Space / Space 꾹)을 오른쪽 조작법 패널이 아니라 **왼쪽
사이드바 빈 공간**에 두고 싶다. 예시 전술 카드를 뺀 자리가 비어 있었다.
Change: `GuidePanel`의 재생 그룹을 제거하고 `ActionsPanel` 하단에 '재생' `panelCard` 추가 —
`GUIDE_PLAY_BINDINGS`를 그대로 소비하므로 문구 단일 소스는 유지된다. 오른쪽 조작법은 제스처
9행만 남는다.
부수 수정: `.panelHintLine`이 `white-space: nowrap`이라 'Space 꾹' 힌트가 카드 밖으로 잘려
나갔다(스크린샷 확인). 힌트가 전부 세 단어짜리라 그동안 드러나지 않던 문제 — nowrap을 걷고
`align-items: flex-start` + `line-height: 17px`(`.kbd` 칩과 동일)로 첫 줄을 칩과 정렬,
마지막 자식에 `min-width: 0`을 줘 카드 안에서 줄바꿈되게 했다.
Validation: typecheck/lint/build/harness PASS, 198 tests PASS. Playwright `playcard.cjs` 9/9 PASS
— 왼쪽 카드 순서 팀 구성|정리|**재생**, 두 행의 라벨·문구 정확 일치, 왼쪽 열 세로 오버플로 없음,
오른쪽 조작법에 Space 부재·제스처 9행 유지, **어떤 힌트도 카드 경계를 넘지 않음**. 콘솔 에러 0.

### CHG-20260821-132 — UX/FIX — 소유된 공 드래그 무효화 + 슬링 도달거리 모델

Problem (사용자 2026-08-21): (1) 슬링으로 던진 공이 **점선보다 덜 나감**, 더 예민했으면. (2) 선수가
소유한 공을 드래그하면 흰 안내선이 뜨고 공이 움직여 경로 저작과 엇갈림.
Change: (1) 원인은 당김→**속도** 선형 매핑 + `simulateFling`의 40 m/s 상한 — 그 상한의 도달거리가
~26.6m라 26m 넘게 당기면 필연적으로 조준선보다 짧았다. `flingReach`/`flingSpeedForReach`(2상 drag
폐형식·역함수)를 추가하고 `slingVelocity`가 `SLING_REACH(2.8) × 당김`을 도달거리로 역산하게 바꿈.
`simulateFling(maxSpeed)` 인자 추가 — 슬링만 `SLING_MAX_SPEED(120)`, flick은 40 유지.
(2) 소유 중인 공의 plain drag는 **선택만** 하고 제스처를 시작하지 않는다. Alt+드래그(패스)는 불변.
흰 안내선(`ballGhost`)은 possession 고정 시에만 나타나던 것이라 죽은 코드가 되어 제거.
드래그로 공을 뗄 수 없어지므로 홀더 `PlayerCard`에 **공 놓기** 버튼 추가(미사용이던
`minibar.release` 키 활용) — 없으면 초기 보유자를 바꿀 방법이 사라진다.
Validation: typecheck/lint/build/harness PASS, 204 tests PASS(유닛 +6: reach/speed 역함수 왕복,
긴 당김 2~60m 전 구간에서 이동거리 > 조준선, 개활지에서는 정지점도 조준선 밖, 짧은 당김 반응성,
flick은 낮은 상한 유지, 당김 비례 reach). Playwright `heldball.cjs` 10/10 PASS — 소유 공 드래그 시
안내선 없음·좌표 불변·소유 유지, 공 놓기 후 loose, 느슨한 공은 22.1m 정상 드래그,
8m 당김 → 조준선 8.0m·실제 22.5m. 콘솔 에러 0.
Note: 최초 테스트가 '이동거리'를 최종 변위로 재서 40m 당김(경계 반사 후 되튐)에서 실패했다.
벽을 넘을 수는 없으므로 경로 길이와 변위를 분리해 각각 단언하도록 고쳤다.

### CHG-20260821-133 — FIX — 소유된 공 드래그 복구, 드롭은 순간이동 (CHG-132 오독 정정)

Problem: CHG-132에서 "움직이지도 않게"를 **드래그 금지**로 읽었으나, 사용자 의도는 놓았을 때
**공이 애니메이션으로 이동하는 것**의 폐기였다("공 잡아서 이동시키면 순간이동 되게 하면 되잖아").
Change: (1) `pressToken`의 소유 공 inert 가드 제거 — 소유된 공도 종전대로 끌리고, 잔디=loose /
선수 위=보유 계약도 그대로. (2) 드롭 시 연속 이동 분기 삭제 → **순간이동**. `ballTravelPoints`와
`BALL_TRAVEL_SPEED/MIN_M`, 관련 유닛 6종을 제거(CHG-127에서 도입한 것을 되돌림). 애니메이션은
**던진 공(fling/sling)**에만 남는다. (3) CHG-132에서 탈착 보전용으로 추가했던 `PlayerCard`의
공 놓기 버튼 철회 — 드래그 복구로 불필요하고 요청되지 않은 UI. (4) 흰색 드래그 안내선은 제거 상태
유지(사용자 명시 요구).
Validation: typecheck/lint/build/harness PASS, 198 tests PASS. Playwright `heldball.cjs` 9/9 PASS
— 안내선 없음, 소유 공 (41.4,35.4)→(75.0,20.0) 드래그됨, 릴리스 한 프레임 뒤 목표점 **0.00m** 오차
(순간이동 확인), 이후 drift 0.00m(이동 애니메이션 미실행), 잔디 드롭=loose, 선수 위 드롭=보유,
슬링 8m 조준선 → 22.5m 비행 유지. 콘솔 에러 0.

### CHG-20260822-134 — UX/FIX — 캐리/분리 경계 링 + 던지기 오발(급발진) 수정

Problem (사용자 2026-08-22): (1) 소유 공의 360° 궤도 조작과 멀리 놓기가 같은 제스처라 구분 불가.
(2) 느슨한 공을 **살짝 빠르게** 움직이면 한 프레임 튄 값이 반영돼 조금만 움직여도 공이 급발진.
Change: (1) 경계를 가시화 — 소유 공 드래그 중 홀더 둘레에 3.4m 분리 링을 그리고 캐리/분리 상태에
따라 스타일이 바뀐다. 히스테리시스(3.4m 이탈 / 2.9m 복귀)로 경계 깜빡임 제거. 수정자 키는 도입하지
않았다(발견 가능성). (2) `flingVelocity` 재작성 — `FLING_MIN_TRAVEL_M(2.5m)` 이동 거리 하한(던지기는
sweep이지 twitch가 아니다), 속도는 구간 속도의 **하위 중앙값**(글리치는 2구간을 오염시킴) ×
순변위 속도 1.5배 상한, 방향은 순변위. 또한 궤도 중 **스냅된 좌표를 표본에 기록하지 않도록** 수정 —
링을 쓸고 다니는 스냅점이 유령 던지기를 만들었다.
Validation: typecheck/lint/build/harness PASS, 200 tests PASS(유닛 +2: 짧고 빠른 twitch는 placement,
글리치 프레임이 추정치를 지배하지 못함 / 기존 속도 테스트를 새 하한에 맞게 갱신).
Playwright `carry.cjs` 12/12 PASS — 링 r=3.4 표시, 4방향 궤도가 캐리 링(2.00~2.50m) 유지, 링 통과 시
분리 전환·문서상 공이 포인터 추종, 릴리스 후 loose·링 소거, **작고 빠른 드래그 오차 0.00m**(급발진
해소), 14m sweep은 여전히 40.8m 던져짐. 콘솔 에러 0.
Note: 소유 공을 링 밖으로 끄는 동안 렌더는 홀더에 고정돼 착지 예정 위치가 보이지 않는다(CHG-132에서
사용자가 흰 안내선 제거를 요구한 결과). 분리 링이 "떨어진다"는 사실은 알려 주지만 위치는 아니다.

### CHG-20260822-135 — UX — 분리 링을 넘으면 공을 잔디 위에 렌더 (CHG-134 트레이드오프 해소)

Problem (사용자 2026-08-22): 링을 넘어 끌면 '공을 뺏는' 의도인데 렌더는 홀더 발밑에 고정돼, 어디에
놓일지 보이지 않았다(CHG-134에서 알려진 트레이드오프로 남겨 둔 부분).
Change: `detachPos` 상태 추가 — `detached`인 동안 공의 렌더 위치를 드래그 지점으로 override하고
`ballStatus`를 `loose`, `holderColor`를 `undefined`로 바꿔 **발에서 떨어져 잔디 위에** 그려지게 한다.
fling 재생이 쓰던 것과 같은 render-override 지점(`flingPos ?? detachPos ?? resolved`). 문서상
possession은 드래그 중 그대로 둔다 — 중간에 지우면 패스 체인이 끊기는 기존 회귀가 있어서, 실제
보유/해제는 드롭 커밋이 결정한다. 링 안으로 복귀하면 override가 풀려 다시 캐리 링에 붙는다.
Validation: typecheck/lint/build/harness PASS, 200 tests PASS. Playwright `carry.cjs` 15/15 PASS —
링 안에서는 발밑 2.00m 유지, 링 통과 후 **렌더 좌표 (56.0,30.0) = 커서**·홀더로부터 16.5m,
드롭 후 loose, 링 소거. 스크린샷으로 잔디 위 렌더 육안 확인. 콘솔 에러 0.

### CHG-20260822-136 — UX — 기본 재생 속도 1.5배

Problem (사용자 2026-08-22): 애니메이션 기본 재생 속도를 1.5배 빠르게.
Change: 재생 배속 상수를 `src/editor/playbackRates.ts` 한 곳으로 모음 — `uiStore`가 모듈 초기화
시점에 기본값이 필요한데 `usePlayback`은 이미 `uiStore`를 import하므로, 되import하면 순환이 된다.
`NORMAL_SPEED 1 → 1.5`. 홀드는 **정상 속도의 배수**로 재정의(`BOOST_FACTOR 3`,
`BOOST_SPEED = 4.5`) — 사용자가 체감하는 "3배속"은 정상 대비 비율이므로, UI는 절대 속도가 아니라
`speedFactor(speed)`(= speed / NORMAL)를 표시한다. 따라서 pill·툴팁·조작법은 그대로 "3배속"이고
클럭만 빨라진다. `boosted` 판정도 `> 1` → `> NORMAL_SPEED`.
GIF 내보내기는 자체 `speed = 2`를 쓰므로 영향 없음(확인함).
Validation: typecheck/lint/build/harness PASS, 200 tests PASS(AppShell 부스트 테스트가 상수를
쓰도록 갱신 — 배속을 하드코딩하지 않는다). Playwright `rate.cjs` 4/4 PASS — **벽시계 대비 실측**
정상 1.50x, 홀드 4.52x(정상의 3배), pill은 "3×" 표기, 콘솔 에러 0.
Note: 계측을 위해 DEV 전용 QA 훅에 `__stClock`(재생 상태 반환)을 추가했다 — 기존 `__stDoc`/
`__stCompiled`와 같은 자리·같은 DEV 가드.

### CHG-20260822-137 — FIX — 경로 곡률 조절 시 제어점이 과민하게 생기던 문제

Problem (사용자 2026-08-22): 이동경로 곡률을 잡을 때 점이 너무 민감하게 잡힌다.
Change: 원인 세 가지 — (1) 휘기가 토큰 드래그와 같은 `DRAG_THRESHOLD_PX(4px)`에서 시작돼 선택만
하려는 클릭의 손떨림에도 제어점이 삽입됐다 → `BEND_START_PX = 10` 분리(휘기는 점을 삽입하는
조작이므로 의도적 당김 요구). (2) 제어점을 임계값 통과 시점의 포인터 위치에 꽂아, 겨눈 곳보다
밀린 자리에 생겼다 → press 시점 좌표(`startPt`)로 변경. (3) 기존 점 재사용 반경이 1.2m라 같은 자리를
두 번 휘면 제어점이 하나 더 생겨 꺾였다 → `BEND_GRAB_RADIUS_M = 2.4m`.
Validation: typecheck/lint/build/harness PASS, 203 tests PASS(stepCommands 유닛 +3: 신규 삽입 1개,
반경 내 재사용, 반경 밖 신규). Playwright `bend.cjs` 6/6 PASS 및 **구/신 대조** — 수정 전에는 7px
흔들림만으로 점이 추가되고(2→3) 근처 재휘기가 또 하나 쌓였으나(4→5), 수정 후 흔들림은 점 추가 0,
의도적 당김은 정확히 1개, 제어점 x=50.0(누른 자리와 일치), 재휘기 3→3. 콘솔 에러 0.

### CHG-20260822-138 — UX — Ctrl 단축키 3종을 왼쪽 사이드바 전용 박스로 분리

Problem (사용자 2026-08-22): Ctrl+좌클릭 / Ctrl+우클릭 / Ctrl+Z가 '팀 구성'과 '정리' 카드에 흩어져
있어 각 버튼의 각주처럼 읽힌다. 하나로 묶어 달라.
Change: `CTRL_BINDINGS`를 `keymap.ts`(문구 단일 소스)에 신설하고, `ActionsPanel`에 'Ctrl 단축키'
`panelCard`를 추가해 세 줄을 렌더한다. 팀 구성 카드에서 좌/우클릭 힌트를, 정리 카드에서 Ctrl+Z
힌트를 제거 — 두 카드는 이제 버튼만 갖는다. 카드 순서: 팀 구성 → 정리 → **Ctrl 단축키** → 재생
(키보드 성격의 두 카드가 이웃). i18n `panel.ctrl` 추가.
Validation: typecheck/lint/build/harness PASS, 203 tests PASS. Playwright `ctrlcard.cjs` 9/9 PASS —
카드 순서 확인, Ctrl 박스가 정확히 3줄(라벨·문구 일치), 팀 구성·정리의 힌트 줄 0개,
다른 카드에 Ctrl 행 중복 없음, 카드 밖으로 넘치는 텍스트 없음. 스크린샷 육안 확인. 콘솔 에러 0.


### CHG-20260822-139 — FIX — 패스가 수신자의 **출발 지점**에서 발사되던 고질 결함 (불변식 B1)

Problem (사용자 2026-08-22, 스크린샷 2장): "3번 선수의 마지막 시점에 있는 공을 잡아 골대로 드래그했는데
왜 3번의 첫 시점에서 공이 나가?" + "예~전부터 있었던 버그인데 고쳤다고 몇 번을 말해도 꾸준히 생긴다.
이번에 구조적으로 아예 안 나오게 해달라."

Root cause (3건 전부 재현 후 확정):

1. **compile 고정점의 저작 순서 의존.** `heldBallPosAt` → `playerPosAt`은 아직 배치되지 않은
   세그먼트를 만나면 그 선수의 **home**을 답한다. 트랙은 문서 순서로 풀리므로 **공 트랙이 수신자
   트랙보다 먼저 생긴 경우**(패스를 먼저 그리고 그 선수에게 나중에 이동을 그림) travel 스케줄이
   home 앵커로 굳고, 스케줄은 다시 계산되지 않아 영구화된다. 재현 로그: 발사 시각 t=3.38에서
   수신자는 (35, 14.88)에 서 있는데 앵커는 (19.06, 12.61) = **home + offset**. 저작 순서에만
   의존하므로 간헐적으로 보였고 손으로 만든 시나리오로는 계속 빠져나갔다.
2. **"선수 발밑 공 위치" 공식이 두 개.** `syncTravelReceiverInDraft`가 `수신자.pos + carryOffset`으로
   도착점을 찍는 반면 `heldBallPos`는 캐리가 있으면 offset을 무시한다(ADR-0010 D2) → 달려온 수신자에게
   가는 **모든** 패스에서 저장 도착점 ≠ 실제 정지 위치.
3. **앵커 단계의 순차 실행.** 도착 앵커 → 원점 앵커 → 스루패스 지연 순서라, 뒤 단계가 앞 단계의
   전제(도착 시각)를 바꿔 앞을 낡게 만들었다.

Change:

- `src/engine/ballContinuity.ts` (신규) — **불변식 B1**: 공은 인접 두 순간에 자기 속도 이상 못 움직인다.
  특정 resolver가 아니라 **결과**를 검사하므로 허용오차·에폭·반경이 바뀌어도 계속 잡는다.
- `compile.ts` — travel 스케줄은 홀더 트랙이 전부 배치된 뒤에만 만든다(`holderSettled`). 한 라운드가
  전혀 진전이 없으면(참조 순환) 대기를 풀어 교착 대신 기존 error issue로 떨어진다.
- `segmentCommands.ts` — 도착점을 `heldBallPos`로 만든다. `ReceiverCandidate`가 `moving`/`carry`를
  실어 나른다. 어떤 호출부도 `pos + offset`을 직접 조립하지 않는다.
- `stepCommands.ts` — 도착 앵커 · 발사 원점 · 스루패스 지연을 **하나의 compile을 공유하는 한 라운드**로
  묶어 고정점까지(최대 4회) 반복.
- `scenarios.test.ts` — "도착점이 수신자 중심 0.05m 이내" 단언 삭제. **그 단언이 B1을 정면으로 위반**
  하고 있었다(중심에 붙이면 착지 직후 캐리 resolver가 공을 다시 옮겨 반드시 튄다). "도착점 = 공의
  정지 위치"로 교체 + 프리셋 전체 연속성 단언 추가.

Validation: typecheck/lint/build PASS, **221 tests PASS**(신규 5).

- `ballContinuity.test.ts` 3종 — 수정 전 전부 FAIL(1.52m / 3.70m / 14.27m).
- `ballContinuityFuzz.test.ts` — **저작 순서 무작위화**(시드 LCG). 수정 전 35번째 시드 안에 3건,
  수정 후 **3000세션(최대 11수) 0건**.
- Playwright 브라우저 재현 `pw/launchorigin.cjs` — 발사점 오차 **4.19m → 0.00m**, 콘솔 에러 0.
- **내장 예시 전술 8개 전부**가 매 캐치마다 2.0~7.04m 순간이동 중이었음을 수정 전 측정으로 확인.
  수정 후 8개 전부 연속.

Decision: ADR-0010 Amendment D7.

### CHG-20260822-140 — FIX/UX — 조작 사각지대 3건 + 패널·하단 바·드롭다운 디자인 대개편 (사용자 지적 8건)

Problem (사용자 2026-08-22, 8건): (1) 그리기 모드 선택 도구에서 Delete가 안 먹음 "이런 것 전부 다
찾아서 수정", (2) 패널 숨겼을 때 생긴 좌/우 잔디에 그리기가 안 됨, (3) zen에서 F 안내가 어디에도
없음, (4) 패널 디자인이 조잡하고 단축키 설명이 정렬 없이 들쭉날쭉, (5) 색 직접 고르기 버튼만 한 행
아래로 밀림 + 흰색 펜 필요, (6) 재생/처음으로/반복/내보내기 버튼과 그 단축키 안내의 높이가 제각각,
(7) 포지션 드롭다운이 OS 기본 박스, (8) 슬링 조준선이 파란색 + 공을 조금만 옮겨도 급발진하고 순간
깜빡임.

Root cause — 공통점은 **규칙 없이 개별 처리**한 자리들:

- (1) `useEditorKeyboard`가 `annotate.on`이면 키보드를 통째로 반환했다. 그런데 select 도구는
  **보드 포인터를 그대로 쓴다**고 계약돼 있다(uiStore) — 포인터는 주고 키는 뺏은 상태.
- (2) viewBox 고정 + `xMidYMid meet` → 레터박스 띠는 **포인터 이벤트는 받지만 좌표가 없는** 죽은
  영역. 펜은 `clampToPitch`로 터치라인에 붙었다. F를 누르면 그 띠가 가장 커진다.
- (4) 두 패널이 서로 다른 행 레이아웃을 쓰면서 제스처("경로 드래그")까지 키캡으로 그려, 어떤 두 줄도
  같은 x에서 시작하지 않았다.
- (5) `.colorCustomWrap`이 `inline-block`이라 버튼이 텍스트 베이스라인을 타고 half-leading만큼 내려갔다.
- (6) `.toolCol`이 flex column이라 각 열이 자기 높이(11+44 / 11+30)만 차지했고 바가 각각 따로 중앙
  정렬했다 → 키 라벨이 세 높이에 흩어짐.
- (8) 릴리스 창(110ms)만 보므로 3m 튕김도 던지기(64 m/s)로 읽혔다. 그리고 문서에는 정지 지점이 이미
  커밋된 채 롤 드라이버는 첫 rAF에야 위치를 써서 **한 프레임 동안 공이 도착지에 그려졌다**.

Change: ADR-0009 Amendment v15 (a~j) 참조. 요지 — select 도구는 편집 키도 돌려받는다 / viewBox가
요소 비율까지 확장돼 보이는 곳은 전부 그릴 수 있다(`usePitchView`, `clampToView`) / 던지기는 잡은
지점부터 `FLING_MIN_SWEEP_M(5m)`을 쓸어야 성립 / 롤 시작점을 같은 커밋에서 고정 / 조준선 중립색 /
키캡은 키에만, 행 레이아웃은 `ShortcutRow` 하나 / 하단 바는 `--st-toolkey-row`·`--st-toolbtn-row`
2행 공유 그리드 / 포지션은 `SelectMenu`(그룹 헤딩·키보드·위쪽 뒤집기) / zen은 나가는 **버튼**을
띄운다 / 펜 팔레트에 흰색 1칸(핑크 1칸 제거).

Validation: typecheck/lint/build/harness PASS, **222 tests PASS**.

- Playwright `overhaul.cjs` **15/15 PASS** — 키 라벨 한 베이스라인(bottom=832), 버튼 한 중심선(cy=854),
  native `<select>` 0개, 그룹 헤딩 4개, 그리기 모드 Delete로 선수 1→0, 색 스와치가 정확히 2행,
  흰색 펜 존재, zen에서 surround에 그은 획이 x=-16.05m(터치라인 밖), zen 탈출 버튼이 F를 명시하고
  클릭 시 복귀, 두 패널 각각 단일 좌측 정렬선(28 / 1230), 카드 밖 넘침 0, 콘솔 에러 0.
- Playwright `fling.cjs` 3/3 PASS. **깜빡임은 대조 실행으로 확정**: 수정 전 릴리스 직후 프레임 간
  전진 점프 **26.79m**(= 롤 전체 거리), 수정 후 0.00m.
- **정직하게 남기는 한계**: `fling.cjs`의 "짧은 플릭은 던지지 않는다"는 브라우저에서 **공허했다**
  (게이트를 빼도 통과) — 합성 포인터 타이밍이 사용자의 실제 플릭을 재현하지 못한다. 그래서 sweep
  게이트는 `ballFling.test.ts` 단위 테스트로 고정했고, 게이트를 빼면 3.2m 플릭이 **64 m/s**로 발사되는
  것을 확인했다(비공허 확인 완료).
- 기존 probe 무회귀: bend 2/2, carry 2/2, heldball 2/2, zen 5/5(보드 921→1066px, +16% 불변).

### CHG-20260822-141 — UX — Alt+클릭 경로(드래그와 병존) · 최초 위치 단독 이동 · 포지션 메뉴 가독성 · GIF 품질

Problem (사용자 2026-08-22): (1) Alt 드래그 대신 Alt 클릭으로 경로를 만들면 중간 엔티티에 방해받지
않고, 휘는 건 나중에 선을 잡아 하면 되지 않나? — 이어서 "**둘 다** 가능하게 하면 되는 거 아닌가?
엔티티 많을 땐 클릭, 빈 곳에서 섬세하겐 드래그" (2) 선수 최초 위치를 잡아 옮기면 미래 시점까지 전부
따라오는데 이유가 있나? 없으면 그 엔티티만 독립적으로 (3) 포지션 드롭다운이 아직 가독성이 없다
(4) GIF를 10MB 제한에 올릴 건데 500~1000KB에 화질도 나쁘고 프레임도 끊긴다.

전제 검증 (정직하게):

- (1) 헤드리스로 두 경우를 재현 시도 — **간섭 재현 실패**. 중간 선수를 정통으로 지나는 패스는 목표까지
  도달했고(끝 x=85.4, 조준 88), 수신자 위 공 고스트에서 이어 그리기도 성공. 정확한 재현 절차는 미상.
  그래도 채택 — WCAG 2.5.7(드래그 없는 대안, 키보드로는 충족 불가) 미충족을 정면 해소하고, 조준을
  포인터 경로에서 분리해 그 부류를 통째로 없앤다. 상세: ADR-0009 v16-a.
- (2) **이유가 있었다**: 2026-08-20 CHG-065 ②에서 같은 사용자가 "시작점만 붙어가 경로가 과도하게
  꺾임"이라 보고해 전체 평행이동으로 바꾼 것. 이번 요청은 그 결정의 명시적 번복이므로 **선택 크기로
  가른다** — 그룹 드래그는 평행이동(옛 계약 유지), 단일 토큰은 앵커만. 단일 드래그가 고스트 드래그의
  거울이 된다(END 조정 ↔ START 조정).

Change: ADR-0009 Amendment v16 (a~c). 요지 — 움직이지 않은 press = 클릭(`CLICK_SLOP_M` 0.8m),
Alt+클릭으로 무장→Alt+클릭으로 도착점, Esc/앵커 재클릭/Alt 없는 클릭이면 해제, Alt+드래그는 불변 /
단일 토큰 드래그는 `shiftJunctionAnchorsInDraft`로 옛 시작점에 붙은 것만 동반 / `SelectMenu`가
`sub`(한글 뜻)과 2열을 지원하고 24개 포지션이 스크롤 없이 한 화면에, 그룹 헤딩은 전폭 행이라 한 항목짜리
그룹이 자기 첫 항목처럼 보이던 문제("GK" 위에 "GK") 해소 / GIF는 예산 기반 티어.

GIF 세부: 1280@25 → 1024@20 → 800@12.5 → 640@10, 상한 9.5MB, 만들면서 크기를 투영해 초과 예상 시
즉시 티어 강등. **모든 레이트가 100을 정확히 나눈다** — GIF 딜레이는 1/100초 단위라 12fps(83.3ms)는
8cs=80ms로 반올림돼 샘플링 속도와 다르게 재생된다(기존 "12fps"는 실제 12.5fps). 테스트가 이 결함을
잡아냈다. 전역 팔레트 1개(5프레임 샘플)로 프레임당 지역 컬러 테이블과 팔레트 흔들림 제거. 기본 2배속
→ 실시간. 완료 토스트가 실제 선택된 해상도·용량을 표시.

Validation: typecheck/lint/build/harness PASS, **225 tests PASS**(신규 3 — GIF 티어 계약).

- Playwright `aimclick.cjs` 7/7 — Alt+클릭이 앵커를 표시, 두 번째 클릭이 2웨이포인트 직선을 생성,
  시작점 일치, **중간 엔티티를 지나 조준한 x=86.0에 도착**, 착지 후 자동 해제, Esc 해제,
  **Alt+드래그는 그대로 곡선(웨이포인트 >2)**.
- Playwright `homeanchor.cjs` 4/4 — 최초 위치 드래그 후 선수 0.00m 오차, 런 시작점이 선수에 붙어
  이동(t=0 순간이동 없음), **런의 끝은 0.00m 불변**. 마퀴 그룹 드래그는 여전히 경로 전체 +8.00m 동반.
- Playwright `gif.cjs` 실측 — 4단계 약 11초 플레이에서 1280@25 투영 초과 → **1024×683 / 20fps /
  222프레임 / 6.58MB / 2.0초**. 기존 대비 용량 약 7~13배, 해상도 1.6배, 실시간 재생.
- 무회귀: overhaul 15/15, fling 3/3.

### CHG-20260822-142 — FIX/UX — 골대 안 공이 안 나가던 문제 · 엔티티 색 매핑 감사 · 조준 점 · 포지션 이름

Problem (사용자 2026-08-22): (1) 골대 안에서 공을 슬링으로 날리면 골대 밖으로 안 나가고 가상의 벽에
막힘 (2) 조준 점선 끝의 흰 점이 크고 진함 — 더 작고 옅게 (3) Alt+클릭 안내 점이 엔티티 색을 따라야 함
(파란 선수 → 파란 점, 공 → 흰 점) + "다른 부분도 이상하게 매핑된 곳 없는지 살펴보고 수정" (4) 포지션
이름의 "좌 윙백"을 "왼쪽 윙백"으로.

Root cause (1): 네트 진입 판정이 "골문 안쪽 **+ 골대 쪽으로 이동 중**"을 요구해서, 이미 골대 안에 있는
공은 `inNet`이 되지 않고 **일반 경계 반사**로 떨어졌다. 그 반사가 x<0을 x>0으로 미러링하고 속도를
뒤집는다 — 정확히 "골문을 가로지르는 보이지 않는 벽". 대조 실행으로 확정: 수정 전 x −1.8 → **−0.05**
(골문 평면에 붙어버림), 수정 후 x −1.8 → **+16.2**.

Root cause (3): 엔티티를 그리는 표시 4종이 accent를 하드코딩하고 있었다 — 조준 안내, 경유점,
단계 배지, 고스트 호버 링. **빨간 팀 경로에 파란 점**이 찍히고, **파란 팀에서는 아예 안 보였다**
(고스트 호버 링은 필요한 바로 그 자리에서 사라진다).

Change: ADR-0009 Amendment v17 (a~c). 요지 — 골문은 들어가는 방향으로만 닫히고 나가는 공에는 네트
흡수가 아니라 잔디 항력이 걸린다(뒤판은 여전히 죽어 있어 처박은 공이 튀어나오지 않는다) /
`entityColorOf`가 `--st-entity`를 **그룹에 한 번** 세우고 하위 표시가 상속, CSS 폴백은 accent가 아니라
**흰색**이라 빠뜨린 호출부가 눈에 띄게 틀려 보인다 / 슬링 끝점 r 1.0 → 0.45m, 불투명도 1 → 0.62 /
포지션 "좌/우" → "왼쪽/오른쪽".

Validation: typecheck/lint/build/harness PASS, **227 tests PASS**(신규 2).

- `ballFling.test.ts` 신규 — 네트에서 오른쪽으로 던지면 필드로(x>6), **되돌아가는 프레임 0개**,
  반대편 골대도 동일, 뒤판에 처박으면 골라인 뒤에 머문다.
- `designTokens.test.ts` 신규 — 엔티티 표시 9종이 accent를 하드코딩하지 않고 `--st-entity`를 읽는지
  강제. 위반(`.aimTip`에 accent)을 심어 실패 확인.
- Playwright `colors.cjs` 6/6 — 조준 색 실측 **홈 rgb(31,109,242) · 원정 rgb(224,62,62) · 공
  rgb(255,255,255)**, 경로 그룹이 `--st-entity`(#e03e3e)를 운반, 단계 배지가 자기 경로와 일치,
  골대 안 공이 x −1.8 → +16.2로 탈출. 대조 실행으로 수정 전 −0.05 확인.
- 무회귀: aimclick 7/7, homeanchor 4/4, overhaul 15/15, fling 3/3.

### CHG-20260822-143 — UX — Alt+클릭 한 번으로 경로 · 호버 하이라이팅(라이브 토큰 포함) · 단계 컨트롤 정체성 · 중복 드롭다운 제거

Problem (사용자 2026-08-22): (1) Alt+클릭을 굳이 두 번 해야 하나? 엔티티가 선택돼 있으면 도착점만
찍으면 되고, 선택 안 돼 있어도 지금은 아무 일도 없으니 잃을 게 없다 (2) AM이 왜 "공격형"인가 —
공격형 미드필더다 (3) 흐린 엔티티 호버가 전부 파란색이고, **초기 선수·공은 호버해도 아무 표시가 없다**
(4) 단계 인라인 피커와 하단 단계 바의 활성 칩도 accent — 엔티티 색이어야 하고, 공은 흰색이라 안 보이니
어두운 버튼에 흰 글씨로 (5) 선택 액션 바의 단계 드롭다운은 없애도 되지 않나.

Root cause (3): **`Token`이 `hovered` prop을 선언만 하고 한 번도 읽지 않았다** — 죽은 prop이 곧 죽은
기능. 고스트 쪽은 `.ghostToken:hover circle`이 accent stroke였고, 고스트 fill이 이미 팀 색이라
**파란 팀에서는 링이 fill과 같아져 사라졌다**.

Root cause (5의 이면): 숫자 **키**는 선택된 움직임의 단계를 바꾸는데 같은 칩을 **클릭**하면 안 바뀌었다.
하나의 컨트롤에 두 가지 뜻이 있었고, 그래서 네 번째 컨트롤(드롭다운)이 필요해 보였던 것.

Change: ADR-0009 Amendment v18 (a~d). 요지 — 새 intent `draw-to-point`(엔티티 하나 선택 + 빈 잔디
Alt+누름 = 마지막 위치에서 여기까지 직선), 두 클릭 방식은 고스트 시작·주어 변경용으로 유지, Alt를 누른
**즉시** 앵커가 떠서 발견 가능 / 호버 표시는 조각 **바깥의 링**이고 `--st-entity`를 읽는다(안쪽 stroke는
링과 fill이 같은 색일 때 사라진다) / 인라인 피커는 편집 중인 엔티티 색, 하단 바는 **선택이 있을 때만**
그 색(없으면 다음에 그릴 움직임이라 accent가 맞다), 공은 `entityChipOf`로 어두운 칩 + 흰 글씨 /
하단 칩 클릭도 선택된 움직임을 재지정 → 액션 바의 드롭다운 제거(단계는 표시만) / AM = 공격형 미드필더.

Validation: typecheck/lint/build/harness PASS, **228 tests PASS**.

- `gestureIntent.test.ts` 신규 — 선택 1개 + Alt = `draw-to-point`, 선택 없으면 `marquee`,
  Ctrl 우선, 체인 우선, 우클릭은 그리지 않음.
- `AppShell.test.tsx` — 사라진 드롭다운을 겨냥하던 단언을 **살아남은 컨트롤**(하단 칩)로 옮겨,
  "배지로 선택 → 한 동작으로 5단계 지정" 계약을 그대로 지킨다.
- `designTokens.test.ts` — 엔티티 표시 목록에 `.hoverHalo` 추가(총 10종).
- Playwright `identity.cjs` 10/10 — 라이브 토큰 호버 halo 실측 **홈 rgb(31,109,242) · 원정
  rgb(224,62,62) · 공 rgb(255,255,255)**, Alt 누름 즉시 미리보기, **클릭 한 번**으로 2웨이포인트 직선이
  클릭 지점에 생성, 하단 칩·인라인 피커 모두 rgb(224,62,62), 액션 바에 `<select>` 0개, 칩 클릭으로
  선택된 움직임이 4단계로 재지정.
- 무회귀: colors 6/6, aimclick 7/7, homeanchor 4/4, overhaul 15/15, fling 3/3.

### CHG-20260822-144 — FIX/UX — 공 단계 배지 실종 · 칩 카운트 색 · 문맥 기반 단축키 하이라이팅

Problem (사용자 2026-08-22): (1) 공 애니메이션 단계 수정 버튼이 안 보임 (2) 단계 바에서 버튼은 색깔
구분하는데 작은 숫자는 파란색 그대로 (3) 지금 하는 일에 따라 관련 단축키가 자동으로 하이라이팅되면
좋겠다 — 단, 키를 아주 빠르게 눌렀다 뗐을 때 점멸되지 않아야 한다.

Root cause (1): v18에서 배지에 `--st-entity`(**잔디 위** 역할)를 물렸다. 공은 거기서 흰색인데 배지는
**밝은 바탕의 채워진 칩**이라 흰 테두리 + 흰 글씨 = 완전 실종. "엔티티 색"이 바탕에 따라 두 역할이라는
것을 배지에 적용하지 않은 실수. `--st-entity-chip`으로 교체(공은 어두운 색).

Change: ADR-0009 Amendment v19 (a~c).

- 배지·인라인 피커는 칩 역할(`--st-entity-chip`)을 쓴다.
- 카운트 배지와 '사용된 단계' 테두리는 **중립**으로. "이 단계에 N개"는 모든 엔티티에 걸친 문서 사실이라
  어느 엔티티의 색도, accent도 주장할 수 없다. 단 **활성 칩 위의** 카운트는 그 칩의 정체성을 따른다.
- `cueHighlight.ts`(순수) + `useActiveCues.ts`(훅) 신설. Ctrl/Alt/Shift 홀드와 재생 중 상태를
  `Binding.cue`로 태그된 행에 연결해 켠다. 게이트: **켜짐 180ms / 꺼짐 340ms**. 비대칭이 안티플리커의
  핵심 — 꺼짐 여운 덕에 창 안의 재입력은 애초에 켜져 있어 깜빡일 수 없다. 하이라이팅은 색만 바꿔
  레이아웃이 흔들리지 않는다.

Validation: typecheck/lint/build/harness PASS, **235 tests PASS**(신규 7).

- `cueHighlight.test.ts` — 밀리초 타임라인 구동: 홀드는 정확히 180ms에 켜지고, **60ms 탭은 한 번도
  켜지지 않으며**, 40ms 간격 연타의 표시 변화는 **≤2회**, 꺼짐 창 안의 재입력은 계속 켜진 상태 유지,
  꺼짐은 정확히 340ms에.
- Playwright `cues.cjs` 9/9 — 공 배지 stroke·text 모두 `rgb(29,29,31)`(흰-위-흰 아님), 활성 칩 카운트가
  칩과 같은 `rgb(29,29,31)`, 정지 상태에서 켜진 행 0개, Ctrl 홀드 시 Ctrl 3행, Alt 홀드 시 Alt 4행,
  재생 중 Space 2행, **Ctrl 연타 6회에 한 번도 켜지지 않음**.
- 무회귀: identity 10/10, colors 6/6, aimclick 7/7, homeanchor 4/4, overhaul 15/15, fling 3/3.

### CHG-20260822-145 — FIX — 캐리 궤도가 멈춰 있던 문제 · Alt+클릭 도착점이 시작점으로 읽히던 문제

Problem (사용자 2026-08-22): (1) 점선 원 안에서 공을 끌면 커서를 따라 안 움직이고 원 밖으로 나가야
움직인다, 전에는 됐다 (2) 공을 누르고 Alt+다음 패스할 선수를 클릭하면 시작점 지정으로 읽혀 공 경로가
끊긴다 — 구조부터 고쳐 달라.

Root cause (1): 궤도 드래그가 `doc.ball.home`만 갱신했다. 패스가 하나라도 있으면 명시적
`possessed.offset`이 렌더를 지배하고 home은 무시된다 → 화면상 정지. 세그먼트가 없을 때만
`initialOffset()`이 home에서 파생돼 돌아갔고, 그래서 "전에는 됐다"가 맞는 말이었다.
실측: 패스 없음 4.00m 이동 / 패스 있음 **0.00m**.

Root cause (2): `resolvePointerIntent`가 토큰 press를 `draw-from-token`으로 **무장된 주어보다 먼저**
읽는다. 클릭/드래그 구분은 release에서만 가능한데 `startDraw`는 pointerdown에서 선택을 바꿔버려,
release 시점엔 이전 주어가 이미 사라져 있다(첫 구현이 아무 일도 안 한 이유).

Change: ADR-0009 Amendment v20 (a~b). 요지 — 궤도 중에는 **드롭이 부르는 그 함수**
(`moveBallStartInDraft`)를 그대로 호출해 미리보기와 확정이 같은 코드가 되게 한다(detach 중에는 호출
안 함) / press 시점의 서 있는 주어를 draw 제스처에 실어 보내고 release에서 "착지냐 무장이냐"를 판단,
Alt+드래그는 불변, **고스트는 항상 무장**(클릭이 가질 수 있는 뜻이 하나뿐이라).

Validation: typecheck/lint/build/harness PASS, **235 tests PASS**.

- Playwright `orbit.cjs` 2/2 — 패스 없는 상태 4.00m, **패스 있는 상태 0.00m → 3.95m**.
- Playwright `passland.cjs` 5/5 — 공 선택 후 수신자 Alt+클릭이 **공 트랙에 travel을 만들고**
  receiver를 `#2`로 지정, 도착점이 그 선수 위(4m 이내), 수신자에게 엉뚱한 run 0개.
- 무회귀: aimclick 6/6, identity 10/10, colors 6/6, homeanchor 4/4, overhaul 15/15, fling 3/3,
  cues 9/9.
- **미해결(재현 실패)**: "왼쪽 패널 버튼 3개가 안 눌린다" — 신규 `panelbtns.cjs`가 히트테스트까지
  포함해 3개 버튼을 모두 검증했고 **전부 통과**했다(새 세션, 그리고 Ctrl/Alt/Shift 홀드·재생·Alt를
  누른 채 클릭한 뒤에도). 다음 turn에 정확한 선행 조작을 받아야 원인을 좁힐 수 있다.

### CHG-20260822-146 — UX — 경로 주어 지목 규칙을 하나로 합침 (단축키 어휘 축소)

Problem (사용자 2026-08-22): "그냥 Alt+클릭 → Alt+클릭 기능만 없애면 되는 거 아냐? 없애면 손해가
되는 게 있나?" → 확인 결과 손해는 **고스트(중간 시점)에서 클릭으로 시작하기** 하나뿐. 이어서
"단축키 최대한 줄이는 방향으로 해줘. 보이는 게 다 똑같이 오류가 안 난다면."

Root cause of the redundancy: 경로의 **주어를 지목하는 방법이 두 개**였다 — 토큰 Alt+클릭 '무장'과
그냥 '선택'. 같은 뜻인데 상태가 둘(`aim` / `quickAim`)이라 **CHG-145의 버그가 바로 그 충돌**이었다.

Change: ADR-0009 Amendment v21. 토큰 Alt+클릭은 **선택**이고 그게 지목이다 — 별도 무장 상태 없음.
안내선은 Alt를 누른 동안 선택 위에 뜬다. **고스트만** 계속 무장한다(시점은 선택으로 표현 불가,
`minStep` 강제 필요). 사용자에게 보이는 동작은 동일하고, 조작법 패널에서 한 줄이 빠지며 고스트 줄은
'흐린 토큰 Alt+드래그·클릭'으로 합쳐진다. WCAG 2.5.7 유지.

Validation: typecheck/lint/build/harness PASS, 235 tests PASS.

- Playwright `aimclick.cjs` 9/9 — 토큰 Alt+클릭이 **선택 1개**를 만들고(별도 무장 상태 없음),
  Alt를 누르면 그 대상에서 안내선이 뜨고, 두 번째 Alt+클릭이 중간 엔티티를 지나 직선 경로를 놓고,
  **고스트 클릭은 여전히 무장**하며 Esc로 해제, Alt+드래그는 불변.
- 무회귀: passland 5/5, orbit 2/2, identity 10/10, colors 8/8, homeanchor 4/4, overhaul 15/15,
  fling 3/3, cues 9/9, panelbtns 5/5.

### CHG-20260822-147 — FIX — 고스트(미래 위치)로 스루패스가 안 되던 문제

Problem (사용자 2026-08-22, 스크린샷): 2번 선수가 초기 위치에서 들고 있는 공을, 1단계 진행 후의
**1번 선수 고스트**에게 패스하려고 공 선택 → 고스트 Alt+클릭 했더니 패스가 안 그려지고 그 고스트에서
안내 점선이 나왔다.

Root cause: CHG-146(v21)에서 "고스트는 항상 무장"을 예외로 뒀다. 예외를 잘못 그은 것 —
**미래 위치로 보내는 패스는 스루패스이고 본론이다.**

Change: ADR-0009 Amendment v22. 규칙을 한 문장으로 축소 — **주어가 서 있으면 클릭은 도착점이다(잔디·
선수·고스트 무엇 위든), 아무도 없을 때만 주어를 지목한다.** 고스트는 *지목하는 방법*만 다르다(시점이라
선택으로 표현 불가). 착지 시 단계는 올리지 않는다 — 스루패스는 같은 단계에 달리는 선수와 함께 나가고
도착 동기화는 relayout §4가 담당한다.

Validation: typecheck/lint/build/harness PASS, 235 tests PASS.

- Playwright `throughball.cjs` 8/8 — 1단계 런을 그린 뒤 공 선택 → 그 런의 끝 고스트 Alt+클릭 →
  **공 트랙에 travel 생성, 도착점 (61.7, 13.2) = 런의 미래 위치, receiver `#1`, step 1**,
  고스트는 무장되지 않았고 러너에게 여분의 런 0개. **아무것도 선택 안 했을 때는 고스트 클릭이 여전히
  무장**한다.
- 무회귀: aimclick 9/9, passland 5/5, orbit 2/2, identity 10/10, colors 8/8, homeanchor 4/4,
  overhaul 15/15, fling 3/3, cues 9/9, panelbtns 5/5.

### CHG-20260822-149 — FIX — 중간 고스트에서 경로가 갈라져 순간이동하던 문제 (분기 금지)

Problem (사용자 2026-08-22): 중간 흐린 토큰에서 Alt로 경로를 그으면 단계가 3·4로 붙어, 선수가
마지막 위치에 있다가 분기점으로 순간이동한다. 이어서 사용자 확정: **"당연히 분기는 안되지."**

Root cause: CHG-148의 `step = max(칩, 마지막 단계 + 1)`이 고스트의 `minStep = 그 고스트 단계 + 1`을
덮었다. 다만 그 값을 살렸어도 이미 있는 같은 단계와 충돌한다 — 한 엔티티는 한 단계에 하나이므로,
분기 자체가 타임라인으로 표현 불가능하다.

Change: ADR-0009 Amendment v23. **한 엔티티의 움직임은 하나의 사슬**이고 새 움직임은 그 엔티티의
**마지막 위치**에서만 시작한다. 중간 고스트는 시작점이 될 수 없고(조용히 뒤에 붙이는 대신 토스트로
이유를 말한다), **도착점으로는 여전히 유효**하며(스루패스), 끝 위치 미세조정(그냥 드래그)도 그대로다.

Validation: typecheck/lint/build/harness PASS, 235 tests PASS.

- Playwright `midghost.cjs` 8/8 — 중간 고스트 Alt+드래그가 **아무것도 만들지 않고**(2→2) 토스트로
  이유를 말하고, Alt+클릭도 무장하지 않으며, **마지막 고스트는 그대로** 무장→착지로 이어지고
  단계가 곧게 **[1,2,3]**을 유지한다.
- 무회귀: throughball 8/8, steps 1/1, aimclick 9/9, passland 5/5, orbit 2/2, identity 10/10,
  colors 8/8, homeanchor 4/4, overhaul 15/15, fling 3/3, cues 9/9, panelbtns 5/5.

### CHG-20260822-150 — FIX/UX — 어느 시점 토큰을 눌러도 이어 그리기 · 공은 '실려 간' 것까지 마지막으로 센다

Problem (사용자 2026-08-22): (1) 분기가 없는데 왜 처음 엔티티만 눌러야 Alt+클릭이 되냐 (2) 공이
2단계 패스까지만 갔어도 소유한 선수가 3단계까지 갔으면 공의 마지막은 3단계로 봐야 하고, 그 선수의
미래 시점 공 고스트를 눌러도 작동해야 하지 않나.

Root cause (2), 재현 완료: `lastKnownPosition(ball)`과 `lastBallStep`이 **공 트랙만** 본다. 소유
세그먼트에는 path가 없어 실려 간 거리·단계가 보이지 않는다. 결과: 1단계 도착 + 2단계 런 상황에서
다음 패스가 **2단계**로 잡혀 런 시작 순간 발에서 떠났고, 출발점도 옛 패스 끝 (41.4, 46.1)에 고정됐다
— 공이 실제로 있는 (75.4, 18.8)이 아니라.

Change: ADR-0009 Amendment v24.

- (a) v23의 중간 고스트 **거절을 철회**한다. 분기가 불가능하면 고스트의 위치는 정보를 담지 않고 정체만
  담으므로, 어느 시점 토큰을 눌러도 그 엔티티의 끝에서 이어진다. 거절 토스트·전용 상태 삭제.
- (b) `entityRestPos` — 위치는 `stateAt(끝)`으로 묻는다(선수·공 한 규칙, 소유 포함).
- (c) `lastBallMovedStep` — 공 자신의 마지막 travel 단계와 **끝에서 공을 든 선수의 마지막 런 단계**
  중 큰 값. 실려 가는 것도 움직임이다.

Validation: typecheck/lint/build/harness PASS, 235 tests PASS.

- Playwright `ballrest.cjs` 6/6 — 1단계 패스 + 2단계 캐리 런 뒤, 실려 간 공 고스트를 Alt+클릭하면
  새 패스가 **3단계**로 생성되고 출발점이 **(75.4, 18.8)** = 실제 정지 위치, 옛 패스 끝에서 **43.7m**.
- Playwright `midghost.cjs` 7/7 — 중간 고스트 Alt+드래그가 새 다리를 만들고 **엔티티의 끝**에서 시작,
  체인이 **[1,2,3,4]**로 곧고 이음매 간격 **0**.
- 무회귀: throughball 8/8, steps 1/1, aimclick 9/9, passland 5/5, orbit 2/2, identity 10/10,
  colors 8/8, homeanchor 4/4, overhaul 15/15, fling 3/3, cues 9/9, panelbtns 5/5.

## CHG-20260822-151 — 공은 '정체'가 아니라 '순간'으로 잡힌다 (ADR-0009 Amendment v25)

Trigger: 사용자 — "2번 선수로 2단계까지 진행한 다음 **가장 처음에 있는 공**을 클릭해서 1번 선수에게
패스하려 했는데, 공이 2번 선수의 **가장 마지막 위치**에서 나간다. 공은 예외여서 중간의 모든 시점에서
움직일 수 있어야 한다. … 그 이후 공들은 없어지고 … **공이 동시에 존재할 수 없으니.**"

Cause: v24가 모든 엔티티에 한 규칙을 적용했다 — "어느 흐린 토큰을 눌러도 그 엔티티의 **끝**에서
이어진다". 선수에게는 맞지만(분기 금지 + 선수는 여럿), 공에게는 틀렸다. 공은 하나뿐이라 이른 순간에
잡는 것은 분기가 아니라 **덮어쓰기**다. `subjectAtPress`가 항상 `entityRestPos`(=끝)를 물었고
`finishDraw`가 `lastBallMovedStep + 1`로 단계를 파생했으므로, 어느 공 토큰을 눌러도 결과가 같았다.

Change: ADR-0009 Amendment v25.

- `DrawSubject.atStep` — 잡은 공 토큰이 정하는 **정확한** 단계(live=1, 흐린 공=그 움직임 단계+1).
  `ballMomentRef`가 press 시점에 기록하고, 공이 선택에서 빠지면 함께 사라진다.
- `truncateBallFromStepInDraft` / `ballMovesFromStep` (editor) — 그 단계 이후 공의 authored travel만
  삭제. 캐리는 저장되지 않으므로 공을 잃은 런은 그대로 남는다.
- `addStepPass(..., { exactStep })` — 자른 뒤 그 단계를 그대로 쓴다. 미지정이면 종전대로 이어 붙인다.
- 토스트 `simple.ballRerouted` — 지워진 패스 개수를 말한다(Ctrl+Z 복구 안내).

Validation: typecheck/lint/build/harness PASS, **240 tests PASS** (신규 `ballMoment.test.ts` 5).

- Playwright `ballmoment.cjs` 15/15 — #2가 2단계를 캐리한 뒤 **시작 지점의 공**을 클릭 → #1의 1단계
  고스트로 Alt+클릭: 패스가 **1단계**, 출발점 **(17.7, 53.1)** = 잡은 지점(#2의 런 끝에서 **56.3m**),
  #1이 리시버(스루패스), #2의 캐리 고스트 **0개**, #2의 런 2개는 그대로.
- **대조군**(`subjectAnchor`의 moment를 끈 상태): 같은 조작이 **3단계 / (75.9, 52.0)** — 사용자가
  보고한 증상 그대로 재현. 비공허(non-vacuous) 확인.
- 마지막 지점에서 잡으면 종전대로 **이어 붙는다**: 2번째 패스 2단계, 앞 패스 끝과 간격 **0.00m**.
- 무회귀: ballrest 6/6, midghost 7/7, throughball 8/8, steps 1/1, aimclick 9/9, passland 5/5,
  orbit 2/2, identity 10/10, launchorigin PASS, throughplayer PASS.

## CHG-20260822-152 — 전술 퍼즈(tactic fuzz): 조작 순서를 무작위로 섞어 결과 불변식 검사

Trigger: 사용자 — "어떠한 전술 재현에도 의도하지 않은 버그나 오류가 발생하지 않도록 검증 좀 많이 해줘.
… 공 위치나 선수 위치 곡률 변화, 이동경로 생성했다가 지우고 다시 다른 곳에 연결 중간 엔티티 제거,
공 잡아서 이동, 선수만 잡아서 이동 등등 진짜 수없이 많은 요소들을 집어넣어서."

Method: `src/editor/tacticFuzz.harness.ts` + `tacticFuzz.test.ts` — 실제 커맨드(run/pass/bend/delete/
restep/단일 드래그/그룹 드래그/공 시작점 이동/공 순간 잡기/undo/redo)를 시드 난수로 섞어 실행하고,
**매 조작 직후** 결과 기준 불변식 9개를 검사한다(리졸버가 아니라 결과를 본다 — 리팩터링 후에도 계속 잡힘).

I1 컴파일 오류 0 · I2 NaN 없음 · I3 한 엔티티 한 단계 하나 · I4 선수 체인 연속(토큰에서 출발, 이음매 0)
· I5 공 연속성(B1) · I6 패스는 공이 실제로 있는 곳에서 출발 · I7 도착점 = 공이 멎는 곳 · I8 패스 비중첩
· I9 파이프라인 멱등. 세션 끝에서 전체 undo→redo 되감기까지 검사.

발견·수정된 결함 6종 (전부 손으로 재현 가능한 실제 버그):

1. **한 엔티티 두 움직임이 같은 단계에** — `stepOf`가 MAX_STEP으로 **클램프**해서, 9단계가 이미 찬 상태로
   더 그리면 두 개가 9단계에 겹쳤다. → `addStepRun`/`addStepPass`가 클램프 대신 **거절**(`Id | null`)하고
   UI가 `simple.stepLimit`을 띄운다. 단계 배지/숫자키(`setSegmentStep`)도 이웃 사이로 **클램프**한다
   (`stepRangeFor`) — 체인은 순서가 기하학에 박혀 있어 재배치가 곧 이음매 찢김이다.
2. **파이프라인이 자기 고정점이 아니었다** — 루프가 `syncThroughBall` 직후 빠져나갈 수 있어, 같은 함수를
   한 번 더 돌리면 duration/trigger가 움직였다. → 라운드 **맨 위에서** `deriveTimings`를 돌려 매 라운드가
   현재 기하의 순수 함수가 되게 하고, 루프가 고정점 **위에서** 끝나게 했다. 캐리 오프셋은 0.1mm로
   양자화(부동소수 드리프트로 영원히 안정되지 않던 문제).
3. **공을 잡아 옮기면 문서가 정착하지 않았다** — `moveBallStartInDraft` 뒤에 relayout이 없었다(플링/드롭
   커밋 두 곳). → 두 곳 모두 파이프라인으로 끝난다.
4. **헤어핀에서 공이 소유자를 가로질러 순간이동** — 캐리 방향을 **순간 접선**에서 뽑아, 되꺾이는 경로에서
   접선이 한 프레임에 180° 뒤집히며 공이 20ms에 3.71m 튀었다. → `carryVecAt`: 최근 DRIBBLE_RAMP_S 동안
   **실제로 지나온 현(chord)** 방향으로 든다. 직선·완만한 곡선에서는 값이 같아 평소 드리블은 그대로.
5. **리시버 없는 패스 뒤 다음 패스가 엉뚱한 선수에게서 출발** — `passerFor`가 원래 소유자로 폴백해서
   공에서 수 미터 떨어진 선수의 소유 세그먼트를 끼워 넣었다(8.4m·18.4m 순간이동). → 공의 **마지막 움직임**이
   소유자를 정한다: 리시버가 있으면 그 선수, 없으면 잔디에는 소유자가 없다.
6. **패스 출발점이 명목 시각에 고정** — 스루패스로 늘어난 패스는 컴파일이 직렬화해 뒤로 밀리는데,
   앵커는 `trigger.t`(단계의 명목 시작)를 읽어 **이전 패스 비행 중** 위치에 붙었다(19.2m). 또 정확히 발사
   시각에 물으면 `stateAt`이 이미 그 패스를 가리켜 자기 자신과 비교하는 무효 검사였다(51.7m). → 컴파일된
   시계에서 1ms **전**을 읽는다.
7. **첫 다리를 지우면 선수가 순간이동** — 남은 다리가 허공에서 시작해, 재생 순간 선수가 거기로 튀고 들고
   있던 공까지 끌고 갔다(14.58m). → 파이프라인 1b 단계에서 **선수 체인을 봉합**한다: 첫 움직임은 토큰에서,
   그 다음은 앞 움직임이 끝난 곳에서 출발. 출발점만 옮기고 사용자가 그린 도착점은 건드리지 않는다.

Validation: typecheck/lint/build/harness PASS, **244 tests PASS**.

- `tacticFuzz` 360 세션(짧은 300 × 12조작 + 긴 60 × 40조작) 위반 0. 비공허 확인 2건(손으로 찢은 문서 =
  출발점 이탈 / 토큰에서 떨어진 첫 런 — 둘 다 검출됨).
- 브라우저 프로브 18종 전부 PASS: ballmoment 15/15, ballrest, midghost, throughball, steps, aimclick,
  passland, orbit, identity, colors, homeanchor, overhaul, fling, cues, panelbtns, launchorigin,
  throughplayer, gif.

## CHG-20260822-153 — 퍼즈 확장(내장 예시·엔티티 삭제·오빗) + 고정된 캐리 면이 되살아나던 결함

Trigger: CHG-152의 퍼즈를 사용자가 열거한 조작 전체로 넓혔다 — 선수 추가/삭제, 단계 전체 지우기,
캐리 면 고정(`carryEnd`), 도착 면 고정(`moveTravelEndInDraft`), 그리고 **세션의 1/3은 빈 판이 아니라
내장 예시 8종 중 하나에서 시작**한다(사용자: "어떠한 전술 재현에도").

발견·수정된 결함 2종:

1. **삭제된 선수를 공이 계속 타고 있었다** — `removeEntities`가 holder/receiver 참조를 남겨,
   `stateAt`이 그 선수를 못 찾고 공을 킥오프 지점으로 돌려보냈다(브라우저 마라톤 29m). 포메이션
   커맨드만 하던 정리를 **파이프라인 0단계**로 옮겼다: 어떤 경로로 들어오든, 저장소에서 나오든
   문서는 일관된 상태로 도착한다. 삭제·팀 비우기·포메이션 교체가 이제 파이프라인으로 끝난다.

2. **고정한 캐리 면이 소유자가 멈추는 순간 되살아났다** — 도착 고스트를 끌어 정한 면(`offsetLocked`)은
   **잡은 순간의 정지 위치**를 뜻하는데, 소유자가 드리블한 뒤 멈추면 그 핀이 다시 적용돼 공이 선수를
   가로질러 캐리 링 지름만큼 튀었다(1.3~3.8m, 내장 예시 포함). → 핀은 **그 소유 구간 안에서 드리블하면
   소진된다**: `CarryAhead.prevEnd`로 "이번 소유 중에 끝난 런이 있는가"를 묻고, 있으면 공은 그 런이
   남긴 자리에 있다. 램프의 출발점도 같은 규칙을 쓴다(핀이 살아 있으면 핀에서 출발). 잡기 전에 뛰었던
   런은 **가지고 있지 않던 공에 대해 아무 말도 하지 않으므로** 핀이 그대로 유효하다.
   파이프라인의 도착 앵커도 이제 `offsetLocked`를 함께 넘긴다 — 재생과 앵커가 다른 계산을 하고 있었다.

Validation: typecheck/lint/build/harness PASS, **252 tests PASS**.

- `tacticFuzz` 360 세션(예시 시작 포함) 위반 0. 신규 `scenarioContinuity.test.ts` — 출고되는 예시 8종
  전부 B1 연속(사용자가 처음 보는 문서이므로 계약으로 고정).
- `engine.test.ts`의 "잠긴 오프셋이 정면 캐리를 이긴다" 케이스는 **소유 시작 후 런이 없을 때**로 정정하고,
  드리블 후에는 정면에 놓이며 그 과정이 연속임을 검사하는 케이스를 추가했다.

## CHG-20260822-154 — 내보내기 왕복 불변식 + 단계 클램프 피드백

- **I10 내보내기 가능성**: 퍼즈가 매 조작 후 `validateDocument`를 통과하는지, `serialize → parseDocument`
  왕복이 **바이트 동일**한지 본다. 편집 결과가 저장할 수 없는 문서면 사용자는 저장하려는 순간에야 안다.
  360세션 위반 0 — 지금까지의 모든 파이프라인 변경이 저장 호환성을 깨지 않았음을 확인.
- **단계 클램프 피드백**: `setSegmentStep`이 이웃 사이로 클램프할 때 착지한 단계를 반환하고, 숫자키·
  StepBar 칩 양쪽이 다르면 토스트(`simple.stepClamped`)를 띄운다 — 눌러도 아무 일 없는 버튼으로 보이면
  안 된다(사용자 2026-08-22 "버튼이 안 눌려" 계열 방지).
- **죽은 코드 제거**: `aheadVec`는 `carryVecAt` 도입 후 아무도 쓰지 않는다. 캐리 리졸버는 단일 해석이
  가치이므로 쓰이지 않는 두 번째 공식을 남겨두지 않는다.

Validation: typecheck/lint/build/harness PASS, 252 tests PASS. 브라우저 `render.cjs` 신규 —
재생 중 각 토큰의 실제 SVG transform이 시계가 말하는 위치와 **0.22m** 이내(스프링 정착), 고스트는 모든
런의 끝에 그려지고, m↔px 매핑 왕복 오차 1.4e-14m. `carrylook.cjs` 신규 — 직선 드리블은 **정확히 1.90m**
앞(변화 없음), 헤어핀은 최대 0.59m/프레임(예산 0.91m)으로 연속이며 회전 구간에서 1.22m까지 발밑으로 붙는다.

## CHG-20260822-155 — 브라우저 마라톤: 실제 포인터 제스처 무작위 + 단계 선택 UX

`pw/marathon.cjs` — 커맨드가 아니라 **포인터**를 흔든다. Alt 드래그/클릭, 고스트 드래그, 경로 구부리기,
경로 클릭, Delete, 숫자키, undo/redo, Esc, 선수 추가, 공 드래그, 포커스(F), **전술안 A/B/C 전환·복제,
그리기 모드 왕복, 구간 재생, 움직임 전체 지우기** — 19종을 시드 난수로 섞고, **매 제스처 후 페이지 안에서**
tacticFuzz와 같은 결과 기준 불변식을 본다(문서 + `__stStateAt`로 실제 재생 궤적까지).

- **run 2**: 25세션 × 60제스처 = **1500 제스처, 위반 0**.
- 신규 dev 훅 `__stStateAt(t)` — 프로브가 "이 순간 보드가 무엇을 그리는가"를 밖에서 다시 유도하지 않고
  직접 묻는다.
- 프로브 자체 결함 1건 수정: F(패널 숨기기) 상태에서 패널 버튼 클릭이 타임아웃 → 선택적 컨트롤은
  `tryClick`으로 관용 처리(보드 상태이지 결함이 아니다).

단계 선택 UX(같은 세션에서 함께):
- `stepRangeFor` — 한 엔티티의 움직임은 **기하학에 순서가 박힌 체인**이므로 이웃 사이로만 재배치된다.
- 숫자키·StepBar 칩은 클램프되면 **가능한 범위**를 말하고(`simple.stepRange`), 피치 위 단계 피커는
  불가능한 단계를 **흐리게** 표시한다(숨기지 않는다 — 1~9 줄은 그대로 읽혀야 한다).

## CHG-20260822-156 — 램프는 자기 런 안에서 끝나야 한다 (넓힌 퍼즈가 잡은 마지막 불연속)

Trigger: 퍼즈를 **7200세션**(짧은 6000 × 12조작 + 긴 1200 × 40조작)으로 넓히자 남은 결함 1종이 드러났다.
시드 3051/5955/100584에서 20ms에 **0.84~0.98m** — 순간이동보다 작지만 예산을 넘는 실제 불연속.

Cause: 캐리 블렌드가 항상 `DRIBBLE_RAMP_S`(0.35초)에 걸쳐 진행되는데, **런이 그보다 짧으면** 런이 끝나는
순간에도 블렌드가 절반쯤에 머문다. 그런데 런 이후 '정지' 상태는 그 런의 **완성된** end-carry를 쓴다.
그래서 0.2~0.3초짜리 런이 끝나는 프레임에 공이 남은 거리를 한 번에 건너뛰었다.

Change: `carryAheadFor`가 `min(DRIBBLE_RAMP_S, 런 길이)`에 걸쳐 블렌드한다 — **램프는 자기 런 안에서
끝난다.** 구성상 연속이고, 램프보다 긴 런(사람이 그리는 모든 런)에서는 값이 완전히 동일하다.
`carryEnd`(캐리 면 고정) 블렌드 창도 같은 길이를 쓴다. 불변식 예산은 문서에서 **가장 짧은 런**을 보고
스윙 항을 계산한다 — 짧은 런은 실제로 더 빨리 스윙하므로, 그걸 찢김으로 신고하면 거짓 양성이다.

Validation: typecheck/lint/build/harness PASS, 252 tests PASS.

- `tacticFuzz` **7200세션 위반 0** (짧은 6000 + 긴 1200, 예시 시작 1/3 포함, 조작 19종 + undo/redo 되감기).
- 슬라이스 검증(seed 301~1000 / 100301~100440)도 0.
- `carrylook.cjs` — 직선 드리블 **1.90m 그대로**, 헤어핀 최대 0.59m/프레임으로 연속.

## CHG-20260822-157 — 퍼즈에 "구부리기는 국소적이다" 성질 추가

사용자가 검증 대상으로 명시한 **곡률 변화**를 조작 조합 아래에서 고정한다. `bendMoveWaypointInDraft`는
잡은 점과 그 양옆만 새 핸들을 받고, 나머지 waypoint는 위치·핸들·hold가 **바이트 그대로**여야 한다
(ADR-0010 R12-B). 양 끝은 파이프라인 소유이므로 제외한다(런 시작=토큰, 패스 양끝=공이 떠나고 멎는 곳).

퍼즈의 구부리기 지점이 현(chord) 위를 **랜덤하게** 이동하도록 바꿨다 — 항상 중점을 잡으면 waypoint가
3개를 넘지 않아 이 성질이 검사할 대상이 없다. 이제 반복 구부리기가 실제 다점 경로를 만든다.

비공허 확인: `bendMoveWaypointInDraft`가 멀리 있는 waypoint를 0.4m 밀도록 임시 개조 → 퍼즈가 3건 검출
(`bending moved a far waypoint …`). 원복 후 위반 0.

Validation: typecheck/lint/build/harness PASS, 252 tests PASS, 퍼즈 1500세션(짧은 1200 + 긴 300) 위반 0.

## CHG-20260822-158 — 도착 면 고정(핀) 브라우저 계약 프로브

`pw/receiveside.cjs` — 세션 19가 손댄 ADR-0010 D3 기능을 실제 조작으로 고정한다.

1. A→B 패스(B 정지) 후 **도착 고스트를 반대쪽으로 드래그** → 공이 그 자리에 멎고(-2.19,-1.40 = 끌어둔
   지점), **패스 끝점이 그 위치와 0.00m로 일치**한다(앵커와 재생이 같은 계산을 한다는 뜻).
2. 이어서 B가 **2단계에서 드리블** → 핀은 소진되고 공은 정면(+1.73,-0.80)으로 나간다.
3. 전 구간 최대 프레임 이동 **0.56m**(예산 0.91m) — 연속.

같은 단계(1단계)에서 뛴 런은 패스가 도착하는 순간 끝나므로 핀이 여전히 정지 위치를 뜻한다 —
프로브가 처음에 그 경우를 잡아 실패했고, 그게 규칙의 정확한 경계다.

## CHG-20260822-159 — 자동 저장 1칸 연결 (ADR-0009 Amendment v26)

Trigger: 사용자 — "자동 저장 하면 뭐가 좋아? 서버 필요 없이 쿠키만 이용하는건가? 예전에 설명하던
전술로 며칠 있다가 다시 접속해도 그대로 나와?" → 설명 후 **기본(지금 판 1칸)** 선택.

Change: `persistence.ts`에 있으나 **아무데서도 호출되지 않던** 자동 저장을 연결했다.

- `src/editor/autosave.ts` — `restoreCore()`(마지막 저장본 또는 null) / `attachAutosave(core)`
  (붙는 즉시 1회 저장 + 이후 변경마다 600ms 디바운스). 지속성 로직을 변형 세션 클래스 밖에 둔다.
- `App.tsx` — 부팅 시 복원해 A로 열고, **활성 코어가 바뀔 때마다** 다시 붙는다(칸은 눈앞의 판을 따라간다).
- `variantSession.ts` — RULE-05를 단언하던 주석 정정. 변형은 여전히 세션 한정.

Validation: typecheck/lint/build/harness PASS, **261 tests PASS** (신규 `autosave.test.ts` 9).

- 브라우저 `autosave.cjs` 9/9 — 보드가 새로고침을 넘어 동일하게 복원(선수·움직임·공 위치·홈 전부),
  되돌리기 기록은 초기화, **"새로 시작"이 진짜 초기화되고 다음 새로고침에도 안 돌아옴**,
  **깨진 칸은 깨끗한 판으로 열리고 앱이 계속 동작**.
- 무회귀: 브라우저 프로브 22종 전부 PASS. 마라톤은 세션마다 칸을 비우도록 고쳤다 — 안 그러면 세션이
  앞 세션의 보드를 물려받아 시드 재현성이 깨진다.

한계(설계상): 같은 기기·브라우저·프로필에서만 남는다(서버 없음). 시크릿 창, 사이트 데이터 삭제,
그리고 **Safari/iOS는 7일 미방문 시 자동 삭제**(ITP)에서는 사라진다. Chrome/Edge/Firefox는 유지.

## CHG-20260822-160 — 상황별 하이라이팅이 '누른 것'까지 답한다

Trigger: 사용자 — "공 클릭했을 때 하이라이팅 되는 설명도 있어야지? 선수 클릭했을 때 하이라이팅 되는
설명이나. 애니메이션 편집중일 때는 토큰 관련 설명 하이라이팅 하고."

Cause: cue 어휘가 **누르고 있는 키**(ctrl/alt/shift/space)뿐이었다. 그런데 사용자가 먼저 하는 질문은
"이걸 눌렀는데 이제 뭘 하지?"다. 그 상태들은 패널에서 아무것도 밝히지 않았다.

Change:
- `Cue`에 **선택 상태** 3종 추가: `ball`(공 선택) · `player`(선수 선택) · `path`(움직임 선택 또는 그리는 중).
  같은 앤티플리커 게이트를 탄다 — 겹친 곳을 반복 클릭하면 선수→고스트→경로로 순환하므로 선택도
  모디파이어만큼 빨리 바뀐다.
- `Binding.cue` → **`cues: Cue[]`**. 한 줄이 여러 상태에 속할 수 있다 — 흐린 토큰 Alt+드래그는
  Alt 제스처이면서 움직임 편집이기도 하다. 판정은 `isCued(b, active)` 한 곳.
- 태깅: 공 관련 3줄 → `ball` · '선수 클릭' → `player` · 흐린 토큰/경로 4줄 → `path` ·
  **Alt+드래그/Alt+클릭 → `['alt','ball','player']`** (뭔가 골랐으면 그게 다음 동작이니까).
- `Shift+잔디 드래그`를 compact로 올렸다 — `shift` cue가 보이는 줄을 하나도 안 밝히고 있었다(같은 결함).

Validation: typecheck/lint/build/harness PASS, **272 tests PASS**.

- 신규 `keymapCues.test.ts` 11 — **"모든 cue는 보이는 줄을 최소 하나 밝힌다"** 를 규칙으로 고정한다.
  보고된 결함이 정확히 그것(아무것도 안 밝히는 상태)이었으므로, 새 cue에 줄이 없거나 줄이 compact를
  잃으면 여기서 실패한다. 비공허 확인: 공 태그를 제거하니 3건 FAIL.
- 브라우저 `selcues.cjs` 10/10 — 실제 페이지에서 밝혀지는 줄 집합:
  · **공 클릭** → 공 휙 던지기 · 공 더블클릭+드래그 · Alt+드래그 · Alt+클릭 (4줄)
  · **선수 클릭** → 선수 클릭(편집) · Alt+드래그 · Alt+클릭 (3줄)
  · **움직임 선택** → 흐린 토큰 Alt+드래그·클릭 · 흐린 토큰 드래그 · 경로 클릭 · 경로 드래그 (4줄)
  쉴 때 0줄, 선택 해제하면 0줄로 복귀, 토큰을 타다닥 눌러도 점멸 없음. 세 집합이 서로 다름 —
  전부 밝히는 패널은 아무 말도 안 하는 패널이므로 그것도 검사한다.
- `cues.cjs`의 "쉴 때 아무것도 안 밝다" 전제가 낡아 실패했다(앞 단계에서 선택이 남아 있었다).
  전제를 고쳐(선택 비우고 측정) 모디파이어 동작은 그대로임을 확인 — 앱 회귀가 아니었다.

## CHG-20260822-161 — 순간 문법: 클릭=주어, Alt+클릭=목적지 (ADR-0009 v27 / ADR-0010 D9)

Trigger: 사용자, 사진 3장 — "Alt 경로 그리기가 너무 복잡하고 실제로 틀린다": (1) 1단계 고스트를 찍었는데
2단계 끝으로, (2) 시작 지점을 찍었는데 1단계 끝으로, (3) 마지막 고스트를 클릭하면 안내선이 안 나옴.
"단축키 설명만 봐도 2배. 단순하고 사용하기 편리하게, 구조적으로 무결점하게."

Cause (전부 재현 — `pw/altcases.cjs` + 유닛 트레이스):
- 찍은 지점이 **어디에도 저장되지 않았다**. 도착점 = deriveTimings(단계 창 강제) × 리시버 4중 추측
  (홈/마지막위치 셋이 거기 없는 선수를 명명) × 앵커 루프(도착 시각의 리시버 위치로 끝점 이동)의
  고정점 — 즉 **리시버의 최종 위치**. (16,46) 조준 → (33.3,28.7), 22m 슬라이드를 유닛으로 확정.
- 사진 1 잔여: 고스트 press가 자기 continuation 시작점(entityRestPos=엔티티 최종 위치)을 착지
  목적지로 재사용 — 브라우저에서만 4.84s/2단계 끝으로 가던 미스터리의 정체.
- 사진 2 잔여: beautify 축 스냅(7°)이 클릭 지점을 1.7m 이동.
- 사진 3: 주어 상태 3벌(엔티티 선택/세그먼트 선택/aim 무장)이 서로 어긋남 — 고스트 클릭은 세그먼트만
  선택해 Alt의 주어가 없었다.

Change:
- **스키마(additive)**: travel `target?: {entityId, step}` — 목적지 순간. validate 포함.
- **editor**: `momentSpotAt`(미래 지점 2.5m), addStepPass가 끝점에서 target 유도(클릭·드래그 공용),
  syncThroughBall은 target으로 **정확 동기화**(늘리고 줄임), 리시버 해석은 **도착 시각 물리 후보만**,
  파이프라인 0단계가 죽은 target 정리, addStepRun 후크는 target 지정으로.
- **UI**: aim 무장 상태 전면 삭제(선언·Escape·pointerdown 분기·렌더·i18n). `deriveSubject` 하나로
  주어 유도 — 엔티티 선택 또는 선택된 움직임의 엔티티(공 travel이면 그 순간까지). 착지 목적지는
  pressPt(누른 지점). 두 점 클릭 착지는 beautify 미적용. 안내 문구 절반(클릭/Alt+클릭/Alt+드래그/
  흐린 토큰 드래그).

Validation: typecheck/lint/build/harness PASS, **280 tests PASS** (`destinationMoment.test.ts` 8 신규).

- `pw/altcases.cjs` — 3케이스 전부 의도대로: 고스트 조준 → (33.3,28.7)/t2.41(그 순간의 정션),
  시작 조준 → **(16,46) 그대로**·리시버 없음, 마지막 고스트 클릭 → 안내선 정상(선택 해제 후에도).
- tacticFuzz `passToMoment` 조작 추가, **1800세션 위반 0**. 프로브 17종 전부 PASS(무장 단언 4종은
  선택 모델로 갱신). 마라톤 별도 실행.

## CHG-20260822-162 — 순간 문법 후속: 주어 유지·연속 클릭·캐리 잔상 클릭·안내선 정리·라인 밖

Trigger: 사용자, 사진 2장 + 4개 지적 (2026-08-22).

1. **착지 후 주어가 리시버로 바뀜(사진 1)** — 고스트 press가 pointerdown에서 눌린 엔티티를 선택하므로,
   패스를 얹은 직후의 Alt+클릭이 **리시버의 런**을 그렸다. → `finishDraw`가 끝에서 **움직인 엔티티를
   다시 선택**한다: 방금 움직인 것이 다음 클릭의 주어다.
2. **캐리 잔상 클릭 불가(사진 2)** — 캐리 공 고스트의 plain 클릭은 orbit-carry 제스처가 무드래그로
   끝나며 **아무 일도 안 했다**. → 클릭이면 공을 선택하고 그 순간을 기록한다(`moment`를 제스처에 실어
   릴리즈에서 커밋 — press에서 쓰면 드래그로 변할 때 낡은 순간이 남는다). 슛이 **실려 간 지점**에서
   나간다. 공 토큰을 던지거나 옮긴 뒤에도 moment가 새 시작점을 따라간다(두 커밋 지점).
3. **Alt 유지 연속 클릭** — draw-chain이 landFor 없이 startDraw만 해서 클릭이 죽었다. → grass press
   표시(`grassPress`)와 landFor를 실어, 같은 엔티티라도 잔디 클릭이면 착지한다. Alt 누른 채
   클릭 3번 = 1, 2, 3단계.
4. **이전 위치 잔상 깜빡** — `aimTo`가 Alt 해제 후에도 남아 다음 hold 첫 프레임에 옛 커서로 선이
   그어졌다. → Alt가 아니면 `aimTo`는 null.
5. **안내선 디자인** — 커서 점(aimTip) 삭제. 주어 3.2m 안 = **준비 할로**(`aimReady`, 실선 — 드래그
   직전 상태)·선 없음, 멀면 점선만. 드래그와 클릭이 시각적으로 갈린다. 디자인 가드의 엔티티 마크
   목록에서 aimTip→aimReady 교체.
6. **라인 밖 클릭** — intent 게이트가 정확히 라인이었다. → PITCH_MARGIN_M(2m)까지 허용; 모든
   목적지는 같은 마진으로 클램프되고 골문 통과는 기존 net 절단이 막는다.

Validation: typecheck/lint/build/harness PASS, 280 tests PASS, 퍼즈 360세션 0.

- 신규 `pw/flow.cjs` 10/10 — 사진 1(착지 직후 Alt+클릭 = **공의 2번째 패스**, #1 런 증가 없음),
  사진 2(캐리 잔상 클릭 → 공 선택 → 슛이 (57.9,25.7) 캐리 지점에서), Alt 유지 3클릭 = [1,2,3],
  신선한 hold에 선 없음, 원거리 = 선·점 없음, 근거리 = 할로·선 없음, 라인 1.2m 밖 착지.
- 프로브 21종 전부 PASS (aimAnchor 단독 셀렉터 7종을 aimReady 포함으로 확장 — 표현 클래스 분화).

## CHG-20260822-163 — 경로 있는 공은 던져지지 않고 '놓인다'

Trigger: 사용자 — "공만 경로 지정했을 때 공이 초기 위치에서 그냥 집어서 옮겨지는 게 아니고 던져지거나
순간이동 돼. 경로가 있을 때는 그런 기능을 막고 선수처럼 커서랑 같이 이동돼야지."

Cause: 소유자 없는(루즈) 공은 드래그 중 `ball.home`만 갱신되는데, 패스가 있으면 화면은 **패스 시작점**을
그린다 → 커서 아래에서 공이 안 움직이다가 릴리즈에 한 번에 스냅(순간이동). 그리고 릴리즈 속도가 빠르면
플링 시뮬이 발동(던짐) — 이미 다음 움직임이 저작돼 있는데도.

Change:
- 드래그 중: 루즈 공 + 경로 → `moveBallStartInDraft`를 **라이브로** 호출(드롭 커밋과 같은 코드) —
  패스 시작점이 손을 따라온다. 실측: 커서 (40,50)에 origin (40,50) 정확 일치.
- 릴리즈: **authored 경로가 있는 공은 플링 금지** — 배치만. 경로 없는 공은 종전대로 굴러간다
  (52.5→88.8 확인). 더블클릭 슬링은 명시적 제스처라 그대로.

Validation: typecheck/lint/build PASS, 280 tests PASS. 신규 `pw/balldrag.cjs` 4/4, 프로브
(fling/flow/colors/orbit/ballrest) 무회귀. 직전 마라톤의 4건 실패는 편집 중 HMR 순간의
`findTrack is not defined` 아티팩트 — 안정 빌드 재실행으로 확인.

## CHG-20260822-164 — 주어 우선순위: 가장 최근 지명이 이긴다

Trigger: 사용자 — (1) "다른 선수 Alt 작업하다가 공 클릭하고 Alt 누르면 공이 아니라 이전 선수 경로가
나온다", (2) "공만 1단계 경로 있을 때 1단계 이후 공을 클릭해도 0단계 공이 움직이고, 한 번 더 클릭해야
그때 움직인다".

Cause: `select()`는 세그먼트 선택을 지우지만 `selectSegment()`는 엔티티 선택을 **남긴다**. 그래서 둘 다
서 있으면 세그먼트가 반드시 더 최근 지명인데, `deriveSubject`는 엔티티를 먼저 읽었다 — 고스트/경로
클릭이 주어 결정에서 조용히 무시됐다. (1) 선수 선택이 남은 채 공 잔상을 클릭 → 주어는 여전히 선수.
(2) 라이브 공 클릭(0단계 순간)이 남은 채 1단계 이후 잔상을 클릭 → 주어는 여전히 0단계 공, 두 번째
클릭의 순환에서야 교정.

Change: `deriveSubject` 우선순위 반전 — **세그먼트가 서 있으면 그것이 주어다**(더 최근 지명이므로).
엔티티 선택은 세그먼트가 없을 때만.

Validation: typecheck/lint/build/harness PASS, 280 tests PASS. 신규 `pw/subject.cjs` 6/6 —
선수 작업 후 라이브 공 클릭 → 안내선이 공(찍은 순간)에서(선수 rest (40,26)에서 6m 이상 떨어짐),
공 잔상 클릭 → 그 순간에서, 공-단독 보드에서 **한 번** 클릭으로 1단계 이후 순간 재지정(새 패스가
(75,34)/2단계에서 출발, 0단계에서 22.5m). 프로브 24종 전부 PASS.

## CHG-20260822-165 — 멈춘 프레임은 저작 컨텍스트다: 단계 2~9 미리보기에서 배지·버튼 유지

Trigger: 사용자 — "단계 바에서 1이 아니라 2~9를 선택하면 단계 안내 배지나 버튼이 다 사라져.
항상 보이게 해줘."

Cause: `viewingFrame = isPlaying || t > 0` — 단계 칩이 그 단계의 시작 프레임으로 재생 헤드를 옮기는데
(단계 1만 t=0), t>0이면 "프레임 보기"로 간주돼 저작 장식(배지·고스트·단계 피커)이 페이드아웃되고
호버·고스트 픽까지 죽었다. 단계 바가 방금 가리킨 컨트롤을 그 자리에서 잠근 셈.

Change: `viewingFrame = isPlaying` — 장식 페이드와 경로 past/active/future 조광은 **실제로 움직일 때만**.
멈춘 프레임(단계 미리보기·일시정지·결과 유지)은 저작 컨텍스트다. 안전한 이유: 모든 press 경로가
`returnToAuthoringStart`로 복귀하므로 멈춘 프레임의 상호작용은 언제나 저작 프레임 기준으로 착지한다.
부수 효과(의도): 미리보기 중에도 A-05a 휴식 조광(현재 단계 밖 경로 감쇠)이 적용되고, 고스트 픽·호버가
살아 있다.

Validation: typecheck/lint/build/harness PASS, 280 tests PASS. 신규 `pw/stepframe.cjs` 6/6 —
단계 2 클릭 후 t=2.57 프레임에서 배지 2·고스트 2 전부 표시(hidden 0), **재생 중에는 종전대로 페이드**
(hidden 3). 프로브 25종 전부 PASS.

## CHG-20260822-166 — 받은 공도 같은 드래그 문법 + 선수가 루즈 공을 가져간다

Trigger: 사용자 — (1) "0단계 공은 링 밖으로 끌면 분리되고 소유가 사라지는데, 1단계 리시버 쪽 공은
360도 돌기만 하고 소유권 뺏김도 없다." (2) "공을 선수 쪽으로 가면 빨려붙는데 왜 선수를 공 주위로
가져가면 안 붙지? 의도된 거면 이유가 뭐고, 아니면 붙게 하는 게 어떤지 판단해달라."

판단(2): 기록된 의도 없음 — 공→선수 부착(ADR-0010 D5)만 구현됐고 반대 방향은 만들어진 적이 없다.
비대칭을 없애되 가드 2개: **단일 선수 드래그만**(그룹/대형 이동은 절대 못 뺏음 — 오착의 실제 위험이
그룹 이동이므로), **루즈 공만**(소유 중인 공을 뺏는 건 명시적 공 드롭 제스처로만).

Change:
1. **orbit-receive에 분리(detach) 추가** — 0단계 공과 동일한 링·히스테리시스(3.4/2.9m). 링 안 = 캐치
   면 선택(기존), 링 밖 = 패스 끝이 손을 따라오고, 놓으면 그 자리 기준으로 **순간(target)·리시버
   재유도** — 잔디에 놓으면 소유권이 사라진다. 커밋 순서 중요: 낡은 receiver를 단 채 relayout을 먼저
   돌리면 도착 앵커가 끝점을 도로 리시버에게 스냅한다(프로브가 잡음) → 재유도 후 relayout.
2. **선수→루즈 공 자동 부착** — 같은 반경(ATTACH_RADIUS_M), 접근 중 **공이** 하이라이팅(끌리는 선수는
   이미 선택 표시라 신호가 안 됨), 릴리즈에 소유 + 부착 FX·토스트.

Validation: typecheck/lint/build/harness PASS, 280 tests PASS, 퍼즈 360세션 0.

- 신규 `pw/takeaway.cjs` 9/9 — 받은 공을 링 밖으로 끌어 잔디에 드롭: 분리 링 표시, **#2 리시버 해제**,
  패스 끝 (80,55) = 드롭 지점. 선수를 공 옆에 끌면 공 하이라이팅 + 릴리즈에 소유. **그룹 드래그로 공
  옆에 놓아도 절대 안 뺏김**. 프로브 26종 전부 PASS.

## CHG-20260822-167 — 리시버의 다음 런은 캐치 후가 기본, 패스 끝점은 저작자의 것

Trigger: 사용자, 사진 2장 — "#1이 n단계(≥2)로 캐리 후 #5에게 패스, #5가 받고 나서 Alt로 이동을
그리면 공 경로가 #5의 마지막 단계로 수정된다. 전부 자동 계산이라 이런 의도치 않은 오류는 절대 안 됨."

Cause (유닛 재현): #5의 새 런이 **1단계**로 자동 배정됐다 — `lastAuthoredStep`은 본인 움직임만 세고
**받는 것**은 안 셌다. 1단계 런이 패스(3단계)보다 먼저 끝나니 도착 시각에 #5는 런 끝에 있고, 도착
앵커가 패스 끝을 그리로 20m 끌고 갔다 ((85,30)→(101.6,18.9)).

Change:
1. **`lastReceivedStep`** — 받는 것도 참여다(공의 `lastBallMovedStep`와 대칭). 리시버의 다음 런 기본
   단계 = max(자기 체인, **캐치 단계**)+1. 재현 케이스: 1 → **4단계**, 패스 끝 그대로, 시각도 순차.
2. **도착 앵커의 정직성** — 앵커는 캐치를 캐리 링 위에 놓는 cm 단위 보정이다. 도착 시각에 리시버가
   그린 끝점에서 RECEIVE_RADIUS(3.5m)보다 멀면 **끝점을 끌지 않고 리시버를 해제**한다(공은 찍은 곳에
   루즈로 떨어짐). 명시적 재단계(캐치 전 런을 일부러 만들 때)의 탈출구이자, 어떤 편집 조합에서도
   패스가 말없이 재경로되지 않는 보증. target 있는 패스는 도착이 그 순간에 동기화되므로 예외.

Validation: typecheck/lint/build/harness PASS, **284 tests PASS** (`receiverRun.test.ts` 4 신규 —
기본 4단계 / 명시적 1단계 강등 시 un-receive + 끝점 유지 / 멱등 / 캐치 후 런은 리시버 유지).
퍼즈 1200세션 위반 0, 프로브 11종 재검 전부 PASS(takeaway 1건은 하이라이트 샘플 타이밍 플레이크 —
재실행 PASS).

## CHG-20260822-168 — 안내 문구 평어화 + 재생 버튼 배속 스크럽

Trigger: 사용자 — (1) "단축키 설명이 과해. '토큰'이 뭔지 사용자는 모르고 괄호 안 내용은 불필요.
풀어 쓰되 주저리 말고 최적화." (2) "Space 꾹을 N배속으로 — N은 재생 버튼을 잡고 좌/우 드래그로
0.5/2/3 선택. 애니메이션은 애플처럼 통통 튀게."

Change 1 — 문구:
- 전문어 "흐린 토큰" → 사용자 본인이 쓰는 말 **"잔상"** (안내판·투어·테스트·프로브 일괄).
- 괄호 부연 전부 삭제: "(경계선 튕김…)", "(선수→고스트→경로 순환)", "(스루패스)", "(공은 그보다
  더 나감)", "(고른 대상이 다음 Alt의 주인공)" 등.
- 남은 문장 압축: "클릭 / 움직일 대상 고르기 — 선수·공·잔상 어디든", "Alt+클릭 / 고른 대상이 찍은
  곳까지 — 잔상을 찍으면 그 타이밍에 맞춰 도착", "경로 드래그 / 당겨서 곡선으로 휘기" 등.

Change 2 — 배속 스크럽:
- `BOOST_FACTORS = [0.5, 2, 3]`, uiStore `boostFactor`(기본 3). Space 꾹 = NORMAL × 선택 배속
  (0.5 = 슬로모 홀드). 해제 시 정상 복귀.
- 재생 버튼 포인터 드래그: 10px부터 스크럽 시작(클릭은 클릭으로), 44px당 한 칸, 손 밑 칩이
  드롭 스프링(`--st-spring-drop`, 오버슛)으로 **부풀며**(scale 1.22) 이동 — 칸마다 "톡" 하는 손맛.
  릴리즈 420ms 후 줄이 사라져 선택이 눈에 남는다. reduced-motion 존중.
- 옵션 줄은 바 **바깥** fixed 렌더 — 바의 overflow-x가 세로도 자르고 backdrop-filter가 fixed의
  containing block이 되므로 안에서는 어떤 포지셔닝도 잘린다(스크린샷으로 확인 후 이동).
- boosted 판정 `speed !== NORMAL`로 정정(0.5 홀드도 상태 표시). 버튼에 `data-boost-factor` 노출.

Validation: typecheck/lint/build/harness PASS, **285 tests PASS** (AppShell 스크럽 1 신규).

- 신규 `pw/speedscrub.cjs` 9/9 — 왼쪽 두 칸 슬라이드 → 0.5(중간에 2× 칩 점등 확인), 스크럽은
  클릭 아님(재생 토글 안 됨), **Space 꾹 = 0.75(=1.5×0.5) 실측**, 해제 1.5 복귀, 오른쪽 슬라이드
  3 복귀, 일반 클릭은 재생.
- selcues/cues/flow/subject/identity/overhaul 무회귀. 스크린샷: 옵션 줄이 버튼 위에 온전히 표시.

## CHG-20260822-169 — 왼쪽 패널(CTRL·재생) 문구 압축

Trigger: 사용자 — "여기도 설명 최적화 해줘" (CTRL 단축키·재생 카드 스크린샷).

- `Space` 힌트: "재생 / 일시정지" → **"재생·일시정지"** — 한 쌍의 동작이지 빗금으로 가른 두 대안이 아니다.
- `Space 꾹`: 3줄로 감기던 문장 → **"누르는 동안 배속 재생 — 배속은 ▶ 좌우 드래그"** 한 줄.
- `F`: "패널 숨기기 / 되돌리기" → **"패널 접기·펴기"** — 바로 위 Ctrl+Z의 "되돌리기"와 단어가 충돌해
  다른 낱말로 교체.

Validation: typecheck/lint/build PASS, 285 tests PASS, cues/selcues 프로브 PASS.

## CHG-20260822-170 — 토스트는 실제 착지 단계를 말한다

Trigger: 사용자, 사진 — "5번이 공 받고 침투하는 4단계를 추가했는데 '1단계에 추가됨'이라고 나와."

Cause: `finishDraw`의 토스트가 UI 지역변수 `step`(칩 값 1)을 읽었다. 커맨드는 안에서 단계를 밀어
올린다(자기 체인 +1, **캐치 단계 +1** — CHG-167) — 4단계에 착지했는데 토스트는 낡은 1을 말했다.

Change: 커맨드가 만든 세그먼트를 문서에서 되읽어 **착지 단계**로 토스트한다. 지그재그 체인의 다음
단계 계산도 같은 값 기준.

Validation: typecheck/lint/build PASS, 285 tests PASS. 신규 `pw/toaststep.cjs` 2/2 — 사진 재현
(캐리 2단계 → 3단계 패스 → #5 런): 런 4단계 착지 + 토스트 "**4단계에 추가됨**". steps/flow/subject/
midghost/aimclick 무회귀.

## CHG-20260822-171 — 재생 카드: 접히는 힌트 제거, 전 줄 한 줄 정렬

Trigger: 사용자 — "디자인이 조화롭지 않아. 들여쓰기가 됐잖아" (Space 꾹 줄이 키캡 아래로 접혀
들여쓰기처럼 보임).

Cause: 키캡 인라인 배치에서 힌트가 접히면 이어지는 줄이 키캡 폭만큼 들여져 카드의 "왼쪽 모서리
하나" 규칙이 깨진다.

Change: `Space 꾹` 힌트를 **"배속 재생"** 한 줄로. 배속 선택법은 제스처 전용 줄로 분리 —
**"▶ 좌우 드래그 / 꾹 배속 선택 — 0.5 · 2 · 3"** (제스처가 원래 쓰는 스택 레이아웃이라 모서리 정렬).
스크린샷으로 전 줄 한 줄 확인.

Validation: typecheck/lint/build PASS, 285 tests PASS (AppShell 단언을 "힌트는 짧다 + ▶ 줄 존재"로
갱신), cues 프로브 PASS.

## CHG-20260822-172 — 잔상 위에 공 드롭 = 그 순간부터 픽업

Trigger: 사용자 — "1번 선수가 2단계까지 뛰는 상황(공 미소유)에서, 공을 1단계 직후 잔상 위로 드래그해
호버하면 하이라이팅되고 거기 둘 수 있게 — 이건 안 될까?"

Change: 됩니다 — 문서 모델로는 "**그 순간부터 소유**":
- 드래그 중 잔상 반경(ATTACH_RADIUS) 안이면 그 선수 하이라이팅. 릴리즈하면 공은 그 지점에 **루즈로
  대기**하고, 선수의 그 런이 도착하는 순간 possessed(런 끝에 afterSegment 체인)로 픽업 — 이후 다음
  런들이 그대로 캐리. 재단계에도 픽업이 런을 따라간다. 라이브 선수가 겹치면 라이브 우선, 공에 이미
  경로가 있으면 일반 이동 유지. 토스트: "{s}단계에 도착하면 #{n} 공 보유".
- **파이프라인 결함 발견·수정**: 0단계의 afterSegment 재체인이 **공 트랙 내부 id만** 검사해, 선수
  런을 참조하는 트리거를 t=0으로 되돌려 썼다(공이 킥오프부터 들려 감). 참조 검사를 씬 전체 트랙으로
  확장.
- **연속성**: 픽업 순간 공이 발밑에서 정면 캐리로 1.9m 스냅 → possessed에 잠긴 오프셋 (0,0)을 줘
  발밑에서 램프로 이어지게(B1). 실측 1.9 → 0.39m/frame.

Validation: typecheck/lint/build PASS, 285 tests PASS, 퍼즈 960세션 0. 신규 `pw/pickup.cjs` 9/9 —
호버 하이라이팅, 토스트, 도착 전 루즈 대기(그 지점), 도착 후 소유, 2단계 끝까지 캐리, 전 구간 연속.
공 흐름 프로브 10종 무회귀.

## CHG-20260822-173 — 링 문법 완전 통일: 소유된 공은 어디서 잡든 같다

Trigger: 사용자 — "그 지점이 아니라 선수 주위로 안 겹치게 나와야지. 그리고 모든 곳에서 동일하게 —
링 안은 각도만, 특정 거리 지나면 소유 박탈 + 잔디. 지금은 0단계일 때만 그렇잖아. 한 번 할 때 제대로."

Change — 링 규칙이 이제 소유된 공의 **모든** 잡기 지점에서 동일하다:
1. **캐리 잔상(orbit-carry)에 분리 추가** — 마지막 남은 구멍. 링 안 = 캐리 면만(소유 유지),
   링 밖 = 공이 손을 따라오고(분리 링 표시), 잔디에 놓으면 **그 순간부터 소유 박탈**: 공이 발밑에서
   드롭 지점으로 **굴러가서**(루즈 롤 travel — 순간이동은 B1 위반, 첫 시도에서 25m 텔레포트를 프로브가
   잡아 롤로 교체) 눕는다. 이후 공이 하려던 일은 덮어써짐(ADR-0009 v25). 토스트로 안내.
2. **픽업 대기 공은 링 위에** — 잔상과 겹치지 않게, 놓은 방향의 캐리 링 지점에 대기. possessed의
   잠긴 오프셋도 같은 링 지점이라 캐치가 그 자리에서 블렌드.
3. **픽업 유효성은 파이프라인이 지킨다** — 대기 공을 정션에서 ATTACH 반경 밖으로 옮기거나 공이
   킥오프 소유자를 얻으면 픽업 소유가 제거된다. 어떤 편집 경로로 오든.

Validation: typecheck/lint/build/harness PASS, 285 tests PASS, 퍼즈 960세션 0.

- `pw/carrydetach.cjs` 9/9 신규 — 링 안 오빗: 끝까지 소유 유지 / 링 밖 드롭: 1단계까지 캐리 →
  이후 무소유, 드롭 지점에 안착, 전 구간 연속 0.33m/frame.
- `pw/pickup.cjs` 갱신 — 대기 위치가 잔상에서 **2.09m**(링 위), 연속 0.28m/frame.
- 공 흐름 프로브 12종 전부 PASS.

## CHG-20260822-174 — 소유 경계 링을 모든 상태에서 동등하게 보이게

Trigger: 사용자 — "소유 박탈해도 다음 시점에서 여전히 소유돼 있고, 초기 위치에서만 점선 경계가
보인다. 뭐가 문법이 한 벌이냐."

진단 (재현 시도 2경로 + 미드-드래그 스크린샷):
- **소유 잔존은 현재 빌드에서 재현 불가** — 초기-캐리 경로(3런, 정션1 박탈: 이후 잔상 소멸·55/80/100%
  전부 무소유)와 받은-공 경로(패스→리시브→2캐리, 캐치 잔상 박탈: 이후 잔상 소멸·무소유·드롭 지점
  안착·0.56m/frame) 둘 다 정상.
- **진짜 뿌리는 링 비가시성**: 분리(Out) 상태 링이 **22% 흰색 + 0.4px 대시** — 사실상 안 보였다.
  초기 위치에선 링 안(75%)에서 시작해 진한 링을 먼저 보니 "된다"고 느끼고, 정션에선 바로 빠져나가
  경계를 못 봤다. 경계가 안 보이면 링 **안**에 놓고도 밖에 놓았다고 여긴다 — "놓았는데 여전히 소유"의
  가장 유력한 정체.

Change: 두 상태 동일 무게 — 잡힘 = 대시(0.9/0.6, 85%), 분리 = **점**(0.3/0.55 round, 80%), 굵기 0.22
동일. 리듬만 다르고 가시성은 같다.

Validation: typecheck/lint/build PASS, 285 tests PASS. 신규 `pw/recvtakeaway.cjs` 6/6(받은-공 경로
계약), ringrepro 미드-드래그 스크린샷으로 링 선명 확인, 링 관련 프로브 8종 무회귀.

## CHG-20260822-175 — 루프스테이션: Alt 없는 유령 경로·링 부재·하이라이팅 부재의 진짜 뿌리 3개

Trigger: 사용자 — "소유된 공 클릭→다시 클릭+드래그로 소유권 밖에 뒀는데 Alt 없이 경로가 그려진다.
소유권 안내 점선도 안 생긴다. 공을 선수한테 들이밀어도 하이라이팅이 안 된다. 구조적으로 처음부터
로그/플래그 세워가며 다 확인해라. 루프스테이션 돌려라."

계측(신규 dev 플래그): `__stIntentLog`(포인터다운마다 intent+수식키+픽), `__stFlags`(제스처·링·
dropTarget 라이브), `__stValidate`(라이브 문서 스키마 검증). 이 로그로 사용자 플로우 6변형(V1~V6)
+ 잔상 경로(A/B) 전수 재현.

진단 — 재현 확정 3건:
1. **"Alt 없이 경로"의 정체**: 빼앗기 드롭이 쓰는 loose-roll travel이 **배지 달린 경로 라인**으로
   렌더됐다. draw 계열 intent는 전 변형에서 Alt 없이 절대 발화 안 함(로그 증명) — 그려진 건 결과
   세그먼트였다.
2. **하이라이팅/건네기 공백**: orbit-carry/orbit-receive의 분리(detached) 드래그에는 선수 위
   하이라이팅이 없었고, 선수 위 드롭도 소유 이전 없이 발밑에 loose로 굴렀다.
3. **링 타이밍**: 링이 첫 이동 후에야 그려짐 — 잡는 순간에는 안내가 없었다.
   (+ V4: 재생 종료 후 보드가 마지막 프레임에 머물러 시작 위치 클릭이 marquee가 됨)

Change:
- **`implicit` 플래그(additive 스키마)**: 빼앗기 롤은 재생 연속성용 결과 세그먼트 — 라인·배지·픽·
  스텝바·stepCounts에서 제외, 잔디 위 공 잔상은 유지. 수신자가 붙는 순간 implicit 해제(진짜
  패스로 승격). validateDocument에 불리언 검증.
- **분리 드래그의 건네기 문법 통일**: 두 orbit 모두 분리 중 ATTACH 반경 선수 하이라이팅;
  orbit-carry 드롭은 그 선수에게 **패스(receiverId)**로 건네기(빼앗기는 선수 자신은 제외 —
  링이 이미 "유지"를 뜻함), orbit-receive는 기존 retarget. 토스트 `ball.givenAt`.
- **링은 잡는 순간부터**: 소유 공 3개 grab 지점(초기 held·정션 캐리·캐치) 모두 pointerdown 즉시.
- **Escape가 시계도 중립으로**: 재생 종료 프레임에서 Escape 시 authoring start 복귀.

Validation: typecheck/lint/build/harness PASS, 288 tests(신규 implicitRoll 3). 프로브: repro1
13/13(V1~V6), repro2, repro3 6/6, repro4 8/8(링 즉시·receive 건네기·연속성), loopstation 19/19
(특이 6상황: 자기 자신 드롭·마지막 정션·Escape 취소·undo/redo·안착 재드래그·안착發 Alt), marathon
450제스처 10세션 0실패(신규 불변식: 스키마 상시 검증·Alt 없는 draw intent 금지·implicit+receiver
동시 금지, 신규 제스처 ballGhostOut/ballGhostToToken), 링·광역 프로브 16종 무회귀.

## CHG-20260822-176 — 드롭 약속 문법: 모든 단계·모든 잡기에서 링+하이라이팅, 시간-정직

Trigger: 사용자 — "초기상황 제외한 다른 단계의 선수한테는 소유/박탈 원형 점선이 안 나온다. 공을
선수 주위로 가져가도 하이라이팅이 안 된다 — 잡은 공이 바닥에 놓일지 누구 소유가 될지 모르겠다.
수백·수천번 마라톤 돌려서 의도 반하는 것·해석 어려운 것 다 개선해라."

진단: 힌트가 (1) 선수의 **시작 토큰(home)만** 후보로 봤고 — 이후 단계의 선수 위치(잔상)는 무시,
(2) bend 계열 공 드래그(수신자 없는 패스 끝 잔상)에는 힌트 코드가 아예 없었고, (3) 시간을 무시해
이미 떠난 선수의 홈 토큰에 건네기를 약속했다(도착 앵커가 정직하게 un-receive → "줬는데 안 가짐").
스테이지힌트 매트릭스(4 잡기 × 3 타깃)로 전부 재현 후 수정.

Change:
- **`dropCandidateAt` 단일 유도**: 라이브 토큰 우선, 다음 momentSpotAt(이제 pos 반환; 저장되는
  target에는 pos 제거) — 공 드래그 4경로(시작 공·orbit-carry·orbit-receive·bend 끝) 전부 이것
  하나로 힌트·커밋이 항상 일치.
- **드롭 약속 시각화**: 후보 지점에 ATTACH 반경 `giveRing`(대시 = 소유 문법, 160ms in), 라이브
  토큰 하이라이팅 + 단계 잔상 글로우(`data-drop-hint`), endGesture에서 일괄 해제.
- **시간-정직 (`dropStep`)**: 드롭이 단계 s에 떨어질 때 첫 런이 s 이하인 선수의 홈 토큰은 후보
  제외(빈 과거 지점) — 그 선수의 "그 시점 위치"는 정션 잔상이 이미 제공. orbit-carry 모멘트
  후보는 minStep(뺏은 순간+1)도 유지 — 이미 지나간 스팟은 약속 안 함.
- **orbit-carry 커밋 3분기**: 라이브 = receiverId 패스 건네기 / 단계 잔상 = implicit 롤 + 링
  대기 + afterSegment 픽업(도착 시 소유) / 잔디 = implicit 롤. bend 커밋은 momentSpotAt→target
  + resolvePassReceiver(순간 지정 패스로 승격).

Validation: typecheck/lint/build/harness PASS, 288 tests. `pw/stagehint.cjs` 18/18(매트릭스 계약:
힌트=링+글로우=커밋 일치, S3b/S8 시간-정직 무약속, 전 케이스 연속성+스키마 0), 링·공 프로브
12종 + 광역 10종 무회귀, marathon 1800제스처(30세션) 0실패.

## CHG-20260822-177 — 링 시각 언어 통일 (반경 차이는 히스테리시스로서 의도 유지)

Trigger: 사용자 — "0단계 초기 상태의 하이라이팅 링이랑 다음 단계 흐릿한 토큰의 링이 왜 다르게 생겼지?"

진단: 반경 차이(뺏김 3.4 / 소유 2.7)는 히스테리시스라 의도지만, 그 위에 스타일 불일치가 겹쳐
있었다 — giveRing이 carryRing보다 미묘하게 굵고 밝았고(0.24/90% vs 0.22/85%), 잔상 힌트에는
호버 언어인 색깔 실선 halo가 덧씌워져 라이브 토큰의 "조각이 도톰해지는" 선택 언어와 어긋났다.

Change: giveRing 스트로크를 carryRing과 동일하게(0.22, 85%, 대시 0.9/0.6); 잔상 힌트의 색 halo
제거, 대신 `.ghostDropLift` — 선택된 라이브 토큰과 같은 언어(테두리 두꺼워지고 그림자, 1.12배).
halo는 호버 전용으로 복귀. 반경 차이는 유지: 나가는 문턱(3.4) > 들어오는 문턱(2.7).

Validation: typecheck/lint/build PASS, 288 tests, stagehint 18/18 + repro3/4·pickup·loopstation·
selcues 무회귀, 스크린샷으로 두 지점 시각 언어 일치 확인.

## CHG-20260822-178 — 소유 링 반경 통일: attach = detach = 3.4 (거짓 구간 제거)

Trigger: 사용자 — "이미 소유한 공을 잡았을 때 하이라이팅 원 크기가 초기 위치랑 다른 위치랑 다르다."

진단(실측): 소유-경계 링 자체는 세 잡기 지점(초기·정션·캐치) 모두 정확히 3.4m 동일. 차이의 정체는
**잡은 공 자리의 링(뺏김 경계 3.4) vs 다른 지점에 뜨는 드롭-약속 링(attach 2.7)** — 한 문법에 두
크기. 게다가 attach(2.7) < 그려진 경계(3.4)라서 2.9~3.4m 구간은 링 **안**에 놓았는데 loose가 되는
거짓 구간이었다.

Change: `ATTACH_RADIUS_M` 2.7→3.4, `CARRY_DETACH_M = ATTACH_RADIUS_M` (단일 소스). 점선 링은
어디서나 한 크기 — 안에 놓으면 소유, 밖으로 끌면 박탈. 드래그 중 재부착 문턱(2.9)만 보이지 않는
히스테리시스로 유지. RECEIVE_RADIUS_M(3.5) ≥ 3.4라 수신 해석과도 정합.

Validation: typecheck/lint/build/harness PASS, 288 tests, 프로브 13종(stagehint 18/18 포함) 전부
PASS, ringsize 실측 3지점 3.4 동일, marathon 450제스처(10세션) 0실패.

## CHG-20260822-179 — 결과 롤은 원인과 함께 죽는다 (공 2개 버그)

Trigger: 사용자 — "정션에서 뺏은 뒤 초기 공도 마저 빼앗으면 공이 2개가 된다. 초기가 아닌 단계에서
소유권을 뺏는 건 어떤 의도로 처리해야 하나?"

진단(doubleball.cjs): 정션 빼앗기가 남긴 implicit 롤(m+1단계, 정션→드롭)이, 초기 공 빼앗기 후에도
생존 — moveBallStart의 "패스 원점 따라감"이 롤의 원점을 새 위치로 끌고 가서, 재생 시 공이 새
드롭에서 옛 드롭으로 저절로 굴러가고 보드엔 안착 지점이 2개(공 2개) 표시됐다. 전제(그 시점의
소유)가 편집으로 사라졌는데 결과(롤)가 남은 것.

Change: relayout 앵커 라운드에 전제 검사 — implicit travel은 발화 직전(compiled clock −1ms)에
공을 잡은 소유자가 없으면 삭제. 어떤 편집 경로로 그 형태가 되든 파이프라인이 지운다(결과 기준
불변식). 의도 정의 확정: 비초기 단계 빼앗기 = "m단계에 소유가 끊기고 공은 놓은 지점까지 굴러가
멈춘다"(롤은 연속성의 대가, 순간이동 금지) — 초기 순간을 다시 빼앗으면 그 이후 전부(롤 포함)
덮어쓴다(ADR-0009 v25 모멘트 문법의 일관 적용).

Validation: typecheck/lint/build/harness PASS, 289 tests(implicitRoll 4 — 신규 "dies with its
cause"), doubleball 재현→수정 확인(worst 0, 잔상 중복 0), 프로브 9종 무회귀.

## CHG-20260822-180 — 빼앗기 롤을 다른 움직임처럼 표시 (점선 + 단계 배지), 타이밍 실측 확정

Trigger: 사용자 — "m-1단계까지 진행하고 놓은 자리까지 m단계에 진행되어야 하는 거 아냐? 그리고
점선이랑 단계 배지도 다른 것들처럼 나오게."

타이밍(rolltiming.cjs 실측): 이미 사용자 공식 그대로였다 — 정션 1(1단계 끝)의 공을 빼앗으면 1단계
캐리는 그대로, 롤 = 2단계(런 2와 같은 창, 같은 시작), 놓은 지점에 정지. CHG-179 보고의 문구("m단계
까지 진행")가 모호했던 것. 동작 변경 없음, 계약 프로브로 창 일치를 고정.

표시(사용자 결정 전환, CHG-175의 숨김을 명시적으로 대체): implicit 롤도 라인 + 배지 + 픽 + 스텝바
카운트 — 단 `pathLoose`(짧은 점, 60%)로 "찬 게 아니라 굴러간 공"임이 구분되게. `implicit` 플래그와
의미(원인 소멸 시 소멸, 수신 시 승격)는 유지 — 렌더만 복원.

Validation: typecheck/lint/build/harness PASS, 289 tests(카운트 테스트 반전), rolltiming 7/7
(창 일치·소유 타임라인·라인·배지 3), repro3 갱신 포함 프로브 7종 PASS, marathon 360제스처 0실패.

## CHG-20260822-181 — 빼앗기는 그 단계를 교체한다 (0-1 연결, m+1이 아니라 m)

Trigger: 사용자 — "0단계부터 소유한 공을 1단계 직후 잔상에서 잔디로 놓으면 공이 0-1로 연결되어야지,
지금은 0-1(정션)-2(드롭)로 이어진다."

의미 확정(이전 CHG-180 해석 정정): 정션 m 잔상 빼앗기 = **공의 m단계 움직임 자체를 교체** —
m−1까지 캐리 유지, m단계에 공이 휴식 위치에서 이탈해 드롭으로 굴러감. 선수 잔상 플레인 드래그가
"그 움직임의 도착 조정"인 것과 완전 대칭. truncate(m)+롤 step=m, 원점은 relayout 원점 앵커가
공의 그 시점 위치로 고정. 힌트 minStep/dropStep = m, givenAt/takenAway 토스트 = m.

Premise 검사 구조화: 1단계 롤은 t=0 발화라 시계 검사(stateAt)가 자기 자신에게 공을 넘긴 뒤를 봐서
정당한 롤을 죽였음 → **구조 검사**로 교체(선행 possessed 존재, 또는 첫 움직임 + initialHolder).
클록 프리·byte-idempotent, doubleball(공 2개) 방지 동일 보장.

Validation: typecheck/lint/build/harness PASS, 289 tests, rolltiming 7/7 신계약(롤=1단계 창 0~1.93s
일치·휴식 위치 출발·1단계 끝 드롭 안착), carrydetach 갱신 포함 프로브 11종 PASS(takeaway 1회
FAIL은 HMR 플레이크 — 2회 연속 재실행 클린), doubleball worst 0 유지, marathon 360제스처 0실패.

## CHG-20260822-182 — 조작법 패널: 안 가르치는 행 삭제, 힌트 한 호흡으로

Trigger: 사용자 — "이 설명 너무 과해. '길게 당길수록 세게' 같은 건 빼고, 클릭 설명은 뭐하러 둔거야."

Change:
- **"클릭 — 움직일 대상 고르기" 행 삭제**: 눌러서 고른다는 건 아무도 배울 필요가 없는 유일한
  제스처인데, 패널에서 가장 비싼 자리를 먹고 정작 가르치는 행들을 아래로 밀어냈다.
- 힌트 전부 한 호흡(≈1줄)으로: 선택에 더하기 / 차례로 고르기 / 빠르게 놓으면 굴러감 / 당긴
  반대로 발사 / 등번호·이름 편집 / 찍은 곳까지 — 잔상은 그 타이밍 / 곡선으로 한 번에 / 도착 지점
  조정 / 선택 — Delete·숫자키 / 당겨서 휘기. 부연("길게 당길수록 세게", "선수는 이동 공은 패스"
  등)은 해보면 바로 아는 것이라 삭제.
- 배치 그룹 6행 → 5행, 두 그룹 모두 줄바꿈 0.

Validation: typecheck/lint/build PASS, 289 tests(keymapCues 11 — 모든 큐가 여전히 보이는 행을
켠다), selcues 프로브 PASS + 스크린샷 3종으로 줄바꿈 없음 확인.

## CHG-20260822-183 — 공 디자인 통일: 잔상 공도 라이브 공과 같은 그림

Trigger: 사용자 — "초기 애니메이션 단계 축구공이랑 그 이외 축구공 디자인이 다르다. 일치시켜라."

진단: 라이브 공은 32조각 패턴 + 스페큘러 하이라이트 + 비-스케일 테두리, 잔상 공은 흰 원판 +
점 3개(별도 CSS)로 완전히 다른 그림이었다 — 0단계와 그 이후에서 공의 정체가 바뀌는 셈.

Change: `BallMark`(원+패턴+하이라이트)를 Token.tsx에서 export, 라이브 토큰과 잔상이 같은 것을
그린다. 잔상은 부모 그룹 opacity만 상속. `.ghostBall circle:first-child` / `.ghostBallDot` 규칙
삭제(잔상 전용 디자인 소멸).

Validation: typecheck/lint/build PASS, 289 tests, 프로브 6종 PASS, 스크린샷으로 라이브·잔상 공
동일 확인.

## CHG-20260823-184 — 자기 패스는 "달려가서 받으면" 받는다 (띄워서 다시 받기)

Trigger: 사용자 — "1번 선수가 2단계를 진행하는데 0번 위치 공을 같은 선수의 1단계 직후로 휘어서
부여하면(띄워서 다시 받기 의도) 2단계에도 공이 부여돼 있어야 하는 거 아냐?"

진단(selfpass/selfpass2/selfpass3 3중 프로브): 기본 흐름 4변형은 통과했으나 **W2 — 초기 소유
상태에서 정션 빼앗기 후 자기에게 띄우기**가 재현 실패. 원인은 `syncTravelReceiverInDraft`의
`filter(p => p.id !== passer)` — **패스한 선수는 수신 후보에서 무조건 제외**. 공은 선수 위에
도착하지만 무소유로 남고, 이후 단계는 전부 공 없이 재생됐다. 자기 머리 위로 띄우기·앞으로 차고
달려 받기가 원천 불가였던 것.

Change: 제외 조건을 **발사 지점으로부터의 거리**로 교체 — 도착 시점에 패서가 발사 지점에서
SELF_RECEIVE_MIN_M(3.5m, RECEIVE_RADIUS와 동일) 넘게 벗어나 있으면 후보. 원래 규칙이 지키던 것은
"떠나지 않은 패스"(제자리에서 2m 차고 그 자리에 서 있기)뿐이고, 그건 이 조건이 그대로 막는다.

Validation: typecheck/lint/build/harness PASS, 291 tests(신규 selfPass 2 — 받는 경우/안 받는 경우
양쪽 계약), 프로브 14종 PASS(신규 selfpass·selfpass2·selfpass3 포함), marathon 450제스처 0실패.

## CHG-20260823-185 — G0: AppShell 전량-실행 flake를 시계에서 종결 (PLAN-014)

Problem: `npm test` 전량 실행에서만 AppShell playback assertion이 실행마다 다른 위치(:186/:296/:359)로
실패. 단독 실행은 항상 초록이라 "고쳤다"가 반복될 수 있는 구조.

Change: 원인은 assertion이 아니라 시계 — vitest jsdom은 pretendToBeVisual이라 실-타이머 rAF가 존재하고,
suite 부하 중 `await act` 동안 발화해 빈 보드의 0.2s 재생 범위(`playableEnd` 하한)를 완주시키면
`holdResult`가 `playing`을 되돌린다. 여기에 afterEach 부분 리셋(playScope/rangeEnd/completion/
boostFactor 누락)이 겹침. 수리는 테스트 전용: 아무도 펌프하지 않는 rAF 삼킴 큐 + `getInitialState`
전체 리셋. production 무변경.

Files: src/ui/AppShell.test.tsx

Validation: AppShell 단독 ×3, 전량 ×3, `--maxWorkers=1` ×1 전부 PASS. (commit 73cbb00)

## CHG-20260823-186 — M1: I1~I10 mutation-kill 감사 — detector 지형을 핀으로 고정 (PLAN-014)

Problem: 퍼즈 불변식 10개가 "건강한 문서만 봐서 초록"인지 실제 detector인지 증거가 없었다.

Change: `invariantMutation.test.ts` 신규 — 불변식 계열마다 최소 mutant를 주입하고 누가 잡는지 핀.
결과 SURVIVED 0: I1/I2/I3/I4/I5/I6/I9/I10은 자기 detector가 KILL, 내부 NaN·1m tear·dead receiver는
I9(relayout self-heal+멱등)가 광역 2차 방어선으로 검출, I7은 I5에 구조적으로 가려짐(2차 울타리),
I8은 문서 mutation으로 도달 불가(predicate 단위 검증). Findings P2 4건: I2 내부 waypoint 미검사,
B1 전역 예산 마스킹, validator receiverId 생존성 미검사, 중복 segment id는 compile 크래시.

Files: src/editor/invariantMutation.test.ts, docs/agent/plans/evidence/PLAN-014-M1-mutation-report.md

Validation: 17/17 PASS, tacticFuzz 기본 campaign PASS. (commit 00afee8)

## CHG-20260823-187 — M2: junction authority graph + core parity 전 junction Δ=0 (PLAN-014)

Problem: D1 1안("여러 입력, 공용 resolver 하나")이 실제 구조인지, 같은 junction의 좌표 권위가
다시 여러 벌이 됐는지 증거가 없었다.

Change: `junctionParity.test.ts` 신규 — 커맨드로 지은 6 fixture(첫 패스/달린 수신자/through-target/
수신측 핀/릴레이/삭제·재저작·저장 왕복)에서 authored 끝점 vs compile·stateAt 결과를 파이프라인
자신의 앵커 임계 0.25m로 검증: 전 junction Δ=0.0000, relayout 0.07~0.58ms, 추가 적용 0회.
R12-E 확인: receiver 정확-동률은 players 배열 순서로 결정(특성화 핀). 정적 그래프: resolver 1개
(heldBallPos, 6 callsite), 우회 조립 0, 커밋 문서의 relayout 우회 0(드래그 중간 상태는
inTransaction 가드로 autosave 제외). Findings P2 2건: import는 relayout하지 않음(외부 문서 첫 편집
시 의미 변경), receiver tie 순서 의존. D1 권고: 1안 유지.

Files: src/editor/junctionParity.test.ts, docs/agent/plans/evidence/PLAN-014-M2-junction-graph.md

Validation: 8/8 PASS. (commit 9cfebde)

## CHG-20260823-188 — M3: Phase 1 판정 Core Closure Supported + 문서 정합화 (PLAN-014)

Problem: 판정·증거·문서 상태의 연결.

Change: gate ledger 전부 초록(전량 ×3 + serial, 46 files/316 tests) → **Core Closure Supported**
(core document/engine/editor 한정 — UI/브라우저/UX는 DG-BROWSER 결정 전 NOT VERIFIED).
미해결 P0/P1 0, Findings 6건 전부 P2. CURRENT_STATE·ACTIVE_PLAN·canonical plan 상태 갱신,
2026-08-22 브라우저 결과를 HISTORICAL로 표기, handoff 작성.

Files: docs/agent/plans/evidence/PLAN-014-M3-final-report.md, docs/agent/CURRENT_STATE.md,
docs/agent/plans/ACTIVE_PLAN.md, docs/agent/handoffs/2026-08-23_0724_plan-014-phase1-audit.md

Validation: typecheck/lint/test/build/harness 전부 PASS. (commit ecfd7cf)

## CHG-20260823-189 — D-browser: R12-D·R7 Resolved, R5는 실제 결함으로 확인 (PLAN-014)

Problem: DG-BROWSER 결정(사용자 "당연히 설치해") 후, 화면·클릭 계층을 실제 브라우저로 감사.

Change: Playwright 1.62.1을 tracked devDependency로 추가, `pw/`에 runner·manifest·probe 4종.
manifest는 과거 22종 probe 이름을 **증거가 아니라 MISSING 인벤토리**로 기록한다.
- **R12-D Resolved**: 7 viewport(1280×720/800, 1440×900, 1440×1000@DPR2, 1920×1080, ultrawide,
  tall)에서 CTM 등방(skew 0), pick의 `view.w/rect.width` = `1/ctm.a`(소수 5자리 일치),
  **히트 밴드 실측 6~7px**(설계 7), surround 전역 유한 좌표(dead strip 0).
- **R7 Resolved**: blur/lostpointercapture/pointercancel/Escape 전부 열린 transaction 없음,
  다음 편집 정상. 특성화: window blur만은 취소가 아니라 이후 pointerup에서 커밋(F-D-03, P3).
- **R5 Confirmed (P1)**: 호버는 전역 rank 튜플의 `norm`으로 정렬해 경로를 고르고, 프레스는
  카테고리 top + intent 우선순위(고스트 > 경로)로 고스트를 고른다. 고스트는 항상 런의 끝점이고
  끝점은 그 경로 위에 있으므로 **모든 런 끝점 ±2m 띠에서 재현**: 경로가 강조된 채 드래그하면
  곡선이 아니라 도착점이 끌려간다. 스캔라인(dx −3~+1m)으로 경계까지 특정.
- production 1줄: DEV 전용 QA mirror에 `hoverKey` 노출(호버 약속은 React state라 paint로 못 읽음).

Files: pw/**, src/ui/pitch/SimplePitch.tsx(DEV 훅 1줄), package.json,
docs/agent/plans/evidence/PLAN-014-D-browser-report.md

Validation: hit-scale 42 PASS, gesture-cancel 17 PASS, reduced-motion 5 PASS,
r5-diagnose 11(mismatch 검출 = 의도된 FAIL). typecheck/lint/test(316)/build/harness PASS. (commit 5aa6c5d)

## CHG-20260823-190 — R5 수정: 강조된 것과 끌리는 것을 일치시킴 (P1)

Problem: 경로 끝 근처(모든 런 끝점 ±2m)에서 화면은 경로를 강조하는데 드래그는 고스트 도착점을 옮겼다.
곡선을 휘려던 조작이 목적지 변경이 됐다.

Change: 호버는 전역 rank 튜플의 `norm`으로, 프레스는 카테고리 top + intent 우선순위(고스트>경로)로
서로 다른 기준을 쓰고 있었다. `pickTarget.pressSubject()` 하나를 두 소비자가 공유하게 했다 —
`resolvePointerIntent`는 여전히 "무엇을 의미하는가"의 권위이고, `pressSubject`는 "누구에 대한 것인가"를
답한다. 진리표(고스트×경로×토큰 8조합) 전수 테스트로 둘의 일치를 계약화했다.

Files: src/ui/pitch/pickTarget.ts, SimplePitch.tsx, pickTarget.test.ts

Validation: `pw/r5-diagnose` 스캔라인 mismatch 0(수정 전 9지점 중 5), 브라우저 102 checks PASS. (commit 7d8f4b1)

## CHG-20260823-191 — 감사 P2 6건 수정 + 오진 1건 정정

Change:
- **I2**: 전 waypoint·handle 검사(내부 NaN이 I9 경유로만 잡히던 것 → 직접 검출).
- **compile**: 중복 segment id를 issue로 보고하고 skip. 기존엔 pending을 덮어쓴 뒤
  `scheduleDuration`에서 크래시 — issue를 올리는 그 줄이 예외를 던지고 있었다.
- **B1 예산**: 전역 → 순간별. 무관한 선수의 0.06s 런이 예산을 2배로 부풀려 1.2m tear를 가리던 문제.
  캐리 중엔 홀더 자신의 런, 비행 중엔 공 자신의 travel 속도. 1800세션 퍼즈·프리셋 8종 전부 통과.
- **자동저장 복원**: relayout을 거쳐 고정점 상태로 보여준다. 기존엔 validate만 해서, 구버전이 저장한
  판이 첫 편집에서 소리 없이 재작성됐다.
- **수신자 동률**: id tie-break 명문화. distance-only stable sort가 players 배열 순서를 물려받았다.
- **blur**: 진행 중 제스처를 취소한다. 기존엔 Alt+Tab 후 마우스를 떼면 안 보는 곳에서 커밋됐다.
  (`lostpointercapture`는 의도적으로 취소하지 않는다 — 정상 종료 시에도 발화하는 이벤트다.)
- **정정**: F-M1-03 "validator가 dead receiver 미검사"는 오진이었다. 검사한다 — I9가 I10보다 먼저
  발화한 순서 문제였고, 이제 validator 직접 호출로 증명한다.

Validation: 324 tests, 브라우저 102 checks, 강화 퍼즈 1800세션, 전 게이트 PASS. (commit e566c9a)

## CHG-20260823-192 — E-core UX probe + 문서 drift 정리, PLAN-014 종료

Change: `pw/ux-core.cjs` 신규 — E1(피드포워드/피드백), E2(제스처 1 = undo 1, 주어 일치),
E3(화면과 시계 일치)를 핵심 여정에서 검증. 화면-시계 오차는 정지·재생 중·결과 프레임 전부 **Δ=0.000m**
(초기 0.64m는 왕복 지연이었고 페이지 내 단일 동기 실행으로 재측정해 정정).
문서: 불변식 수(9→I1~I10), PROJECT_MAP에 `pw/` 라우팅, Known Issues 현재 증거로 재분류
(ISSUE-002·009 Resolved, ISSUE-003 Not Reproduced, ISSUE-008에 player fling 제거 주석).

Validation: ux-core 14 PASS, harness:verify PASS. (commit 8d31458)

## CHG-20260823-193 — 다른 엔티티의 경로를 한 번에 잡을 수 있게 (포커스 격리의 사각지대)

Problem: 사용자 보고 — "경로 수정하다가 다른 엔티티를 눌렀을 때 더블클릭을 해야 그 엔티티의 경로를
수정할 수 있다". 재현해보니 보고보다 나빴다: 46m 떨어진 다른 선수의 경로를 눌렀는데 `marquee`(빈 잔디
드래그 선택)로 해석됐다. 첫 press는 포커스를 벗어나는 데 쓰이고 두 번째가 비로소 경로를 잡는다.

Change: 포커스 격리(2026-08-21, "편집 중인 움직임이 있으면 남의 스트로크가 press를 뺏지 못한다")가
**무조건 필터**였다. 포커스된 엔티티가 커서 근처에 아무것도 없어도 다른 엔티티의 경로·고스트를 후보에서
통째로 제거해, 앱이 그 지점을 빈 잔디로 인식했다. `applyFocus()`로 바꿔 **포커스가 잡을 것이 사정권에
있을 때만** 격리한다. 겹침(규칙이 존재하는 이유)은 그대로 보호된다 — 겹치면 포커스된 후보가 정의상
사정권 안이다. 호버와 프레스가 같은 함수를 쓰므로 R5 계약도 유지된다.

같은 파일에서 발견된 전량-실행 flake도 함께 닫았다: `accessibility.test.tsx`(간헐 실패 재현)와
`tour.test.tsx`(스토어 리셋 없음)에 G0와 동일한 처방(프레임 삼킴 큐 + `getInitialState` 전체 리셋).
세 jsdom suite가 이제 같은 규율을 따른다.

Files: src/ui/pitch/pickTarget.ts(+test), SimplePitch.tsx, ui/accessibility.test.tsx, ui/tour/tour.test.tsx, pw/focus-switch.cjs

Validation: `pw/focus-switch` 13 checks PASS(떨어진 경로 1회 press로 편집 + 겹침에서 포커스 우선 보존),
브라우저 115 checks ALL PASS, 329 tests 전량 3회 연속 + serial 1회, typecheck/lint/build/harness PASS.
## CHG-20260823-185 — 화살촉·연결부 마감 (애플식): 테이퍼 다트 + 진입 페이드 + 단일 그림자

Trigger: 사용자 — "화살표 디자인이라든가, 이어지는 경로 중간중간 끊긴 지점 더 이쁘게 애플 형식으로."

진단(4배 확대 스크린샷): (1) 화살촉이 열린 V자(선 2개 붙인 형태)라 선의 연장으로 안 읽히고,
(2) 선 아래 흰 케이싱의 둥근 끝이 화살촉 둘레로 창백한 깃처럼 삐져나왔으며, (3) 모든 구간이 full
weight로 시작해 정션마다 "잘린 조각"으로 보였다.

Change:
- **테이퍼 다트 화살촉**: 뾰족한 팁 + 오목한 등 + 라운드 조인(`ARROW_D`), 선수 1.9m/공 1.65m,
  refX 8.7로 팁이 경로 끝에 정확히 안착. 선 트림도 재보정(선수 1.9m, 공 1.0m)해 팁이 토큰 가장자리
  바로 앞에서 멈춘다.
- **케이싱은 머리 길이만큼 먼저 끝난다**(별도 캐시) — 깃 소멸.
- **진입 페이드**: 각 구간 시작 2.2m(공 1.4m)를 그라디언트 마스크로 서서히 드러냄 → 다리가 토큰
  에서 자라 나오듯 이어진다. 히트 패스는 마스크 밖(클릭 영역 유지).
- **단일 그림자**: 케이싱+선+머리를 한 그룹(`pathBody`)으로 묶어 부드러운 그림자 하나.

Validation: typecheck/lint/build PASS, 291 tests, 프로브 9종 + GIF 내보내기 PASS, marathon
240제스처 0실패, 4배 확대 스크린샷으로 정션/도착/출발 3지점 육안 확인.

## CHG-20260824-194 — 단계 격리 · 단계 상황판 · 공 던지기 토글 · 다크모드 (PLAN-015)

Trigger: 사용자 2026-08-24 — "공 굴러가는거 키고 끄는 토글(기본 디폴트는 없게) / 레이어 단계를 하나
선택했을 때 지금 어떤 상황이고 어떻게 행동할 예정인지가 더 중요하다. 직관성 필요함 / 처음부터 끝까지
모든걸 보여줄 필욘 없음 / 다크모드 기능 추가."

인터뷰로 확정: "공 굴러가는거" = **휙 던지기(플링)**, 단계 표시 = **이 단계 + 직전 1단계 흐리게**,
다크모드 = **헤더 버튼 + 시스템 따름**.

Change:

- **단계 격리** (`deriveStepLayers` / `deriveGhostLayers`, `uiStore.stepIsolate` 기본 켜짐):
  경로·배지는 `현재` 선명 / `현재-1` trace(0.15) / 나머지 **미렌더**. 잔상은 규칙이 다르다 —
  현재 단계는 선명, **엔티티별로 현재 직전의 마지막 잔상**은 trace, 나머지는 숨김. 3단계 전에 움직인
  선수의 현재 위치가 사라지는 것을 막는 앵커 규칙이다. 숨긴 것은 `pickSegments`/pick 고스트 입력에서도
  빠진다(보이지 않는 것이 press를 먹으면 안 된다). 재생 중에는 격리하지 않는다. StepBar의
  **"보기: 이 단계 / 전체"** 토글이 상시 탈출구.
- **단계 상황판** (`stepNarrative.ts` + `StepStatus.tsx`): 보드 좌상단이 `N단계 · 지금 … · 이번 …`을
  말한다. 상황은 **직전 단계들이 끝난 상태**에서 읽는다 — 단계 경계는 도착과 출발이 같은 순간에
  겹쳐서, ε을 어느 쪽으로 줘도 한쪽이 틀린다(2단계가 "공 이동 중"으로 보고됨). 경계 직후를 읽고 그
  travel이 이 단계 것이면 직전으로 되감는다. 재생 중엔 진행 중인 단계를 말한다.
  `activeStepAt`은 StepBar의 aria-current와 공용 — 같은 질문에 두 파생이 답하면 갈라진다.
- **빈 단계의 프레임**: 칩을 눌렀을 때 그 단계에 움직임이 없으면 재생 헤드가 그대로 있었다(4단계를
  골라도 킥오프 프레임). `stepOpensAt`으로 **직전 단계의 끝**으로 보낸다.
- **공 휙 던지기 토글** (`uiStore.ballFling`, 기본 **꺼짐**, localStorage): 꺼짐이면 아무리 빠르게
  놓아도 배치. 상수는 그대로 두고 게이트만 추가했다(ISSUE-008은 여전히 열려 있다). 더블클릭
  슬링샷은 명시적 제스처이므로 유지. 왼쪽 "동작 설정" 카드의 스위치, 꺼져 있으면 조작법의
  "공 휙 던지기" 행도 사라진다(`Binding.flag` + `visibleBindings`).
- **다크모드**: `theme.ts`(순수) + `useTheme.ts`, 헤더 버튼이 **시스템 → 라이트 → 다크** 순환.
  `main.tsx`가 React 마운트 전에 칠한다(마운트 이펙트로 칠하면 다크 사용자에게 흰 화면이 한 프레임).
  `AppShell`의 `dataset.theme = 'light'` 하드코딩 제거. 다크 토큰 보강: depth 4단(라이트의 청회색
  그림자는 검정 위에서 보이지 않아 모든 표면이 납작했다), danger/warn/success/ball-chip, tint 버튼
  잉크(`#0a63cc`류는 근-검정 위에서 안 읽힌다).
- `deriveRestMutedIds` 제거 — `deriveStepLayers(isolate=false)`가 같은 답을 낸다.

Files: src/ui/pitch/pathPresentation.ts(+stepLayers.test.ts), SimplePitch.tsx, renderer/PathLayer.tsx,
renderer/pitch.module.css, editor/uiStore.ts, ui/{StepStatus.tsx,stepNarrative.ts(+test),theme.ts(+test),
useTheme.ts,StepBar.tsx,SidePanels.tsx,AppShell.tsx,ShortcutsOverlay.tsx,keymap.ts,UiIcon.tsx,
shell.module.css,tokens.css,i18n/ko.ts}, app/main.tsx, pw/step-view.cjs, pw/audit-manifest.json

Validation: typecheck/lint/build/harness PASS, **346 tests** (신규 30: stepLayers 7, stepNarrative 8,
theme 5 + 기존). 브라우저 `node pw/run.cjs step-view` → **16 checks ALL PASS**, 콘솔 클린 —
테마 순환·새로고침 유지·다크 실제 도색, 2단계에서 1단계가 trace, 1단계에서 2단계가 **트리에서 제거**,
토글 OFF 복귀, 플링 기본 꺼짐(빠른 스윕 overshoot 1.60m = 배치), 켜면 조작법 행 복귀.

Related: PLAN-20260824-015, ADR-0009(단순 모드), ADR-0006 D2(토큰)

Rollback: 세 기능 모두 UI 플래그 뒤 — `stepIsolate` 끄기 / `ballFling` 켜기 / 테마 라이트 고정으로
종전 동작. 문서 스키마·엔진 불변이라 저장된 전술은 그대로 열린다.

Documentation Updated: CURRENT_STATE, ACTIVE_PLAN, PROJECT_MAP, CHANGELOG_AGENT

## CHG-20260824-195 — 자동으로 밀려난 단계의 움직임이 사라지던 문제 (PLAN-015 회귀)

Problem: 사용자 2026-08-24 — "오류 났다 1단계 이상으로 경로가 안 그려져". 재현: 선수 하나에 런을
그리고 **같은 선수에게 두 번째 런**을 그리면 문서에는 2단계로 들어가는데 보드에는 아무것도 안 나온다.
공도 같다 — 런 뒤에 그린 패스가 다음 단계로 밀리면 보이지 않는다.

원인: `addStepRun`/`addStepPass`는 **엔티티 체인상 불가능한 단계를 스스로 밀어낸다**
(`step = Math.max(step, lastAuthoredStep+1, …)`). 한 선수의 두 번째 런은 첫 런과 같은 단계를 쓸 수
없기 때문이다. 그런데 단계 칩(`currentStep`)은 그대로 1에 남아 있었다. 이건 CHG-194 전까지는 표시상의
불일치일 뿐이었지만(토스트만 "2단계에 추가됨"이라고 말했다), **단계 격리가 켜지는 순간 치명적**이 됐다:
칩의 단계 밖은 렌더에서 빠지므로, 방금 그린 움직임이 만들어지고 카운트되고 토스트로 announce된 뒤
**보이지 않는다**.

Change: 커밋 직후 `landed !== currentStep`이면 **칩을 착지한 단계로 옮긴다**(`SimplePitch` commit
경로). 토스트는 원래부터 그 단계를 말하고 있었고, 이제 바가 그 말에 동의한다. 손이 방금 만든 것을
숨기는 보드는 보기 설정이 뭐라고 하든 고장이다.

부수 확인: 잔상 끝 드래그(`adjust-ghost-end`)는 이미 `selectSegment`를 하고, 선택된 움직임은 격리가
절대 숨기지 않으므로 숨은 단계를 편집하는 경로에는 같은 구멍이 없다.

Files: src/ui/pitch/SimplePitch.tsx, pw/step-view.cjs(회귀 검사 2건 추가)

Validation: `node pw/run.cjs step-view` → **18 checks ALL PASS**(신규: "자동으로 밀려난 움직임이
보드에 남는다" landed=2·inTree=true, "바/캡션이 따라간다" 2단계), 346 tests,
typecheck/lint/build/harness PASS.

Related: CHG-20260824-194, PLAN-20260824-015

## CHG-20260824-196 — 단계 격리 v2(시계가 곧 맥락) · 경로 방향 언어 통일 · 상황판을 시계로 · 헤더 토글

Trigger: 사용자 2026-08-24 2차 피드백 5건 — (1) 플링 토글은 헤더에 1행으로, (2) 단계 박스는 오른쪽,
(3) 격리는 "이전 단계도 흐리게"가 아니라 **고른 단계 구간만**(1단계 직후는 잔상이 아니라 실체여야),
(4) "보기: 이 단계"에서 공 경로 주변 **흰색 찌꺼기**, (5) 점선이 이동 방향으로 흐르게 + 선수/공 경로
표기 통일. 그리고 상황판 문구는 **의미 없는 정보**니 없애거나 진짜 쓸모 있는 걸로.

Change:

- **격리 v2 — 시계가 맥락이다.** v1은 `현재-1` 단계를 trace로 남겼는데, 그러면 화면에 같은 플레이가
  세 겹으로 그려진다(직전 화살표 + 직전 잔상 + 킥오프에 서 있는 실제 토큰). 이제 격리 중에는
  **보드가 그 단계가 열리는 시각에 선다** — 이전 단계들의 결과가 잔상이 아니라 **토큰 자신**으로
  보인다. 파생은 단순해졌다: `deriveStepLayers`/`deriveGhostLayers`는 `현재 단계 = focus`, 나머지는
  `hidden`(격리) 또는 `muted`(전체). 엔티티별 앵커 잔상 규칙과 trace 계층 삭제.
  - 시계 고정은 두 갈래다. `uiStore.authoringT` — 모든 press가 부르는 `returnToAuthoringStart`가
    0 대신 여기로 돌아온다(안 그러면 손댈 때마다 킥오프로 튄다). 그리고 SimplePitch의 **핀 이펙트** —
    편집이 타이밍을 바꿔 단계 시작 시각이 움직여도 사후에 다시 맞춘다. `held-result`는 건드리지 않는다.
- **흰색 찌꺼기 = 고아가 된 relay arc.** 패스와 수신자를 잇는 `.passLink`는 문서에서 직접 그려서
  레이어 맵을 안 봤다. 격리가 패스를 지워도 호는 남아 잔디 위에 흰 조각으로 떠 있었다. 경로를
  꾸미는 것은 경로와 같은 맵을 읽는다.
- **방향 언어 통일.** 선수=실선, 공=점선이라 "어느 쪽으로 가는가"는 맨 끝 화살촉만 답했고, 붐비는
  보드에서 맨 끝은 제일 가려지는 픽셀이다. 이제 **둘 다 점선이고 둘 다 같은 속도로 목적지 쪽으로
  행진**한다(`dashFor` + `stPathFlow`). 리듬은 일부러 다르게 둔다 — 런은 긴 보폭, 패스는 짧은 틱,
  루즈볼은 점. 축구 다이어그램 관례를 문법이 아니라 질감으로 유지한다. **작성 중인 단계만** 흐른다.
  - 곁들여 해결된 것: 흰 케이싱이 이제 **같은 대시**를 쓴다. 점선 아래 실선 케이싱은 모든 틈을 흰색으로
    메워서, 공 점선이 뭉개진 실선처럼 보이던 원인이었다.
- **상황판 → 단계 시계.** "10번 보유 · 10번→7번 패스"는 잔디 위에 이미 컬러로 그려져 있다. 그림이
  말 못 하는 건 **타이밍**이다(2초 런과 5초 런은 같은 화살표를 그린다). 이제 `N단계 · {d}초 걸림 ·
  {i}/{n}번째 · {from}초에 시작 · 전체 {all}초`, 재생 중엔 스톱워치. `stepNarrative.ts` 삭제 →
  `stepTiming.ts`. 위치는 보드 **우상단**.
- **헤더 토글.** 공 휙 던지기 스위치가 왼쪽 패널 카드에서 헤더 1행으로. 설명은 툴팁에.

Files: src/ui/pitch/pathPresentation.ts(+stepLayers.test.ts), SimplePitch.tsx, renderer/PathLayer.tsx,
renderer/pitch.module.css, editor/uiStore.ts, ui/{stepTiming.ts(+test),StepStatus.tsx,StepBar.tsx,
SidePanels.tsx,AppShell.tsx,shell.module.css,i18n/ko.ts}, pw/step-view.cjs

Validation: `node pw/run.cjs` → **138 checks ALL PASS**(step-view 23, 신규: 격리 중 시계가 단계 시작에
정박 t=1.34, 고아 relay arc 0, 경로/케이싱 대시 일치, 작성 단계만 행진), 345 tests,
typecheck/lint/build/harness PASS.

Related: CHG-20260824-194·195, PLAN-20260824-015

Rollback: "보기: 전체"로 종전 표시(시계 정박도 함께 해제), 헤더 스위치로 플링 복구.

## CHG-20260824-197 — 라이브 공에서 그린 패스가 체인을 잇지 못하고 매번 처음부터 다시 만들던 문제

Problem: 사용자 — "같은 선수한테 또 공을 2번 이상 주면 반응을 안 해". 조작은 **Alt+드래그 패스**.
재현(프로브): 공 토큰에서 Alt+드래그로 패스를 그리면, 두 번째부터는 문서가 그대로다. 토스트만
"이후 패스 1개는 지워졌어요"라고 말한다. 같은 선수를 겨누면 결과가 **글자 그대로 동일**해서 아무 일도
안 일어난 것처럼 보인다. 더 나쁜 건 2단계 칩을 눌러 공이 도착해 있는 프레임에서 그려도 마찬가지라,
**라이브 공으로는 체인을 이을 방법이 아예 없었다**.

원인: `startMoment()`가 `{ step: 0, pos: stateAt(…, 0).ball.pos }`로 **하드코딩**돼 있었다. 작성용
시계가 언제나 킥오프였을 때는 참인 문장이었지만, PLAN-015 v2가 보드를 단계 시작 시각에 세우면서
거짓이 됐다. 커서 아래의 공은 **그 단계 시점의 공**인데 여전히 step 0이라고 보고하니,
`atStep = 0+1 = 1` → `truncateBallFromStepInDraft(doc, 1)`이 매번 공 체인 전체를 지웠다.

Change: 라이브 공의 순간을 **잡은 시각에서 파생**한다 — `completedStepAt(doc, compiled, t)`
(그 시각까지 완료된 마지막 단계). 잔상을 잡을 때와 정확히 같은 규칙이다. 킥오프에서 잡으면 여전히
step 0 → 기존의 "시작에서 잡으면 이후를 덮어쓴다" 규칙 그대로 보존된다.

결과: 2단계 칩 → 공이 도착해 있는 프레임 → Alt+드래그 = 2단계 패스가 **이어 붙는다**.

Files: src/ui/stepTiming.ts(+test), src/ui/pitch/SimplePitch.tsx, pw/step-view.cjs

Validation: `node pw/run.cjs` → **140 checks ALL PASS**(신규: 라이브 공에서 그린 다음 패스가 체인을
대체하지 않고 확장 — travels 1→2, steps 2,3), 348 tests, typecheck/lint/build/harness PASS.

Related: CHG-20260824-196, PLAN-20260824-015

## CHG-20260824-198 — 단계 패널을 보드 위로(3행) · 푸터 너비 고정 · 배속 창은 누르는 순간 · 플링 민감도

Trigger: 사용자 2026-08-24 3차 — (1) 우상단 단계 시계는 쓸모없으니 "이 단계만/여기부터" 버튼을 그
자리에 2행으로, (2) 도구창 너비가 상태에 따라 변해 **단계 칩이 좌우로 움직이는 게 불편**, (3) 이어서
"보기: 이 단계" 토글도 같은 자리에 합쳐 **3행**으로, (4) ▶ 버튼은 **누르고 있을 때부터** 배속 창이
보여야지 드래그를 시작해야 보이면 안 됨, (5) 공 휙 던지기가 잘 안 됨 — 더 예민하게.

Change:

- **StepPanel(보드 우상단, 3행)**: `보기: 이 단계/전체` + `N단계만 재생` + `N단계부터 재생`.
  셋 다 원래 푸터 바에 있었고 그중 둘은 **단계에 움직임이 있을 때만** 나타났다. 푸터는 가운데 정렬
  flex 행이라 바 너비가 상태를 따라 숨 쉬었고, 커서 밑에서 칩이 좌우로 밀렸다. 옆 컨트롤을 움직이는
  컨트롤은 자리가 틀린 것이다 — 보드 위로 띄우면 나타나고 사라져도 아무것도 밀지 않는다.
  푸터에는 **단계를 고르는 일 하나만** 남았고, 칩은 언제나 같은 픽셀에 있다.
  그 자리에 있던 단계 시계 캡션은 폐기(사용자: 쓸모없음). 누를 수 있는 것 셋이 못 누르는 숫자 셋보다 낫다.
- **푸터 잔여 가변폭 제거**: GIF 버튼이 인코딩 중 "…"로 바뀌며 좁아지던 것 `min-width`로 고정.
- **배속 창은 press에서 연다**: 슬라이드가 가능하다는 걸 알려주는 유일한 신호인데, 이미 슬라이드한
  뒤에 보여줘선 아무것도 가르치지 못한다. 이동 없이 뗀 press는 그대로 play/pause —
  판정은 `scrubMovedRef`로, 상태(`scrub`)를 읽으면 방금 연 창을 보고 클릭을 삼킨다.
- **플링 게이트 완화**(옵트인이므로 의심할 이유가 사라졌다): `MIN_SPEED 10→6`,
  `MIN_SWEEP_M 5→2.5`, `MIN_TRAVEL_M 2.5→1.2`, `STALE_MS 120→150`, 굴림 저항 `ROLL_K 3.2→2.4`,
  `STOP_SPEED 1.5→1.1`. 관련 테스트는 **숫자가 아니라 상수 기준**으로 다시 써서, 문턱을 옮겨도
  테스트가 지키려는 규칙 자체는 그대로 남게 했다.
- `.stepReplayBtn` → `.replayScopeBtn`: 앞 이름은 문자열 `playBtn`을 부분 문자열로 포함해
  `[class*=playBtn]` 셀렉터가 재생 버튼과 함께 잡혔다. 클래스명도 인터페이스다.

Files: src/ui/{StepPanel.tsx(신규, StepStatus/StepReplay 대체),StepBar.tsx,AppShell.tsx,UiIcon.tsx,
shell.module.css,i18n/ko.ts,stepTiming.ts(+test),tour/tourSteps.ts,AppShell.test.tsx},
src/ui/pitch/ballFling.ts(+test), pw/{step-view,ux-core}.cjs

Validation: `node pw/run.cjs` → **143 checks ALL PASS**(신규: 빈 단계에서도 푸터 너비·첫 칩 x좌표
불변 882/748, 라벨이 짧아져도 불변, 배속 창이 press에서 열림, 이동 없는 press는 여전히 play/pause),
346 tests, typecheck/lint/build/harness PASS.

Related: CHG-20260824-196·197, PLAN-20260824-015

## CHG-20260824-199 — 계측 랩(feel-lab) + 측정으로 드러난 대비·타깃·모션 결함 수정

Trigger: 사용자 2026-08-24 — "수정된 사이트로 수백 가지 전술을 직접 실험해보고 문제점·의도 위반·
행동 인지 가능성·애플다운 애니메이션과 가독성을 점검하라". 그 중 **숫자로 판정 가능한 절반**을 먼저.

Change — 도구:

- `pw/lab/tactic-lab.cjs`: 시드 기반 랜덤 스크립트로 실제 포인터 제스처를 써서 전술을 수백 개 작성하고,
  매 세션 끝에 보드가 여전히 진실을 말하는지 묻는다(문서 유효성, 콘솔, 고아 relay arc, 공 순간이동,
  배지 충돌, **화면 대 시계 오차**). 게이트가 아니라 **단서** 생산기 — 잡힌 것은 이해된 뒤 probe가 된다.
- `pw/lab/feel-lab.cjs`: 폴리시 중 숫자인 넷 — **대비·히트 크기·모션 어휘·레이아웃 안정성** — 을
  **두 테마 모두**에서 측정한다.

Change — 측정이 드러낸 것(전부 수정):

- **대비**: `--st-text-3`가 light 2.74:1, dark 3.53:1 — 섹션 라벨·키캡·힌트 전부가 AA 미만이었다.
  `--st-text-2`도 4.49로 문턱 바로 아래. 두 값을 내리고(라이트) 올려(다크) 위계는 그대로 유지.
- **액센트를 잉크로 쓸 때**: `#0a7aff`는 채움 색이다. 12px 텍스트로 쓰면 크림 패널 위에서 3.7:1인데,
  활성 단축키 행과 눌린 토글이 정확히 그 색으로 칠해져 있었다. 같은 색조를 읽힐 때까지 내린
  **`--st-accent-text`** 신설(테두리·채움은 `--st-accent` 그대로).
- **등번호**: 흰 글씨 on 팀 색은 축구 다이어그램 관례이고 팀 색은 사용자 것이라 팔레트를 못 건드린다.
  이름 라벨이 이미 쓰던 처방(`paint-order: stroke`)으로 글리프 밑에 그림자 실선 한 겹.
- **모션 어휘**: `.stepBadge`의 `120ms ease` — 토큰 밖 유일한 값. `--st-motion-feedback`로.
- **히트 크기**: 포지션 셀렉트 26→28px. 결과: light 175→207/208, dark 186→207/208 통과.
- **되돌린 것**: 단계 배지에 28px 히트 원을 붙였더니 그 원이 **경로 중점**(= "경로를 잡아 휘기"
  프레스가 떨어지는 바로 그 지점)에 앉아 프레스를 전부 삼켰다. probe 7건이 즉시 실패해서 되돌렸다.
  배지는 컨트롤이 아니라 보드 마크이고, 그것이 라벨하는 경로가 우선한다. 주석으로 못박음.

Files: pw/lab/{tactic-lab,feel-lab}.cjs(신규), src/ui/tokens.css, src/ui/shell.module.css,
src/renderer/pitch.module.css, src/ui/pitch/SimplePitch.tsx

Validation: `node pw/run.cjs` **143 checks ALL PASS**, feel-lab 대비 **207/208**(양 테마) ·
모션 어휘 이탈 0 · 히트 미달 2(버전 배지·투어 링크, 텍스트 링크라 유지), 346 tests,
typecheck/lint/build/harness PASS.

Related: PLAN-20260824-015

## CHG-20260824-200 — 자율 QA 캠페인: 수백 전술 실험 + 다중 리뷰 + 수정 (사용자 위임)

Trigger: 사용자 2026-08-24 — "수정된 사이트로 수백 가지 전술을 직접 실험하고 캡쳐해가면서 문제점,
사용자 의도에 반하는 것, 행동을 인지할 수 있게 디자인됐는지, 애니메이션·감성이 애플과 유사하며
가독성이 좋은지 점검하라. 에이전트 몇 개로 루프 스테이션 돌려라. 중간에 멈추지 말고 끝나고 보고."

방법: 기계 층(`pw/lab/tactic-lab.cjs`로 시드 랜덤 전술 세션, 매 세션 결과 기준 점검) + 계측 층
(`pw/lab/feel-lab.cjs`로 대비·히트·모션 어휘) + 사람 층(스크린샷을 읽는 리뷰 에이전트 3종:
보드 가독성 / 재생·모션·크롬 / 다크 테마·크롬). **수정 → 재캡처 → 재리뷰**를 3라운드 돌렸다.

기계 판정(라운드 누계): **전술 세션 300+**, 실 결함 **0** — 토큰-시계 오차 최대 **0.000m**,
공 최고 속도 28.5 m/s(순간이동 없음), 고아 relay arc 0, 배지 충돌 0, 문서 무효 0, 콘솔 클린.

수정된 것(리뷰가 지목 → 확인 → 고침):

- **재생이 보드를 갖는다**: 편집 팝오버가 재생 중에도 최대 밝기로 떠 있었고 배속 알약이 그 위 이름
  칸을 덮었다 → 재생 중 미표시. 푸터만 딤 예외라 가장 시끄러운 띠가 됐던 것 → 함께 딤(재생 버튼 제외),
  딤 강도 0.45→0.6(2.1:1은 "비활성"으로 읽힌다), 재생 중 힌트 행의 액센트 제거.
- **보드 마크의 시각 언어**: 배지가 잔디 위 **1.4:1**(사실상 안 보임)이고 토큰과 같은 지름이었다.
  더 작고 불투명하게, 그리고 **격리 중에는 숨긴다** — 격리에서는 모든 배지가 같은 숫자를 달아
  정보량이 0이기 때문(선택된 움직임만 유지, 배지가 곧 단계 피커라서).
  잔상은 잔디와 알파 합성돼 **빨간 팀이 갈색**(측정 rgb(156,110,83))이 됐다 → 불투명 바탕 + 강한 알파,
  그리고 **점선 링**으로 바꿔 "예정"이라는 뜻을 모양이 지게 했다.
- **운동 단서 통일**: 재생 중 비행하는 공은 잔디 위 흰 점 하나였다 → 짧은 잔상 꼬리. 선수의 방향
  쐐기는 두 리뷰어가 "떨어져 나온 화살촉"으로 읽어 제거하고, **공과 같은 꼬리**로 통일.
- **접근성(측정)**: `--st-text-2/3`가 2.7~4.5:1이라 섹션 라벨·키캡·힌트 전부 AA 미만 → 재조정.
  액센트를 **잉크로** 쓸 때 3.7:1 → `--st-accent-text` 신설. 등번호는 팔레트를 못 바꾸므로 글리프
  그림자. 전송부 키 힌트 2.2:1, 버전 칩 1.7:1 → 수정. 결과 **양 테마 207/208 통과**.
- **다크 테마**: 잔디가 크롬만 near-black이 되고 12%만 어두워져 **광원처럼 빛났다** → 더 어둡고 덜 채도.
  배속 알약이 텍스트 색에 묶여 다크에서 가장 밝은 물체가 됐다 → 고정 어두운 스크림.
  스위치 노브가 트랙보다 **어두웠다**(rgb(28,29,33) in rgb(45,48,54)) — 값이 아니라 역할로 토큰화.
- **레이아웃 정밀도**: 푸터 세 그룹이 서로 다른 중심선(1696.0/1696.5/1707.5) → 키 힌트 행 높이를 모두
  예약. 푸터가 **보드가 아니라 뷰포트** 중심이었다(8px) → 컬럼 clamp를 그대로 써서 보드 중심으로.
  단계 패널이 보드 라운드 코너에서 8px, 그리고 재생 버튼이 없을 때 **구분선만 남는** 문제 → 둘 다 수정.
- **경로 기하**: 짧은 경로가 화살촉뿐이었다(1.9 유닛 머리) → 5.5m 미만은 작은 머리. 경로 진입 페이드가
  0까지 떨어져 **어느 토큰에서 나왔는지** 사라졌다 → 30% 바닥.
- **되돌린 것 1건**: 단계 배지에 28px 히트 원을 주자 그 원이 경로 중점에 앉아 "경로 휘기" 프레스를
  전부 삼켰다(probe 7건 즉시 실패). 배지는 컨트롤이 아니라 보드 마크다.
- **오독 1건 기각**: "공이 선수 원판 정중앙에 그려져 등번호를 가린다"는 리뷰 주장은 기계 검증 결과
  거짓 — 소유 중 공은 홀더로부터 **최소 2.6m**(원판 반지름 1.35m)다. 실제로 본 것은 패스 도착 잔상이
  다른 선수 위에 앉은 프레임이었다.

Files: src/ui/{tokens.css,shell.module.css,StepPanel.tsx,AppShell.tsx,keymap.ts,AppShell.test.tsx},
src/renderer/{pitch.module.css,PathLayer.tsx,Token.tsx}, src/ui/pitch/SimplePitch.tsx,
pw/lab/{tactic-lab,feel-lab}.cjs, pw/{step-view,ux-core}.cjs, .gitignore, docs/agent/PROJECT_MAP.md

Validation: 라운드마다 `npm run typecheck && lint && test && build && harness:verify` +
`node pw/run.cjs`. 최종 **143 probe checks ALL PASS**, **346 tests**, feel-lab **207/208 양 테마**,
모션 어휘 이탈 0, tactic-lab 300+ 세션 실 결함 0.

Related: PLAN-20260824-015, CHG-20260824-194~199

## CHG-20260824-201 — 검증 라운드: 착지하지 않은 수정 3건 + craft 지적 반영

Trigger: CHG-200 캠페인 3라운드. 수정 후 재캡처한 스크린샷을 **검증 전용 에이전트**(주장별
CONFIRMED/STILL BROKEN 판정)와 **craft 심판 에이전트**(애플 기준)가 각각 읽었다.

착지하지 않았던 것(전부 수정):

- **잔상이 토큰 위에 그려졌다.** 잔상과 토큰이 같은 자리에 있는 일은 없다고 가정한 페인트 순서였는데,
  **held-result 프레임에서는 모든 엔티티가 정확히 자기 잔상 위에 선다.** 그래서 도착한 선수가 잔상의
  얇은 링을 쓰고 잔상처럼 보였다 — 코치가 가장 오래 들여다보는 프레임에서. 집기는 DOM이 아니라 기하
  기반(`pickTargets`)이므로 페인트 순서는 진실을 말할 자유가 있다: **실물이 계획을 덮는다.**
- **잔상의 점선 링이 점선이 아니었다.** `vector-effect: non-scaling-stroke` 때문에 미터 값이 픽셀로
  읽혀 0.26m 링이 0.26px 헤어라인, 0.72px 대시 = 사실상 실선. 게다가 뒤에 오는 `.ghostToken circle`이
  두께를 다시 눌렀다. 둘 다 수정.
- **선수 잔상 꼬리가 사실상 안 보였다.** 렌더는 되고 있었지만 팀 색 0.30 알파는 잔디 위에서 리뷰어가
  똑바로 보고도 못 찾는 수준. 공 꼬리도 어두워진 다크 잔디에서 같은 문제 → 둘 다 바닥값 상향,
  다크에서는 공 꼬리를 흰색 쪽으로.

craft 지적 반영:

- **재생 중 패널 행이 좌우로 흔들렸다**(내가 만든 회귀): 액센트 거터를 하이라이트 자체의 padding으로
  줬더니 하이라이트가 켜지고 꺼질 때 텍스트가 15px씩 밀렸다 — 그것도 사용자가 피치를 보는 동안 저절로.
  거터는 **모든 행에 상시 예약**하고 색만 바뀐다. 폭을 먹어 힌트가 줄바꿈되지 않도록 카드 패딩 쪽으로
  내밀었다(계측: 줄바꿈 행 0).
- **라이트 잔디가 흐렸다**: 흰 라인이 잔디 대비 **2.86:1**인데 같은 라인이 다크에서는 7.7:1.
  토큰 원판은 잔디 대비 1.6:1이라 흰 링이 분리를 전담하는데, 그 링이 설 바닥이 없었다. 어둡게 조정
  (되돌리려면 `--st-pitch-grass`를 `#4aab6d`로).
- 전송부 키 슬롯의 `GIF`는 키가 아니다 → 제거. 단계 칩 카운트 배지가 옆 칩 경계에 걸치던 것 → 안으로.
  라이트 스위치 트랙이 크림 페이지 위에서 컨트롤로 안 읽히던 것 → 키라인 강화.
- **Home 의미 복구**: 격리 중 authoring anchor가 플레이 중간에 있어서 "처음으로"가 그리로 갔다.
  Home은 **플레이의 처음**(1단계, t=0)으로 간다.

기각/보류: "공이 선수 원판 정중앙"(기계 검증으로 거짓, 최소 2.6m), 짧은 경로 화살촉(작은 마커로 완화,
1.3 지름 미만은 여전히 뭉개짐 — 후속), 액센트 파랑이 홈팀 색과 같다는 지적(제품 결정, 사용자 몫).

Files: src/ui/pitch/SimplePitch.tsx, src/renderer/pitch.module.css, src/ui/{shell.module.css,
tokens.css,AppShell.tsx}, src/editor/{uiStore.ts,usePlayback.ts}, pw/step-view.cjs

Validation: **144 probe checks ALL PASS**, 346 tests, feel-lab 206/207 양 테마,
typecheck/lint/build/harness PASS. 육안 확인: held-result에서 도착 선수가 실물 링을 유지,
재생 중 공·선수 꼬리가 양 테마에서 보임.

Related: CHG-20260824-200, PLAN-20260824-015

## CHG-20260824-202 — 공 디자인 · 단계 패널 세그먼트 · 테마 토글 버그 · 액센트 색 · 라이트 잔디

Trigger: 사용자 2026-08-24 4차 — (1) 공에 오각형이 필요 없는 곳에 끼어 있음, (2) 안내 박스가 경기장을
침범하고 **지금이 전체보기인지 단계보기인지 버튼만 봐선 모름**, (3) 다크→라이트 전환에 버튼을 2번
눌러야 함, (4) 액센트를 파랑 말고 다른 색으로 시도, (5) 라이트 모드 잔디를 라이트에 어울리게.

Change:

- **공**: 가운데 오각형 하나만 남겼다. 이전엔 중앙 오각형 + 2/3 반경에 위성 5개였고, 공은 실제로
  **13px**로 렌더된다 — 그 크기에서 여분의 마크는 전부 잉크이고, 잉크가 쌓이면 흰 공이 검은 덩어리가
  된다. **진짜 원인도 하나 더 찾았다**: 이전 세션에서 선수 방향 쐐기를 지울 때 슬라이스가
  `.ballShadow`와 `.ballSpecular`까지 같이 지웠고, 그래서 하이라이트가 SVG 기본값인 **검정**으로
  떨어져 있었다. 흰 공에 검은 하이라이트 = 검은 덩어리. 둘 다 복구. 키라인도 1.2→0.9px.
- **단계 패널**: 토글 버튼 하나로는 그 라벨이 **현재 상태**인지 **누르면 갈 상태**인지 말할 수 없다.
  **세그먼트 컨트롤**(`[N단계만][전체]`)로 바꿔 둘 다 보여주고 하나를 켠다 — 한 눈에 두 질문 모두 답.
  켜진 세그먼트가 단계 번호를 들고 있으므로 아래 버튼은 `현재 단계만` / `현재 단계부터`로 짧아졌고,
  패널 폭이 줄어 경기장 침범도 함께 줄었다.
- **테마 토글 버그**: 순환이 system → light → dark → system이었는데, OS가 다크인 기기에서 'dark'일 때
  누르면 'system'으로 가고 그건 다시 다크로 해석된다 — **화면이 안 바뀌어서 두 번 눌러야** 했다.
  이제 버튼은 **보이는 것을 뒤집는다**: 한 번 누르면 반드시 반대 테마. 'system'은 첫 누름 전까지의
  초기값으로 남는다(OS를 따른다는 게 바로 그 뜻이다). 아이콘도 pref가 아니라 **현재 보이는 테마**를 표시.
- **액센트 → 바이올렛**: 보드에서 파랑은 이미 "우리 팀"이다. 재생 버튼·활성 칩·켜진 힌트가 전부
  파랑이면 제품의 가장 중요한 구분이 크롬과 경쟁한다. 바이올렛은 어느 팀도 아니고 크림 페이지에
  더 따뜻하게 앉는다. 하드코딩돼 있던 재생 버튼 그라디언트와 tint 버튼도 **토큰에서 파생**하도록 정리.
  되돌리려면 `--st-accent`/`--st-accent-text`/`--st-accent-soft`만 복구.
- **라이트 잔디 재조정**: 직전 수정이 크림 페이지 위에서 야간 경기장처럼 어두웠다. 흰 라인 대비
  **3.0:1**(비텍스트 그래픽의 WCAG 기준)을 지키면서 밝고 낮의 초록으로. 다크 잔디는 그대로.

Files: src/renderer/{Token.tsx,pitch.module.css}, src/ui/{theme.ts,useTheme.ts,AppShell.tsx,
StepPanel.tsx,shell.module.css,tokens.css,i18n/ko.ts,theme.test.ts,AppShell.test.tsx},
pw/step-view.cjs

Validation: 144 probe checks ALL PASS(테마 검사는 "누를 때마다 화면이 바뀐다"로 재작성), 346 tests,
feel-lab 대비 **라이트 209/209 · 다크 208/209**(남은 1건은 등번호), typecheck/lint/build/harness PASS.

Related: PLAN-20260824-015, CHG-20260824-200·201

## CHG-20260824-203 — 공은 원래의 표준 무늬로 복원 (진범은 하이라이트였다)

Trigger: 사용자 2026-08-24 — "축구공 디자인 일반적인 디자인으로 해줘".

경위: 사용자가 "오각형이 필요없는 부분에 끼어있음"이라고 했을 때 나는 **무늬를 범인으로 지목**하고
두 번 깎았다(위성 제거 → 중앙 오각형만). 실제 원인은 CHG-202에서 따로 밝혀졌다 — 이전 세션에
방향 쐐기를 지우면서 `.ballSpecular` 규칙이 함께 삭제돼 하이라이트가 SVG 기본값인 **검정**으로
칠해지고 있었고, 그게 중심에서 벗어난 검은 원반, 즉 "필요없는 곳에 끼어있는 모양"이었다.
세 번째 시도(가장자리로 패널을 밀고 원에 클립)는 패널이 키라인과 뭉쳐 **검은 공에 흰 무늬**로
반전됐다.

Change: 출고돼 있던 표준 구성으로 복원 — 중앙 오각형(0.3) + 반경 0.66에 오각형 5개(0.26).
클립과 이음선 제거. 하이라이트·그림자는 이미 복구돼 있으므로 이제 제대로 **흰 공에 검은 오각형**으로
읽힌다(육안: 최대 확대·실제 보드 크기 양쪽 확인). 키라인 0.9px는 유지.

교훈은 주석으로 박아뒀다: 무늬를 세 번 다시 그리는 동안 진짜 회귀는 CSS 한 줄이었다.

Files: src/renderer/Token.tsx, src/renderer/pitch.module.css

Validation: 144 probe checks ALL PASS, 346 tests, build/harness PASS.

Related: CHG-20260824-202

## CHG-20260824-204 — 공 경로가 고른 단계가 아니라 1단계로 들어가던 버그 + 헤더/패널 정렬

Trigger: 사용자 2026-08-24 — (1) "2단계를 선택하고 축구공을 선택해서 경로 그리면 2단계가 아니라
1단계로 설정돼. 선수는 잘 되는데", (2) 왼쪽 패널 버튼의 이모지가 여기만 있어 어색하고 텍스트 정렬을
어지럽힘 + `X`/`⇧R` 키캡 너비 불일치, (3) 헤더의 브랜드와 A/B/C 칩 높이가 안 맞음.

**공 단계 버그** — 재현: 공을 클릭해 선택한 뒤 칩을 옮기고 **잔디에서** Alt 제스처(`draw-to-point`).
이 경로는 토큰을 누르지 않으므로 `subjectAnchor`가 **캐시된 `ballMomentRef`**를 읽는데, 그 순간은
킥오프에서 잡힌 `{step: 0}`이었다 → `atStep = 1` → 패스가 1단계로. 선수는 순간이 아니라 **정체성**으로
앵커되므로 같은 문제가 없었다(사용자 관찰과 일치).

수정 두 겹:
- 잡힌 순간은 **그 프레임의 것**이다. 시계 앵커가 움직이면(칩 클릭, 타이밍이 바뀌는 편집) 캐시를 비운다.
- 잡힌 순간이 없고 **한 단계만 보고 있는 중**이면, 화면에 있는 프레임이 곧 답이다 — 공의 위치와
  단계를 그 시각에서 파생한다. 격리가 꺼져 있으면 종전대로 "체인의 끝에서 이어간다".

**정렬**:
- 왼쪽 패널 버튼의 ⚽/⌫/🗑 제거. 앱의 다른 컨트롤은 전부 그려진 스트로크 아이콘이거나 순수 텍스트라
  이 셋만 다른 제품처럼 보였고, 글리프 폭이 제각각이라 라벨의 x가 서로 달랐다.
- `.btnKbd`에 `min-width: 30px` — "X"(1자)와 "⇧R"(2자)가 각자 폭으로 줄어 오른쪽 끝이 들쭉날쭉했다.
- **헤더 정렬은 내 회귀였다**: 푸터 세 그룹의 중심선을 맞추려고 넣은 `margin-top`이 클래스 기준이라
  **헤더의 같은 컴포넌트**(variant 스위처)까지 13px 밀어냈다. 푸터 직계 자식으로 한정.
  variant 칩도 36×28의 눌린 타원에서 30×28의 원형에 가깝게.

계측: 헤더 4요소 중심 전부 23.5, 푸터 3그룹 전부 854, 바 중심 712 = 보드 중심 712.

Files: src/ui/pitch/SimplePitch.tsx, src/ui/SidePanels.tsx, src/ui/shell.module.css, pw/step-view.cjs

Validation: **145 probe checks ALL PASS**(신규: "칩 3에서 그린 공 경로가 3단계에 들어간다"),
346 tests, feel-lab 라이트 209/209 · 다크 208/209, typecheck/lint/build/harness PASS.

Related: CHG-20260824-197(같은 계열의 앞선 수정), PLAN-20260824-015

## CHG-20260824-205 — 경로 안내 한 줄로: Alt+클릭/드래그 = 경로 지정

Date: 2026-08-24 · Type: UX · Level: L1

Problem (사용자): "이거 걍 Alt + 클릭/드래그 로 합치고, 설명은 간단하게 경로 지정 이런식으로 해.
잔상은 그 타이밍 이런 설명 너무 짜침. 그리고 경로 드래그 설명을 바로 아래에 위치해줘."

Change (`src/ui/keymap.ts`, `ANIM_BINDINGS` — 왼쪽/오른쪽 상시 패널과 `?` 오버레이의 단일 소스):
- `Alt+클릭`(찍은 곳까지 — 잔상은 그 타이밍) + `Alt+드래그`(곡선으로 한 번에) → **`Alt+클릭/드래그` / `경로 지정`** 한 줄.
- 순서: 그리기 → **경로 드래그(당겨서 휘기)** → 잔상 드래그 → 경로 클릭.

근거: 두 줄은 결과의 **모양**(직선/곡선)이 달라서 나뉘었지만, 패널은 "경로를 어떻게 그리느냐"를
답하려고 읽는다. 답은 **같은 모디파이어, 같은 주어** 하나고, 모양은 손이 이미 정하는 것이다. 또
옛 힌트는 행동을 이름 짓는 대신 **기계 동작**을 서술했다. 그린 선을 바로 휘는 것이 다음 동작이므로
`경로 드래그`를 그리기 바로 아래로 올렸다.

동작 변경 없음 — 안내 문구와 순서만 바뀌었다. 플래그/큐 체계(`cues`)는 그대로라
공·선수·경로 선택 시 하이라이팅도 종전과 같다.

Files: src/ui/keymap.ts

Validation: typecheck/lint/**346 tests**/build/harness PASS, **145 probe checks ALL PASS**.
계측(1440×900): 패널 전 행 단일 줄(라벨 h=17, 힌트 h=18), 최대 라벨 폭 88px < 카드 190px — 줄바꿈 없음.

Related: CHG-20260822-161(순간 문법으로 안내가 절반이 된 앞선 정리), PLAN-20260824-015


## CHG-20260824-206 — 공의 단계는 시계가 아니라 "세워 둔 순간"에서 온다 (전체 보기 1단계 고착 버그)

Date: 2026-08-24 · Type: FIX · Level: L2

Problem (사용자 2026-08-24, 스크린샷): 2번 선수가 공을 소유한 채 1단계 진행 예정인 판에서 —
(2) 단계 레이어 2를 고르고 공을 클릭해 Alt로 경로를 그리면 **1단계로 저장**,
(3) 공을 잡아 잔디에 내려놓아 소유를 푼 뒤 다시 단계 2에서 그려도 **여전히 1단계**,
(4) 이리저리 하다 보면 어느 순간 정상으로 돌아오는데 이유를 알 수 없음.

재현(프로브): **보기 = 전체**일 때 100% 재현. `clock=0.00`, 칩 2 → `ball:travel@1`.
보기 = 단계만에서는 재현되지 않는다.

Root cause: 공의 단계는 **시계에서 파생**한다(`completedStepAt(t)`). 그런데 **전체 보기에서는 시계가
저작 내내 킥오프에 고정**된다(핀 효과가 `t`를 0으로 되돌린다). 그래서 파생된 "순간"은 항상 step 0이고,
`atStep`은 **바닥이 아니라 답**이므로(ADR-0010 D9) 칩을 통째로 덮어썼다. 어떤 칩을 골라도 공 경로는
1단계. 선수는 순간이 아니라 **정체성**으로 앵커되므로 칩을 덮어쓸 것이 애초에 없었다 — 사용자가
"선수는 잘 되는 것 같은데"라고 관찰한 그대로다.

3번(잔디에 내려놓기)이 계속 1단계였던 이유는 하나 더 있다: 드롭과 던지기가 `ballMomentRef`에
**`{ step: 0 }`을 하드코딩**해 두었고, 그 주장이 드롭 이후까지 살아남았다.

Change (`src/ui/pitch/SimplePitch.tsx`):
- 신규 `parkedBallMoment()` — 공의 순간은 **사용자가 보드를 세워 둔 곳**에만 존재한다: 격리 중인
  단계의 시작 프레임, 또는 결과 유지 프레임. 그 밖에는 `null`을 돌려준다. 그러면 공은 자기 체인의
  끝에서 이어지고(`entityRestPos`), 단계는 칩이 정한다(`max(칩, 마지막 공 이동+1)`).
- 격리 중에는 **칩이 순간의 바닥**이다. 비어 있는 단계는 자기 창이 없어 재생 끝에서 열리므로, 시계만
  읽으면 "1,2단계만 있는 판에서 4단계를 고르면 3단계에 저장"된다. 칩은 같은 동작의 명시적인 절반이라
  `Math.max(clock, currentStep - 1)`. 단계가 실재하면 두 값은 이미 일치하므로 **틈만 메운다**.
- 드롭/던지기: `{ step: 0 }` 하드코딩 → `null`. 공의 시작이 옮겨졌으니 다음 제스처는 **그때의 보드**를
  읽어야 한다.

명시적으로 지목한 순간(고스트 클릭, 선택된 travel 세그먼트)은 **그대로** — 체인을 잘라내고 다시
쓰는 D9 문법은 손대지 않았다. 사라진 것은 아무도 지목하지 않은 "킥오프"라는 가짜 순간뿐이다.

Files: src/ui/pitch/SimplePitch.tsx, pw/step-view.cjs

Validation: typecheck/lint/**346 tests**/build/harness PASS. 브라우저 **152 probe checks ALL PASS**
(신규 7: 두 보기 모드 × [공이 잔디에 홀로 있음 / 칩 2 → 2단계 / 3단계가 없어도 칩 4 → 4단계 + 체인 유지]).
**신규 검사는 수정 전 코드에서 실제로 실패한다** — 되돌려 확인: 전체 보기 `ball:travel@1`,
격리 틈 `travel@3`.

Related: CHG-20260824-204(같은 계열, 격리 중 잔디 Alt 제스처), CHG-20260824-197, ADR-0010 D9


## CHG-20260824-207 — 단계 레이어를 넘기다 전술이 섞이던 문제 3건 (숫자키·일시정지·결과 화면)

Date: 2026-08-24 · Type: FIX · Level: L2 (ADR-0009 v28)

Problem (사용자 2026-08-24): "전체 애니메이션 다 만든 다음 숫자키로 1, 2, 3, … 눌러서 현재 단계
경로만 보는 그거 보고 있는데 계속 누르니까 단계들이 서로 섞여서 보일 때도 있고 그래. 직접 재현,
스냅샷 해가면서 발견된 것들 전부 수정해줘. 스페이스바도 눌러보고 현재 단계만, 현재 단계부터 이
버튼도 직접 중간중간 눌러보면서 단계들 바꿔가면서 그렇게 해봐."

방법: 신규 퍼즈 프로브 `pw/step-view-fuzz`. 전술 하나를 만든 뒤 **보기 조작만** 시드 순서로 돌린다 —
숫자키 1~9 · Space · 현재 단계만 · 현재 단계부터 · 단계 칩 · 보기 전환 · 경로 클릭 · 잔디 클릭 ·
Home · G · 재생 끝까지 대기. 매 조작 뒤 같은 질문을 한다: 문서 지문이 그대로인가, 격리 중 다른
단계의 경로/잔상이 그려졌는가, 칩과 상태가 일치하는가, 단계를 고른 뒤 시계가 그 단계의 시작에
서 있는가, 모든 토큰이 시계가 말하는 자리에 있는가.

### 찾은 것 셋 — 뿌리는 하나, **보는 행위가 보는 것 이상을 했다**

**(1) 숫자키와 단계 칩이 문서를 고쳤다.** 경로를 하나 선택해 두면 1~9와 칩이 그 경로를 **그 단계로
옮겼다**. 완성된 전술을 읽는 자연스러운 동작(경로 클릭 → 숫자키로 단계 넘기기)이 곧 전술을 다시
쓰는 동작이었다. `stepRangeFor`에 막혀 못 옮겨간 경우에는 칩과 그려지는 단계가 어긋나 **두 단계가
한 화면에** 남았다. 퍼즈 로그: `chip 5 → seg:5`, `chip 2 → seg:2`, `digit 8 → seg:8`.

**(2) 결과를 붙잡은 화면이 자기를 설명하지 않았다.** 재생이 끝나면 보드는 마지막 프레임을 붙잡는데
격리는 그때도 **칩이 가리키는 단계**를 그렸다. 칩 2로 5단계짜리를 다 보고 나면 2단계 화살표가 최종
프레임 위에 떠 있고 그 꼬리는 아무도 없는 잔디를 가리켰다(스냅샷 `held-after-full-play-chip2.png`).

**(3) 일시정지가 프레임을 붙잡지 못했다.** 단계 핀이 매 렌더마다 시계를 되돌려서, 재생 중 멈추면
보고 싶던 프레임 대신 단계 시작으로 튕겼다 — 계측 `parked 1.30 → mid 3.03 → paused 1.30`.
A-02("pause HOLDS the frame") 위반이고, 결과 화면은 `completion === 'held-result'`로 **이름을 불러
예외 처리**돼 있었다 — 같은 버그를 한 번 덧댄 자국.

### 수정

- **`src/ui/stepPick.ts` (신규)** — 단계 고르기 한 구현. 칩과 숫자키가 같은 것을 실행한다:
  재생 멈춤 → **경로 선택 해제** → 단계 설정 → (격리 중이면) 그 단계의 시작 프레임에 서기.
  선택 해제가 필요한 이유: 선택된 움직임은 어느 단계에 있든 계속 그려지므로, 남겨 두면 이전 단계의
  경로가 새 단계 위에 겹친다 — 사용자가 본 "섞임"의 절반.
- **`Shift+1~9` = 선택한 경로를 그 단계로 옮기기.** 재배치는 사라지지 않고 모디파이어를 얻었다.
  물리 키를 읽는다(`e.code`) — Shift를 누르면 `e.key`는 숫자가 아니라 문장부호다. 옮긴 뒤 **어디로
  갔는지 토스트**(`simple.stepMoved`).
- **결과를 붙잡는 동안 칩이 그 프레임의 단계를 가리킨다.** 붙잡음은 유지(`setCurrentStep(n, {
  keepResult: true })`) — 다시 park하면 단계의 **끝**에서 **시작**으로 되감긴다.
- **단계 핀은 자기 치유 전용.** 앵커가 **움직였을 때만** 시계를 옮긴다. 그리고 앵커는 재생 중에도
  물러서지 않는다(`ui.stepIsolate ? … : 0`, 종전 `isolating`은 `!playing`을 포함) — 재생/일시정지마다
  앵커가 0으로 갔다 오면 그 왕복이 "앵커가 움직였다"로 읽혀 매번 되감겼다.
- 안내 문구: `1~9 → 그 단계 보기`, `Shift+1~9 → 선택한 경로를 그 단계로 옮기기`,
  `경로 클릭 → 선택 — Delete·Shift+숫자`. 계측(1440×900): 전 행 단일 줄, 최대 힌트 폭 137px < 190px.

ADR-0009 **v28**이 v13/v26의 "숫자키·칩이 선택된 움직임을 재배치한다"를 명시적으로 대체한다.

Files: src/ui/stepPick.ts(신규), src/ui/StepBar.tsx, src/ui/useEditorKeyboard.ts,
src/ui/pitch/SimplePitch.tsx, src/editor/uiStore.ts, src/ui/keymap.ts, src/ui/i18n/ko.ts,
src/ui/AppShell.test.tsx, pw/step-view-fuzz.cjs(신규), pw/audit-manifest.json,
docs/agent/decisions/ADR-0009-simple-mode-interaction.md

Validation: typecheck/lint/**346 tests**/build/harness PASS. 브라우저 **164 probe checks ALL PASS**
(신규 12). 퍼즈는 8라운드 × 시드 3종(1·7·99, 각 225 조작)도 클린 — 토큰 최대 편차 0.22 m(스프링
정착분), 콘솔 클린. **신규 검사는 수정 전 코드에서 실제로 실패한다** — 되돌려 확인:
`no view op edited the tactic` FAIL, `pausing mid-play holds the frame` 1.67 → 0.00.

Related: PLAN-20260824-015(단계 격리), CHG-20260824-206, ADR-0009 v28
