# Active ExecPlan

Plan ID: PLAN-20260819-002
Status: Ready (M0 완료. 사용자 "시작" 시 In Progress)
Task Risk: L2 (신규 기능 — Tactical Board Foundation)
Created: 2026-08-19
Updated: 2026-08-19

## Objective

M1 — Tactical Board Foundation: pitch 렌더, 팀/선수/공 배치·선택·drag, 미터 좌표, data-driven formation preset, transactional undo/redo, Option 3 shell 뼈대. ADR-0006 조작감(지연 0 drag, 스냅 spring, hit 크기)을 M1부터 적용.

## Verifiable End State

- `npm run dev`에서: 빈 pitch → Formation 선택(4-4-2 등) → 양 팀 11명 배치 → 선수/공 drag(지연 0, Esc cancel) → 스냅(정렬 가이드·랜드마크) 시 spring 정착 → Ctrl+Z/Shift+Z로 drag 단위 undo/redo → 패널 열려도 pitch ≥65% 폭.
- 단위테스트: history(drag 병합·cancel·undo/redo 왕복·상한), preset schema, pointer→domain 변환, spring helper(bounce 0 비오버슈트).
- typecheck/lint/test/build/harness:verify PASS.

## Scope

- `src/editor/`: documentStore(Zustand+immer, revision), historyStore(patches, transaction begin/update/commit/cancel, 상한 200), uiStore(selection, tool, viewBox, panels), commands(addPlayer/movePlayer/moveBall/applyFormation/removeEntity/nudge), tool state machine(select/move 만).
- `src/renderer/`: `PitchSvg`(viewBox 0 0 105 68, 라인·센터서클·박스·스팟·코너), `TokenLayer`(팀색 원+번호, hit ≥28px), `BallToken`, `SnapGuides`, pointer→domain(`getScreenCTM().inverse()` 단일 지점).
- `src/ui/`: AppShell(Option 3: 얇은 top bar, 좌 tool rail 48px, 우 Inspector 슬라이드(선택 시), 하단 1줄 재생바 placeholder), `motion/spring.ts`(duration+bounce → stiffness/damping, rAF, 재타깃 속도 계승, reduced-motion), FormationPicker(검색+최근), tokens 확장.
- `src/presets/formations.json` + schema guard + 테스트: 4-4-2, 4-2-3-1, 4-3-3, 4-1-4-1, 4-3-1-2, 4-2-2-2, 4-1-2-1-2, 3-4-3, 3-4-2-1, 3-5-2, 5-4-1, 5-3-2 (미터 좌표, side 미러링).
- 키보드: V 선택, Ctrl/Cmd+Z/Shift+Z, Delete, Esc, 화살표 nudge 0.5m(Shift 2m, 500ms 병합), Alt 스냅 해제, Tab 다음 엔티티.

## Out of Scope

- 경로/타임라인/재생(M2), 공 possession 의미(M3), freehand/annotation(M4), 저장(M5), `motion/react` 도입.

## Relevant Context

- ADR-0004 (SVG/미터), ADR-0005 (store/history), ADR-0006 (D2 spring 표, D3 hit/스냅, D6 레이아웃, D7 키보드, D8 시각), VDR-0001 배제 항목, `src/ui/AGENTS.md`, `src/engine/AGENTS.md`, DoD §3.

## Assumptions

| Assumption | Impact | Evidence | Status |
|---|---|---|---|
| 자체 spring helper로 "탁 달라붙음" 충분 | Medium | ADR-0006 D2, 단순 2차 spring | Open — M1 체감 후 판정 |
| 팀 기본 2개(좌/우), 선수 번호 1–11 자동 | Low | PRODUCT_BRIEF §5 | Assumed |
| formation 좌표는 자체 정의(일반 축구 관행), FC 버전 비의존 | Medium | A-04 (a) | Confirmed |

## Ambiguity Register

| ID | Question | Materiality | Options | Recommendation | Resolution |
|---|---|---|---|---|---|
| B-01 | 선수 추가 방식 | Low | (a) tool rail "선수" 클릭 후 pitch 클릭 (b) 팀 팔레트에서 drag-in (c) 둘 다 | (c) — M1은 (a)+Formation, (b)는 M4 | Open (기본 (a)) |
| B-02 | 스냅 가이드 범위 | Low | 정렬선만 / +랜드마크 / +그리드 | 정렬선+랜드마크, 그리드 없음 | Open (기본안) |

## Plan Reversal Log

| ID | Previous Plan / Assumption | New Evidence | Invalidated Scope | Replacement Plan | Preserved Work |
|---|---|---|---|---|---|
| — | — | — | — | — | — |

## Milestones

### M1.1 — Stores + History
Goal: documentStore/historyStore/uiStore, transaction API, commands 골격.
Files: `src/editor/{documentStore,historyStore,uiStore,transaction,commands/*}.ts` + tests.
Validation: `npm test` history 시나리오(drag 병합·cancel·undo/redo 왕복·상한).
Rollback: M1.1 커밋 revert (UI 미연결).

### M1.2 — Pitch + Tokens + Drag
Goal: SVG pitch, token/ball 렌더, pointer→domain, drag(지연 0, transaction), 선택 링.
Files: `src/renderer/{PitchSvg,TokenLayer,BallToken,pointer}.tsx`, `src/ui/AppShell.tsx` 최소.
Validation: pointer 변환 단위테스트; DELEGATED: drag 체감.
Rollback: revert.

### M1.3 — Formation Presets
Goal: `formations.json`, schema guard, applyFormation command(좌/우 미러), FormationPicker.
Validation: preset 테스트(11명, 경계 내 좌표); DELEGATED: 적용 후 자유 이동.
Rollback: revert.

### M1.4 — Snap + Spring + Keyboard + Shell
Goal: 정렬 가이드·랜드마크 스냅, `motion/spring.ts`, 드롭/스냅 spring(0.35s, b0.25), Inspector 슬라이드(선택 시), 키보드 세트.
Validation: spring 테스트(bounce 0 비오버슈트, 정착), DELEGATED: 스냅 "달라붙음", Esc, reduce-motion.
Rollback: revert.

## Final Acceptance Criteria

- [ ] End State 시나리오 DELEGATED 확인(사용자)
- [ ] 테스트 전부 PASS, harness:verify PASS
- [ ] CURRENT_STATE/PROJECT_MAP/CHANGELOG 갱신, `[WH-CHANGE]` 불필요(신규)
- [ ] Pitch ≥65% 폭 스크린샷

## Validation Commands

```text
npm run typecheck && npm run lint && npm test && npm run build && npm run harness:verify
npm run dev  # DELEGATED 체크
```

## Rollback Strategy

M1.x 커밋 단위 revert. engine/domain 변경 없음(domain 타입 추가 시 SCHEMA_VERSION 유지—직렬화 shape 불변).

## Progress Log

### 2026-08-19
- Plan 작성(Ready). 시작 대기.
