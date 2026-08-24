/**
 * Theme preference (PLAN-015 M1). The pure half — the half that decides what gets painted.
 */
import { describe, expect, it } from 'vitest'
import { nextTheme, parseThemePref, resolveTheme } from './theme'

describe('resolveTheme', () => {
  it('follows the OS only while the preference is "system"', () => {
    expect(resolveTheme('system', 'dark')).toBe('dark')
    expect(resolveTheme('system', 'light')).toBe('light')
    expect(resolveTheme('light', 'dark')).toBe('light')
    expect(resolveTheme('dark', 'light')).toBe('dark')
  })
})

describe('nextTheme', () => {
  it('always switches to the OTHER theme, so one press always changes the screen', () => {
    expect(nextTheme('dark')).toBe('light')
    expect(nextTheme('light')).toBe('dark')
  })

  it('never returns "system", which is what made the old cycle no-op', () => {
    /*
     * The old order was system → light → dark → system. On a machine set to dark, pressing while
     * the preference was 'dark' landed on 'system', which resolves back to dark — the screen did
     * not change and the user had to press twice to reach light.
     */
    for (const shown of ['light', 'dark'] as const) expect(nextTheme(shown)).not.toBe('system')
  })
})

describe('parseThemePref', () => {
  it('treats anything it does not recognise as "follow the OS"', () => {
    expect(parseThemePref('dark')).toBe('dark')
    expect(parseThemePref(null)).toBe('system')
    expect(parseThemePref('')).toBe('system')
    expect(parseThemePref('DARK')).toBe('system')
  })
})
