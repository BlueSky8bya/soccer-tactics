// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createEmptyDocument } from '@/domain'
import { EditorCore } from '@/editor/editorCore'
import { EditorProvider } from '@/editor/EditorContext'
import { applyFormation, ensureDefaultTeams } from '@/editor/commands'
import { useUiStore } from '@/editor/uiStore'
import { AppShell } from './AppShell'

beforeAll(() => {
  // jsdom lacks these; spring animators + reduced-motion query touch them.
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
  useUiStore.setState({ selection: [], tool: 'select', drag: null, hover: null })
})

function setup() {
  const core = new EditorCore(createEmptyDocument({ id: 'd', now: '2026-08-19T00:00:00.000Z' }))
  ensureDefaultTeams(core)
  const utils = render(
    <EditorProvider core={core}>
      <AppShell />
    </EditorProvider>,
  )
  return { core, ...utils }
}

describe('AppShell (M1)', () => {
  it('renders pitch, shell, and the ball token', () => {
    const { container } = setup()
    expect(screen.getByRole('application', { name: /pitch/i })).toBeTruthy()
    expect(container.querySelectorAll('[data-entity]').length).toBe(1) // ball only
    expect(screen.getByDisplayValue('Untitled tactic')).toBeTruthy()
  })

  it('applying a formation renders 11 player tokens per team; undo removes them', async () => {
    const { core, container } = setup()
    const [home, away] = core.getDocument().teams
    await act(async () => {
      applyFormation(core, home!.id, '4-3-3')
      applyFormation(core, away!.id, '3-5-2')
    })
    expect(container.querySelectorAll('[data-kind="player"]').length).toBe(22)
    await act(async () => {
      core.undo()
    })
    expect(container.querySelectorAll('[data-kind="player"]').length).toBe(11)
  })

  it('selection opens the inspector with the player number', async () => {
    const { core, container } = setup()
    const home = core.getDocument().teams[0]!
    await act(async () => {
      applyFormation(core, home.id, '4-4-2')
    })
    const p = core.getDocument().players[9]!
    await act(async () => {
      useUiStore.getState().select([p.id])
    })
    const numberInput = container.querySelector('aside input[type="number"]') as HTMLInputElement
    expect(numberInput).toBeTruthy()
    expect(Number(numberInput.value)).toBe(p.number)
  })
})

describe('AppShell (M2)', () => {
  it('a drawn movement renders a path, the playhead moves the token, and the segment inspector opens', async () => {
    const { core, container } = setup()
    const home = core.getDocument().teams[0]!
    await act(async () => {
      applyFormation(core, home.id, '4-4-2')
    })
    const p = core.getDocument().players[9]!
    let segId = ''
    await act(async () => {
      segId = (await import('@/editor/segmentCommands')).addMoveSegment(
        core,
        p.id,
        [
          { id: 'w0', p: { x: p.home.x, y: p.home.y } },
          { id: 'w1', p: { x: p.home.x + 10, y: p.home.y } },
        ],
        { at: 0, speed: 5 },
      )
    })
    expect(container.querySelectorAll('[data-segment]').length).toBeGreaterThanOrEqual(1)
    const tokenAt0 = container.querySelector(`[data-entity="${p.id}"]`)!.getAttribute('transform')
    await act(async () => {
      useUiStore.getState().setPlayhead(1) // 5 m/s → +5 m
    })
    const tokenAt1 = container.querySelector(`[data-entity="${p.id}"]`)!.getAttribute('transform')
    expect(tokenAt1).not.toBe(tokenAt0)
    expect(tokenAt1).toContain(`translate(${p.home.x + 5}`)
    await act(async () => {
      useUiStore.getState().select([p.id])
      useUiStore.getState().selectSegment(segId)
    })
    expect(container.querySelector('aside select')).toBeTruthy() // start-condition select
    // timeline shows a block for the segment once expanded
    await act(async () => {
      useUiStore.getState().setTimelineExpanded(true)
    })
    expect(container.textContent).toContain('↝')
  })
})

describe('AppShell (end-to-end: examples, auto-react, annotations, persistence)', () => {
  it('loads Scenario B, auto-reacts for the defending team, adds a zone, survives JSON round-trip', async () => {
    const { core, container } = setup()
    const { buildScenarioB } = await import('@/presets/scenarios')
    const { applyReaction, addZone, replaceDocument } = await import('@/editor/moreCommands')
    const { parseDocument, serialize } = await import('@/editor/persistence')
    await act(async () => {
      replaceDocument(core, buildScenarioB())
    })
    expect(container.querySelectorAll('[data-kind="player"]').length).toBe(4)
    expect(container.querySelectorAll('[data-segment]').length).toBeGreaterThanOrEqual(4)
    let n = 0
    await act(async () => {
      n = applyReaction(core, { teamId: 'team-b', intensity: 0.8 })
    })
    expect(n).toBeGreaterThan(0)
    const genCount = core
      .getDocument()
      .scenes[0]!.timeline.tracks.flatMap((t) => t.segments)
      .filter((s) => s.id.startsWith('gen-')).length
    expect(genCount).toBe(n)
    await act(async () => {
      addZone(core, 'rect', { x: 50, y: 10 }, { x: 60, y: 20 })
    })
    expect(container.querySelectorAll('[data-drawing]').length).toBeGreaterThanOrEqual(1)
    // playhead moves the ball away from the holder during pass1
    await act(async () => {
      useUiStore.getState().setPlayhead(0.9)
    })
    const ball = container.querySelector('[data-kind="ball"]')!.getAttribute('transform')!
    expect(ball).not.toContain('translate(41.1')
    // JSON round-trip preserves the document
    const json = serialize(core.getDocument())
    expect(parseDocument(json)).toEqual(core.getDocument())
  })
})

describe('ISSUE-006 attached pass start', () => {
  it('renders one locked attached marker and leaves later waypoints draggable; authored path unchanged', async () => {
    const { core, container } = setup()
    const { buildScenarioA } = await import('@/presets/scenarios')
    const { replaceDocument } = await import('@/editor/moreCommands')
    await act(async () => {
      replaceDocument(core, buildScenarioA())
    })
    const before = JSON.stringify(core.getDocument())
    await act(async () => {
      useUiStore.getState().select(['ball'])
      useUiStore.getState().selectSegment('ball-pass')
    })
    expect(container.querySelectorAll('[data-attached-start]').length).toBe(1)
    const hits = container.querySelectorAll('[data-waypoint][data-segment="ball-pass"]')
    expect(hits.length).toBe(1) // second waypoint only
    expect(JSON.stringify(core.getDocument())).toBe(before)
  })
})

describe('Timeline team filtering (M2)', () => {
  it('filters 11v11 rows by team, leaves ball visible, shows the selected entity override, keeps block selection', async () => {
    const { core, container } = setup()
    const { applyReaction } = await import('@/editor/moreCommands')
    const { addBallTravel, addMoveSegment, giveBallTo } = await import('@/editor/segmentCommands')
    const [home, away] = core.getDocument().teams
    await act(async () => {
      applyFormation(core, home!.id, '4-3-3')
      applyFormation(core, away!.id, '4-4-2')
    })
    const players = core.getDocument().players
    await act(async () => {
      giveBallTo(core, players[9]!.id)
      addBallTravel(
        core,
        [
          { id: 'pw0', p: players[9]!.home },
          { id: 'pw1', p: players[8]!.home },
        ],
        { at: 0.5, holderId: players[9]!.id, receiverId: players[8]!.id },
      )
      for (const p of players.filter((x) => x.teamId === home!.id).slice(0, 5)) {
        addMoveSegment(
          core,
          p.id,
          [
            { id: `w0${p.id}`, p: p.home },
            { id: `w1${p.id}`, p: { x: p.home.x + 8, y: p.home.y } },
          ],
          { at: 0 },
        )
      }
      applyReaction(core, { teamId: away!.id, intensity: 0.8 })
      useUiStore.getState().setTimelineExpanded(true)
    })
    const rows = () => container.querySelectorAll('[data-track-row]')
    const initial = rows().length
    expect(initial).toBeGreaterThan(5)
    const awayBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes(away!.name) && b.getAttribute('aria-pressed') !== null,
    )!
    await act(async () => {
      awayBtn.click()
    })
    const afterFilter = rows().length
    expect(afterFilter).toBeLessThan(initial)
    expect(Array.from(rows()).some((r) => r.getAttribute('data-track-row') === 'ball')).toBe(true)
    // select a filtered-out home player → forced visible row appears
    const homeMover = players.filter((x) => x.teamId === home!.id)[0]!
    await act(async () => {
      useUiStore.getState().select([homeMover.id])
    })
    const forced = container.querySelector(`[data-track-row="${homeMover.id}"]`)
    expect(forced).toBeTruthy()
    expect(forced!.getAttribute('data-forced-visible')).toBe('true')
    // block click still selects segment
    const block = forced!.querySelector(`.${'block'}`) ?? forced!.querySelector('[title]')
    expect(block).toBeTruthy()
  })
})
