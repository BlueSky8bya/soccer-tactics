import { useUiStore } from '@/editor/uiStore'
import styles from './shell.module.css'
import {
  ANIM_BINDINGS,
  CTRL_BINDINGS,
  PLACE_BINDINGS,
  GUIDE_PLAY_BINDINGS,
  isCued,
  visibleBindings,
  type Binding,
} from './keymap'
import { useActiveCues } from './useActiveCues'

/**
 * THE GUIDE IS A STATE, NOT A WALL (ADR-0009 v31, user 2026-08-25: 맥락 힌트만 보드 위에).
 *
 * What this replaces: two columns of cards that listed every gesture at one volume, forever, and
 * repeated what the `?` overlay already holds in full. Measured, they cost a third of the window.
 *
 * What it does instead: `useActiveCues()` already knows which states the user is IN — Ctrl held,
 * Alt held, the ball selected, a movement being edited, the play running — and it settles them
 * through an anti-flicker gate (enter 180ms, leave 340ms) so a tapped modifier cannot strobe the
 * screen (WCAG 2.3.1). Only the rows belonging to a live state are drawn. On an idle board this
 * component renders NOTHING.
 *
 * The cap is three. A hint you have to read past is a panel again.
 */
const HINT_BINDINGS: readonly Binding[] = [
  ...CTRL_BINDINGS,
  ...PLACE_BINDINGS,
  ...ANIM_BINDINGS,
  ...GUIDE_PLAY_BINDINGS,
].filter((b) => b.cues && b.cues.length > 0)

const MAX_HINTS = 3

export function BoardHints() {
  const cues = useActiveCues()
  const ballFling = useUiStore((s) => s.ballFling)
  const rows: Binding[] = []
  for (const b of visibleBindings(HINT_BINDINGS, { ballFling })) {
    if (!isCued(b, cues)) continue
    if (rows.some((r) => r.label === b.label)) continue
    rows.push(b)
    if (rows.length === MAX_HINTS) break
  }
  if (!rows.length) return null
  return (
    /*
     * aria-hidden: this is a visual affordance that appears and disappears with a held key, and a
     * live region that announced three rows every time Ctrl goes down would be unusable. The
     * accessible path to the same content is the `?` overlay, which carries the FULL keymap in one
     * readable dialog.
     */
    <div className={styles.boardHints} aria-hidden="true">
      {rows.map((b) => (
        <div key={b.label} className={styles.boardHint}>
          <span className={b.chip ? styles.kbd : styles.boardHintLabel}>{b.label}</span>
          <span className={styles.boardHintText}>{b.hint}</span>
        </div>
      ))}
    </div>
  )
}
