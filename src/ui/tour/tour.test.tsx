// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createEmptyDocument } from '@/domain'
import { EditorCore } from '@/editor/editorCore'
import { EditorProvider } from '@/editor/EditorContext'
import { applyFormation, seedDefaultTeams } from '@/editor/commands'
import { addStepRun } from '@/editor/stepCommands'
import { makePath } from '@/editor/segmentCommands'
import { useUiStore } from '@/editor/uiStore'
import { AppShell } from '../AppShell'
import { hasSeenTour, markTourSeen, resetTourSeen } from './tourStorage'
import { MINI_TOUR_STEPS, TOUR_STEPS, nextPendingStep } from './tourSteps'

beforeAll(() => {
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    })
  }
  if (!('ResizeObserver' in window)) {
    ;(window as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  }
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = (cb) =>
      setTimeout(() => cb(performance.now()), 16) as unknown as number
    window.cancelAnimationFrame = (h) => clearTimeout(h)
  }
})

beforeEach(() => {
  resetTourSeen()
  useUiStore.setState({
    tour: { active: false, step: 0, set: 'main' as const },
    animMode: false,
    hasPlayed: false,
    timelineExpanded: false,
    autoReactOpen: false,
    selection: [],
    tool: 'select',
  })
})
afterEach(() => cleanup())

function mount() {
  const core = new EditorCore(
    seedDefaultTeams(createEmptyDocument({ id: 'd', now: '2026-08-19T00:00:00.000Z' })),
  )
  render(
    <EditorProvider core={core}>
      <AppShell />
    </EditorProvider>,
  )
  return core
}

const wait = (ms: number) => act(() => new Promise((r) => setTimeout(r, ms)))

describe('tourStorage', () => {
  it('remembers "seen" via localStorage/cookie and can be reset', () => {
    expect(hasSeenTour()).toBe(false)
    markTourSeen()
    expect(hasSeenTour()).toBe(true)
    localStorage.clear() // cookie alone still counts
    expect(hasSeenTour()).toBe(true)
    resetTourSeen()
    expect(hasSeenTour()).toBe(false)
  })
})

describe('tourSteps', () => {
  it('nextPendingStep skips unavailable/done steps and always stops at the terminal step', () => {
    const doc = createEmptyDocument({ id: 'd', now: '2026-08-19T00:00:00.000Z' })
    const ctx = {
      doc,
      entry: doc,
      hasPlayed: true,
      timelineExpanded: false,
      autoReactOpen: false,
      animMode: true,
      playScope: 'all' as const,
    }
    // players empty -> step 0 (place) pending
    expect(nextPendingStep(0, ctx)).toBe(0)
    // empty pitch from step 1 -> straight to the terminal card
    expect(nextPendingStep(1, ctx)).toBe(TOUR_STEPS.length - 1)
    expect(nextPendingStep(TOUR_STEPS.length - 1, ctx)).toBe(TOUR_STEPS.length - 1)
  })
})

describe('interactive tour (first visit)', () => {
  it('starts on first visit, advances when the pitch is filled, then when a run is drawn; skip marks seen', async () => {
    const core = mount()
    expect(useUiStore.getState().tour.active).toBe(true)
    const dlg = screen.getByRole('dialog', { name: '튜토리얼' })
    expect(dlg.textContent).toContain(TOUR_STEPS[0]!.title)
    // user performs step 1 (quick start)
    await act(async () => {
      screen.getByRole('button', { name: /양 팀 채우기/ }).click()
    })
    await wait(600)
    expect(useUiStore.getState().tour.step).toBe(1) // run step
    const p = core.getDocument().players[0]!
    await act(async () => {
      addStepRun(core, p.id, makePath([p.home, { x: p.home.x + 8, y: p.home.y }]).waypoints, 1)
    })
    await wait(600)
    expect(useUiStore.getState().tour.step).toBe(2)
    // skip → ends + remembered
    await act(async () => {
      screen.getByRole('button', { name: '건너뛰기' }).click()
    })
    expect(useUiStore.getState().tour.active).toBe(false)
    expect(hasSeenTour()).toBe(true)
  })

  it('does not start when already seen; can be restarted from the ? overlay', async () => {
    markTourSeen()
    mount()
    expect(useUiStore.getState().tour.active).toBe(false)
    expect(screen.queryByRole('dialog', { name: '튜토리얼' })).toBeNull()
    await act(async () => {
      useUiStore.getState().setShortcutsOpen(true)
    })
    await act(async () => {
      screen.getByRole('button', { name: /튜토리얼 다시 보기/ }).click()
    })
    expect(useUiStore.getState().tour.active).toBe(true)
  })

  it('skips steps that are already satisfied (returning user with players)', async () => {
    const core = mount()
    const home = core.getDocument().teams[0]!
    await act(async () => {
      applyFormation(core, home.id, '4-3-3')
    })
    await wait(600)
    // step 0 (fill pitch) auto-completes → step 1
    expect(useUiStore.getState().tour.step).toBe(1)
  })
})

describe('opt-in mini tour (PLAN-005 M6, C-04)', () => {
  it('has the edit-loop steps and its replay step completes on a scoped step playback', () => {
    expect(MINI_TOUR_STEPS.map((s) => s.id)).toEqual(['mini-bend', 'mini-step-replay', 'mini-undo'])
    const doc = createEmptyDocument({ id: 'd', now: '2026-08-19T00:00:00.000Z' })
    const base = {
      doc,
      entry: doc,
      hasPlayed: true,
      timelineExpanded: false,
      autoReactOpen: false,
      animMode: false,
    }
    const replay = MINI_TOUR_STEPS[1]!
    expect(replay.done({ ...base, playScope: 'all' })).toBe(false)
    expect(replay.done({ ...base, playScope: 'step' })).toBe(true)
    // terminal step never auto-advances
    expect(MINI_TOUR_STEPS[2]!.terminal).toBe(true)
    // bend step completes on any document change
    const doc2 = createEmptyDocument({ id: 'e', now: '2026-08-19T00:00:00.000Z' })
    expect(MINI_TOUR_STEPS[0]!.done({ ...base, playScope: 'all' })).toBe(false)
    expect(MINI_TOUR_STEPS[0]!.done({ ...base, doc: doc2, playScope: 'all' })).toBe(true)
  })
})
