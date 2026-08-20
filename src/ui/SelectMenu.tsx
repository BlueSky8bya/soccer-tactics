import { useEffect, useRef, useState } from 'react'
import styles from './shell.module.css'

/**
 * Apple-style replacement for a native <select>: the POPUP list of a native control cannot be
 * styled, so this renders its own card menu (rounded, shadowed, check on the current row).
 * Click-driven with Escape/outside-click close — option lists here are short (formations).
 */
export function SelectMenu(p: {
  value: string
  options: readonly { id: string; label?: string }[]
  onChange: (id: string) => void
  ariaLabel: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className={styles.selectMenu} ref={rootRef}>
      <button
        type="button"
        className={styles.selectBtn}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={p.ariaLabel}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={styles.selectValue}>{p.value}</span>
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
        <ul className={styles.selectPop} role="listbox" aria-label={p.ariaLabel}>
          {p.options.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                role="option"
                aria-selected={o.id === p.value}
                className={`${styles.selectItem} ${o.id === p.value ? styles.selectItemOn : ''}`}
                onClick={() => {
                  p.onChange(o.id)
                  setOpen(false)
                }}
              >
                <span className={styles.selectCheck} aria-hidden="true">
                  {o.id === p.value ? '✓' : ''}
                </span>
                {o.label ?? o.id}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
