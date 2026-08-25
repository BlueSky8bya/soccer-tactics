import { useEffect, useRef, useState } from 'react'
import { useUiStore } from '@/editor/uiStore'
import styles from './shell.module.css'
import { DRAW_KEY_GUIDE, GUIDE_GROUPS, KEY_GUIDE, type GuideKey } from './keymap'
import { useActiveCues } from './useActiveCues'
import { BoardActions } from './BoardActions'
import { NO_SIDE_ROOM, useMediaQuery } from './useMediaQuery'
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
  const playing = useUiStore((s) => s.playback.playing)
  const [focused, setFocused] = useState<string | null>(null)
  // Same condition the stylesheet folds the columns on — one query, two consumers.
  const oneColumn = useMediaQuery(NO_SIDE_ROOM)
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

  /*
   * EXACTLY ONE ROW IS EVER OPEN.
   *
   * Cues are not exclusive — Ctrl and Shift are held together all the time, and the play running
   * lights Space on top of them — so "open every row whose cue is live" stacked three drawers at
   * once and ran the column off the bottom of the screen (user 2026-08-25: 그래도 높이가 넘쳐;
   * measured, three open sets are ~250px more than the tallest one). Bounding the height is not a
   * styling problem, it is this rule.
   *
   * Order: the key in your HAND wins (that is the rehearsal ExposeHK is built on), then what you
   * pinned, then what you tabbed to.
   *
   * …and none of them while the play runs. The board owns those seconds (the same reason the
   * chrome recedes), and the one thing worth saying then — the boost — is already on the pitch as
   * its own pill.
   */
  const held = playing ? [] : guide.filter((k) => k.cue && cues.has(k.cue))
  const openLabel = held[0]?.label ?? pin ?? focused ?? null
  const heldOf = (k: GuideKey) => held[0]?.label === k.label

  return (
    <>
      <div className={styles.keyGuide} ref={rootRef} aria-label="단축키 안내">
        {GUIDE_GROUPS.filter((g) => guide.some((k) => k.group === g)).map((group) => (
          <div key={group} className={styles.guideGroup}>
            <div className={styles.guideGroupLabel} aria-hidden="true">
              {group}
            </div>
            {guide
              .filter((k) => k.group === group)
              .map((k) => {
                const isHeld = heldOf(k)
                const open = openLabel === k.label
                return (
                  <div key={k.label} className={styles.guideItem}>
                    <button
                      type="button"
                      className={styles.guideRow}
                      data-held={isHeld || undefined}
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
          <span className={styles.guideAllLabel}>{t('guide.all')}</span>
        </button>
        {/* No room for a second column? Then these ride along at the foot of this one. */}
        {oneColumn && <BoardActions />}
      </div>
      {/* The opposite margin. A column of two commands and a switch balances seven key rows without
        costing the board a pixel — the two reserves together stay inside the slack. */}
      {!oneColumn && (
        <div className={styles.keyGuideRight} aria-label={t('panel.cleanup')}>
          <BoardActions />
        </div>
      )}
    </>
  )
}
