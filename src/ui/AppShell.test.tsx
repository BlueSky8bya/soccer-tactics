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
    tour: { active: false, step: 0 },
    animMode: false,
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

  it('a drawn run renders a path with a step badge; the badge advances the step', async () => {
    const { core, container } = setup()
    await act(async () => {
      screen.getByRole('button', { name: /양 팀 채우기/ }).click()
    })
    const p = core.getDocument().players[0]!
    await act(async () => {
      addStepRun(core, p.id, makePath([p.home, { x: p.home.x + 10, y: p.home.y }]).waypoints, 1)
    })
    expect(container.querySelectorAll('[data-segment]').length).toBeGreaterThan(0)
    const badge = screen.getByRole('button', { name: /단계 1/ })
    await act(async () => {
      badge.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    })
    const d = core.getDocument()
    const seg = d.scenes[0]!.timeline.tracks.flatMap((t) => t.segments).find((s) => 'path' in s)!
    expect(seg.step).toBe(2)
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
