/**
 * Pure pointer-intent resolution for the simple-mode pitch (PLAN-005 M3, FRAG-02).
 * No DOM here: SimplePitch reduces the event to these flags, this module decides WHAT the press
 * means, SimplePitch then starts exactly one gesture. Priorities mirror the interaction contract:
 * same press → same result, path drag is ALWAYS bend (C-01), group move is live-token drag only.
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
  shift: boolean
  /** Ctrl or Meta. */
  ctrl: boolean
}

export interface PointerContext {
  /** A live token sits directly under a ghost press (the token wins). */
  liveTokenNearGhost: boolean
  /** An unbroken Shift zigzag chain is in progress. */
  chainActive: boolean
}

export type PointerIntent =
  | 'draw-from-ghost' // Shift+drag on a ghost: next movement starts at that future spot
  | 'press-live-token' // ghost press but a live token is underneath → treat as the token
  | 'adjust-ghost-end' // plain drag on a ghost: fine-tune that movement's end
  | 'draw-chain' // Shift held after a draw: next zigzag leg from the last end
  | 'draw-from-token' // Shift+drag on a live token: movement from its original spot
  | 'press-token' // plain press on a live token: select / move (group aware)
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
    if (mods.shift) return 'draw-from-ghost'
    if (ctx.liveTokenNearGhost) return 'press-live-token'
    return 'adjust-ghost-end'
  }
  // The chain continues on any non-token press while Shift stays down.
  if (mods.shift && left && ctx.chainActive && !hit.token) return 'draw-chain'
  if (hit.segment && !hit.token && left) return 'bend-path'
  if (hit.token && left) return mods.shift ? 'draw-from-token' : 'press-token'
  if (!hit.token && !hit.segment && hit.insidePitch && (left || mods.button === 2)) {
    if (!mods.ctrl) return left ? 'marquee' : 'none'
    return left ? 'add-home-player' : 'add-away-player'
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
