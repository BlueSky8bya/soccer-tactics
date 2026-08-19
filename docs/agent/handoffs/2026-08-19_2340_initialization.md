# Handoff Snapshot — Initialization (M0)

Created: 2026-08-19 23:40
Agent / Tool: Claude Code (Fable 5)
Task: Project initialization per `project-initializing_260712.md` (Mode A, Empty Project)
Risk Level: L2
Project Version: 0.1.0

## Session Goal

빈 저장소 → WHITEHAVEN Harness + 제품 명세 + 아키텍처 결정 + HCI 근거 UX 설계 + Vite skeleton. 구현(M1+)은 승인 후.

## Completed

- Repository discovery (빈 폴더, 원격 빈 repo, node 22.14/npm 10.9), `git init -b main`, origin 설정. 커밋/push 없음.
- 제품 문서: `docs/product/PRODUCT_BRIEF.md`, `UX_LAYOUT_PROPOSAL.md`(Option 3 추천), `UX_RESEARCH.md`(39 출처).
- Decision Records (모두 Accepted): ADR-0001 제품 원칙, ADR-0002 Stack, ADR-0003 엔진/도메인, ADR-0004 렌더/미터 좌표, ADR-0005 상태/히스토리, ADR-0006 인터랙션/모션(spring 표, hit, path-scrub, record, 2단계 disclosure, 키보드), VDR-0001 레퍼런스(anti-reference, canonical png 존재).
- Harness: `AGENTS.md`, `CLAUDE.md`, `agent-harness.yaml`(BR 5개: ENGINE-001 MACHINE, 나머지 UNENFORCED), `docs/agent/{CONSTITUTION,CURRENT_STATE,PROJECT_MAP,RISK_PROFILE(GENERAL),DEFINITION_OF_DONE,CHANGELOG_AGENT}`, `decisions/DECISION_INDEX.md`, plans(완료 M0 → `completed/`, M1 Ready), `src/engine/AGENTS.md`, `src/ui/AGENTS.md`.
- Scripts: `verify-harness.mjs`(구조+순수성, negative test 통과), `state-drift-check.mjs`, `create-handoff.mjs`, `session-brief.mjs`. `.claude/settings.json` hooks(SessionStart/Stop) + permissions deny(git push/reset --hard/clean/restore/branch -D).
- Skeleton: Vite 8, React 19, TS 6(strict, noUncheckedIndexedAccess), Vitest 4, oxlint, Prettier, zustand/immer. `src/domain/types.ts`(ADR-0003 스키마 그대로), `factories.ts`+test, `src/engine/vec.ts`+test, `src/ui/tokens.css`/`base.css`, `src/app/*`.

## Files Touched

| File | Change | Change ID |
|---|---|---|
| (위 전체, 초기 생성) | create | CHG-20260819-001 |

## Decisions Made

- ADR-0001~0006, VDR-0001 (Accepted). A-01~A-06 Resolved (`plans/completed/PLAN-20260819-001-m0-initialization.md` Ambiguity Register).

## Decision Persistence

- 제품 정체성/원칙 → ADR-0001 · 요구사항 → PRODUCT_BRIEF · Stack → ADR-0002 · 엔진/도메인 → ADR-0003 + `src/domain/types.ts` · 렌더/좌표 → ADR-0004 · 상태 → ADR-0005 · HCI/모션 → ADR-0006 + UX_RESEARCH · 레퍼런스 해석 → VDR-0001 · 모호성 해소 → completed plan · 현재 → CURRENT_STATE.
- UNPERSISTED DECISION: None

## Validation Evidence

- `npm run typecheck` → PASS
- `npm run lint` → PASS
- `npm test` → PASS (2 files / 3 tests)
- `npm run build` → PASS
- `npm run format:check` → PASS
- `npm run harness:verify` → PASS; negative test → FAIL(exit 1) 확인
- Claude hooks 활성 → NOT VERIFIED (세션 중 생성, ISSUE-002)

## Verification Ownership

- Direct: 위 전부.
- Delegated: 없음(M0는 코드 기능 없음). M1부터 DoD §3 사용자 체크리스트.
- Shared: —

## Failed Attempts

### Attempt 1 — 단일 bash heredoc 배치로 다수 파일 쓰기
Hypothesis: 한 번에 쓰면 빠름. Result: bash 파싱 오류로 아무것도 안 써짐(CSS 2개 누락 → build 실패로 발견). Why abandoned: Write 툴/소분할로 전환. 교훈: 대량 heredoc 후 `ls`로 확인.

### Attempt 2 — jsdom 30, vitest `environmentMatchGlobs`, tsconfig `baseUrl`
Result: node 22.14 engine 경고 / vitest 4에서 옵션 제거됨 / TS 6 deprecated. Fix: jsdom ^27, 옵션 삭제(UI 테스트는 파일 상단 `// @vitest-environment jsdom`), `paths` 상대경로.

## Plan Reversals

| ID | New Evidence | Previous Plan | Replacement Plan |
|---|---|---|---|
| — (Plan Reversal 아님, 증거 갱신) | 사용자가 저장한 png ≠ 채팅 첨부 이미지 | VDR-0001 = 채팅 이미지 해석 | VDR-0001 canonical = 저장된 png(anti-reference), 채팅 이미지는 비canonical 기록, M-01 ledger |

## Open Questions

- B-01 선수 추가 방식, B-02 스냅 범위 (기본안 있음).
- 자체 spring vs `motion/react` (M1.4 체감 후).

## Known Risks

- ISSUE-002 hooks/deny 활성 미확인 → 다음 세션 시작 출력으로 확인.
- ISSUE-003 node 22.14 engine 경고(무해).
- 자체 spring 품질이 "탁 달라붙음"에 못 미칠 가능성 → ADR-0006 Revisit.

## Current Working Tree Notes

- uncommitted user changes: 없음(사용자가 추가한 것은 `docs/agent/decision-assets/VDR-0001/reference-tactical-board.png`뿐).
- agent changes: 전체(untracked). 커밋 0.

## Next Exact Step

1. 사용자 커밋 지시 시: `git add -A && git commit -m "chore: bootstrap WHITEHAVEN harness + project skeleton (M0)"` (push 별도).
2. "M1 시작" 시: `docs/agent/plans/ACTIVE_PLAN.md` Status → In Progress; M1.1 `src/editor/historyStore.ts` + 테스트부터.
3. 세션 시작 시 `[WHITEHAVEN harness] ... hook active` 출력 확인 → CURRENT_STATE ISSUE-002 갱신.

## Rollback

커밋 전: 폴더 전체 삭제 가능(사용자 자산은 png 1개 — 보존). 커밋 후: revert.

## Documents Updated

- CURRENT_STATE, PROJECT_MAP, CHANGELOG_AGENT, DECISION_INDEX, ACTIVE_PLAN(M1), completed/PLAN-…-001, ADR-0002(oxlint/TS6 반영), VDR-0001

## Documents Possibly Stale

- None
