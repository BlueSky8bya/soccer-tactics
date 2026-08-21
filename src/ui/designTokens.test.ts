/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// PLAN-006 M1: semantic token contract. Visual roles live in tokens.css, not scattered CSS.
const tokens = readFileSync(new URL('./tokens.css', import.meta.url), 'utf-8')
const shell = readFileSync(new URL('./shell.module.css', import.meta.url), 'utf-8')
const pitch = readFileSync(new URL('../renderer/pitch.module.css', import.meta.url), 'utf-8')

describe('semantic design tokens', () => {
  it('defines every approved depth, radius and motion role', () => {
    for (const name of [
      '--st-depth-rest',
      '--st-depth-raised',
      '--st-depth-drag',
      '--st-depth-overlay',
      '--st-radius-control',
      '--st-radius-card',
      '--st-radius-stage',
      '--st-radius-pill',
      '--st-motion-instant',
      '--st-motion-feedback',
      '--st-motion-transition',
      '--st-motion-settle',
      '--st-motion-emphasis',
      '--st-ease-standard',
      '--st-ease-out',
      '--st-ease-pop',
    ])
      expect(tokens, name).toContain(`${name}:`)
  })

  it('keeps reduced-motion overrides for every decorative duration token', () => {
    const reduced = tokens.slice(tokens.indexOf('prefers-reduced-motion'))
    for (const name of [
      '--st-motion-instant',
      '--st-motion-feedback',
      '--st-motion-transition',
      '--st-motion-settle',
      '--st-motion-emphasis',
    ])
      expect(reduced, name).toContain(`${name}: 0ms`)
  })

  it('leaves no raw cubic-bezier in shell or pitch CSS (easing comes from tokens)', () => {
    expect(shell).not.toMatch(/cubic-bezier/)
    expect(pitch).not.toMatch(/cubic-bezier/)
  })

  it('keeps translucency to floating surfaces only (A-04a: docked panels are solid)', () => {
    /*
     * This counted blur declarations and capped the number, so every new floating surface broke it
     * and the fix was to raise the number — which is not the rule. The rule is WHICH surfaces may
     * blur: things that float OVER the board (the footer bar, the zen escape, a scrim) can, and
     * anything docked in the layout cannot, because a translucent panel over a moving pitch is
     * exactly the motion-behind-text case A-04a rules out. Naming the surfaces makes the next
     * addition a decision instead of an increment.
     */
    const ALLOWED = new Set(['.simpleBar', '.zenExit', '.emptyState'])
    const offenders = shell
      .split('}')
      .filter((block) => /backdrop-filter:/.test(block))
      .map((block) => (block.split('{')[0] ?? '').trim().split(/\r?\n/).pop()!.trim())
      .filter((selector) => !selector.split(',').every((s) => ALLOWED.has(s.trim())))
    expect(offenders).toEqual([])
    for (const docked of ['.panelCard', '.shortcutList', '.sideLeft', '.sideRight', '.top'])
      expect(shell, docked).not.toMatch(new RegExp(`\\${docked}\\s*\\{[^}]*backdrop-filter`, 's'))
  })
})
