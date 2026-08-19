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
