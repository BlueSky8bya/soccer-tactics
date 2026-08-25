// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createEmptyDocument } from '@/domain'
import type { Id } from '@/domain/types'
import { EditorCore } from '@/editor/editorCore'
import { EditorProvider } from '@/editor/EditorContext'
import { seedDefaultTeams } from '@/editor/commands'
import { addStepPass as addStepPassRaw, addStepRun as addStepRunRaw } from '@/editor/stepCommands'
import { makePath } from '@/editor/segmentCommands'
import { BOOST_FACTOR, BOOST_SPEED, NORMAL_SPEED } from '@/editor/playbackRates'
import { useUiStore } from '@/editor/uiStore'
import { AppShell } from './AppShell'
import { GUIDE_PLAY_BINDINGS, KEYMAP } from './keymap'
import { markTourSeen } from './tour/tourStorage'

/** These commands refuse past step 9; every case here stays well inside, so assert non-null once. */
const addStepRun = (...a: Parameters<typeof addStepRunRaw>): Id => addStepRunRaw(...a)!
const addStepPass = (...a: Parameters<typeof addStepPassRaw>): Id => addStepPassRaw(...a)!


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
  // Vitest's jsdom runs with pretendToBeVisual, so a REAL-timer rAF exists here. Under full-suite
  // CPU load those 16ms timers fire during `await act(...)` and the playback controller finishes
  // short ranges (an empty board plays out in 0.2s) before the assertion runs — `playing` flips
  // back to false and the failure moves between tests (G0, PLAN-014). No test in this file needs
  // frames to fire, so swallow them: schedule into a queue that nothing ever pumps.
  const rafQueue = new Map<number, FrameRequestCallback>()
  let rafId = 0
  window.requestAnimationFrame = (cb) => {
    rafQueue.set(++rafId, cb)
    return rafId
  }
  window.cancelAnimationFrame = (h) => {
    rafQueue.delete(h)
  }
})

afterEach(() => {
  cleanup()
  // Full reset: the old field list forgot playScope/rangeStart/rangeEnd/completion/boostFactor,
  // so a finished playback in one test leaked 'held-result' into the next (G0, PLAN-014).
  useUiStore.setState(useUiStore.getInitialState(), true)
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

/**
 * 팀 구성 / 보드 are toolbar MENUS since ADR-0009 v31 — the left column they used to live in is
 * gone. Opening one is now part of pressing anything inside it, so the tests say so out loud
 * rather than reaching for a button that is not on screen.
 */
function menuButton(menu: '팀 구성' | '보드', name: RegExp): HTMLButtonElement {
  const trigger = screen.getByRole('button', { name: menu })
  // its own act(): the card has to be rendered before the row inside it can be queried
  if (trigger.getAttribute('aria-expanded') !== 'true') act(() => trigger.click())
  return screen.getByRole('button', { name }) as HTMLButtonElement
}

/** Open the menu, press the row, and let both renders settle. */
async function pressInMenu(menu: '팀 구성' | '보드', name: RegExp) {
  await act(async () => {
    screen.getByRole('button', { name: menu }).click()
  })
  await act(async () => {
    screen.getByRole('button', { name }).click()
  })
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
    await pressInMenu('팀 구성', /양 팀 채우기/)
    expect(container.querySelectorAll('[data-kind="player"]').length).toBe(22)
    expect(core.getDocument().ball.initialHolderId).toBeDefined()
    await act(async () => {
      core.undo()
    })
    expect(container.querySelectorAll('[data-kind="player"]').length).toBe(0)
  })

  it('badge click only SELECTS; the action bar picker sets the exact step (PLAN-005 M2)', async () => {
    const { core, container } = setup()
    await pressInMenu('팀 구성', /양 팀 채우기/)
    const p = core.getDocument().players[0]!
    await act(async () => {
      addStepRun(core, p.id, makePath([p.home, { x: p.home.x + 10, y: p.home.y }]).waypoints, 1)
    })
    expect(container.querySelectorAll('[data-segment]').length).toBeGreaterThan(0)
    const rev = core.getRevision()
    /*
     * Under step isolation every drawn path is the current step, so every badge would show the
     * same digit — they are hidden there and only the SELECTED movement keeps its badge (the badge
     * is the in-place picker, so that one has to stay reachable). This test is about the picker,
     * so it asks for the all-steps view first, exactly as a user would.
     */
    await act(async () => {
      screen.getByRole('button', { name: /^전체$/ }).click()
    })
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
    /*
     * A CHIP ONLY LOOKS. It used to retarget the selected movement — matching what the bare number
     * key did — and that turned reading a tactic step by step into rewriting it (user 2026-08-24:
     * 계속 누르니까 단계들이 서로 섞여서 보임). ADR-0009 v28: the view keys look, Shift files.
     */
    const chip5 = screen.getByTitle(/^5단계 —/)
    await act(async () => {
      chip5.click()
    })
    const afterChip = core
      .getDocument()
      .scenes[0]!.timeline.tracks.flatMap((t) => t.segments)
      .find((s) => 'path' in s)!
    expect(core.getRevision()).toBe(rev)
    expect(afterChip.step ?? 1).toBe(1)
    expect(useUiStore.getState().currentStep).toBe(5)
    // and a pick drops the selection, so the step you left stops being painted over the one you chose
    expect(useUiStore.getState().selectedSegmentId).toBe(null)
    // …and it SHOWS that step: a pick switches the view, whatever view you were in (v28)
    expect(useUiStore.getState().stepIsolate).toBe(true)

    // Exact assignment 1 -> 5, with the modifier that means it: Shift+5 on the selected movement.
    // Back to the all-steps view first — under isolation the step-1 badge is not on the board to
    // press, which is the whole point of isolation.
    await act(async () => {
      screen.getByRole('button', { name: /^전체$/ }).click()
    })
    await act(async () => {
      screen.getByRole('button', { name: /단계 1/ }).dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true }),
      )
    })
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: '%', code: 'Digit5', shiftKey: true, bubbles: true }),
      )
    })
    const seg2 = core
      .getDocument()
      .scenes[0]!.timeline.tracks.flatMap((t) => t.segments)
      .find((s) => 'path' in s)!
    expect(seg2.step).toBe(5)
  })

  it('움직임 전체 지우기 removes all authored movements in one undo entry', async () => {
    const { core } = setup()
    await pressInMenu('팀 구성', /양 팀 채우기/)
    const d = core.getDocument()
    const [a, b] = d.players
    await act(async () => {
      addStepRun(core, a!.id, makePath([a!.home, { x: a!.home.x + 8, y: a!.home.y }]).waypoints, 1)
      addStepRun(core, b!.id, makePath([b!.home, { x: b!.home.x + 8, y: b!.home.y }]).waypoints, 2)
    })
    await pressInMenu('보드', /움직임 전체 지우기/)
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
    await pressInMenu('팀 구성', /양 팀 채우기/)
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
    // scoped replay lives beside the board now, not in the footer (PLAN-015 v3): the footer used
    // to grow and shrink with it and slide every chip sideways.
    const stepOnly = screen.getByRole('button', { name: /현재 단계만/ })
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
    await pressInMenu('팀 구성', /양 팀 채우기/)
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
    await pressInMenu('팀 구성', /양 팀 채우기/)
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
    // Board-level actions are one press away, inside the toolbar menu that names them (v31).
    for (const [menu, name] of [
      ['팀 구성', /양 팀 채우기/],
      ['보드', /움직임 전체 지우기/],
      ['보드', /새로 시작/],
    ] as const)
      expect(menuButton(menu, name)).toBeTruthy()
    /*
     * …and the transport is always on screen, no menu needed. EXACT names: the key guide's rows
     * are buttons too ("Space — 재생 단축키 설명"), and a loose /재생/ would no longer say which
     * control it means — which is the same ambiguity a screen reader would hit.
     */
    for (const name of ['재생', '처음으로', '반복'])
      expect(screen.getByRole('button', { name })).toBeTruthy()
    // 공 투입 was dropped (user 2026-08-21): every document already starts with the ball on the
    // centre spot, so the button only re-centred it — the board never lacks a ball.
    expect(screen.queryByRole('button', { name: /공 투입/ })).toBeNull()
    expect(container.querySelector('[data-entity="ball"]')).toBeTruthy()
    expect(screen.getByRole('button', { name: /실행 취소/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /다시 실행/ })).toBeTruthy()
    // no timeline / scrubber / mode toggle / doc menu resurrection
    expect(container.querySelector('[class*="scrub"]')).toBeNull()
    expect(document.body.textContent).not.toContain('애니메이션 모드')
    expect(container.querySelector('input[type="range"]')).toBeNull()
  })
})

describe('discoverability (ADR-0009 v32)', () => {
  it('a first visit can see the keys, but is not explained at', () => {
    const { container } = setup()
    /*
     * v31 made every hint contextual and that hid the entrance: a first-time visitor never holds
     * Ctrl, so they never learn Ctrl is what puts a player on the pitch (user 2026-08-25). The
     * guide is the standing INDEX — one key, one word, grouped by what it is for — and the
     * explanation still waits until it is asked for.
     */
    const guide = container.querySelector('[class*="keyGuide"]')!
    expect(guide).toBeTruthy()
    const caps = [...guide.querySelectorAll('[class*="guideCap"]')].map((k) => k.textContent)
    for (const k of ['Ctrl', 'Alt', 'Shift', '1~9', 'X', '⇧R']) expect(caps).toContain(k)
    // …every drawer shut, nothing held
    expect(guide.querySelector('[data-open]')).toBeNull()
    expect(guide.querySelector('[data-held]')).toBeNull()
    for (const row of guide.querySelectorAll('[aria-expanded]'))
      expect(row.getAttribute('aria-expanded')).toBe('false')
  })

  it('a key opens its own detail and nothing else', () => {
    const { container } = setup()
    const rows = [...container.querySelectorAll<HTMLButtonElement>('button[class*="guideRow"]')]
    const alt = rows.find((r) => r.getAttribute('aria-label')?.startsWith('Alt'))!
    act(() => alt.click())
    expect(alt.getAttribute('aria-expanded')).toBe('true')
    expect(
      rows.filter((r) => r.getAttribute('aria-expanded') === 'true').map((r) => r.textContent),
    ).toHaveLength(1)
    // the detail is the keymap's own wording, not a second copy of it
    expect(alt.parentElement!.textContent).toContain('경로')
    act(() => alt.click())
    expect(alt.getAttribute('aria-expanded')).toBe('false')
  })

  it('the guide points at the full list', () => {
    const { container } = setup()
    const all = [...container.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.includes('단축키 전체 보기'),
    )!
    expect(all).toBeTruthy()
    act(() => all.click())
    expect(useUiStore.getState().shortcutsOpen).toBe(true)
  })
})

describe('playback staging (PLAN-006 M5)', () => {
  it('marks the shell as playing so chrome can recede, and clears it on stop', async () => {
    const { container } = setup()
    expect(container.querySelector('[data-playing="true"]')).toBeNull()
    await act(async () => {
      useUiStore.setState((s) => ({ playback: { ...s.playback, playing: true } }))
    })
    expect(container.querySelector('[data-playing="true"]')).toBeTruthy()
    await act(async () => {
      useUiStore.getState().returnToAuthoringStart()
    })
    expect(container.querySelector('[data-playing="true"]')).toBeNull()
  })

  it('the space-HOLD shortcut is announced as its own row, not buried in the Space hint', async () => {
    setup()
    /*
     * The standing 조작법 column is gone (v31) — the hold is announced by the board hint that
     * appears while the play runs, and by the `?` overlay. Both read the same KEYMAP rows, so the
     * contract this test protects is the ROW ITSELF: one line for the hold, separate from Space.
     */
    const rows = GUIDE_PLAY_BINDINGS.map((b) => `${b.label} ${b.hint}`).join(' ')
    expect(rows).toContain('Space 꾹')
    // the factor is CHOSEN on the play button now: the hold row stays one line, and the pick
    // lives in its own gesture row (a wrapped hint hangs indented under the keycap)
    expect(rows).toMatch(/배속/)
    // the row names the play button in words; the ▶ glyph is reserved for the button itself,
    // because a play triangle in a panel row reads as "press me" (lab review, 2026-08-24)
    expect(rows).toMatch(/재생 버튼 좌우 드래그/)
    expect(KEYMAP.playback.boost.hint.length).toBeLessThan(16)
    // the plain Space row stays about play/pause only
    expect(KEYMAP.playback.toggle.hint).not.toMatch(/배속/)
  })

  it('sliding the play button picks the hold factor (0.5 / 2 / 3)', async () => {
    const { container } = setup()
    expect(useUiStore.getState().boostFactor).toBe(3)
    const btn = container.querySelector('[data-tour="play"]') as HTMLButtonElement
    expect(btn.getAttribute('data-boost-factor')).toBe('3')
    // a hold factor below normal is a SLOW-MOTION hold and must still count as a hold state
    await act(async () => {
      useUiStore.getState().setBoostFactor(0.5)
    })
    expect(btn.getAttribute('data-boost-factor')).toBe('0.5')
    await act(async () => {
      useUiStore.setState((s) => ({
        playback: { ...s.playback, playing: true, speed: NORMAL_SPEED * 0.5 },
      }))
    })
    expect(container.querySelectorAll('[data-boost="true"]').length).toBe(2)
    await act(async () => {
      useUiStore.getState().setPlaying(false)
      useUiStore.getState().setSpeed(NORMAL_SPEED)
      useUiStore.getState().setBoostFactor(3)
    })
  })

  it('space-hold fast-forward is visible: pill, stage glow and transport all agree', async () => {
    const { container } = setup()
    const pill = () => container.querySelector('[class*="speedPill"]')
    const boosted = () => container.querySelectorAll('[data-boost="true"]').length
    expect(pill()).toBeNull()
    expect(boosted()).toBe(0)

    // playing at normal pace is NOT a boost
    await act(async () => {
      useUiStore.setState((s) => ({
        playback: { ...s.playback, playing: true, speed: NORMAL_SPEED },
      }))
    })
    expect(pill()).toBeNull()
    expect(boosted()).toBe(0)

    // the hold raises the rate — both the stage and the play button say so
    await act(async () => {
      useUiStore.getState().setSpeed(BOOST_SPEED)
    })
    expect(pill()?.textContent).toContain(`${BOOST_FACTOR}×`)
    expect(boosted()).toBe(2)

    // a raised rate while STOPPED is not announced (nothing is moving)
    await act(async () => {
      useUiStore.getState().setPlaying(false)
    })
    expect(pill()).toBeNull()
    expect(boosted()).toBe(0)
  })
})
