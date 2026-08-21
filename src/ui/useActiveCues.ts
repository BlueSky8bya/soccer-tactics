import { useEffect, useRef, useState } from 'react'
import { useUiStore } from '@/editor/uiStore'
import {
  CUES,
  cuesSettling,
  emptyGates,
  stepCueGate,
  type Cue,
  type CueGateState,
} from './cueHighlight'

/**
 * Which shortcut family the user is in the middle of, settled through the anti-flicker gate.
 *
 * The raw signals are held modifiers and "the play is running". A held key emits nothing while it
 * is down, so a change that is still being decided keeps a light interval alive; once every gate
 * agrees with reality the interval stops and this costs nothing at rest.
 */
export function useActiveCues(): ReadonlySet<Cue> {
  const playing = useUiStore((s) => s.playback.playing)
  const [active, setActive] = useState<ReadonlySet<Cue>>(() => new Set<Cue>())
  const gates = useRef<Record<Cue, CueGateState>>(emptyGates())
  const raw = useRef<Record<Cue, boolean>>({ ctrl: false, alt: false, shift: false, space: false })
  const timer = useRef<number | null>(null)

  useEffect(() => {
    raw.current.space = playing

    const settle = () => {
      const now = performance.now()
      let changed = false
      for (const c of CUES) {
        const next = stepCueGate(gates.current[c], raw.current[c], now)
        if (next !== gates.current[c]) {
          if (next.on !== gates.current[c].on) changed = true
          gates.current[c] = next
        }
      }
      if (changed) setActive(new Set<Cue>(CUES.filter((c) => gates.current[c].on)))
      if (cuesSettling(gates.current)) {
        if (timer.current === null) timer.current = window.setInterval(settle, 40)
      } else if (timer.current !== null) {
        window.clearInterval(timer.current)
        timer.current = null
      }
    }

    const fromEvent = (e: KeyboardEvent) => {
      raw.current.ctrl = e.ctrlKey || e.metaKey
      raw.current.alt = e.altKey
      raw.current.shift = e.shiftKey
      settle()
    }
    // A modifier released while the window is not focused never sends keyup — drop everything.
    const clear = () => {
      raw.current.ctrl = false
      raw.current.alt = false
      raw.current.shift = false
      settle()
    }
    window.addEventListener('keydown', fromEvent)
    window.addEventListener('keyup', fromEvent)
    window.addEventListener('blur', clear)
    settle()
    return () => {
      window.removeEventListener('keydown', fromEvent)
      window.removeEventListener('keyup', fromEvent)
      window.removeEventListener('blur', clear)
      if (timer.current !== null) {
        window.clearInterval(timer.current)
        timer.current = null
      }
    }
  }, [playing])

  return active
}
