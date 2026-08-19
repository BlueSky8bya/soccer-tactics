import { useEffect, useRef } from 'react'
import { setDocumentTitle } from '@/editor/commands'
import { useEditor, useEditorSnapshot } from '@/editor/EditorContext'
import { useCompiled } from '@/editor/useCompiled'
import { usePlaybackController } from '@/editor/usePlayback'
import { useUiStore } from '@/editor/uiStore'
import { PlayerCard } from './PlayerCard'
import { ActionsPanel, GuidePanel } from './SidePanels'
import { ShortcutsOverlay } from './ShortcutsOverlay'
import { StepBar } from './StepBar'
import { t } from './i18n'
import { prefersReducedMotion } from './motion/spring'
import { SimplePitch } from './pitch/SimplePitch'
import styles from './shell.module.css'
import { TourOverlay } from './tour/TourOverlay'
import { hasSeenTour } from './tour/tourStorage'
import { useEditorKeyboard } from './useEditorKeyboard'

/**
 * Single simple mode (ADR-0009, user decision 2026-08-20): pitch + play + steps. No tool rail,
 * no inspector, no tracks. Everything is authored with the mouse on the pitch.
 */
export function AppShell() {
  const core = useEditor()
  const { doc, canUndo, canRedo } = useEditorSnapshot()
  const compiled = useCompiled()
  const ui = useUiStore()
  const pb = usePlaybackController(compiled.duration)
  const titleBefore = useRef('')
  const setReducedMotion = useUiStore((s) => s.setReducedMotion)
  const startTour = useUiStore((s) => s.startTour)
  useEditorKeyboard()

  useEffect(() => {
    document.documentElement.dataset.theme = 'light' // overrides any stored dark preference
  }, [])

  useEffect(() => {
    setReducedMotion(prefersReducedMotion())
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const on = () => setReducedMotion(!!mq?.matches)
    mq?.addEventListener?.('change', on)
    return () => mq?.removeEventListener?.('change', on)
  }, [setReducedMotion])

  // First visit (cookie/localStorage flag absent) → interactive tour.
  useEffect(() => {
    if (!hasSeenTour()) startTour(0)
  }, [startTour])

  const errors = compiled.issues.filter((i) => i.level === 'error')

  return (
    <div className={styles.shell} data-simple="true">
      <header className={styles.top}>
        <input
          className={styles.title}
          value={doc.meta.title}
          onChange={(e) => setDocumentTitle(core, e.target.value)}
          onFocus={(e) => {
            titleBefore.current = e.currentTarget.value
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            else if (e.key === 'Escape') {
              setDocumentTitle(core, titleBefore.current)
              e.currentTarget.blur()
            }
          }}
          aria-label={t('doc.rename')}
          spellCheck={false}
        />
        <span className={styles.hintInline}>{t('simple.topHint')}</span>
        <span className={styles.spacer} />
        <span className={styles.group}>
          <button
            type="button"
            className={styles.btn}
            onClick={() => core.undo()}
            disabled={!canUndo}
            title={`${t('topbar.undo')} (Ctrl+Z)`}
            aria-label={t('topbar.undo')}
          >
            ↶
          </button>
          <button
            type="button"
            className={styles.btn}
            onClick={() => core.redo()}
            disabled={!canRedo}
            title={`${t('topbar.redo')} (Ctrl+Shift+Z)`}
            aria-label={t('topbar.redo')}
          >
            ↷
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.helpBtn}`}
            onClick={() => ui.setShortcutsOpen(true)}
            data-tour="tour-restart"
            title={t('topbar.help')}
            aria-label={t('topbar.help')}
          >
            ?
          </button>
        </span>
      </header>

      <ActionsPanel />
      <main className={styles.pitchAreaSimple}>
        <div className={styles.pitchFrame}>
          <SimplePitch />
        </div>
        <PlayerCard />
        {errors.length > 0 && (
          <div className={styles.emptyHint} role="alert">
            ⚠ {t('tl.issue.cycle')}
          </div>
        )}
      </main>
      <GuidePanel />

      <footer className={styles.bottomWrap}>
        <div className={styles.simpleBar}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary} ${styles.playBtn}`}
            onClick={pb.toggle}
            data-tour="play"
            title={`${ui.playback.playing ? t('tl.pause') : t('tl.play')} (Space)`}
            aria-label={ui.playback.playing ? t('tl.pause') : t('tl.play')}
          >
            {ui.playback.playing ? '❚❚' : '▶'}
          </button>
          <button
            type="button"
            className={styles.btn}
            onClick={pb.restart}
            title={`${t('tl.restart')} (Home)`}
            aria-label={t('tl.restart')}
          >
            ↺
          </button>
          <button
            type="button"
            className={`${styles.btn} ${ui.playback.loop ? styles.btnActive : ''}`}
            onClick={() => ui.setLoop(!ui.playback.loop)}
            title={`${t('tl.loop')} (G)`}
            aria-label={t('tl.loop')}
            aria-pressed={ui.playback.loop}
          >
            ⟳
          </button>
          <StepBar />
        </div>
      </footer>

      <ShortcutsOverlay />
      <TourOverlay />
    </div>
  )
}
