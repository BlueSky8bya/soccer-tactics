/**
 * Theme preference (PLAN-015 M1). The pure half — the half that decides what gets painted.
 */
import { describe, expect, it } from 'vitest'
import { nextTheme, parseThemePref, resolveTheme, THEME_ORDER } from './theme'

describe('resolveTheme', () => {
  it('follows the OS only while the preference is "system"', () => {
    expect(resolveTheme('system', 'dark')).toBe('dark')
    expect(resolveTheme('system', 'light')).toBe('light')
    expect(resolveTheme('light', 'dark')).toBe('light')
    expect(resolveTheme('dark', 'light')).toBe('dark')
  })
})

describe('nextTheme', () => {
  it('cycles system → light → dark → system, so the default is always one press away', () => {
    expect(nextTheme('system')).toBe('light')
    expect(nextTheme('light')).toBe('dark')
    expect(nextTheme('dark')).toBe('system')
  })

  it('returns to the start after one full lap of THEME_ORDER', () => {
    let p = THEME_ORDER[0]!
    for (let i = 0; i < THEME_ORDER.length; i++) p = nextTheme(p)
    expect(p).toBe(THEME_ORDER[0])
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
