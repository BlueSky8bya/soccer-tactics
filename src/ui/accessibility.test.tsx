// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createEmptyDocument } from '@/domain'
import { EditorCore } from '@/editor/editorCore'
import { EditorProvider } from '@/editor/EditorContext'
import { seedDefaultTeams } from '@/editor/commands'
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
    shortcutsOpen: false,
    tour: { active: false, step: 0 },
    animMode: false,
    playback: { t: 0, playing: false, speed: 1, loop: false },
  })
})

function setup() {
  markTourSeen()
  useUiStore.setState({ animMode: true })
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

describe('minimum editor accessibility (simple mode)', () => {
  it('top bar and playbar controls have accessible names; no positive tabindex anywhere', () => {
    const { container } = setup()
    for (const name of ['실행 취소', '다시 실행', '재생', '처음으로']) {
      expect(screen.getByRole('button', { name })).toBeTruthy()
    }
    expect(screen.getByRole('group', { name: '단계' })).toBeTruthy()
    const positive = [...container.querySelectorAll('[tabindex]')].filter(
      (el) => Number(el.getAttribute('tabindex')) > 0,
    )
    expect(positive).toHaveLength(0)
  })

  it('moves focus into the shortcut dialog and restores the trigger on close', async () => {
    const { container } = setup()
    const trigger = container.querySelector('button[aria-label*="단축키"]') as HTMLButtonElement
    trigger.focus()
    await act(async () => {
      trigger.click()
      await new Promise((r) => setTimeout(r, 30))
    })
    const dialog = container.querySelector('[role="dialog"][aria-modal="true"]')!
    expect(dialog.parentElement!.hasAttribute('inert')).toBe(false)
    expect(dialog.contains(document.activeElement)).toBe(true)
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' })
      await new Promise((r) => setTimeout(r, 30))
    })
    expect(document.activeElement).toBe(trigger)
  })

  it('keyboard-focused button owns Space (playback untouched); document unchanged', async () => {
    const { core } = setup()
    const rev = core.getRevision()
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Tab' }) // mark keyboard modality
    })
    const loop = screen.getByRole('button', { name: /반복/ })
    loop.focus()
    await act(async () => {
      fireEvent.keyDown(loop, { key: ' ' })
    })
    expect(useUiStore.getState().playback.playing).toBe(false)
    expect(core.getRevision()).toBe(rev)
  })
})
