# Decision Index

| Record | Type | Status | Area | Decision / Artifact | Revisit Trigger |
|---|---|---|---|---|---|
| [ADR-0001](ADR-0001-product-identity-and-core-principles.md) | ADR | Accepted | product | Dynamic Tactical Sequencer, Animation 최우선, Formation=preset, Tactical vs UI motion, 직접 조작, Engine↔Render 분리 | 제품 방향 변경 |
| [ADR-0002](ADR-0002-frontend-stack.md) | ADR | Accepted | stack | React 19 + TS + Vite, Zustand+immer, CSS Modules+tokens, Vitest, oxlint | playback 성능, 스타일 선호 |
| [ADR-0003](ADR-0003-animation-engine-and-domain-model.md) | ADR | Accepted | engine / domain | TacticDocument 스키마, Track/Segment/Trigger, compile→stateAt, ball possession 모델 | 물리 시뮬 요구, Scene 계승 |
| [ADR-0004](ADR-0004-rendering-and-coordinates.md) | ADR | Accepted | renderer / coords | React SVG 단일 레이어, 미터 좌표(105×68) viewBox | freehand 성능, 다른 종목 |
| [ADR-0005](ADR-0005-editor-state-and-history.md) | ADR | Accepted | editor state | 3 store 분리, immer patches 기반 transactional undo/redo | — |
| [ADR-0006](ADR-0006-interaction-and-motion-design.md) | ADR | Accepted | interaction / motion | 두 시계, spring 표(duration+bounce), hit/스냅/rubber-band, path-scrub·record·on-canvas pill, 2단계 disclosure, Option 3, 키보드, 시각 언어 | 사용성 테스트, spring 품질 |
| [VDR-0001](VDR-0001-reference-tactical-board.md) | VDR | Accepted | visual | `decision-assets/VDR-0001/reference-tactical-board.png` — anti-reference + 기능 인벤토리 | 새 레퍼런스 제공 |
| [ADR-0007](ADR-0007-reactive-opponent-autoplay.md) | ADR | Accepted (Phase 1) | opponent AI | 규칙 기반 반응 생성기(segments 산출, 결정론·편집 가능) → Phase 2 학습 정책(ONNX) | Phase 1 체감 결과 |
| [ADR-0008](ADR-0008-attacking-transition-reaction.md) | ADR | Proposed | opponent AI | 소유 전환 후 공격 측 반응(support/run/width) — 제안만, 구현 금지 | 사용자 Phase 1 체감 후 |
