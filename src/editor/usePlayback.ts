import { useCallback, useEffect, useRef } from 'react'
import { useUiStore } from './uiStore'
import type { PlaybackScope } from './uiStore'

/**
 * Playback controller — the UI clock (ADR-0003/0006 "two clocks").
 * Advances uiStore.playback.t with rAF while playing. Tactical time is linear: t += dt * speed.
 * PLAN-005 M1: the clock is bounded by [rangeStart, rangeEnd ?? duration]; a natural finish HOLDS
 * the final frame ('held-result', A-02) instead of snapping to 0. Buttons and keyboard share the
 * exported actions below (RULE-03) so their semantics can never diverge.
 */

/**
 * Real end of the play: the last segment's compiled end. `compiled.duration` pads empty boards
 * to MIN_SCENE_DURATION (5s) for the old timeline — playing that padding feels like lag
 * (user 2026-08-20: 재생이 너무 느림).
 */
export function playableEnd(compiled: {
  segmentTimes: Record<string, { start: number; end: number }>
}): number {
  let end = 0
  for (const t of Object.values(compiled.segmentTimes)) if (t.end > end) end = t.end
  return Math.max(0.2, end)
}

/** One clock advance, pure (tested in usePlayback.test.ts). */
export function advanceClock(
  t: number,
  dt: number,
  speed: number,
  loop: boolean,
  rangeStart: number,
  rangeEnd: number,
): { t: number; done: boolean } {
  let next = t + dt * speed
  if (next >= rangeEnd) {
    if (loop) return { t: rangeStart, done: false }
    return { t: rangeEnd, done: true }
  }
  if (next < rangeStart) next = rangeStart
  return { t: next, done: false }
}

/** Footer Play / Space: the whole play. Resumes a paused frame; restarts after a finish. */
export function playAll(duration: number): void {
  const st = useUiStore.getState()
  const atEnd = st.completion === 'held-result' || st.playback.t >= duration - 1e-6
  st.startRange('all', atEnd ? 0 : st.playback.t, null)
}

/** Scoped replay (StepBar context actions): one step, or from a step to the end. */
export function playWindow(scope: PlaybackScope, start: number, end: number | null): void {
  useUiStore.getState().startRange(scope, start, end)
}

/** Pause: hold the current frame (A-02). */
export function pausePlayback(): void {
  useUiStore.getState().setPlaying(false)
}

/** Space semantics: pause when playing, otherwise play the whole thing. */
export function togglePlayback(duration: number): void {
  const st = useUiStore.getState()
  if (st.playback.playing) pausePlayback()
  else playAll(duration)
}

/** Home: explicit return to the authoring start (t=0, scope reset). */
export function returnToStart(): void {
  useUiStore.getState().returnToAuthoringStart()
}

export function usePlaybackController(duration: number) {
  const raf = useRef<number | null>(null)
  const last = useRef(0)
  const durRef = useRef(duration)
  useEffect(() => {
    durRef.current = duration
  }, [duration])

  useEffect(() => {
    const tick = (now: number) => {
      const st = useUiStore.getState()
      if (!st.playback.playing) {
        raf.current = null
        return
      }
      const dt = Math.min(0.1, (now - last.current) / 1000)
      last.current = now
      const end = Math.min(st.rangeEnd ?? durRef.current, durRef.current)
      const res = advanceClock(
        st.playback.t,
        dt,
        st.playback.speed,
        st.playback.loop,
        st.rangeStart,
        end,
      )
      if (res.done) {
        // Natural finish → hold the result frame; the user studies the outcome and returns
        // via Home or by starting an edit (A-02).
        st.holdResult(res.t)
        raf.current = null
        return
      }
      useUiStore.setState({ playback: { ...st.playback, t: res.t } })
      raf.current = requestAnimationFrame(tick)
    }
    const unsub = useUiStore.subscribe((s, prev) => {
      if (s.playback.playing && !prev.playback.playing && raf.current === null) {
        last.current = performance.now()
        raf.current = requestAnimationFrame(tick)
      }
    })
    return () => {
      unsub()
      if (raf.current !== null) cancelAnimationFrame(raf.current)
    }
  }, [])

  const play = useCallback(() => playAll(durRef.current), [])
  const pause = useCallback(() => pausePlayback(), [])
  const toggle = useCallback(() => togglePlayback(durRef.current), [])
  const restart = useCallback(() => returnToStart(), [])
  const seek = useCallback((t: number) => {
    useUiStore.getState().setPlayhead(Math.max(0, Math.min(durRef.current, t)))
  }, [])

  return { play, pause, toggle, restart, seek }
}
