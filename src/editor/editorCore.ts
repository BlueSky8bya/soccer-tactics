/**
 * EditorCore — owns the TacticDocument and its undo/redo history.
 * Framework-agnostic (no React). See ADR-0005.
 *
 * Transaction model:
 *   transaction(label, recipe)            one-shot, one history entry
 *   begin(label) → update(recipe)* → commit() | cancel()
 *                                          continuous gesture (drag) = one entry
 *   coalesce: consecutive entries with the same coalesceKey within `coalesceWindowMs`
 *             merge into one (arrow-key nudges).
 *
 * History entries store structurally-shared before/after document references
 * (immer `produce`), so undo/redo is O(1) and memory cost ≈ changed paths only.
 */
import { produce, type Draft } from 'immer'
import type { TacticDocument } from '@/domain/types'

export type Recipe = (draft: Draft<TacticDocument>) => void

export interface HistoryEntry {
  label: string
  before: TacticDocument
  after: TacticDocument
  at: number
  coalesceKey?: string
}

export interface TransactionOptions {
  /** Entries with the same key merge if within coalesceWindowMs of the previous entry. */
  coalesceKey?: string
}

export interface EditorCoreOptions {
  historyLimit?: number
  coalesceWindowMs?: number
  /** Injected clock for tests. Editor layer only — never engine time. */
  now?: () => number
}

export interface EditorSnapshot {
  doc: TacticDocument
  revision: number
  canUndo: boolean
  canRedo: boolean
  inTransaction: boolean
}

type Listener = () => void

export class EditorCore {
  private doc: TacticDocument
  private revision = 0
  private past: HistoryEntry[] = []
  private future: HistoryEntry[] = []
  private active: { label: string; before: TacticDocument; coalesceKey?: string } | null = null
  private listeners = new Set<Listener>()
  private snapshot: EditorSnapshot | null = null

  private readonly historyLimit: number
  private readonly coalesceWindowMs: number
  private readonly now: () => number

  constructor(initial: TacticDocument, opts: EditorCoreOptions = {}) {
    this.doc = initial
    this.historyLimit = opts.historyLimit ?? 200
    this.coalesceWindowMs = opts.coalesceWindowMs ?? 500
    this.now = opts.now ?? (() => Date.now())
  }

  // ---------- read ----------

  getDocument(): TacticDocument {
    return this.doc
  }

  getRevision(): number {
    return this.revision
  }

  getSnapshot(): EditorSnapshot {
    if (!this.snapshot) {
      this.snapshot = {
        doc: this.doc,
        revision: this.revision,
        canUndo: this.past.length > 0,
        canRedo: this.future.length > 0,
        inTransaction: this.active !== null,
      }
    }
    return this.snapshot
  }

  get canUndo(): boolean {
    return this.past.length > 0
  }

  get canRedo(): boolean {
    return this.future.length > 0
  }

  get inTransaction(): boolean {
    return this.active !== null
  }

  get historyLength(): number {
    return this.past.length
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  // ---------- write ----------

  /** Replace the whole document (load). Clears history. */
  load(doc: TacticDocument): void {
    if (this.active) this.cancel()
    this.doc = doc
    this.past = []
    this.future = []
    this.bump()
  }

  /** One-shot transaction: one history entry. */
  transaction(label: string, recipe: Recipe, opts: TransactionOptions = {}): void {
    if (this.active) throw new Error(`transaction("${label}") while "${this.active.label}" is open`)
    const before = this.doc
    const after = produce(before, recipe)
    if (after === before) return // no-op: no entry, no revision bump
    this.doc = after
    this.pushEntry({ label, before, after, at: this.now(), coalesceKey: opts.coalesceKey })
    this.bump()
  }

  /** Start a continuous gesture. Subsequent update() calls are visible immediately but form one entry. */
  begin(label: string, opts: TransactionOptions = {}): void {
    if (this.active) throw new Error(`begin("${label}") while "${this.active.label}" is open`)
    this.active = { label, before: this.doc, coalesceKey: opts.coalesceKey }
    this.bump()
  }

  update(recipe: Recipe): void {
    if (!this.active) throw new Error('update() without begin()')
    const next = produce(this.doc, recipe)
    if (next === this.doc) return
    this.doc = next
    this.bump()
  }

  commit(): void {
    if (!this.active) throw new Error('commit() without begin()')
    const { label, before, coalesceKey } = this.active
    this.active = null
    if (this.doc !== before) {
      this.pushEntry({ label, before, after: this.doc, at: this.now(), coalesceKey })
    }
    this.bump()
  }

  cancel(): void {
    if (!this.active) throw new Error('cancel() without begin()')
    this.doc = this.active.before
    this.active = null
    this.bump()
  }

  undo(): boolean {
    if (this.active) this.cancel()
    const entry = this.past.pop()
    if (!entry) return false
    this.future.push(entry)
    this.doc = entry.before
    this.bump()
    return true
  }

  redo(): boolean {
    if (this.active) return false
    const entry = this.future.pop()
    if (!entry) return false
    this.past.push(entry)
    this.doc = entry.after
    this.bump()
    return true
  }

  // ---------- internals ----------

  private pushEntry(entry: HistoryEntry): void {
    this.future = []
    const last = this.past[this.past.length - 1]
    if (
      entry.coalesceKey &&
      last &&
      last.coalesceKey === entry.coalesceKey &&
      entry.at - last.at <= this.coalesceWindowMs
    ) {
      last.after = entry.after
      last.at = entry.at
      return
    }
    this.past.push(entry)
    if (this.past.length > this.historyLimit)
      this.past.splice(0, this.past.length - this.historyLimit)
  }

  private bump(): void {
    this.revision++
    this.snapshot = null
    for (const l of this.listeners) l()
  }
}
