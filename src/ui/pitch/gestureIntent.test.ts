import { describe, expect, it } from 'vitest'
import { nextChainStep, resolvePointerIntent } from './gestureIntent'
import type { PointerContext, PointerHit, PointerMods } from './gestureIntent'

const hit = (over: Partial<PointerHit> = {}): PointerHit => ({
  ghost: false,
  segment: false,
  token: false,
  insidePitch: true,
  ...over,
})
const mods = (over: Partial<PointerMods> = {}): PointerMods => ({
  button: 0,
  draw: false,
  ctrl: false,
  ...over,
})
const ctx = (over: Partial<PointerContext> = {}): PointerContext => ({
  liveTokenNearGhost: false,
  chainActive: false,
  soloSelection: false,
  ...over,
})

/** Same press → same result (PLAN-005 M3): the truth table of the interaction contract. */
describe('resolvePointerIntent', () => {
  it('ghost presses: Alt draws from there, overlap yields to the live token, plain adjusts the end', () => {
    expect(resolvePointerIntent(hit({ ghost: true }), mods({ draw: true }), ctx())).toBe(
      'draw-from-ghost',
    )
    expect(
      resolvePointerIntent(hit({ ghost: true }), mods(), ctx({ liveTokenNearGhost: true })),
    ).toBe('press-live-token')
    expect(resolvePointerIntent(hit({ ghost: true }), mods(), ctx())).toBe('adjust-ghost-end')
  })

  it('path drag is ALWAYS bend — selection state is not even an input (C-01)', () => {
    expect(resolvePointerIntent(hit({ segment: true }), mods(), ctx())).toBe('bend-path')
    // even mid-chain with Alt down, a press on a segment (not token) continues the chain instead
    expect(
      resolvePointerIntent(
        hit({ segment: true }),
        mods({ draw: true }),
        ctx({ chainActive: true }),
      ),
    ).toBe('draw-chain')
  })

  it('token presses: Alt draws, plain selects/moves; token beats segment underneath', () => {
    expect(resolvePointerIntent(hit({ token: true }), mods({ draw: true }), ctx())).toBe(
      'draw-from-token',
    )
    expect(resolvePointerIntent(hit({ token: true }), mods(), ctx())).toBe('press-token')
    expect(resolvePointerIntent(hit({ token: true }), mods({ ctrl: true }), ctx())).toBe(
      'press-token-additive', // Ctrl+click on a token adds to the selection (user 2026-08-20)
    )
    expect(resolvePointerIntent(hit({ token: true, segment: true }), mods(), ctx())).toBe(
      'press-token',
    )
  })

  it('chain continues on any non-token press while Alt stays down', () => {
    expect(resolvePointerIntent(hit(), mods({ draw: true }), ctx({ chainActive: true }))).toBe(
      'draw-chain',
    )
    // pressing another token breaks out of the chain (draws from that token instead)
    expect(
      resolvePointerIntent(hit({ token: true }), mods({ draw: true }), ctx({ chainActive: true })),
    ).toBe('draw-from-token')
  })

  it('grass + Alt with ONE entity selected: land a straight path here, no arming click', () => {
    // The selection already names the subject, so a second click to say so is ceremony. With
    // nothing selected the same press was inert, so the shortcut takes nothing away.
    const alt = mods({ draw: true })
    expect(resolvePointerIntent(hit(), alt, ctx({ soloSelection: true }))).toBe('draw-to-point')
    expect(resolvePointerIntent(hit(), alt, ctx())).toBe('marquee')
    // Ctrl still wins: adding a player is not a path
    expect(
      resolvePointerIntent(hit(), mods({ draw: true, ctrl: true }), ctx({ soloSelection: true })),
    ).toBe('add-home-player')
    // and an in-progress chain still owns the press
    expect(resolvePointerIntent(hit(), alt, ctx({ soloSelection: true, chainActive: true }))).toBe(
      'draw-chain',
    )
    // right button never draws
    expect(
      resolvePointerIntent(hit(), mods({ draw: true, button: 2 }), ctx({ soloSelection: true })),
    ).toBe('none')
  })

  it('grass: plain drag = marquee, Ctrl+click = home player, Ctrl+right = away player', () => {
    expect(resolvePointerIntent(hit(), mods(), ctx())).toBe('marquee')
    expect(resolvePointerIntent(hit(), mods({ ctrl: true }), ctx())).toBe('add-home-player')
    expect(resolvePointerIntent(hit(), mods({ ctrl: true, button: 2 }), ctx())).toBe(
      'add-away-player',
    )
    expect(resolvePointerIntent(hit({ insidePitch: false }), mods(), ctx())).toBe('none')
    expect(resolvePointerIntent(hit(), mods({ button: 2 }), ctx())).toBe('none')
  })

  it('nextChainStep advances 1..9 and refuses to pass the last step (A-05)', () => {
    expect(nextChainStep(1)).toBe(2)
    expect(nextChainStep(8)).toBe(9)
    expect(nextChainStep(9)).toBeNull()
  })
})
