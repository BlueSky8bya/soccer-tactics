/**
 * The radius ladder is CONCENTRIC, and this is where that stops being a comment.
 *
 * Apple's rule for the iOS/macOS 26 look: a nested shape's radius is its parent's minus the padding
 * between them, so the two curves run parallel instead of one bending inside the other. Ours is
 * derived from the inset rhythm rather than picked by eye — and before this the shell carried TWO
 * ladders (s/m/l and control/card/stage) plus eleven raw pixel values, which is the same as none.
 *
 * These tests read the built CSS, so they fail on the value that actually ships.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const tokens = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8')
const shell = readFileSync(new URL('./shell.module.css', import.meta.url), 'utf8')

/** The `:root` value of a custom property, as a number of px. */
function px(name: string): number {
  const m = new RegExp(`${name}:\\s*(-?[\\d.]+)px`).exec(tokens)
  expect(m, `${name} must be declared in px on :root`).not.toBeNull()
  return Number(m![1])
}

describe('radius ladder', () => {
  const inset = () => px('--st-inset')
  const tight = () => px('--st-inset-tight')

  it('each rung is its parent minus the padding that sits between them', () => {
    expect(px('--st-radius-card')).toBe(px('--st-radius-stage') - inset())
    expect(px('--st-radius-control')).toBe(px('--st-radius-card') - inset())
    expect(px('--st-radius-chip')).toBe(px('--st-radius-control') - tight())
  })

  it('the ladder only goes one way', () => {
    const rungs = ['--st-radius-chip', '--st-radius-control', '--st-radius-card', '--st-radius-stage']
    const values = rungs.map(px)
    expect(values).toEqual([...values].sort((a, b) => a - b))
    expect(new Set(values).size).toBe(values.length)
  })

  it('the old names point at the ladder instead of carrying their own numbers', () => {
    for (const legacy of ['--st-radius-s', '--st-radius-m', '--st-radius-l'])
      expect(tokens, legacy).toMatch(new RegExp(`${legacy}:\\s*var\\(--st-radius-`))
  })

  it('the shell reaches for a rung, never a raw pixel radius', () => {
    /*
     * `50%` is exempt: a circle is not on the ladder, it is a different shape — a step chip, a
     * token, a dot. Everything else that curves has to name which rung it is on, which is what
     * makes "is this nested correctly?" a question with an answer.
     */
    const raw = shell.match(/border-radius:\s*\d+px/g) ?? []
    expect(raw).toEqual([])
  })
})
