/**
 * First-visit memory for the interactive tour. Cookie + localStorage (either one counts),
 * so the flag survives whichever the browser keeps. No server, no identity — just "seen".
 */
const KEY = 'st:tour:seen:v1'
const COOKIE = 'st_tour_seen'

export function hasSeenTour(): boolean {
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem(KEY) === '1') return true
  } catch {
    /* storage disabled */
  }
  if (
    typeof document !== 'undefined' &&
    document.cookie.split(';').some((c) => c.trim().startsWith(`${COOKIE}=1`))
  )
    return true
  return false
}

export function markTourSeen(): void {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    /* storage disabled */
  }
  try {
    document.cookie = `${COOKIE}=1; max-age=31536000; path=/; SameSite=Lax`
  } catch {
    /* cookies disabled */
  }
}

export function resetTourSeen(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
  try {
    document.cookie = `${COOKIE}=; max-age=0; path=/; SameSite=Lax`
  } catch {
    /* ignore */
  }
}
