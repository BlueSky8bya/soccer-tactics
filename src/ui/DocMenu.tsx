import { useEffect, useRef, useState } from 'react'
import { createEmptyDocument } from '@/domain'
import { ensureDefaultTeams } from '@/editor/commands'
import { useEditor, useEditorSnapshot } from '@/editor/EditorContext'
import { replaceDocument } from '@/editor/moreCommands'
import {
  clearAutosave,
  exportJson,
  exportPng,
  exportSvg,
  parseDocument,
  pickJsonFile,
} from '@/editor/persistence'
import { useUiStore } from '@/editor/uiStore'
import { SCENARIOS } from '@/presets/scenarios'
import { t } from './i18n'
import styles from './shell.module.css'

function pitchSvg(): SVGSVGElement | null {
  return document.querySelector('svg[role="application"]')
}

/** File menu: new / examples / open / save / export. No backend (ADR-0001). */
export function DocMenu() {
  const core = useEditor()
  const { doc } = useEditorSnapshot()
  const theme = useUiStore((s) => s.theme)
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const anchor = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!anchor.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  const flash = (msg: string) => {
    setStatus(msg)
    setTimeout(() => setStatus(null), 1800)
  }
  const resetUi = () => {
    const ui = useUiStore.getState()
    ui.clearSelection()
    ui.setPlaying(false)
    ui.setPlayhead(0)
    ui.setTool('select')
  }

  const item = (label: string, onClick: () => void, hint?: string) => (
    <button
      type="button"
      className={`${styles.btn} ${styles.menuItem}`}
      onClick={() => {
        setOpen(false)
        onClick()
      }}
    >
      <span>{label}</span>
      {hint && <span className={styles.kbd}>{hint}</span>}
    </button>
  )

  return (
    <div className={styles.popoverAnchor} ref={anchor}>
      <button
        type="button"
        className={`${styles.btn} ${open ? styles.btnActive : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={t('menu.title')}
      >
        ☰
      </button>
      {status && <span className={`${styles.muted} ${styles.status}`}>{status}</span>}
      {open && (
        <div className={`${styles.popover} ${styles.menu}`} role="menu">
          <div className={styles.sectionLabel}>{t('menu.file')}</div>
          {item(t('menu.new'), () => {
            const fresh = createEmptyDocument({ title: t('doc.untitled') })
            replaceDocument(core, fresh)
            ensureDefaultTeams(core)
            clearAutosave()
            resetUi()
          })}
          {item(t('menu.open'), async () => {
            const json = await pickJsonFile()
            if (!json) return
            try {
              replaceDocument(core, parseDocument(json))
              resetUi()
              flash(t('menu.opened'))
            } catch {
              flash(t('menu.openFailed'))
            }
          })}
          {item(t('menu.save'), () => {
            exportJson(core.getDocument())
            flash(t('menu.saved'))
          })}
          <div className={styles.sectionLabel}>{t('menu.export')}</div>
          {item('PNG', async () => {
            const svg = pitchSvg()
            if (svg) await exportPng(svg, doc.meta.title, theme)
          })}
          {item('SVG', () => {
            const svg = pitchSvg()
            if (svg) exportSvg(svg, doc.meta.title, theme)
          })}
          <div className={styles.sectionLabel}>{t('menu.examples')}</div>
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`${styles.btn} ${styles.menuItem}`}
              title={s.description}
              onClick={() => {
                setOpen(false)
                replaceDocument(core, s.build())
                resetUi()
              }}
            >
              <span>▶ {s.name}</span>
            </button>
          ))}
          <div className={styles.muted}>{t('menu.autosave')}</div>
        </div>
      )}
    </div>
  )
}
