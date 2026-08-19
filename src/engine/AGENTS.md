# Local Agent Instructions — src/engine (and src/domain)

## Role

Pure tactical animation engine: path geometry (polyline/cubic bezier, arc-length LUT), `compile(doc)` (trigger graph → absolute times, derived ball events), `stateAt(compiled, t)`. `src/domain` holds the serializable types/factories the engine consumes.

## Read Before Editing

- `docs/agent/decisions/ADR-0003-animation-engine-and-domain-model.md` (schema, compile, stateAt, Scenario A)
- `docs/agent/decisions/ADR-0004-rendering-and-coordinates.md` (metres, origin top-left)
- `docs/product/PRODUCT_BRIEF.md` §6 (animation requirements, Scenario A)

## Invariants (BLOCKING BR-ENGINE-001 — MACHINE via `npm run harness:verify`)

- No imports from `react`, `react-dom`, `motion`, `framer-motion`, `zustand`, or DOM globals. No `Date.now()`, `performance.now()`, `requestAnimationFrame`, `Math.random()` in engine code paths.
- Deterministic: same `(doc, t)` → identical `ResolvedState`. No hidden state, no caching keyed by time.
- Tactical motion never overshoots or bounces unless the segment's `easing` says so. Springs are forbidden here.
- Ball ≠ player: possession attach/detach; `ball.released` / `ball.received` are derived at compile time, never stored.
- Trigger cycles → `CompileError` (never silent fallback).
- Domain types are plain data (JSON-safe): no classes, functions, Dates.

## Allowed Changes

- New pure functions with tests. Extending `Segment`/`Trigger` unions per ADR-0003 (update the ADR + `SCHEMA_VERSION` policy if serialized shape changes).

## Restricted Changes

- Changing `schemaVersion` semantics, coordinate unit, or the meaning of `Timing` without updating ADR-0003/ADR-0004 and a migration note.
- Adding a dependency.

## Data / Control Flow

`TacticDocument` → `compile` → `CompiledTimeline` (immutable) → `stateAt(t)` → `ResolvedState`. Clock lives in `src/ui` playback controller, not here.

## Verification

- `npm test` — every engine module has a `*.test.ts`. Scenario A assertions (ADR-0003) must stay green from M2 on.
- `npm run harness:verify` — purity grep.

## Change Annotation

Behavior changes get `[WH-CHANGE ...]` at the function/segment-resolution boundary, not per line.
