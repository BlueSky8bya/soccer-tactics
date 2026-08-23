/**
 * Autosave wiring — ONE SLOT, the board in front of you.
 *
 * Supersedes ADR-0009's "새로고침 = 완전 클린" (user 2026-08-22, after asking what it buys). What it
 * buys: a refresh, a closed tab, a browser crash or a new deploy no longer throws the work away.
 *
 * localStorage, not a cookie: nothing leaves the browser, there is no backend to have, and the
 * budget is megabytes rather than the 4 KB a cookie carries to the server on every request. A board
 * with ten movements serialises to about 5.7 KB.
 *
 * Deliberately ONE slot. This is "carry on where you left off", not a tactic library — the saved
 * board is whichever variant is active, and it comes back as A. Keeping several tactics, or moving
 * one to another machine, is what JSON export is for and is a separate decision.
 */
import { EditorCore } from './editorCore'
import { loadAutosave, saveAutosave, startAutosave } from './persistence'
import { relayoutStepsInDraft } from './stepCommands'

/**
 * The board to open with: the last one saved, or null for a fresh pitch.
 *
 * Anything unreadable — corrupt JSON, an older schema, a document that fails validation — comes
 * back as null rather than throwing, so a bad save can never lock the app shut. `loadAutosave`
 * validates; this only decides what to do about it.
 */
export function restoreCore(): EditorCore | null {
  const doc = loadAutosave()
  if (!doc) return null
  /*
   * SETTLE WHAT COMES OUT OF STORAGE. `relayoutStepsInDraft` already promises that "every route in
   * and every document out of storage arrives consistent, whatever created it" — but the load path
   * only VALIDATED, so a document saved by an older build (whose relayout resolved things
   * differently) came back as a non-fixed-point and was silently rewritten by the user's first
   * edit instead: the board they left is not quite the board that moves (audit F-M2-01).
   *
   * Doing it here makes the correction happen once, visibly, at the moment the board appears —
   * and for a document that IS already settled it is a no-op by construction (byte-idempotence,
   * invariant I9).
   */
  const healed = structuredClone(doc)
  relayoutStepsInDraft(healed)
  return new EditorCore(healed)
}

/**
 * Keep `core` saved while it is the active board. Returns a detach function.
 *
 * Saves once up front so that merely switching variants is durable, then on every change after a
 * short debounce. Re-attach when the active variant changes.
 */
export function attachAutosave(core: EditorCore, delayMs?: number): () => void {
  saveAutosave(core.getDocument())
  return startAutosave(core, delayMs)
}
