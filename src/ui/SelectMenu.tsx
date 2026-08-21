import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import styles from './shell.module.css'

export interface SelectOption {
  id: string
  label?: string
  /** Optional heading this option belongs under; consecutive options share one heading. */
  group?: string
  /** Plain-language gloss shown beside the label — a code list is not a readable menu. */
  sub?: string
}

/**
 * Apple-style replacement for a native <select>: the POPUP list of a native control cannot be
 * styled, so this renders its own card menu (rounded, shadowed, check on the current row) that
 * matches the surrounding panels instead of the operating system (user 2026-08-22: 드롭다운 박스
 * 디자인도 기본 말고 주변이랑 어울리게).
 *
 * Because it replaces a native control it has to earn the keyboard behaviour back: Enter/Space/
 * arrows open it, arrows move the active row, Enter commits, Escape cancels, and focus returns to
 * the trigger. It also flips above the trigger when the room below runs out — the player card
 * lives at the bottom of the board, where a downward menu would open off-screen.
 */
export function SelectMenu(p: {
  value: string
  options: readonly SelectOption[]
  onChange: (id: string) => void
  ariaLabel: string
  /** Shown on the trigger when `value` matches no option (e.g. "role not set"). */
  placeholder?: string
  /**
   * Lay the options out in N columns. A one-per-line list of 24 position codes scrolls, repeats
   * its own group name as its first row, and says nothing a coach can read at a glance
   * (user 2026-08-22: 가독성이 너무 없어). Two columns fit the whole set without scrolling.
   */
  columns?: 1 | 2
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [flipUp, setFlipUp] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLUListElement>(null)

  const current = p.options.findIndex((o) => o.id === p.value)
  const chosen = current >= 0 ? p.options[current]! : undefined
  const label = chosen ? (chosen.label ?? chosen.id) : p.placeholder
  const cols = p.columns ?? 1

  useEffect(() => {
    if (!open) return
    setActive(current >= 0 ? current : 0)
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', onDown, true)
    return () => window.removeEventListener('pointerdown', onDown, true)
    // `current` is read once per opening on purpose — reopening re-syncs it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Flip before paint so the menu never appears in the wrong place for a frame.
  useLayoutEffect(() => {
    if (!open) return
    const btn = btnRef.current
    const pop = popRef.current
    if (!btn || !pop) return
    const r = btn.getBoundingClientRect()
    const need = Math.min(pop.scrollHeight + 8, 420)
    setFlipUp(window.innerHeight - r.bottom < need && r.top > need)
  }, [open])

  // Keep the active row in view while arrowing through a long list (roles).
  useEffect(() => {
    if (!open) return
    popRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const commit = (id: string) => {
    p.onChange(id)
    setOpen(false)
    btnRef.current?.focus()
  }

  const step = (dir: 1 | -1) =>
    setActive((i) => Math.min(p.options.length - 1, Math.max(0, i + dir)))

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        setOpen(true)
      }
      return
    }
    switch (e.key) {
      case 'Escape':
        e.preventDefault()
        setOpen(false)
        btnRef.current?.focus()
        return
      case 'ArrowDown':
        e.preventDefault()
        step(1)
        return
      case 'ArrowUp':
        e.preventDefault()
        step(-1)
        return
      case 'Home':
        e.preventDefault()
        setActive(0)
        return
      case 'End':
        e.preventDefault()
        setActive(p.options.length - 1)
        return
      case 'Enter':
      case ' ': {
        e.preventDefault()
        const o = p.options[active]
        if (o) commit(o.id)
        return
      }
      default:
        return
    }
  }

  return (
    <div className={styles.selectMenu} ref={rootRef} onKeyDown={onKeyDown}>
      <button
        type="button"
        ref={btnRef}
        className={styles.selectBtn}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={p.ariaLabel}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={`${styles.selectValue} ${label ? '' : styles.selectPlaceholder}`}>
          {label || p.placeholder || '—'}
        </span>
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
        <ul
          className={`${styles.selectPop} ${flipUp ? styles.selectPopUp : ''} ${
            cols === 2 ? styles.selectPopWide : ''
          }`}
          ref={popRef}
          role="listbox"
          aria-label={p.ariaLabel}
        >
          {p.options.flatMap((o, i) => {
            const heading = o.group && o.group !== p.options[i - 1]?.group ? o.group : null
            const rows = []
            // A heading is its own full-width row, so the columns underneath stay aligned and a
            // one-item group never reads as its own first option (the old list showed "GK" twice).
            if (heading)
              rows.push(
                <li key={`h-${heading}`} className={styles.selectHeadRow} role="presentation">
                  <div className={styles.selectGroup}>{heading}</div>
                </li>,
              )
            rows.push(
              <li
                key={o.id || `__${i}`}
                className={cols === 2 && o.group ? styles.selectCellHalf : styles.selectHeadRow}
              >
                <button
                  type="button"
                  role="option"
                  tabIndex={-1}
                  data-active={i === active}
                  aria-selected={o.id === p.value}
                  className={`${styles.selectItem} ${o.id === p.value ? styles.selectItemOn : ''} ${
                    i === active ? styles.selectItemActive : ''
                  }`}
                  onPointerEnter={() => setActive(i)}
                  onClick={() => commit(o.id)}
                >
                  <span className={styles.selectItemLabel}>{o.label ?? o.id}</span>
                  {o.sub && <span className={styles.selectItemSub}>{o.sub}</span>}
                  <span className={styles.selectCheck} aria-hidden="true">
                    {o.id === p.value ? '✓' : ''}
                  </span>
                </button>
              </li>,
            )
            return rows
          })}
        </ul>
      )}
    </div>
  )
}
