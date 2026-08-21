/**
 * Session-only A/B/C tactic variants (PLAN-005 M5 + user 2026-08-20). Independent EditorCores —
 * separate documents AND separate undo histories — living purely in memory.
 *
 * The VARIANTS are still session-only: this class writes nothing anywhere, and B/C are gone on a
 * refresh. What survives is the board that was ACTIVE, saved to one slot by `autosave.ts` and
 * restored here as A (user 2026-08-22). Undo history is not saved either — you come back to the
 * board, not to the session.
 */
import { createEmptyDocument } from '@/domain'
import { seedDefaultTeams } from './commands'
import { EditorCore } from './editorCore'

export type VariantId = 'A' | 'B' | 'C'

export class VariantSession {
  /** Readable so the shell can key on the ACTIVE core's identity (autosave follows the board). */
  readonly cores: Partial<Record<VariantId, EditorCore>> = {}
  private active: VariantId = 'A'
  private listeners = new Set<() => void>()

  constructor(initial?: EditorCore) {
    this.cores.A =
      initial ?? new EditorCore(seedDefaultTeams(createEmptyDocument({ title: '제목 없는 전술' })))
  }

  get activeId(): VariantId {
    return this.active
  }

  get activeCore(): EditorCore {
    return this.cores[this.active]!
  }

  has(id: VariantId): boolean {
    return !!this.cores[id]
  }

  /**
   * Copy the ACTIVE document into `id` as a fresh core (independent history), then switch to it.
   * Documents are immutable (immer) — the clone shares structure safely; edits never cross over.
   */
  cloneActiveTo(id: VariantId): void {
    this.cores[id] = new EditorCore(this.activeCore.getDocument())
    this.switchTo(id)
  }

  /** Make `id` the active variant. No-op if it does not exist yet. */
  switchTo(id: VariantId): void {
    if (!this.cores[id] || id === this.active) return
    this.active = id
    for (const l of this.listeners) l()
  }

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }
}
