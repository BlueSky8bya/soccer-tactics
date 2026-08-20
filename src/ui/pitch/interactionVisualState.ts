/**
 * UI-only visual phase machine for direct manipulation (PLAN-006 M4a).
 * Commands stay in EditorCore transactions — this only names what the pointer is doing so
 * decorations (press scale, lift shadow, settle spring) share one truth. Never persisted.
 */
export type VisualPhase = 'idle' | 'pressed' | 'dragging' | 'settling' | 'cancelled'

export type VisualEvent =
  | 'press' // pointer down on a subject
  | 'drag-start' // passed the drag threshold
  | 'release-click' // released without dragging
  | 'release-commit' // released after dragging (document committed)
  | 'cancel' // Escape / pointercancel
  | 'settled' // settle/cancel decoration finished

export function nextVisualPhase(phase: VisualPhase, event: VisualEvent): VisualPhase {
  switch (event) {
    case 'press':
      return phase === 'idle' ? 'pressed' : phase
    case 'drag-start':
      return phase === 'pressed' ? 'dragging' : phase
    case 'release-click':
      return phase === 'pressed' ? 'idle' : phase
    case 'release-commit':
      return phase === 'dragging' ? 'settling' : phase
    case 'cancel':
      return phase === 'pressed' || phase === 'dragging' ? 'cancelled' : phase
    case 'settled':
      return phase === 'settling' || phase === 'cancelled' ? 'idle' : phase
  }
}
