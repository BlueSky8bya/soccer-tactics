# Active ExecPlan

Plan ID: PLAN-20260819-001
Status: Completed (2026-08-19 세션 2 — M0 산출물 전부 생성·검증. 커밋은 사용자 요청 시)
Task Risk: L2 (신규 제품 구조 설계 + Harness 초기화)
Created: 2026-08-19
Updated: 2026-08-19 (세션 2)

## Objective

Soccer Tactics 프로젝트의 Agent Harness 초기화 + 제품 명세·아키텍처 확정 + 구현 milestone 수립. 구현 자체는 승인 후.

## Verifiable End State

- Harness 필수 문서 존재(AGENTS/CLAUDE/agent-harness.yaml/CONSTITUTION/CURRENT_STATE/PROJECT_MAP/RISK_PROFILE/DoD/CHANGELOG/DECISION_INDEX/handoffs).
- ADR-0002~0005 Accepted (또는 사용자 수정 반영).
- VDR-0001 canonical artifact 존재 → Accepted.
- Vite+React+TS skeleton 생성, `typecheck/lint/test/build` PASS.
- Initialization Handoff 작성.

## Scope

- Harness 생성, Decision Records, 제품 브리프, 레이아웃 제안, milestone 정의, 프로젝트 skeleton(M0).

## Out of Scope

- M1 이후 기능 구현 (별도 Plan).
- GitHub push (사용자 명시 요청 시만).

## Relevant Context

- `docs/product/PRODUCT_BRIEF.md`, `docs/product/UX_LAYOUT_PROPOSAL.md`
- `docs/agent/decisions/ADR-0001..0005`, `VDR-0001`
- 사용자 관행 참고: 형제 프로젝트 `../VIC Schedule studio` (npm, Korean docs, Claude hooks) — 내용 복사 금지

## Assumptions

| Assumption | Impact | Evidence | Status |
|---|---|---|---|
| npm 사용 | Low | node 22/npm 10 설치, pnpm/yarn 없음 | Confirmed |
| Harness 문서 한국어 | Low | 형제 프로젝트 관행 | Assumed (이의 없으면 유지) |
| v1 백엔드 없음 | High | 프롬프트 §29 | Confirmed |
| 데스크톱 1차 | Medium | 레퍼런스 이미지 landscape | Open (A-03) |
| 좌표 미터 | High | ADR-0004 제안 | Open (A-02) |

## Ambiguity Register

| ID | Question | Materiality | Options | Recommendation | Resolution |
|---|---|---|---|---|---|
| A-01 | v1 Persistence 범위 | High (M5 범위, schema 버저닝 시점) | (a) 없음 (b) localStorage 자동저장 + JSON 파일 export/import (c) 백엔드 | **(b)** | Resolved: (b) 기본안 (세션 2, 사용자 이의 없음) |
| A-02 | 도메인 좌표 단위 | High (모든 데이터) | (a) 정규화 0..1 (b) 미터 105×68 | **(b)** | Resolved: (b) 미터 → ADR-0004 Accepted |
| A-03 | 대상 디바이스 | Medium (레이아웃) | (a) 데스크톱만 (b) 데스크톱+태블릿 가로 (c) 모바일 포함 | **(b)** | Resolved: **PC(데스크톱, 마우스+키보드) 1차** — 사용자 명시(세션 2). 태블릿은 후순위 |
| A-04 | Formation preset 범위 / EA FC 버전 | Medium (데이터 소스) | (a) 일반 formation 라이브러리만 (b) 특정 FC 버전 preset 대응(버전 명시 필요) | **(a) v1**, FC 버전 확정 시 (b) 추가 | Resolved: (a) 기본안 |
| A-05 | UI 언어 | Medium (문자열 구조) | (a) 한국어 (b) 영어 (c) i18n 준비 + 한국어 기본 | **(c)** | Resolved: (c) 기본안 |
| A-06 | Editor 레이아웃 | Medium | Option 1/2/3 (`UX_LAYOUT_PROPOSAL.md`) | **Option 3** | Resolved: Option 3 + HCI 근거 재검토(ADR-0006) — 사용자 "HCI적으로 PC에서 편리" 지시 |

## Plan Reversal Log

| ID | Previous Plan / Assumption | New Evidence | Invalidated Scope | Replacement Plan | Preserved Work |
|---|---|---|---|---|---|
| — | — | — | — | — | — |

## Milestones (제안)

### M0 — Project Initialization (이 Plan)
Goal: Harness + 명세 + ADR + skeleton.
Files: `AGENTS.md`, `CLAUDE.md`, `agent-harness.yaml`, `docs/agent/**`, `docs/product/**`, Vite scaffold(`package.json`, `src/app`, `src/domain`, `src/engine`, `src/editor`, `src/renderer`, `src/ui`, `src/presets`), `scripts/agent-harness/verify-harness.mjs`.
Validation: `npm run typecheck && npm run lint && npm test && npm run build`, `npm run harness:verify`.
Rollback: 저장소 초기 커밋 이전 → 폴더 내용 삭제(사용자 자산 없음).

### M1 — Tactical Board Foundation
Goal: pitch 렌더, 팀/선수/공 배치, 선택, drag, 미터 좌표, formation preset(data), undo/redo 기반.
Scope: `domain/` 타입+팩토리, `renderer/Pitch`, `renderer/Token`, `editor/store+history+commands`, `presets/formations.json`, tool rail(select/move), 상단바 Undo/Redo.
Validation: history 단위테스트, 브라우저에서 drag→undo→redo(DELEGATED 시각), typecheck/lint/test/build.
Rollback: M1 커밋 범위 revert.

### M2 — Motion Path + Timeline Core
Goal: player/ball path, waypoint/handle 편집, duration/speed/delay, 독립 track, compile, stateAt, play/pause/seek/speed, 결정론.
Scope: `engine/path`(bezier, arc-length), `engine/compile`, `engine/stateAt`, `editor/tools/path`, `renderer/PathLayer+Handles`, `ui/Timeline`(1줄+tracks 펼침), playback controller(rAF).
Validation: engine 단위테스트(Scenario A 타이밍 단언), 동일 doc 2회 재생 stateAt 동일성 테스트, 브라우저 scrub(DELEGATED).
Rollback: M2 커밋 범위 revert; engine은 순수 모듈이라 M1 UI 영향 없음.

### M3 — Football Scenario Semantics
Goal: possession attach/detach, pass/through/cross/shot travel, receive 이벤트, afterSegment/onEvent trigger UI(Inspector 드롭다운), Scenario A 템플릿, 세트피스 preset.
Scope: `engine/ball`, `editor/tools/ball`, Inspector 시작조건 UI, `presets/scenarios/`.
Validation: Scenario A end-to-end(테스트+시각), trigger 순환 오류 UI.
Rollback: M3 revert.

### M4 — Interaction & Apple-like Polish
Goal: 직접 조작 정교화(snap/guide, ghost preview, path 강조), UI spring(motion 도입 여부 결정), contextual 미니바, Inspector 슬라이드, a11y(키보드 이동, focus ring, reduced-motion), design token 정리.
Validation: 키보드 전용 조작 체크리스트(DELEGATED), reduced-motion 동작, Playwright 도입 여부 결정.
Rollback: M4 revert.

### M5 — Persistence / Export / Sharing (A-01 결정 후)
Goal: localStorage 자동저장, JSON export/import, schema 버전 마이그레이션 훅, PNG/SVG 정지 export, (검토) GIF/WebM.
Rollback: M5 revert.

## Final Acceptance Criteria (M0)

- [x] Harness 문서 세트 존재·상호 링크 유효 (harness:verify PASS)
- [x] ADR-0002~0006 Accepted
- [x] VDR-0001 canonical artifact 존재 → Accepted
- [x] skeleton typecheck/lint/test/build PASS
- [x] Initialization Handoff 작성, CURRENT_STATE 일치

## Validation Commands

```text
npm run typecheck
npm run lint
npm test
npm run build
npm run harness:verify
```

## Rollback Strategy

M0 산출물은 문서+scaffold. 문제 시 커밋 단위 revert. 사용자 기존 자산 없음.

## Progress Log

### 2026-08-19 (세션 1)
- 저장소 조사: 빈 폴더, 원격 빈 repo, Mode A. `git init -b main`, origin 설정(commit/push 없음).
- 작성: PRODUCT_BRIEF, UX_LAYOUT_PROPOSAL, ADR-0001(Accepted), ADR-0002~0005(Proposed), VDR-0001(Proposed), 본 Plan, CURRENT_STATE.
- 대기: A-01~A-06 사용자 답변, VDR-0001 이미지 저장.

### 2026-08-19 (세션 2)
- 사용자: 레퍼런스 png 저장(채팅 이미지와 다른 보드 → VDR-0001 M-01 ledger), "절대로 이대로 하지 말 것", HCI 근거 설계 + Apple spring 조작감 요구, PC 대상.
- A-01~A-06 Resolved(A-03 PC 명시, 나머지 기본안). ADR-0002~0005 Accepted. VDR-0001 Accepted.
- HCI 조사 39출처 → `docs/product/UX_RESEARCH.md` → ADR-0006 Accepted(두 시계, spring 표, hit/스냅, path-scrub/record/on-canvas pill, 2단계 disclosure, Option 3, 키보드, 시각 언어).
- Harness 생성: AGENTS/CLAUDE/agent-harness.yaml/CONSTITUTION/PROJECT_MAP/RISK_PROFILE/DoD/CHANGELOG, scripts 4종, .claude/settings.json(hooks+deny).
- Skeleton: Vite 8/React 19/TS 6/Vitest 4/oxlint/Prettier, domain types+factories, engine/vec, tokens.css. jsdom 30→27 (node 22.14 engine).
- 검증: typecheck PASS, lint PASS, test 2 files/3 tests PASS, build PASS, format:check PASS, harness:verify PASS(+negative test로 BR-ENGINE-001 차단 확인).
- Plan Reversal 없음. M0 Acceptance Criteria 전부 충족(커밋 제외) → Completed. 다음: PLAN-20260819-002 (M1).
