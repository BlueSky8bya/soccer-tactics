# Project Map — Soccer Tactics

> 라우팅용. 각 항목 1–3문장. 새 폴더가 생겼다고 모두 적지 않는다 — 경계가 있는 곳만.
> 상태: end-to-end 구현 완료(M1–M5 core + 주석 + ADR-0007 P1). 사용자 리뷰 대기.

| Path | Role | Main Entry | Input → Output | Local Instructions | Risk |
|---|---|---|---|---|---|
| `src/domain/` | Tactic Domain Model — 순수 타입·팩토리. JSON 직렬화 가능. ADR-0003 스키마 | `index.ts`, `types.ts` | — → 타입/문서 객체 | (engine 규칙 준용) `src/engine/AGENTS.md` | GENERAL |
| `src/engine/` | 순수 엔진: `path.ts`, `compile.ts`, `stateAt.ts`(height/spin), `opponent.ts`(ADR-0007 규칙 기반 반응 생성), `vec.ts`. React/DOM/spring 금지 | `index.ts` | TacticDocument + t → ResolvedState / 반응 segments | `src/engine/AGENTS.md` | GENERAL |
| `src/editor/` | `EditorCore`, `commands.ts`, `segmentCommands.ts`, `moreCommands.ts`(자동대응·주석·문서 교체), `persistence.ts`(자동저장·JSON·SVG/PNG), `snap.ts`, `geometry.ts`, `uiStore.ts`, `useCompiled.ts`, `usePlayback.ts`, `EditorContext.tsx`(자동저장 시작) | `index.ts` | UI 이벤트 → command → doc | — | GENERAL |
| `src/renderer/` | **순수 SVG**: `PitchMarkings`, `Token`(공 패턴/회전/로빙), `PathLayer`, `DrawingLayer`(주석), `pointer.ts` | `Token.tsx` | doc/ResolvedState → SVG | — (spring 금지 MACHINE) | GENERAL |
| `src/ui/` | `AppShell`(라이트 기본, 우측 단일 컬럼), `DocMenu`(파일/예시), `AutoReactPanel`, `FormationPicker`, `Inspector`+`SegmentInspector`, `HelpPanel`(도킹), `ShortcutsOverlay`, `useEditorKeyboard`, `i18n/`, `motion/`(spring 유일), `pitch/`(`PitchStage` 제스처: drag/marquee/group/path/waypoint/shape/text/scrub, `pathPresentation.ts` ISSUE-006 표현, `pathScrub.ts` D4-1 역산, `AnimatedToken`, `EntityMiniBar`, `TextEditOverlay`), `timeline/`(`Timeline`, `trackView.ts` 팀 그룹/필터), `keymap.ts`(단일 키맵+MOUSE_POLICY) | `AppShell.tsx` | 상호작용 → commands | `src/ui/AGENTS.md` | GENERAL |
| `src/presets/` | `formations.json`+`formations.ts`, `scenarios.ts`(예시 문서 A/B) | `formations.ts` | preset → 문서/슬롯 | — | GENERAL |
| `src/app/` | Vite entry, App 루트 | `main.tsx`, `App.tsx` | — | — | GENERAL |
| `scripts/agent-harness/` | `verify-harness.mjs`(구조·순수성 검사), `state-drift-check.mjs`(경고), `create-handoff.mjs`, `session-brief.mjs` | — | repo → 검사 결과 | — | GENERAL |
| `.claude/` | Claude Code hooks + permissions deny | `settings.json` | — | — | GENERAL |
| `docs/agent/` | Harness 문서 (이 파일, Constitution, Current State, DoD, Risk, Changelog, decisions/, plans/, handoffs/, decision-assets/) | `CURRENT_STATE.md` | — | — | — |
| `docs/product/` | 제품 명세: PRODUCT_BRIEF, UX_LAYOUT_PROPOSAL, UX_RESEARCH | `PRODUCT_BRIEF.md` | — | — | — |

## 경계 메모

- **Generated / do not edit**: `node_modules/`, `dist/`, `node_modules/.tmp/*.tsbuildinfo`.
- **Data ownership**: TacticDocument는 `src/editor` documentStore가 소유. 다른 계층은 읽기 또는 command 호출만.
- **External boundary**: 없음(v1 서버 없음). M5에서 localStorage/JSON file.
- **Primary verification**: `npm run typecheck && npm run lint && npm test && npm run build && npm run harness:verify`.

## 문제 → 위치

| 문제 | 위치 |
|---|---|
| 선수/공이 잘못된 시각에 있음 | `src/engine/compile.ts`(trigger 해석) / `stateAt.ts` + `engine.test.ts` |
| 경로 그리기/waypoint 편집 | `src/ui/pitch/PitchStage.tsx` draw/waypoint 제스처, `segmentCommands.ts` |
| 타임라인 블록/재생/팀 필터 | `src/ui/timeline/Timeline.tsx`, `trackView.ts`, `editor/usePlayback.ts` |
| 단축키/모디파이어 정책 | `src/ui/keymap.ts` (KEYMAP, MOUSE_POLICY) |
| 자동 대응 품질 | `src/engine/opponent.ts` + `opponent.test.ts` |
| 드래그/스냅/undo 동작 | drag 제스처 `src/ui/pitch/PitchStage.tsx`, 스냅 규칙 `src/editor/snap.ts`, 히스토리 `src/editor/editorCore.ts` |
| 렌더 깨짐, 좌표 어긋남 | `src/renderer/` (viewBox, pointer→domain) |
| 패널/모션/토큰 | `src/ui/` (spring 표: `motion/spring.ts` SPRINGS) |
| 포메이션 내용 | `src/presets/` |
| "왜 이렇게 했지?" | `docs/agent/decisions/DECISION_INDEX.md` |
