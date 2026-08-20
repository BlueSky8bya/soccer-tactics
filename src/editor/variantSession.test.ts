import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from '@/domain'
import { addPlayer, seedDefaultTeams } from './commands'
import { EditorCore } from './editorCore'
import { VariantSession } from './variantSession'

function seededCore() {
  return new EditorCore(
    seedDefaultTeams(createEmptyDocument({ id: 'd', now: '2026-08-20T00:00:00.000Z' })),
  )
}

/** Session-only A/B variants (PLAN-005 M5, A-03a): independent docs, independent histories. */
describe('VariantSession', () => {
  it('clone copies the active document; edits after the clone never cross over', () => {
    const s = new VariantSession(seededCore())
    const team = s.activeCore.getDocument().teams[0]!
    addPlayer(s.activeCore, team.id, { x: 10, y: 10 })
    const countA = s.activeCore.getDocument().players.length

    s.cloneActiveTo('B')
    expect(s.activeId).toBe('B')
    expect(s.activeCore.getDocument().players.length).toBe(countA)

    // edit B → A untouched
    addPlayer(s.activeCore, team.id, { x: 20, y: 20 })
    expect(s.activeCore.getDocument().players.length).toBe(countA + 1)
    s.switchTo('A')
    expect(s.activeCore.getDocument().players.length).toBe(countA)

    // edit A → B untouched
    addPlayer(s.activeCore, team.id, { x: 30, y: 30 })
    addPlayer(s.activeCore, team.id, { x: 40, y: 40 })
    s.switchTo('B')
    expect(s.activeCore.getDocument().players.length).toBe(countA + 1)
  })

  it('undo/redo histories are independent per variant', () => {
    const s = new VariantSession(seededCore())
    const team = s.activeCore.getDocument().teams[0]!
    addPlayer(s.activeCore, team.id, { x: 10, y: 10 })
    s.cloneActiveTo('B')
    // B starts with a FRESH history: nothing to undo
    expect(s.activeCore.getSnapshot().canUndo).toBe(false)
    addPlayer(s.activeCore, team.id, { x: 20, y: 20 })
    expect(s.activeCore.getSnapshot().canUndo).toBe(true)
    s.activeCore.undo()
    const bCount = s.activeCore.getDocument().players.length
    // A's history is intact and undoes ITS edit only
    s.switchTo('A')
    expect(s.activeCore.getSnapshot().canUndo).toBe(true)
    s.activeCore.undo()
    expect(s.activeCore.getDocument().players.length).toBe(bCount - 0 - 1)
  })

  it('switching to a missing slot is a no-op; subscribers hear switches; nothing persists', () => {
    const s = new VariantSession(seededCore())
    let fired = 0
    s.subscribe(() => fired++)
    s.switchTo('B') // does not exist yet
    expect(s.activeId).toBe('A')
    expect(fired).toBe(0)
    s.cloneActiveTo('B')
    expect(fired).toBe(1)
    // the document carries no variant field — variants are session state only (RULE-05)
    expect('variant' in s.activeCore.getDocument()).toBe(false)
    expect(JSON.stringify(s.activeCore.getDocument())).not.toContain('"variant"')
  })
})

describe('third slot (user 2026-08-20)', () => {
  it('C clones from the ACTIVE variant and stays independent of A and B', () => {
    const s = new VariantSession(seededCore())
    const team = s.activeCore.getDocument().teams[0]!
    addPlayer(s.activeCore, team.id, { x: 10, y: 10 }) // A: +1
    s.cloneActiveTo('B')
    addPlayer(s.activeCore, team.id, { x: 20, y: 20 }) // B: +1 more
    s.cloneActiveTo('C') // C copies B
    const cCount = s.activeCore.getDocument().players.length
    addPlayer(s.activeCore, team.id, { x: 30, y: 30 }) // C: +1 more
    expect(s.activeCore.getDocument().players.length).toBe(cCount + 1)
    s.switchTo('B')
    expect(s.activeCore.getDocument().players.length).toBe(cCount)
    s.switchTo('A')
    expect(s.activeCore.getDocument().players.length).toBe(cCount - 1)
  })
})
