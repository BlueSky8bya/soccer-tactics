# Soccer Tactics

Interactive Football Tactics Sequencer — tactical board + motion path editor + timeline sequencer + scenario player.
Design football situations (11v11 down to 2v2, set pieces, transitions), give players and the ball independent motion tracks with timing and triggers, and play them back as deterministic animation.

Status: **M0 (harness + skeleton)**. See `docs/agent/CURRENT_STATE.md`.

## Develop

```bash
npm install
npm run dev
npm run typecheck && npm run lint && npm test && npm run build && npm run harness:verify
```

## Docs

- Product: `docs/product/PRODUCT_BRIEF.md`, `docs/product/UX_LAYOUT_PROPOSAL.md`, `docs/product/UX_RESEARCH.md`
- Agent harness (WHITEHAVEN): `AGENTS.md`, `agent-harness.yaml`, `docs/agent/`
- Decisions: `docs/agent/decisions/DECISION_INDEX.md`
