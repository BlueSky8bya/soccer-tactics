# Local Agent Instructions — src/ui

## Role

Editor shell (Option 3 Focused Hybrid), tool rail, top bar, timeline (1-line + expandable tracks), inspector, contextual mini-bar, design tokens, and **interface motion** (`src/ui/motion/` — the only place springs are allowed).

## Read Before Editing

- `docs/agent/decisions/ADR-0006-interaction-and-motion-design.md` — spring table (D2), hit sizes/snap (D3), signature interactions (D4), disclosure (D5), keyboard (D7), visual language (D8).
- `docs/product/UX_LAYOUT_PROPOSAL.md` (Option 3), `docs/product/UX_RESEARCH.md` (why).
- `docs/agent/decisions/VDR-0001-reference-tactical-board.md` — anti-patterns to avoid.

## Invariants

- Two clocks: UI motion here (springs, 120–400ms, interruptible, honors `prefers-reduced-motion`); tactical playback time comes from the playback controller and is never spring-eased.
- Tokens only: colors/spacing/radius/motion from `tokens.css` (`--st-*`). No ad-hoc hex in components. No multicolor tool buttons.
- Pitch stays visual center: ≥65% width / ≥55% height with panels open. No layout jumps — panels slide.
- No modal dialogs in the core editing loop. Esc cancels; every edit goes through editor commands (never set document state directly).
- Hit targets: tokens ≥28px, handles/waypoints/playhead ≥16px, resize edges ≥8px. Keyboard shortcuts shown in tooltips.
- Max 2 disclosure levels (L1 base, L2 tracks/inspector).

## Allowed Changes

- New panels/components following tokens + ADR-0006 numbers; new spring presets if added to the D2 table.

## Restricted Changes

- Introducing a UI animation library (needs ADR-0002 update), changing the layout option, adding a third disclosure level, touching `src/engine` from here.

## Routing

- Spring/feel → `src/ui/motion/`
- Timeline blocks → `src/ui/timeline/` (reads CompiledTimeline, writes via commands)
- Inspector fields → `src/ui/inspector/`
- Tokens → `tokens.css`

## Verification

- `npm test` (jsdom for `src/ui/**`), `npm run harness:verify` (no spring imports in engine/renderer).
- DELEGATED (user): drag latency, snap feel, reduce-motion, pitch ratio — see DoD §3.

## Change Annotation

`[WH-CHANGE ...]` on interaction behavior changes (e.g., snap rules, shortcut remaps).
