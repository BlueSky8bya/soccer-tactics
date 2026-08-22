/**
 * Playback rates — one source, so the clock, the key hint and the on-board pill cannot disagree.
 *
 * Kept apart from `usePlayback` because `uiStore` needs the default at module-init time and
 * `usePlayback` already imports `uiStore`; importing back would close a cycle.
 */

/**
 * Normal tactical-time rate. 1.5× real time (user 2026-08-22: 기본보다 1.5배 더 빠르게) — a play
 * authored at walking pace reads sluggish when replayed second-for-second.
 */
export const NORMAL_SPEED = 1.5

/**
 * The hold factors a hand can pick: slow-motion study, brisk, fast. Chosen by grabbing the play
 * button and sliding left/right (user 2026-08-22); Space-HOLD multiplies the normal rate by the
 * chosen one.
 */
export const BOOST_FACTORS = [0.5, 2, 3] as const

/** Default hold factor — what the hint promises before the user picks one. */
export const BOOST_FACTOR = 3

/** Absolute clock rate while the hold is active, for the DEFAULT factor. */
export const BOOST_SPEED = NORMAL_SPEED * BOOST_FACTOR

/** How long Space must be down before a tap (play/pause) becomes a hold. */
export const HOLD_TO_BOOST_MS = 260

/** Rate as a multiple of normal playback — what a person means by "3배속". */
export function speedFactor(speed: number): number {
  return Math.round((speed / NORMAL_SPEED) * 10) / 10
}
