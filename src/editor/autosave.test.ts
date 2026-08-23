// @vitest-environment jsdom
/**
 * The autosave contract, stated as what a user would notice.
 *
 * The point of the slot is that work survives a refresh; the point of the guards is that a bad save
 * can never lock the app shut — anything unreadable has to come back as "fresh pitch", never as a
 * throw. Both halves matter, and only one of them is the happy path.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyDocument } from '@/domain'
import type { TacticDocument } from '@/domain/types'
import { attachAutosave, restoreCore } from './autosave'
import { addPlayer, seedDefaultTeams } from './commands'
import { EditorCore } from './editorCore'
import { AUTOSAVE_KEY, saveAutosave } from './persistence'
import { makePath } from './segmentCommands'
import { addStepRun, relayoutStepsInDraft } from './stepCommands'

const board = () =>
  new EditorCore(seedDefaultTeams(createEmptyDocument({ id: 'r', now: '2026-08-22T00:00:00.000Z' })))

beforeEach(() => {
  localStorage.clear()
})
afterEach(() => {
  vi.useRealTimers()
  localStorage.clear()
})

describe('autosave — one slot, the board in front of you', () => {
  it('opens a fresh pitch when nothing has been saved', () => {
    expect(restoreCore()).toBeNull()
  })

  it('brings the saved board back', () => {
    const core = board()
    const team = core.getDocument().teams[0]!.id
    addPlayer(core, team, { x: 30, y: 40 })
    saveAutosave(core.getDocument())

    const back = restoreCore()
    expect(back).not.toBeNull()
    expect(back!.getDocument().players).toHaveLength(1)
    expect(back!.getDocument().players[0]!.home).toEqual({ x: 30, y: 40 })
  })

  it('a restored board starts with a CLEAN history — you come back to the board, not the session', () => {
    const core = board()
    addPlayer(core, core.getDocument().teams[0]!.id, { x: 30, y: 40 })
    saveAutosave(core.getDocument())
    const back = restoreCore()!
    expect(back.undo()).toBe(false)
  })

  it('an edit reaches the slot after the debounce', () => {
    vi.useFakeTimers()
    const core = board()
    const detach = attachAutosave(core, 50)
    addPlayer(core, core.getDocument().teams[0]!.id, { x: 12, y: 12 })
    vi.advanceTimersByTime(60)
    detach()
    const saved = JSON.parse(localStorage.getItem(AUTOSAVE_KEY)!) as TacticDocument
    expect(saved.players).toHaveLength(1)
  })

  it('attaching saves at once, so switching boards is durable without an edit', () => {
    const core = board()
    addPlayer(core, core.getDocument().teams[0]!.id, { x: 5, y: 5 })
    const detach = attachAutosave(core, 50)
    detach()
    expect(restoreCore()!.getDocument().players).toHaveLength(1)
  })

  it('stops saving once detached', () => {
    vi.useFakeTimers()
    const core = board()
    const detach = attachAutosave(core, 50)
    detach()
    addPlayer(core, core.getDocument().teams[0]!.id, { x: 60, y: 20 })
    vi.advanceTimersByTime(200)
    expect(restoreCore()!.getDocument().players).toHaveLength(0)
  })

  it('corrupt JSON opens a fresh pitch instead of throwing', () => {
    localStorage.setItem(AUTOSAVE_KEY, '{ this is not json')
    expect(restoreCore()).toBeNull()
  })

  it('a document from another schema opens a fresh pitch', () => {
    const doc = seedDefaultTeams(createEmptyDocument({ id: 'r', now: '2026-08-22T00:00:00.000Z' }))
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ ...doc, schemaVersion: 999 }))
    expect(restoreCore()).toBeNull()
  })

  it('a structurally broken document opens a fresh pitch', () => {
    const doc = seedDefaultTeams(createEmptyDocument({ id: 'r', now: '2026-08-22T00:00:00.000Z' }))
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ ...doc, pitch: { length: 0, width: -1 } }))
    expect(restoreCore()).toBeNull()
  })
})

describe('a restored board is settled before it is shown (audit F-M2-01)', () => {
  it('a saved document that is not a fixed point comes back settled, not on the first edit', () => {
    // A board saved by an older build can be valid yet unsettled. Simulate that exactly: move a
    // player's home away from where their run starts, which is the shape relayout heals by
    // pulling the run's first waypoint back onto the token.
    const core = board()
    addPlayer(core, core.getDocument().teams[0]!.id, { x: 30, y: 40 })
    const p = core.getDocument().players[0]!
    addStepRun(core, p.id, makePath([p.home, { x: p.home.x + 10, y: p.home.y }]).waypoints, 1)
    const settled = core.getDocument()

    const stale = structuredClone(settled) as TacticDocument
    stale.players.find((x) => x.id === p.id)!.home = { x: p.home.x + 3, y: p.home.y + 2 }
    saveAutosave(stale)
    expect(JSON.stringify(stale), 'the fixture must really be unsettled').not.toBe(
      (() => {
        const c = structuredClone(stale)
        relayoutStepsInDraft(c)
        return JSON.stringify(c)
      })(),
    )

    const restored = restoreCore()
    expect(restored).not.toBeNull()
    const shown = restored!.getDocument()

    // what came back is already a fixed point: another relayout changes nothing
    const again = structuredClone(shown) as TacticDocument
    relayoutStepsInDraft(again)
    expect(JSON.stringify(again)).toBe(JSON.stringify(shown))

    // and the run now leaves from the token, which is what the user will see move
    const seg = shown.scenes[0]!.timeline.tracks
      .flatMap((t) => t.segments)
      .find((s) => 'path' in s)! as { path: { waypoints: { p: { x: number; y: number } }[] } }
    const home = shown.players.find((x) => x.id === p.id)!.home
    const start = seg.path.waypoints[0]!.p
    expect(Math.hypot(start.x - home.x, start.y - home.y)).toBeLessThan(0.1)
  })

  it('a settled document is returned unchanged (the heal is a no-op)', () => {
    const core = board()
    addPlayer(core, core.getDocument().teams[0]!.id, { x: 30, y: 40 })
    const p = core.getDocument().players[0]!
    addStepRun(core, p.id, makePath([p.home, { x: p.home.x + 8, y: p.home.y }]).waypoints, 1)
    const saved = core.getDocument()
    saveAutosave(saved)
    const restored = restoreCore()!
    expect(JSON.stringify(restored.getDocument())).toBe(JSON.stringify(saved))
  })
})
