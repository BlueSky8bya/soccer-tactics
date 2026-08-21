import { describe, expect, it } from 'vitest'
import {
  CUE_ENTER_MS,
  CUE_EXIT_MS,
  cuesSettling,
  emptyGates,
  idleCue,
  stepCueGate,
  type CueGateState,
} from './cueHighlight'

/** Drive one gate through a raw timeline and report what the panel showed at each instant. */
function play(events: readonly { t: number; raw: boolean }[]): boolean[] {
  let g: CueGateState = idleCue
  const shown: boolean[] = []
  let raw = false
  // one sample per millisecond, so a "tick" is never what makes a case pass
  const end = events[events.length - 1]!.t
  for (let t = 0; t <= end; t++) {
    for (const e of events) if (e.t === t) raw = e.raw
    g = stepCueGate(g, raw, t)
    shown.push(g.on)
  }
  return shown
}

describe('contextual highlight gate', () => {
  it('a deliberate hold lights up, and only after the dwell', () => {
    const shown = play([
      { t: 0, raw: true },
      { t: 1000, raw: true },
    ])
    expect(shown[CUE_ENTER_MS - 1]).toBe(false)
    expect(shown[CUE_ENTER_MS]).toBe(true)
    expect(shown[999]).toBe(true)
  })

  it('a quick tap never lights up at all', () => {
    // the reported worry: 키를 타다닥 완전 빠르게 눌렀다 뗐을 때 점멸
    const shown = play([
      { t: 0, raw: true },
      { t: 60, raw: false },
      { t: 900, raw: false },
    ])
    expect(shown.some(Boolean)).toBe(false)
  })

  it('drumming on a key cannot strobe', () => {
    const events: { t: number; raw: boolean }[] = []
    // press/release every 40ms for a second — far faster than either threshold
    for (let t = 0; t < 1000; t += 80) {
      events.push({ t, raw: true })
      events.push({ t: t + 40, raw: false })
    }
    events.push({ t: 1200, raw: false })
    const shown = play(events)
    // count how many times the display changed at all
    let flips = 0
    for (let i = 1; i < shown.length; i++) if (shown[i] !== shown[i - 1]) flips++
    expect(flips).toBeLessThanOrEqual(2)
  })

  it('lingers after release, so a re-press inside the window never blinks', () => {
    const shown = play([
      { t: 0, raw: true },
      { t: 500, raw: false },
      { t: 500 + CUE_EXIT_MS - 40, raw: true }, // re-pressed before the lamp went out
      { t: 1400, raw: true },
    ])
    for (let t = CUE_ENTER_MS; t <= 1400; t++) expect(shown[t], `t=${t}`).toBe(true)
  })

  it('goes out once the release outlasts the exit window', () => {
    const shown = play([
      { t: 0, raw: true },
      { t: 500, raw: false },
      { t: 1200, raw: false },
    ])
    expect(shown[500 + CUE_EXIT_MS - 1]).toBe(true)
    expect(shown[500 + CUE_EXIT_MS]).toBe(false)
  })

  it('entering is stricter than leaving — the asymmetry IS the anti-flicker', () => {
    expect(CUE_EXIT_MS).toBeGreaterThan(CUE_ENTER_MS)
  })

  it('reports whether anything still needs a tick', () => {
    expect(cuesSettling(emptyGates())).toBe(false)
    const pending = { ...emptyGates(), alt: stepCueGate(idleCue, true, 0) }
    expect(cuesSettling(pending)).toBe(true)
    const settled = { ...emptyGates(), alt: stepCueGate(pending.alt, true, CUE_ENTER_MS) }
    expect(settled.alt.on).toBe(true)
    expect(cuesSettling(settled)).toBe(false)
  })
})
