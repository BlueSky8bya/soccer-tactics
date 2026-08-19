import { useEffect, useMemo, useRef, useState } from 'react'
import type { Team } from '@/domain/types'
import { applyFormation, clearTeam } from '@/editor/commands'
import { useEditor, useEditorSnapshot } from '@/editor/EditorContext'
import { FORMATIONS, searchFormations } from '@/presets/formations'
import { t } from './i18n'
import { SPRINGS } from './motion/spring'
import { useSpringAnimator } from './motion/useSpring'
import styles from './shell.module.css'

const RECENT_KEY = 'st.recentFormations'

function loadRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

function pushRecent(id: string): string[] {
  const next = [id, ...loadRecent().filter((x) => x !== id)].slice(0, 4)
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  return next
}

export function FormationPicker({ team }: { team: Team }) {
  const core = useEditor()
  const { doc } = useEditorSnapshot()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [recent, setRecent] = useState<string[]>(() => loadRecent())
  const anchor = useRef<HTMLDivElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const current = doc.formationRefs?.[team.id]
  const results = useMemo(() => searchFormations(query), [query])
  const count = doc.players.filter((p) => p.teamId === team.id).length

  // Popover spring (scale + fade) — interface motion only.
  const anim = useSpringAnimator(0, SPRINGS.miniBar, (v) => {
    const el = pop.current
    if (!el) return
    el.style.opacity = String(Math.max(0, Math.min(1, v)))
    el.style.transform = `scale(${0.96 + 0.04 * v})`
    el.style.pointerEvents = v > 0.5 ? 'auto' : 'none'
  })
  useEffect(() => {
    anim.to(open ? 1 : 0)
    if (open) setTimeout(() => inputRef.current?.focus(), 0)
  }, [open, anim])

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!anchor.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  const apply = (id: string) => {
    applyFormation(core, team.id, id)
    setRecent(pushRecent(id))
    setOpen(false)
    setQuery('')
  }

  const label = current
    ? (FORMATIONS.find((f) => f.id === current)?.name ?? current)
    : t('formation.none')

  return (
    <div className={styles.popoverAnchor} ref={anchor}>
      <button
        type="button"
        className={`${styles.btn} ${open ? styles.btnActive : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={`${t('topbar.formation')} — ${team.name}`}
      >
        <span className={styles.teamDot} style={{ background: team.color }} />
        <span>
          {team.name} · {label}
        </span>
        {count > 0 && <span className={styles.muted}>{count}</span>}
      </button>
      <div
        ref={pop}
        className={styles.popover}
        role="dialog"
        aria-label={`${t('topbar.formation')} — ${team.name}`}
        style={{ opacity: 0, pointerEvents: 'none' }}
        inert={!open}
        aria-hidden={!open}
      >
        <input
          ref={inputRef}
          className={styles.input}
          placeholder={t('formation.search')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results[0]) apply(results[0].id)
          }}
        />
        {!query && recent.length > 0 && (
          <>
            <div className={styles.sectionLabel}>{t('formation.recent')}</div>
            <div className={styles.formationGrid}>
              {recent.map((id) => {
                const f = FORMATIONS.find((x) => x.id === id)
                if (!f) return null
                return (
                  <button
                    key={id}
                    type="button"
                    className={`${styles.btn} ${styles.formationBtn} ${current === id ? styles.formationBtnActive : ''}`}
                    onClick={() => apply(id)}
                  >
                    {f.id}
                  </button>
                )
              })}
            </div>
          </>
        )}
        <div className={styles.sectionLabel}>{t('formation.all')}</div>
        <div className={styles.formationGrid}>
          {results.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`${styles.btn} ${styles.formationBtn} ${current === f.id ? styles.formationBtnActive : ''}`}
              onClick={() => apply(f.id)}
              title={f.name}
            >
              {f.id}
            </button>
          ))}
        </div>
        <div className={styles.muted}>{t('formation.replaceWarning')}</div>
        {count > 0 && (
          <button
            type="button"
            className={styles.btn}
            onClick={() => {
              clearTeam(core, team.id)
              setOpen(false)
            }}
          >
            {t('formation.clear')}
          </button>
        )}
      </div>
    </div>
  )
}
