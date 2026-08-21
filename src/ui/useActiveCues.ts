import { useEffect, useRef, useState } from 'react'
import { useEditor } from '@/editor/EditorContext'
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
 * Which states the user is currently in, settled through the anti-flicker gate.
 *
 * Two kinds of raw signal, one gate:
 *
 *  · HELD KEYS and "the play is running" — a held key emits nothing while it is down, so a change
 *    that is still being decided keeps a light interval alive.
 *  · WHAT IS SELECTED — the ball, a player, a movement being edited. These answer the question that
 *    comes first ("I clicked this, now what?") and they change just as fast as a modifier does:
 *    clicking a crowded spot cycles player → ghost → path on every press, so they need the same
 *    dwell before they are allowed to claim the panel.
 *
 * Once every gate agrees with reality the interval stops and this costs nothing at rest.
 */
export function useActiveCues(): ReadonlySet<Cue> {
  const core = useEditor()
  const playing = useUiStore((s) => s.playback.playing)
  // BOOLEANS, not the selection array: the array gets a fresh identity on every store write, so
  // subscribing to it would re-render these panels constantly. The ball's id is a domain constant
  // ('ball'), so deriving inside the selector is safe.
  const ballId = core.getDocument().ball.id
  const ballSelected = useUiStore((s) => s.selection.includes(ballId))
  const playerSelected = useUiStore((s) => s.selection.some((id) => id !== ballId))
  const segmentId = useUiStore((s) => s.selectedSegmentId)
  const drafting = useUiStore((s) => s.pathDraft !== null)
  const [active, setActive] = useState<ReadonlySet<Cue>>(() => new Set<Cue>())
  const gates = useRef<Record<Cue, CueGateState>>(emptyGates())
  const raw = useRef<Record<Cue, boolean>>({
    ctrl: false,
    alt: false,
    shift: false,
    space: false,
    ball: false,
    player: false,
    path: false,
  })
  const timer = useRef<number | null>(null)

  useEffect(() => {
    raw.current.space = playing
    raw.current.ball = ballSelected
    raw.current.player = playerSelected
    // "Editing a movement" is either one selected or one being drawn right now.
    raw.current.path = segmentId !== null || drafting

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
  }, [playing, ballSelected, playerSelected, segmentId, drafting])

  return active
}
