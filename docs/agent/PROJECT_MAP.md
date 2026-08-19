# Project Map — Soccer Tactics

> 라우팅용. 각 항목 1–3문장. 새 폴더가 생겼다고 모두 적지 않는다 — 경계가 있는 곳만.
> 상태: M0 (skeleton). "Arrives" 표기 = 아직 비어 있음.

| Path | Role | Main Entry | Input → Output | Local Instructions | Risk |
|---|---|---|---|---|---|
| `src/domain/` | Tactic Domain Model — 순수 타입·팩토리. JSON 직렬화 가능. ADR-0003 스키마 | `index.ts`, `types.ts` | — → 타입/문서 객체 | (engine 규칙 준용) `src/engine/AGENTS.md` | GENERAL |
| `src/engine/` | 순수 애니메이션 엔진: path(bezier, arc-length), compile(trigger→절대시간), stateAt(t). React/DOM/spring 금지 | `index.ts` | TacticDocument + t → ResolvedState | `src/engine/AGENTS.md` | GENERAL |
| `src/editor/` | documentStore / historyStore / uiStore, commands, transaction, tool state machine (ADR-0005). Arrives M1 | — | UI 이벤트 → command → doc patch | — (M1에 추가 예정) | GENERAL |
| `src/renderer/` | SVG pitch renderer: pitch, tokens, ball, paths, handles, ghosts. ResolvedState만 읽음. 재생 중 ref/rAF transform (ADR-0004). Arrives M1 | — | doc + ResolvedState → SVG | — | GENERAL |
| `src/ui/` | App shell(Option 3 레이아웃), tool rail, top bar, timeline, inspector, design tokens(`tokens.css`), UI motion(`motion/` spring — 유일 허용 위치) (ADR-0006) | `tokens.css`, `base.css` | — | `src/ui/AGENTS.md` | GENERAL |
| `src/presets/` | data-driven formation/scenario presets. constraint 아님. Arrives M1/M3 | — | preset id → 엔티티 배치/segments | — | GENERAL |
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
| 선수/공이 잘못된 시각에 있음 | `src/engine/` compile/stateAt + 테스트 |
| 드래그/스냅/undo 동작 | `src/editor/` (history, commands, tools) |
| 렌더 깨짐, 좌표 어긋남 | `src/renderer/` (viewBox, pointer→domain) |
| 패널/모션/토큰 | `src/ui/` |
| 포메이션 내용 | `src/presets/` |
| "왜 이렇게 했지?" | `docs/agent/decisions/DECISION_INDEX.md` |
