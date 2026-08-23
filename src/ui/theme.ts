/**
 * Theme preference (user 2026-08-24: 다크모드 기능 추가).
 *
 * THREE states, not two. "System" is a real answer — the OS already knows whether the room is
 * dark — and a two-state toggle silently overrides it forever after one accidental click. The
 * cycle is system → light → dark → system, so the default is always one press away.
 *
 * The pure half (resolve/next) is what the tests hold; the DOM half is one line at the end.
 */
export type ThemePref = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_ORDER: readonly ThemePref[] = ['system', 'light', 'dark']

const STORAGE_KEY = 'st.theme'

/** Pure: what actually gets painted, given the preference and what the OS reports. */
export function resolveTheme(pref: ThemePref, system: ResolvedTheme): ResolvedTheme {
  return pref === 'system' ? system : pref
}

/** Pure: the next state of the header button. */
export function nextTheme(pref: ThemePref): ThemePref {
  const i = THEME_ORDER.indexOf(pref)
  return THEME_ORDER[(i < 0 ? 0 : i + 1) % THEME_ORDER.length]!
}

/** Pure: an unknown/corrupt stored value is not a preference — fall back to the OS. */
export function parseThemePref(raw: string | null | undefined): ThemePref {
  return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system'
}

export function loadThemePref(): ThemePref {
  try {
    return parseThemePref(localStorage.getItem(STORAGE_KEY))
  } catch {
    return 'system'
  }
}

export function saveThemePref(pref: ThemePref): void {
  try {
    localStorage.setItem(STORAGE_KEY, pref)
  } catch {
    /* private mode / disabled storage — the preference just does not survive the session */
  }
}

export function systemTheme(): ResolvedTheme {
  return typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

/** Paint it: `data-theme` on <html> is what tokens.css switches on. */
export function applyTheme(pref: ThemePref): ResolvedTheme {
  const resolved = resolveTheme(pref, systemTheme())
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = resolved
  return resolved
}
