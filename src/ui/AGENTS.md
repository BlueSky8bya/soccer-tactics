# Local Agent Instructions — src/ui

## Role

Single simple mode (ADR-0009): top bar + full-width pitch + play bar with step chips. All authoring
is mouse gestures on the pitch; **interface motion** lives in `src/ui/motion/` (the only place
springs are allowed).

## Read Before Editing

- `docs/agent/decisions/ADR-0009-simple-mode-interaction.md` — the gesture language and step model.
- `docs/agent/decisions/ADR-0006-interaction-and-motion-design.md` — springs (D2), hit sizes (D3),
  direct manipulation (D4). D5/D7 are superseded by ADR-0009.

## Invariants

- Two clocks: UI motion here (springs, interruptible, honors `prefers-reduced-motion`); tactical
  playback time comes from the playback controller and is never spring-eased.
- Tokens only: colors/spacing/radius/motion from `tokens.css` (`--st-*`).
- One mode. No tool rail, no inspector, no numeric timing UI. Timing comes from steps
  (`src/editor/stepCommands.ts` derives triggers) — never let the UI write triggers directly.
- Every edit goes through editor commands; components never set document state directly.
- No modal dialogs in the core loop (the ? overlay and the tour are overlays, not gates).

## Routing

- Pitch gestures (click add / drag / double-click draw / fling / badges) → `src/ui/pitch/SimplePitch.tsx`
- Step chips → `src/ui/StepBar.tsx`; step model → `src/editor/stepCommands.ts`
- Shell / play bar → `src/ui/AppShell.tsx`
- First-visit launcher → `src/ui/EmptyState.tsx`; interactive tour → `src/ui/tour/`
- Auto-react popover → `src/ui/AutoReactPanel.tsx`; file menu → `src/ui/DocMenu.tsx`
- Shortcuts overlay + tour restart → `src/ui/ShortcutsOverlay.tsx`; bindings → `src/ui/keymap.ts`
- Spring/feel → `src/ui/motion/`; team colour → `src/ui/teamColor.ts`; tokens → `tokens.css`

## Verification

- `npm test` (jsdom for `src/ui/**`), `npm run harness:verify` (no spring imports in engine/renderer).
- DELEGATED (user): gesture feel, tour, step comprehension — see DoD §3.

## Change Annotation

`[WH-CHANGE ...]` on interaction behavior changes (e.g., gesture remaps, step semantics).
