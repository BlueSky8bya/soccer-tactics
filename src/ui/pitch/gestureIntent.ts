/**
 * Pure pointer-intent resolution for the simple-mode pitch (PLAN-005 M3, FRAG-02).
 * No DOM here: SimplePitch reduces the event to these flags, this module decides WHAT the press
 * means, SimplePitch then starts exactly one gesture. Priorities mirror the interaction contract:
 * same press → same result, path drag is ALWAYS bend (C-01), group move is live-token drag only.
 * Draw modifier = Alt (user 2026-08-20; was Shift).
 */
import { MAX_STEP } from '@/editor/stepCommands'

export interface PointerHit {
  /** Press landed on a ghost (a future position of an entity). */
  ghost: boolean
  /** Press landed on an authored path line. */
  segment: boolean
  /** Press landed on a live token (player or ball). */
  token: boolean
  /** Pointer is inside the pitch rectangle. */
  insidePitch: boolean
}

export interface PointerMods {
  /** 0 = left, 2 = right. */
  button: number
  /** Path-drawing modifier is held (Alt — user 2026-08-20, replaced Shift). */
  draw: boolean
  /** Ctrl or Meta. */
  ctrl: boolean
}

export interface PointerContext {
  /** A live token sits directly under a ghost press (the token wins). */
  liveTokenNearGhost: boolean
  /** An unbroken Shift zigzag chain is in progress. */
  chainActive: boolean
  /**
   * A SUBJECT stands: one entity is selected, or a movement is (its entity is the subject —
   * clicking any faded token picked "that entity at that moment", 사진 3 2026-08-22). With a
   * subject chosen, Alt+click on grass needs no separate "arm" click — the selection IS the
   * arming. With nothing selected the press was inert anyway, so this costs no behaviour.
   */
  soloSelection: boolean
}

export type PointerIntent =
  | 'draw-from-ghost' // Alt+drag on a ghost: next movement starts at that future spot
  | 'press-live-token' // ghost press but a live token is underneath → treat as the token
  | 'adjust-ghost-end' // plain drag on a ghost: fine-tune that movement's end
  | 'draw-chain' // draw key held after a draw: next zigzag leg from the last end
  | 'draw-from-token' // Alt+drag on a live token: movement from its original spot
  | 'draw-to-point' // Alt+press on grass with ONE entity selected: straight path to here
  | 'press-token' // plain press on a live token: select / move (group aware)
  | 'press-token-additive' // Ctrl+press on a token: ADD to the selection (click toggles, drag moves all)
  | 'bend-path' // drag on a path line: ALWAYS bend its curvature (C-01)
  | 'marquee' // drag on empty grass: rubber-band selection
  | 'add-home-player' // Ctrl+click on grass
  | 'add-away-player' // Ctrl+right-click on grass
  | 'none'

export function resolvePointerIntent(
  hit: PointerHit,
  mods: PointerMods,
  ctx: PointerContext,
): PointerIntent {
  const left = mods.button === 0
  if (hit.ghost && left) {
    if (mods.draw) return 'draw-from-ghost'
    if (ctx.liveTokenNearGhost) return 'press-live-token'
    return 'adjust-ghost-end'
  }
  // The chain continues on any non-token press while the draw key stays down.
  if (mods.draw && left && ctx.chainActive && !hit.token) return 'draw-chain'
  if (hit.segment && !hit.token && left) return 'bend-path'
  if (hit.token && left)
    return mods.draw ? 'draw-from-token' : mods.ctrl ? 'press-token-additive' : 'press-token'
  if (!hit.token && !hit.segment && hit.insidePitch && (left || mods.button === 2)) {
    if (mods.ctrl) return left ? 'add-home-player' : 'add-away-player'
    if (left && mods.draw && ctx.soloSelection) return 'draw-to-point'
    return left ? 'marquee' : 'none'
  }
  return 'none'
}

/**
 * Step for the NEXT zigzag chain leg. Null = past the last step (A-05): the caller must block the
 * creation and explain, instead of silently stacking more movements onto step 9.
 */
export function nextChainStep(step: number): number | null {
  const next = step + 1
  return next > MAX_STEP ? null : next
}
