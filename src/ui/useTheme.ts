import { useCallback, useEffect, useState } from 'react'
import {
  loadThemePref,
  nextTheme,
  resolveTheme,
  saveThemePref,
  systemTheme,
  type ResolvedTheme,
  type ThemePref,
} from './theme'

/**
 * The theme, wired to the DOM. Following the OS means LISTENING to it: a preference of 'system'
 * has to repaint when the machine flips at sunset, which a one-shot read on mount would miss.
 *
 * The resolved theme is DERIVED during render from two pieces of state the user and the OS each
 * own; the only effects here are the two genuine external systems — the media query and the
 * `data-theme` attribute tokens.css switches on. `main.tsx` paints the stored preference before
 * React mounts, so this effect confirms rather than introduces it.
 */
export function useTheme(): {
  pref: ThemePref
  resolved: ResolvedTheme
  cycle: () => void
} {
  const [pref, setPref] = useState<ThemePref>(loadThemePref)
  const [system, setSystem] = useState<ResolvedTheme>(systemTheme)
  const resolved = resolveTheme(pref, system)

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    const onChange = () => setSystem(mq?.matches ? 'dark' : 'light')
    mq?.addEventListener?.('change', onChange)
    return () => mq?.removeEventListener?.('change', onChange)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = resolved
  }, [resolved])

  const cycle = useCallback(() => {
    setPref((p) => {
      const n = nextTheme(resolveTheme(p, systemTheme()))
      saveThemePref(n)
      return n
    })
  }, [])

  return { pref, resolved, cycle }
}
