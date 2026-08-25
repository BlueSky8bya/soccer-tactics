import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import styles from './shell.module.css'

/**
 * A toolbar button that opens a card of controls (ADR-0009 v31).
 *
 * The children are ORDINARY BUTTONS, not `role="menuitem"`. A real menu takes the arrow keys
 * hostage and forces roving tabindex on rows that are otherwise plain controls — and this card
 * holds a formation `<select>` and a preference switch as well as commands, which a menu role
 * would misdescribe. So: a disclosure (`aria-haspopup`/`aria-expanded`) whose panel is a small
 * group of the same controls the side column used to hold.
 *
 * What it still owes the keyboard: Escape closes and returns focus to the trigger, a click outside
 * closes, and Tab leaving the card closes it. That is the contract a popover has to keep whatever
 * its role is.
 */
export function MenuButton(p: {
  label: string
  title?: string
  ariaLabel?: string
  /** Right-align the card under a trigger that sits on the toolbar's right half. */
  alignRight?: boolean
  children: ReactNode
  'data-tour'?: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const popId = useId()

  // useCallback, not a plain closure: the trigger ref is read when the card CLOSES, never while
  // it renders, and the linter is right to want that said in the code.
  const close = useCallback((focusTrigger = false) => {
    setOpen(false)
    if (focusTrigger) btnRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    // Escape is captured on the window, not the card: the pointer may be anywhere, and a
    // formation select inside the card swallows its own Escape first (that is correct — the
    // inner popup closes, this one stays).
    window.addEventListener('pointerdown', onDown, true)
    return () => window.removeEventListener('pointerdown', onDown, true)
  }, [open])

  return (
    <div
      className={styles.menu}
      ref={rootRef}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation()
          close(true)
        }
      }}
      onFocus={undefined}
      onBlur={(e) => {
        // Tabbing past the last control in the card closes it; clicking inside does not.
        if (open && !rootRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false)
      }}
    >
      <button
        type="button"
        ref={btnRef}
        className={`${styles.btn} ${styles.menuBtn} ${open ? styles.btnActive : ''}`}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? popId : undefined}
        aria-label={p.ariaLabel ?? p.label}
        title={p.title ?? p.label}
        data-tour={p['data-tour']}
        onClick={() => setOpen((o) => !o)}
      >
        {p.label}
        <svg width="10" height="6" viewBox="0 0 10 6" aria-hidden="true">
          <path
            d="M1 1l4 4 4-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <div
          id={popId}
          className={`${styles.menuPop} ${p.alignRight ? styles.menuPopRight : ''}`}
          role="group"
          aria-label={p.ariaLabel ?? p.label}
          /*
           * A COMMAND closes the card; a SETTING does not. Pressing 양 팀 채우기 and being left
           * staring at the menu that did it is the classic popover mistake, and so is having the
           * card vanish halfway through picking a formation. Rows that stay put say so with
           * `data-menu-keep`.
           */
          onClick={(e) => {
            const hit = (e.target as HTMLElement).closest('button')
            if (hit && !hit.closest('[data-menu-keep="true"]')) close(true)
          }}
        >
          {p.children}
        </div>
      )}
    </div>
  )
}
