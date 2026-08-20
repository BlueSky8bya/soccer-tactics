// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createEmptyDocument } from '@/domain'
import { EditorCore } from '@/editor/editorCore'
import { EditorProvider } from '@/editor/EditorContext'
import { seedDefaultTeams } from '@/editor/commands'
import { addStepPass, addStepRun } from '@/editor/stepCommands'
import { makePath } from '@/editor/segmentCommands'
import { useUiStore } from '@/editor/uiStore'
import { AppShell } from './AppShell'
import { markTourSeen } from './tour/tourStorage'

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

afterEach(() => {
  cleanup()
  useUiStore.setState({
    selection: [],
    selectedSegmentId: null,
    drag: null,
    hover: null,
    currentStep: 1,
    tour: { active: false, step: 0, set: 'main' as const },
    playback: { t: 0, playing: false, speed: 1, loop: false },
    hasPlayed: false,
  })
})

function setup() {
  markTourSeen() // shell tests are not about the tour
  const core = new EditorCore(
    seedDefaultTeams(createEmptyDocument({ id: 'd', now: '2026-08-19T00:00:00.000Z' })),
  )
  const utils = render(
    <EditorProvider core={core}>
      <AppShell />
    </EditorProvider>,
  )
  return { core, ...utils }
}

describe('AppShell (simple mode, ADR-0009)', () => {
  it('renders pitch, ball, side panels, play bar and step chips', async () => {
    const { container } = setup()
    expect(screen.getByRole('application', { name: /pitch/i })).toBeTruthy()
    expect(container.querySelectorAll('[data-kind="ball"]').length).toBe(1)
    // play bar + step chips are always visible (no mode toggle)
    expect(screen.getByRole('button', { name: '재생' })).toBeTruthy()
    expect(screen.getByRole('group', { name: '단계' })).toBeTruthy()
  })

  it('fill button fills both teams with the ball assigned; one undo empties the pitch', async () => {
    const { core, container } = setup()
    await act(async () => {
      screen.getByRole('button', { name: /양 팀 채우기/ }).click()
    })
    expect(container.querySelectorAll('[data-kind="player"]').length).toBe(22)
    expect(core.getDocument().ball.initialHolderId).toBeDefined()
    await act(async () => {
      core.undo()
    })
    expect(container.querySelectorAll('[data-kind="player"]').length).toBe(0)
  })

  it('badge click only SELECTS; the action bar picker sets the exact step (PLAN-005 M2)', async () => {
    const { core, container } = setup()
    await act(async () => {
      screen.getByRole('button', { name: /양 팀 채우기/ }).click()
    })
    const p = core.getDocument().players[0]!
    await act(async () => {
      addStepRun(core, p.id, makePath([p.home, { x: p.home.x + 10, y: p.home.y }]).waypoints, 1)
    })
    expect(container.querySelectorAll('[data-segment]').length).toBeGreaterThan(0)
    const rev = core.getRevision()
    const badge = screen.getByRole('button', { name: /단계 1/ })
    await act(async () => {
      badge.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    })
    // no document change; the movement is selected and the action bar appears
    expect(core.getRevision()).toBe(rev)
    const seg = core
      .getDocument()
      .scenes[0]!.timeline.tracks.flatMap((t) => t.segments)
      .find((s) => 'path' in s)!
    expect(useUiStore.getState().selectedSegmentId).toBe(seg.id)
    expect(seg.step ?? 1).toBe(1)
    // picker: exact assignment 1 -> 5 in one change
    const picker = screen.getByRole('combobox', { name: /이 움직임의 단계/ })
    await act(async () => {
      const { fireEvent } = await import('@testing-library/react')
      fireEvent.change(picker, { target: { value: '5' } })
    })
    const seg2 = core
      .getDocument()
      .scenes[0]!.timeline.tracks.flatMap((t) => t.segments)
      .find((s) => 'path' in s)!
    expect(seg2.step).toBe(5)
  })

  it('움직임 전체 지우기 removes all authored movements in one undo entry', async () => {
    const { core } = setup()
    await act(async () => {
      screen.getByRole('button', { name: /양 팀 채우기/ }).click()
    })
    const d = core.getDocument()
    const [a, b] = d.players
    await act(async () => {
      addStepRun(core, a!.id, makePath([a!.home, { x: a!.home.x + 8, y: a!.home.y }]).waypoints, 1)
      addStepRun(core, b!.id, makePath([b!.home, { x: b!.home.x + 8, y: b!.home.y }]).waypoints, 2)
    })
    await act(async () => {
      screen.getByRole('button', { name: /움직임 전체 지우기/ }).click()
    })
    const segs = core
      .getDocument()
      .scenes[0]!.timeline.tracks.flatMap((t) => t.segments)
      .filter((s) => 'path' in s)
    expect(segs).toHaveLength(0)
    expect(core.getDocument().players.length).toBeGreaterThan(0)
    await act(async () => {
      core.undo()
    })
    const restored = core
      .getDocument()
      .scenes[0]!.timeline.tracks.flatMap((t) => t.segments)
      .filter((s) => 'path' in s)
    expect(restored).toHaveLength(2)
  })

  it('step chip preview moves UI time only - no document revision (PLAN-005 M1)', async () => {
    const { core } = setup()
    await act(async () => {
      screen.getByRole('button', { name: /양 팀 채우기/ }).click()
    })
    const d = core.getDocument()
    const [a, b] = d.players
    await act(async () => {
      addStepRun(core, a!.id, makePath([a!.home, { x: a!.home.x + 10, y: a!.home.y }]).waypoints, 1)
      addStepRun(core, b!.id, makePath([b!.home, { x: b!.home.x + 6, y: b!.home.y }]).waypoints, 2)
    })
    const rev = core.getRevision()
    const chip2 = screen.getByTitle(/^2단계/)
    await act(async () => {
      chip2.click()
    })
    const ui = useUiStore.getState()
    expect(ui.currentStep).toBe(2)
    expect(ui.playback.t).toBeGreaterThan(0) // preview seeks to the step-2 start
    expect(ui.playback.playing).toBe(false)
    expect(core.getRevision()).toBe(rev) // chip never mutates the document
    // scoped replay actions appear for a used step
    const stepOnly = screen.getByRole('button', { name: /이 단계만/ })
    await act(async () => {
      stepOnly.click()
    })
    const st = useUiStore.getState()
    expect(st.playback.playing).toBe(true)
    expect(st.playScope).toBe('step')
    expect(st.rangeEnd).not.toBeNull()
    expect(core.getRevision()).toBe(rev)
  })

  it('a pass in step 2 starts after the step-1 run ends (steps drive the timing)', async () => {
    const { core } = setup()
    await act(async () => {
      screen.getByRole('button', { name: /양 팀 채우기/ }).click()
    })
    const d0 = core.getDocument()
    const holder = d0.players.find((p) => p.id === d0.ball.initialHolderId)!
    const runner = d0.players.find((p) => p.teamId === holder.teamId && p.id !== holder.id)!
    let runId = ''
    await act(async () => {
      runId = addStepRun(
        core,
        runner.id,
        makePath([runner.home, { x: runner.home.x + 12, y: runner.home.y }]).waypoints,
        1,
      )
      addStepPass(
        core,
        makePath([d0.ball.home, { x: runner.home.x + 12, y: runner.home.y }]).waypoints,
        2,
        holder.id,
      )
    })
    const { compile } = await import('@/engine/compile')
    const c = compile(core.getDocument())
    expect(c.issues.filter((i) => i.level === 'error')).toHaveLength(0)
    const times = Object.entries(c.segmentTimes)
    const runEnd = c.segmentTimes[runId]!.end
    const pass = core
      .getDocument()
      .scenes[0]!.timeline.tracks.flatMap((t) => t.segments)
      .find((s) => s.kind === 'travel')!
    expect(c.segmentTimes[pass.id]!.start).toBeCloseTo(runEnd, 1)
    expect(times.length).toBeGreaterThan(1)
  })
})

describe('session A/B variants (PLAN-005 M5)', () => {
  it('empty slot click clones the board in; switch stops playback and clears selection', async () => {
    markTourSeen()
    const { App } = await import('@/app/App')
    render(<App />)
    // A active; B and C render as empty clone-in slots
    expect(screen.getByTitle(/지금 판을 B안으로 복제/)).toBeTruthy()
    expect(screen.getByTitle(/지금 판을 C안으로 복제/)).toBeTruthy()
    await act(async () => {
      screen.getByRole('button', { name: /양 팀 채우기/ }).click()
    })
    await act(async () => {
      screen.getByTitle(/지금 판을 B안으로 복제/).click()
    })
    expect(
      (screen.getByRole('button', { name: 'B' }) as HTMLButtonElement).getAttribute('aria-pressed'),
    ).toBe('true')
    // C is still an empty slot
    expect(screen.getByTitle(/지금 판을 C안으로 복제/)).toBeTruthy()
    // switching back stops playback and clears selection
    useUiStore.setState((st) => ({
      playback: { ...st.playback, playing: true, t: 2 },
      selection: ['someone'],
    }))
    await act(async () => {
      screen.getByRole('button', { name: 'A' }).click()
    })
    const ui = useUiStore.getState()
    expect(ui.playback.playing).toBe(false)
    expect(ui.playback.t).toBe(0)
    expect(ui.selection).toEqual([])
  })
})

describe('shell hierarchy (PLAN-006 M2)', () => {
  it('keeps the single simple-mode landmarks and all primary actions; no legacy chrome', async () => {
    const { container } = setup()
    // primary actions all reachable by name
    for (const name of [
      /양 팀 채우기/,
      /공 투입/,
      /움직임 전체 지우기/,
      /새로 시작/,
      /재생/,
      /처음으로/,
      /반복/,
    ])
      expect(screen.getByRole('button', { name })).toBeTruthy()
    expect(screen.getByRole('button', { name: /실행 취소/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /다시 실행/ })).toBeTruthy()
    // no timeline / scrubber / mode toggle / doc menu resurrection
    expect(container.querySelector('[class*="scrub"]')).toBeNull()
    expect(document.body.textContent).not.toContain('애니메이션 모드')
    expect(container.querySelector('input[type="range"]')).toBeNull()
  })
})
