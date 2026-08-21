/**
 * Contextual shortcut highlighting (user 2026-08-22): while you hold Ctrl, the Ctrl shortcuts light
 * up; while the play is running, the Space ones do; while Alt is down for a path, the Alt ones.
 *
 * The whole problem is FLICKER. Modifiers are tapped, released and re-pressed faster than anyone
 * can read, and a panel that strobes with them is worse than one that never reacts at all — this
 * is exactly the WCAG 2.3.1/2.3.3 territory a flashing UI element strays into. So the raw state
 * never reaches the screen directly: it goes through a gate that needs a real hold to turn ON and
 * waits before turning OFF.
 *
 * Asymmetric on purpose. Entering is a claim ("you are doing this now") and must be earned by a
 * deliberate hold. Leaving is only a return to rest, so it lingers — which also means a quick
 * re-press inside the exit window never blinks, because the highlight was still on.
 *
 * Pure: no timers, no DOM. The hook feeds it a clock and it decides.
 */

/**
 * A cue is a STATE THE USER IS IN, not only a key they are holding.
 *
 * The modifier families answer "what does this key do"; the selection families answer the question
 * that actually comes first — "I clicked this thing, now what?" (user 2026-08-22: 공 클릭했을 때
 * 하이라이팅 되는 설명도 있어야지). They ride the same gate because a selection changes as fast as
 * a modifier does: clicking a crowded spot cycles player → ghost → path on each press.
 */
export type Cue = 'ctrl' | 'alt' | 'shift' | 'space' | 'ball' | 'player' | 'path'

/**
 * A modifier must be held this long before its shortcuts light up. Comfortably past a tap
 * (~50–120 ms) and under the ~1 s at which a wait becomes its own event.
 */
export const CUE_ENTER_MS = 180
/**
 * …and the highlight lingers this long after release. Longer than entering so drumming on a key
 * cannot strobe: the second press lands while the first is still lit.
 */
export const CUE_EXIT_MS = 340

export interface CueGateState {
  /** What the panel is currently showing. */
  on: boolean
  /** When the raw state first disagreed with `on`, or null when they agree. */
  since: number | null
}

export const idleCue: CueGateState = { on: false, since: null }

/**
 * Advance one cue's gate. Call it on every raw change AND on a tick while a change is pending —
 * a hold produces no events of its own, so something has to ask again.
 */
export function stepCueGate(prev: CueGateState, raw: boolean, now: number): CueGateState {
  if (raw === prev.on) return prev.since === null ? prev : { on: prev.on, since: null }
  const since = prev.since ?? now
  const need = raw ? CUE_ENTER_MS : CUE_EXIT_MS
  return now - since >= need ? { on: raw, since: null } : { on: prev.on, since }
}

/** True while any gate is mid-decision, i.e. something still has to tick it. */
export function cuesSettling(gates: Readonly<Record<Cue, CueGateState>>): boolean {
  return (Object.values(gates) as CueGateState[]).some((g) => g.since !== null)
}

export const CUES: readonly Cue[] = ['ctrl', 'alt', 'shift', 'space', 'ball', 'player', 'path']

export function emptyGates(): Record<Cue, CueGateState> {
  return {
    ctrl: idleCue,
    alt: idleCue,
    shift: idleCue,
    space: idleCue,
    ball: idleCue,
    player: idleCue,
    path: idleCue,
  }
}
