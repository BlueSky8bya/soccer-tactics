import { useEffect, useRef, useState } from 'react'
import { useUiStore } from '@/editor/uiStore'
import styles from './shell.module.css'
import { DRAW_KEY_GUIDE, GUIDE_GROUPS, KEY_GUIDE, type GuideKey } from './keymap'
import { useActiveCues } from './useActiveCues'
import { t } from './i18n'

/**
 * THE KEY GUIDE — it lives in the margin the pitch cannot use.
 *
 * Where it is, is a measurement, not a taste. The board has a fixed 105:68 shape and, full-bleed,
 * it is HEIGHT-constrained at every laptop size: at 1440×900 the pitch leaves ~135px of grass on
 * each side that no amount of scaling will ever fill. The previous version put the guide across
 * the TOP instead, crowding the one edge that was already busy while both margins sat empty
 * (user 2026-08-25: 왜 위쪽에 나열했어 좌/우 남는 여백이 이렇게 많은데). So the guide is a column in
 * the left margin, and `usePitchView` only reserves that strip WHEN IT IS FREE — see
 * `BOARD_SAFE_LEFT_PX`. The guide costs the board nothing at 1280 and above.
 *
 * How it behaves comes from the literature (see `KEY_GUIDE` for the citations):
 *   · a key opens while it is REALLY HELD (ExposeHK's rehearsal — the hand is already on the key),
 *   · a CLICK opens and keeps it open, and so does keyboard focus — a hint nobody can reach is not
 *     a hint,
 *   · HOVER DOES NOT OPEN ANYTHING. It used to, and sweeping the pointer past the column then
 *     opened and shut drawers one after another, shoving every row below them up and down
 *     (user 2026-08-25: 호버링 했을 때 움직임이 너무 많아서 어지럽고). Hover now only tints, which
 *     is the whole job it should ever have had: say "this is pressable", change no geometry,
 *   · and the detail opens UNDER its own row, inside the column — never over the board. The row
 *     you are pointing at does not move (only what is below it does), so the target stays where
 *     you aimed (CommandMaps: stability beats reflow), and the pitch stays uncovered
 *     (user 2026-08-25: 보드 펼치면 나오는 단축키도 다 밖으로 보이게).
 */
export function KeyGuide() {
  const cues = useActiveCues()
  const drawing = useUiStore((s) => s.annotate.on)
  const guide = drawing ? DRAW_KEY_GUIDE : KEY_GUIDE
  const [focused, setFocused] = useState<string | null>(null)
  const [pinned, setPinned] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  // The pin is a reading aid, not a mode: anything that is not this guide dismisses it.
  useEffect(() => {
    if (!pinned) return
    const away = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setPinned(null)
    }
    window.addEventListener('pointerdown', away, true)
    return () => window.removeEventListener('pointerdown', away, true)
  }, [pinned])

  // Switching to the pen swaps the whole set, so a pin from the other mode simply stops matching —
  // derived, not an effect: there is no external system to synchronise with here.
  const pin = pinned && guide.some((k) => k.label === pinned) ? pinned : null

  const heldOf = (k: GuideKey) => !!k.cue && cues.has(k.cue)

  return (
    <div className={styles.keyGuide} ref={rootRef} aria-label="단축키 안내">
      {GUIDE_GROUPS.filter((g) => guide.some((k) => k.group === g)).map((group) => (
        <div key={group} className={styles.guideGroup}>
          <div className={styles.guideGroupLabel} aria-hidden="true">
            {group}
          </div>
          {guide
            .filter((k) => k.group === group)
            .map((k) => {
              const held = heldOf(k)
              const open = held || focused === k.label || pin === k.label
              return (
                <div key={k.label} className={styles.guideItem}>
                  <button
                    type="button"
                    className={styles.guideRow}
                    data-held={held || undefined}
                    data-open={open || undefined}
                    aria-expanded={open}
                    /* Its own name, or it competes with the real control that shares the word —
                       "Space 재생" next to the transport's 재생 button is two buttons with one
                       name, and a screen reader user cannot tell which is the play button. */
                    aria-label={`${k.label} — ${k.word} 단축키 설명`}
                    onFocus={() => setFocused(k.label)}
                    onBlur={() => setFocused((f) => (f === k.label ? null : f))}
                    onClick={() => setPinned((p) => (p === k.label ? null : k.label))}
                  >
                    <span className={styles.guideCap}>{k.label}</span>
                    <span className={styles.guideWord}>{k.word}</span>
                  </button>
                  {/* Height animates through the 0fr→1fr grid trick: `auto` cannot be sprung, and
                      a detail that snaps open reads as a glitch next to the rest of the app. */}
                  <div className={styles.guideDrawer} data-open={open || undefined}>
                    <div className={styles.guideDrawerInner}>
                      {k.rows.map((b) => (
                        <div key={b.label} className={styles.guideDetail}>
                          <span className={b.chip ? styles.kbd : styles.guideGesture}>
                            {b.label}
                          </span>
                          <span className={styles.guideHint}>{b.hint}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
        </div>
      ))}
      {/*
       * The way out of the guide and into the whole list. It also gives the column a purpose
       * statement: without it, nine keycaps in a card are a thing you have to guess the job of.
       */}
      <button
        type="button"
        className={styles.guideAll}
        onClick={() => useUiStore.getState().setShortcutsOpen(true)}
        title={t('topbar.help')}
      >
        <span className={styles.kbd}>?</span>
        {t('guide.all')}
      </button>
    </div>
  )
}
