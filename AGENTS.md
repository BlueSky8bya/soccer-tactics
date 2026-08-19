# Agent Entry Point — Soccer Tactics

This repository uses the WHITEHAVEN Agent Harness (`project-initializing_260712.md`, schema 1.1). Manifest: `agent-harness.yaml`.

**Product in one line**: Interactive Football Tactics Sequencer — tactical board + motion path editor + timeline + scenario player. Animation/Timeline is the core, not a static board.

## Read order (before modifying anything)

1. `docs/agent/CONSTITUTION.md` — invariants and philosophy.
2. `docs/agent/CURRENT_STATE.md` — where we are, next exact steps.
3. `docs/agent/PROJECT_MAP.md` — route to the right folder; read that folder's `AGENTS.md` if present.
4. Relevant Accepted records in `docs/agent/decisions/DECISION_INDEX.md` (ADR-0001 product principles, ADR-0003 engine/domain, ADR-0004 render/coords, ADR-0005 state/history, ADR-0006 interaction/motion, VDR-0001 anti-reference).
5. For L2/L3 tasks: `docs/agent/plans/ACTIVE_PLAN.md` — create/update before implementing.
6. Only if needed: `docs/agent/handoffs/` latest, `docs/product/*`.

## Non-negotiables

- Inspect the repository before asking. Project-Owned Evidence (`reference_roots` in manifest) before external research.
- Resolve material ambiguity before structural (L2) or critical (L3) changes. Trivial tasks: no interviews.
- Minimum necessary change. No unrelated refactors, renames, dependency swaps.
- Preserve unrelated user changes. Check `git status` first.
- Do not silently override Accepted decision records; supersede explicitly.
- Never claim validation that was not executed. Report `PASS / FAIL / NOT RUN` with the command.
- Persist material user decisions in the same turn (ADR / VDR / Plan / Current State). If impossible, emit `UNPERSISTED DECISION`.
- BLOCKING rules are `MACHINE` or `UNENFORCED` per `agent-harness.yaml`; do not claim enforcement that is not verified.
- Keep `src/engine` and `src/domain` pure (no React/DOM/spring/wall-clock). Tactical motion is deterministic; springs live only in `src/ui/motion`.
- Update project memory (`CURRENT_STATE`, `PROJECT_MAP`, `CHANGELOG_AGENT`) when a change makes it stale.
- No destructive git, no auto commit, no auto push. Ask first.
- Leave a Handoff (`npm run harness:handoff -- <topic>`) at any Continuity Break.

## Verify

`npm run typecheck && npm run lint && npm test && npm run build && npm run harness:verify`
