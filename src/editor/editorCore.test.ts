import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from '@/domain'
import { EditorCore } from './editorCore'

function makeCore(opts: { now?: () => number; historyLimit?: number } = {}) {
  const doc = createEmptyDocument({ id: 'd', now: '2026-08-19T00:00:00.000Z' })
  doc.teams.push({ id: 'A', name: 'A', color: '#00f', side: 'left' })
  doc.players.push({ id: 'p1', teamId: 'A', number: 1, home: { x: 10, y: 10 } })
  return new EditorCore(doc, { coalesceWindowMs: 500, ...opts })
}

describe('EditorCore', () => {
  it('one-shot transaction creates one entry; undo/redo round-trips identically', () => {
    const core = makeCore()
    const before = core.getDocument()
    core.transaction('move', (d) => {
      d.players[0]!.home = { x: 20, y: 20 }
    })
    const after = core.getDocument()
    expect(after.players[0]!.home).toEqual({ x: 20, y: 20 })
    expect(core.canUndo).toBe(true)
    expect(core.undo()).toBe(true)
    expect(core.getDocument()).toBe(before) // structural identity
    expect(core.canRedo).toBe(true)
    expect(core.redo()).toBe(true)
    expect(core.getDocument()).toBe(after)
  })

  it('no-op transaction does not create an entry', () => {
    const core = makeCore()
    const rev = core.getRevision()
    core.transaction('noop', () => {})
    expect(core.historyLength).toBe(0)
    expect(core.getRevision()).toBe(rev)
  })

  it('begin/update*/commit merges a drag into ONE entry; intermediate updates are visible', () => {
    const core = makeCore()
    core.begin('drag')
    for (let i = 1; i <= 50; i++) {
      core.update((d) => {
        d.players[0]!.home = { x: 10 + i, y: 10 }
      })
      expect(core.getDocument().players[0]!.home.x).toBe(10 + i)
    }
    core.commit()
    expect(core.historyLength).toBe(1)
    expect(core.getDocument().players[0]!.home.x).toBe(60)
    core.undo()
    expect(core.getDocument().players[0]!.home.x).toBe(10)
    core.redo()
    expect(core.getDocument().players[0]!.home.x).toBe(60)
  })

  it('cancel restores the pre-gesture document and leaves no entry', () => {
    const core = makeCore()
    const before = core.getDocument()
    core.begin('drag')
    core.update((d) => {
      d.players[0]!.home = { x: 99, y: 99 }
    })
    core.cancel()
    expect(core.getDocument()).toBe(before)
    expect(core.historyLength).toBe(0)
    expect(core.inTransaction).toBe(false)
  })

  it('commit with no changes leaves no entry', () => {
    const core = makeCore()
    core.begin('drag')
    core.commit()
    expect(core.historyLength).toBe(0)
  })

  it('new transaction after undo clears redo stack', () => {
    const core = makeCore()
    core.transaction('a', (d) => void (d.players[0]!.home.x = 1))
    core.transaction('b', (d) => void (d.players[0]!.home.x = 2))
    core.undo()
    expect(core.canRedo).toBe(true)
    core.transaction('c', (d) => void (d.players[0]!.home.x = 3))
    expect(core.canRedo).toBe(false)
    expect(core.getDocument().players[0]!.home.x).toBe(3)
  })

  it('coalesces nudges with the same key within the window', () => {
    let t = 1000
    const core = makeCore({ now: () => t })
    const nudge = () =>
      core.transaction('nudge', (d) => void (d.players[0]!.home.x += 0.5), {
        coalesceKey: 'nudge:p1',
      })
    nudge()
    t += 100
    nudge()
    t += 100
    nudge()
    expect(core.historyLength).toBe(1)
    expect(core.getDocument().players[0]!.home.x).toBe(11.5)
    t += 1000 // outside window
    nudge()
    expect(core.historyLength).toBe(2)
    core.undo()
    expect(core.getDocument().players[0]!.home.x).toBe(11.5)
    core.undo()
    expect(core.getDocument().players[0]!.home.x).toBe(10)
  })

  it('respects history limit (drops oldest)', () => {
    const core = makeCore({ historyLimit: 3 })
    for (let i = 1; i <= 5; i++) core.transaction(`t${i}`, (d) => void (d.players[0]!.home.x = i))
    expect(core.historyLength).toBe(3)
    core.undo()
    core.undo()
    core.undo()
    expect(core.canUndo).toBe(false)
    expect(core.getDocument().players[0]!.home.x).toBe(2) // oldest retained entry's `before`
  })

  it('undo during an open gesture cancels it first', () => {
    const core = makeCore()
    core.transaction('a', (d) => void (d.players[0]!.home.x = 1))
    core.begin('drag')
    core.update((d) => void (d.players[0]!.home.x = 50))
    core.undo()
    expect(core.inTransaction).toBe(false)
    expect(core.getDocument().players[0]!.home.x).toBe(10)
  })

  it('notifies subscribers and exposes a stable snapshot per revision', () => {
    const core = makeCore()
    let calls = 0
    const off = core.subscribe(() => calls++)
    const s1 = core.getSnapshot()
    expect(core.getSnapshot()).toBe(s1)
    core.transaction('a', (d) => void (d.players[0]!.home.x = 1))
    expect(calls).toBe(1)
    expect(core.getSnapshot()).not.toBe(s1)
    off()
    core.transaction('b', (d) => void (d.players[0]!.home.x = 2))
    expect(calls).toBe(1)
  })

  it('document stays JSON-serializable after edits', () => {
    const core = makeCore()
    core.transaction('a', (d) => void (d.players[0]!.home.x = 1))
    const doc = core.getDocument()
    expect(JSON.parse(JSON.stringify(doc))).toEqual(doc)
  })
})

describe('dangling ball holder (plan M1)', () => {
  it('applyFormation / clearTeam / removeEntities drop initialHolderId when the holder disappears', async () => {
    const { applyFormation, clearTeam, ensureDefaultTeams, removeEntities } =
      await import('./commands')
    const { giveBallTo } = await import('./segmentCommands')
    const doc = createEmptyDocument({ id: 'd', now: '2026-08-19T00:00:00.000Z' })
    const core = new EditorCore(doc)
    ensureDefaultTeams(core)
    const home = core.getDocument().teams[0]!
    applyFormation(core, home.id, '4-4-2')
    const p = core.getDocument().players[3]!
    giveBallTo(core, p.id)
    expect(core.getDocument().ball.initialHolderId).toBe(p.id)
    applyFormation(core, home.id, '4-3-3') // replaces players → holder gone
    expect(core.getDocument().ball.initialHolderId).toBeUndefined()
    const q = core.getDocument().players[0]!
    giveBallTo(core, q.id)
    removeEntities(core, [q.id])
    expect(core.getDocument().ball.initialHolderId).toBeUndefined()
    const r = core.getDocument().players[0]!
    giveBallTo(core, r.id)
    clearTeam(core, home.id)
    expect(core.getDocument().ball.initialHolderId).toBeUndefined()
  })
})
