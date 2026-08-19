import { useEffect, useRef } from 'react'
import { useUiStore } from '@/editor/uiStore'
import { t } from './i18n'
import { KEYMAP_GROUPS } from './keymap'
import { SPRINGS } from './motion/spring'
import { useSpringAnimator } from './motion/useSpring'
import styles from './shell.module.css'

/** Full keymap overlay (`?`). Rendered from keymap.ts — single source of truth. */
export function ShortcutsOverlay() {
  const open = useUiStore((s) => s.shortcutsOpen)
  const setOpen = useUiStore((s) => s.setShortcutsOpen)
  const el = useRef<HTMLDivElement>(null)
  const anim = useSpringAnimator(0, SPRINGS.panelIn, (v) => {
    const node = el.current
    if (!node) return
    node.style.opacity = String(Math.max(0, Math.min(1, v)))
    node.style.transform = `translate(-50%, -50%) scale(${0.96 + 0.04 * v})`
    node.style.pointerEvents = v > 0.5 ? 'auto' : 'none'
    node.parentElement!.style.pointerEvents = v > 0.5 ? 'auto' : 'none'
    node.parentElement!.style.opacity = String(Math.max(0, Math.min(1, v)))
  })
  const lastFocus = useRef<HTMLElement | null>(null)
  const closeBtn = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    anim.to(open ? 1 : 0)
    if (open) {
      lastFocus.current = document.activeElement as HTMLElement | null
      setTimeout(() => closeBtn.current?.focus(), 0)
    } else if (lastFocus.current) {
      const prev = lastFocus.current
      lastFocus.current = null
      if (document.contains(prev)) prev.focus()
    }
  }, [open, anim])

  return (
    <div
      className={styles.overlay}
      style={{ opacity: 0, pointerEvents: 'none' }}
      onClick={() => setOpen(false)}
      inert={!open}
      aria-hidden={!open}
    >
      <div
        ref={el}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label={t('shortcuts.title')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.inspectorHead}>
          <span>⌨ {t('shortcuts.title')}</span>
          <button
            ref={closeBtn}
            type="button"
            className={styles.btn}
            onClick={() => setOpen(false)}
            title={t('shortcuts.close')}
            aria-label={t('shortcuts.close')}
          >
            ✕
          </button>
        </div>
        <p className={styles.muted}>
          왼손은 키보드(Q W E R / A S D / Z X C V / Space / Alt·Ctrl·Shift), 오른손은 마우스. 모든
          바인딩은 `src/ui/keymap.ts` 한 곳에서 바꿉니다.
        </p>
        <div className={styles.shortcutGrid}>
          {KEYMAP_GROUPS.map((g) => (
            <div key={g.title} className={styles.card}>
              <div className={styles.sectionLabel}>{g.title}</div>
              {g.items.map((b, i) => (
                <div key={b.label + i} className={styles.shortcutRow}>
                  <span className={styles.kbd}>{b.label}</span>
                  <span>{b.hint}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
