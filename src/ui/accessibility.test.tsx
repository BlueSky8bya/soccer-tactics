// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createEmptyDocument } from '@/domain'
import { EditorCore } from '@/editor/editorCore'
import { EditorProvider } from '@/editor/EditorContext'
import { applyFormation, ensureDefaultTeams } from '@/editor/commands'
import { useUiStore } from '@/editor/uiStore'
import { AppShell } from './AppShell'

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
    tool: 'select',
    drag: null,
    hover: null,
    shortcutsOpen: false,
    timelineExpanded: false,
    playback: { t: 0, playing: false, speed: 1, loop: false },
  })
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

describe('minimum editor accessibility (M5)', () => {
  it('exposes meaningful names for rail, timeline, and Inspector controls; no positive tabindex', () => {
    const { container } = setup()
    const rail = container.querySelector('nav[aria-label="Tools"]')!
    const railBtns = rail.querySelectorAll('button')
    expect(railBtns.length).toBeGreaterThan(4)
    railBtns.forEach((b) =>
      expect(b.getAttribute('aria-label') || b.textContent?.trim()).toBeTruthy(),
    )
    const slider = container.querySelector('[role="slider"]')!
    expect(slider.getAttribute('aria-valuetext')).toMatch(/s \/ /)
    const positive = Array.from(container.querySelectorAll('[tabindex]')).filter(
      (el) => Number(el.getAttribute('tabindex')) > 0,
    )
    expect(positive.length).toBe(0)
  })

  it('removes closed shortcut dialog, formation popover, minibar and collapsed tracks from the tab order (inert)', () => {
    const { container } = setup()
    const overlay = container.querySelector('[role="dialog"][aria-modal="true"]')!.parentElement!
    expect(overlay.hasAttribute('inert')).toBe(true)
    const popover = container.querySelector('[role="dialog"]:not([aria-modal])')!
    expect(popover.hasAttribute('inert')).toBe(true)
    const minibar = container.querySelector('[role="toolbar"]')
    if (minibar) expect(minibar.hasAttribute('inert')).toBe(true)
    const tracks = container.querySelector('[aria-hidden="true"][inert]')
    expect(tracks).toBeTruthy()
  })

  it('moves focus into the shortcut dialog and restores the trigger on close', async () => {
    const { container } = setup()
    const trigger = container.querySelector('button[aria-label*="단축키"]') as HTMLButtonElement
    trigger.focus()
    await act(async () => {
      trigger.click()
      await new Promise((r) => setTimeout(r, 5))
    })
    const dialog = container.querySelector('[role="dialog"][aria-modal="true"]')!
    expect(dialog.parentElement!.hasAttribute('inert')).toBe(false)
    expect(dialog.contains(document.activeElement)).toBe(true)
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' })
      await new Promise((r) => setTimeout(r, 5))
    })
    expect(document.activeElement).toBe(trigger)
  })

  it('does not toggle global playback when Space activates a focused button; slider keyboard seeks without mutating the document', async () => {
    const { core, container } = setup()
    await act(async () => {
      applyFormation(core, core.getDocument().teams[0]!.id, '4-4-2')
    })
    const rev = core.getRevision()
    const anyBtn = container.querySelector('nav[aria-label="Tools"] button') as HTMLButtonElement
    anyBtn.focus()
    await act(async () => {
      fireEvent.keyDown(anyBtn, { key: ' ' })
    })
    expect(useUiStore.getState().playback.playing).toBe(false)
    const slider = container.querySelector('[role="slider"]') as HTMLElement
    slider.focus()
    await act(async () => {
      fireEvent.keyDown(slider, { key: 'ArrowRight' })
      fireEvent.keyDown(slider, { key: 'ArrowRight' })
    })
    expect(useUiStore.getState().playback.t).toBeCloseTo(0.2, 5)
    await act(async () => {
      fireEvent.keyDown(slider, { key: 'End' })
    })
    expect(useUiStore.getState().playback.t).toBeGreaterThan(1)
    expect(core.getRevision()).toBe(rev)
  })
})
