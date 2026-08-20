import { beforeEach, describe, expect, it } from 'vitest'
import { advanceClock, playAll, playWindow, togglePlayback } from './usePlayback'
import { useUiStore } from './uiStore'

/** Scoped playback semantics (PLAN-005 M1, A-02): ranges, result hold, explicit return. */
describe('scoped playback', () => {
  beforeEach(() => {
    useUiStore.getState().returnToAuthoringStart()
  })

  describe('advanceClock (pure)', () => {
    it('advances linearly inside the range', () => {
      expect(advanceClock(1, 0.1, 1, false, 0, 5)).toEqual({ t: 1.1, done: false })
      expect(advanceClock(1, 0.1, 2, false, 0, 5)).toEqual({ t: 1.2, done: false })
    })
    it('finishes exactly at the range end (held-result frame)', () => {
      expect(advanceClock(4.95, 0.1, 1, false, 0, 5)).toEqual({ t: 5, done: true })
    })
    it('loops back to the range start, not to 0', () => {
      expect(advanceClock(4.95, 0.1, 1, true, 2, 5)).toEqual({ t: 2, done: false })
    })
  })

  it('playWindow bounds one step; a natural finish holds the frame', () => {
    playWindow('step', 2, 4)
    let st = useUiStore.getState()
    expect(st.playback.playing).toBe(true)
    expect(st.playback.t).toBe(2)
    expect(st.playScope).toBe('step')
    expect(st.rangeEnd).toBe(4)
    // simulate the controller reaching the range end
    const res = advanceClock(3.95, 0.1, 1, false, st.rangeStart, st.rangeEnd!)
    expect(res.done).toBe(true)
    st.holdResult(res.t)
    st = useUiStore.getState()
    expect(st.playback.playing).toBe(false)
    expect(st.playback.t).toBe(4)
    expect(st.completion).toBe('held-result')
  })

  it('from-step plays to the document end (rangeEnd null)', () => {
    playWindow('from-step', 3, null)
    const st = useUiStore.getState()
    expect(st.playScope).toBe('from-step')
    expect(st.rangeStart).toBe(3)
    expect(st.rangeEnd).toBeNull()
  })

  it('playAll resumes a paused frame and restarts after a held result', () => {
    playAll(10)
    useUiStore.setState((s) => ({ playback: { ...s.playback, t: 4 } }))
    useUiStore.getState().setPlaying(false) // pause: hold at 4
    expect(useUiStore.getState().playback.t).toBe(4)
    playAll(10) // resume, not restart
    expect(useUiStore.getState().playback.t).toBe(4)
    useUiStore.getState().holdResult(10)
    playAll(10) // after a finish: restart from 0
    const st = useUiStore.getState()
    expect(st.playback.t).toBe(0)
    expect(st.playback.playing).toBe(true)
    expect(st.completion).toBe('idle')
  })

  it('togglePlayback pauses when playing and plays the whole thing otherwise', () => {
    togglePlayback(10)
    expect(useUiStore.getState().playback.playing).toBe(true)
    togglePlayback(10)
    const st = useUiStore.getState()
    expect(st.playback.playing).toBe(false)
    expect(st.completion).toBe('idle') // pause is not a finish
  })

  it('Home (returnToAuthoringStart) resets time, scope and completion', () => {
    playWindow('step', 2, 4)
    useUiStore.getState().holdResult(4)
    useUiStore.getState().returnToAuthoringStart()
    const st = useUiStore.getState()
    expect(st.playback.t).toBe(0)
    expect(st.playScope).toBe('all')
    expect(st.rangeStart).toBe(0)
    expect(st.rangeEnd).toBeNull()
    expect(st.completion).toBe('idle')
  })
})
