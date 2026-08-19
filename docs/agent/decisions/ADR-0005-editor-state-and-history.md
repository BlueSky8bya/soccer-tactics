# ADR-0005: Editor State Architecture and Undo/Redo History

Status: Accepted (2026-08-19 세션 2 — 사용자 추천안 채택, 이의 없음)
Date: 2026-08-19
Decision Owners: Agent proposal / User approval
Related: ADR-0001 (원칙 10,11), ADR-0002, ADR-0003

## Context

직접 조작 에디터. drag 전체 = 1 undo step. 모든 mousemove를 히스토리에 넣으면 안 됨. Playback/selection 같은 UI 상태는 undo 대상 아님. Document는 직렬화 가능해야 함.

## Decision (Proposed)

세 store 분리 (Zustand):

```text
documentStore   TacticDocument + revision counter        ← undo/redo 대상
historyStore    { past: Entry[], future: Entry[] }        Entry = { label, patches, inversePatches, at }
uiStore         selection, activeTool, hover, panels, playback {t, playing, speed, loop}, viewBox   ← undo 대상 아님
```

Command/Transaction 규약:
- 모든 document 변경은 `dispatch(command)` 또는 `transaction(label, draft => …)` 경유. 컴포넌트가 doc을 직접 set 금지.
- `immer.produceWithPatches`로 patch/inversePatch 수집. 히스토리 Entry = patch 묶음.
- **Transaction 경계 = 사용자 의미 단위**: `beginTransaction("선수 이동")` → 드래그 중 `update()` 여러 번(같은 entry에 병합, 화면은 즉시 반영) → `commit()` / `cancel()`(Esc → inverse 적용). 즉 drag start~end가 한 step.
- Inspector 숫자 입력: blur/enter 시 1 entry. 연속 slider도 pointerup까지 1 entry.
- Undo/Redo는 inversePatches/patches 재적용 → O(patch). 전체 스냅샷 복사 없음.
- 히스토리 상한(예: 200) 초과 시 가장 오래된 것 drop.
- 재생 중 편집 허용(Edit after playback). 편집 → revision 증가 → compile memo 무효 → 다음 프레임 반영.
- Selection은 uiStore지만 undo로 엔티티가 사라지면 selection 정리(구독으로 처리).

compile memo: `compiledFor(revision)` — revision 단위 캐시 1개.

## Considered Options

- Redux Toolkit + redux-undo: 보일러플레이트 큼, redux-undo는 action 단위라 drag 병합에 별도 처리 필요.
- zundo(zustand temporal): 스냅샷 기반 → 큰 doc에서 메모리 비효율, transaction 병합 세밀 제어 부족.
- useReducer+Context: 성능·selector 부족.
→ Zustand + immer patches 자체 history (코드 ~150줄) 선택.

## Consequences

- (+) drag 1 step, Esc cancel 자연스러움(Sense of Control).
- (+) patch 기반 → 추후 "변경 diff 공유/협업" 확장 여지 (non-goal이지만 막지 않음).
- (−) 자체 구현이므로 단위테스트 필수 (begin/update/commit/cancel/undo/redo 시나리오).

## Validation

- `editor/history` 단위테스트: 드래그 병합, cancel 복구, undo→redo 왕복 동일성, 상한.
- verify: 컴포넌트에서 `documentStore.setState` 직접 호출 없음(grep/lint).
