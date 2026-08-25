import { useEffect, useState } from 'react'

/**
 * Subscribe to a CSS media query from React.
 *
 * Used where a LAYOUT DECISION has to be the same on both sides of the language barrier: the side
 * columns are laid out by CSS, but which column a card is rendered INTO is a DOM question, and a
 * card cannot be in two places at once (rendering it twice would give every command two accessible
 * names). One query string, quoted from the stylesheet, keeps them agreeing.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false,
  )
  useEffect(() => {
    if (!window.matchMedia) return
    const mql = window.matchMedia(query)
    const on = () => setMatches(mql.matches)
    on()
    mql.addEventListener('change', on)
    return () => mql.removeEventListener('change', on)
  }, [query])
  return matches
}

/**
 * "There is no grass to stand on" — the same condition the stylesheet uses to fold the side
 * columns into one strip of caps. Kept beside the query it mirrors (tokens.css).
 */
export const NO_SIDE_ROOM = '(max-width: 1180px), (max-aspect-ratio: 157/100)'
