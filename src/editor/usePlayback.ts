import { useCallback, useEffect, useRef } from 'react'
import { useUiStore } from './uiStore'

/**
 * Playback controller — the UI clock (ADR-0003/0006 "two clocks").
 * Advances uiStore.playback.t with rAF while playing. Tactical time is linear: t += dt * speed.
 */
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
      let t = st.playback.t + dt * st.playback.speed
      if (t >= durRef.current) {
        if (st.playback.loop) t = 0
        else {
          // Playback finished → snap back to the start, so the vivid tokens sit at their original
          // spots and only the faint ghosts mark the path ends (authoring view stays readable).
          useUiStore.setState({ playback: { ...st.playback, t: 0, playing: false } })
          raf.current = null
          return
        }
      }
      useUiStore.setState({ playback: { ...st.playback, t } })
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

  const play = useCallback(() => {
    const st = useUiStore.getState()
    // After drawing a pass/fling the playhead sits at the arrival; play from where that action started.
    if (st.playFrom !== null) st.setPlayhead(st.playFrom)
    else if (st.playback.t >= durRef.current - 1e-6) st.setPlayhead(0)
    st.setPlaying(true)
  }, [])
  const pause = useCallback(() => useUiStore.getState().setPlaying(false), [])
  const toggle = useCallback(() => {
    const st = useUiStore.getState()
    if (st.playback.playing) pause()
    else play()
  }, [play, pause])
  const restart = useCallback(() => {
    const st = useUiStore.getState()
    st.setPlayhead(0)
  }, [])
  const seek = useCallback((t: number) => {
    const st = useUiStore.getState()
    st.setPlayhead(Math.max(0, Math.min(durRef.current, t)))
  }, [])

  return { play, pause, toggle, restart, seek }
}
