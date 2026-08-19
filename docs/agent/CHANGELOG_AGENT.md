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
