/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// PLAN-006 M1: semantic token contract. Visual roles live in tokens.css, not scattered CSS.
const tokens = readFileSync(new URL('./tokens.css', import.meta.url), 'utf-8')
const shell = readFileSync(new URL('./shell.module.css', import.meta.url), 'utf-8')
const pitch = readFileSync(new URL('../renderer/pitch.module.css', import.meta.url), 'utf-8')

/** The selector a CSS block belongs to, given the text between the previous `}` and its `{`. */
function selectorOf(chunk: string): string {
  const head = chunk.split('{')[0] ?? ''
  const lines = head.split('\n')
  return (lines[lines.length - 1] ?? '').trim()
}

/** Declarations of the rule with exactly this selector, or '' when there is none. */
function ruleBody(css: string, selector: string): string {
  for (const chunk of css.split('}')) {
    if (selectorOf(chunk) === selector) return chunk.split('{')[1] ?? ''
  }
  return ''
}

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

  it('marks that depict an ENTITY take the entity colour, never the accent', () => {
    /*
     * The rule: anything drawn to represent a particular entity — its path, its waypoints, its step
     * badge, the aim guide while it is armed — wears that entity's colour, and only genuine system
     * affordances (marquee, snap guides, the step picker) wear the accent. Breaking it put blue
     * dots along a red team's run and made the same dots vanish on a blue one (user 2026-08-22).
     *
     * `--st-entity` is set once per group by whoever renders the mark. Its fallback is deliberately
     * white rather than the accent, so a call site that forgets to set it looks WRONG instead of
     * quietly passing for a system affordance.
     */
    const ENTITY_MARKS = [
      '.waypoint',
      '.waypointStart',
      '.attachedRing',
      '.attachedDot',
      '.aimLine',
      '.aimAnchor',
      '.aimTip',
      '.hoverHalo',
      '.stepBadge circle',
      '.stepBadge text',
    ]
    for (const sel of ENTITY_MARKS) {
      const rule = ruleBody(pitch, sel)
      expect(rule, `${sel} must exist`).not.toBe('')
      expect(rule, `${sel} must not hardcode the accent`).not.toMatch(/--st-accent/)
      expect(rule, `${sel} must read --st-entity`).toMatch(/--st-entity/)
    }
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
      .map(selectorOf)
      .filter((selector) => !selector.split(',').every((s) => ALLOWED.has(s.trim())))
    expect(offenders).toEqual([])
    for (const docked of ['.panelCard', '.shortcutList', '.sideLeft', '.sideRight', '.top'])
      expect(shell, docked).not.toMatch(new RegExp(`\\${docked}\\s*\\{[^}]*backdrop-filter`, 's'))
  })
})
