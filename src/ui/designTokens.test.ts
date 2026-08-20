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

  it('keeps translucency to the footer bar and overlays only (A-04a: panels are solid)', () => {
    // panel cards and the header must not blur; count blur usages and assert the ceiling
    const blurs = shell.match(/backdrop-filter:/g) ?? []
    expect(blurs.length).toBeLessThanOrEqual(3) // footer (std+webkit) + one overlay card
    expect(shell).not.toMatch(/\.panelCard[^}]*backdrop-filter/s)
    expect(shell).not.toMatch(/\.guideGroup[^}]*backdrop-filter/s)
    expect(shell).not.toMatch(/\.top \{[^}]*backdrop-filter/s)
  })
})
