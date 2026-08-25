import { useUiStore } from '@/editor/uiStore'
import styles from './shell.module.css'
import {
  ANIM_BINDINGS,
  CTRL_BINDINGS,
  DRAW_RAIL_KEYS,
  PLACE_BINDINGS,
  GUIDE_PLAY_BINDINGS,
  RAIL_KEYS,
  isCued,
  visibleBindings,
  type Binding,
} from './keymap'
import { useActiveCues } from './useActiveCues'

/**
 * A STANDING INDEX, AND CONTEXT SUPPLIES THE DETAIL (ADR-0009 v32).
 *
 * v31 deleted the two columns of guide cards — a third of the window spent restating what the `?`
 * overlay already held — and made every hint contextual. That went one step too far (user
 * 2026-08-25: 단축키가 아예 다 사라져서 처음 사이트 들어가는 사람들은 뭘 어떻게 해야 할지 모를 것
 * 같은데): a gesture you only learn by already performing it is not discoverable at all. Ctrl puts
 * a player on the pitch, and nobody guesses that from an empty field.
 *
 * So there are two layers, and they are different KINDS of information:
 *
 *   · The RAIL always stands there: one key, one word. It is an index — it tells you a key exists
 *     and what it is for, and it costs one line at the top of the board.
 *   · The ROWS unfold only while you are in the state they describe. `useActiveCues` gates the
 *     state through an anti-flicker gate (enter 180ms, leave 340ms) so a tapped modifier cannot
 *     strobe the screen (WCAG 2.3.1), and the rail chip lights up at the same moment so the eye
 *     connects "the key I am holding" to "the lines that just appeared".
 *
 * The cap is three rows. A hint you have to read past is a panel again.
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
  const drawing = useUiStore((s) => s.annotate.on)
  const rail = drawing ? DRAW_RAIL_KEYS : RAIL_KEYS

  // The pen has its own vocabulary and none of it is a held state, so draw mode is rail-only.
  const rows: Binding[] = []
  if (!drawing) {
    for (const b of visibleBindings(HINT_BINDINGS, { ballFling })) {
      if (!isCued(b, cues)) continue
      if (rows.some((r) => r.label === b.label)) continue
      rows.push(b)
      if (rows.length === MAX_HINTS) break
    }
  }

  return (
    /*
     * aria-hidden: the rail is a visual index and the rows appear and disappear with a held key —
     * a live region announcing three lines every time Ctrl goes down would be unusable. The
     * accessible path to the same content is the `?` overlay, which carries the FULL keymap in one
     * readable dialog, and every command also names its key in its own tooltip.
     */
    <div className={styles.boardHints} aria-hidden="true">
      <div className={styles.hintRail}>
        {rail.map((k) => (
          <span
            key={k.label}
            className={styles.hintKey}
            data-on={k.cue ? cues.has(k.cue) : undefined}
          >
            <span className={styles.kbd}>{k.label}</span>
            <span className={styles.hintKeyWord}>{k.word}</span>
          </span>
        ))}
      </div>
      {rows.length > 0 && (
        <div className={styles.hintRows}>
          {rows.map((b) => (
            <div key={b.label} className={styles.boardHint}>
              <span className={b.chip ? styles.kbd : styles.boardHintLabel}>{b.label}</span>
              <span className={styles.boardHintText}>{b.hint}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
