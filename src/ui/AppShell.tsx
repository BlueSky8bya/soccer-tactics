import { useEffect, useState } from 'react'
import { useEditor, useEditorSnapshot, useVariantSession } from '@/editor/EditorContext'
import { useCompiled } from '@/editor/useCompiled'
import { downloadBlob, exportGif } from './exportGif'
import { UiIcon } from './UiIcon'
import { usePlaybackController } from '@/editor/usePlayback'
import { useUiStore } from '@/editor/uiStore'
import { PlayerCard } from './PlayerCard'
import { SelectionActionBar } from './SelectionActionBar'
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
  const { canUndo, canRedo } = useEditorSnapshot()
  const compiled = useCompiled()
  const ui = useUiStore()
  const pb = usePlaybackController(compiled.duration)
  const setReducedMotion = useUiStore((s) => s.setReducedMotion)
  const startTour = useUiStore((s) => s.startTour)
  const variants = useVariantSession()
  const [gifBusy, setGifBusy] = useState(false)
  useEditorKeyboard()

  const exportPlayGif = async () => {
    if (gifBusy) return
    setGifBusy(true)
    ui.flashToast(t('gif.start'), 90000)
    try {
      const blob = await exportGif(core.getDocument(), {
        onProgress: (d, n) => {
          if (d % 12 === 0)
            ui.flashToast(t('gif.progress', { p: Math.round((d / n) * 100) }), 90000)
        },
      })
      downloadBlob(blob, `tactic-${new Date().toISOString().slice(0, 10)}.gif`)
      ui.flashToast(t('gif.done'))
    } catch {
      ui.flashToast(t('gif.fail'))
    } finally {
      setGifBusy(false)
    }
  }

  const switchVariant = (id: 'A' | 'B' | 'C') => {
    if (!variants || !variants.has(id) || variants.activeId === id) return
    // Switching stops playback and drops the selection - they belong to the old board (M5).
    ui.returnToAuthoringStart()
    ui.clearSelection()
    variants.switchTo(id)
  }
  const cloneInto = (target: 'A' | 'B' | 'C') => {
    if (!variants || variants.has(target)) return
    ui.returnToAuthoringStart()
    ui.clearSelection()
    variants.cloneActiveTo(target)
    ui.flashToast(t('variant.cloned', { v: target }))
  }

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
        <button
          type="button"
          className={styles.versionBadge}
          onClick={() => {
            navigator.clipboard?.writeText(__APP_VERSION__).catch(() => {})
            ui.flashToast(t('app.versionCopied', { v: __APP_VERSION__ }))
          }}
          title={t('app.versionCopy')}
        >
          {__APP_VERSION__}
        </button>
        <span className={styles.headerCenter}>
          <span className={styles.brand}>{t('app.brand')}</span>
          {variants && (
            <span className={styles.variantBar} role="group" aria-label={t('variant.label')}>
              {(['A', 'B', 'C'] as const).map((v) =>
                variants.has(v) ? (
                  <button
                    key={v}
                    type="button"
                    className={`${styles.btn} ${styles.variantChip} ${variants.activeId === v ? styles.btnActive : ''}`}
                    onClick={() => switchVariant(v)}
                    aria-pressed={variants.activeId === v}
                    title={t('variant.switchTo', { v })}
                  >
                    {v}
                  </button>
                ) : (
                  <button
                    key={v}
                    type="button"
                    className={`${styles.btn} ${styles.variantChip} ${styles.variantEmpty}`}
                    onClick={() => cloneInto(v)}
                    title={t('variant.cloneInto', { v })}
                  >
                    {v}
                    <span className={styles.variantPlus}>+</span>
                  </button>
                ),
              )}
            </span>
          )}
        </span>
        <span className={styles.group}>
          <button
            type="button"
            className={styles.btn}
            onClick={() => core.undo()}
            disabled={!canUndo}
            title={`${t('topbar.undo')} (Ctrl+Z)`}
            aria-label={t('topbar.undo')}
          >
            <UiIcon name="undo" />
          </button>
          <button
            type="button"
            className={styles.btn}
            onClick={() => core.redo()}
            disabled={!canRedo}
            title={`${t('topbar.redo')} (Ctrl+Shift+Z)`}
            aria-label={t('topbar.redo')}
          >
            <UiIcon name="redo" />
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.helpBtn}`}
            onClick={() => ui.setShortcutsOpen(true)}
            data-tour="tour-restart"
            title={t('topbar.help')}
            aria-label={t('topbar.help')}
          >
            <UiIcon name="help" size={17} />
          </button>
        </span>
      </header>

      <ActionsPanel />
      <main className={styles.pitchAreaSimple}>
        <div className={styles.pitchFrame}>
          <SimplePitch />
        </div>
        {ui.selectedSegmentId ? <SelectionActionBar /> : <PlayerCard />}
        {errors.length > 0 && (
          <div className={styles.emptyHint} role="alert">
            ⚠ {t('tl.issue.cycle')}
          </div>
        )}
      </main>
      <GuidePanel />

      <footer className={styles.bottomWrap}>
        <div className={styles.simpleBar}>
          <span className={styles.barGroup}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary} ${styles.playBtn}`}
              onClick={pb.toggle}
              data-tour="play"
              title={`${ui.playback.playing ? t('tl.pause') : t('tl.play')} (Space)`}
              aria-label={ui.playback.playing ? t('tl.pause') : t('tl.play')}
            >
              {ui.playback.playing ? (
                <UiIcon name="pause" size={18} />
              ) : (
                <UiIcon name="play" size={18} filled />
              )}
            </button>
            <button
              type="button"
              className={styles.btn}
              onClick={pb.restart}
              title={`${t('tl.restart')} (Home)`}
              aria-label={t('tl.restart')}
            >
              <UiIcon name="home" />
            </button>
            <button
              type="button"
              className={`${styles.btn} ${ui.playback.loop ? styles.btnActive : ''}`}
              onClick={() => ui.setLoop(!ui.playback.loop)}
              title={`${t('tl.loop')} (G)`}
              aria-label={t('tl.loop')}
              aria-pressed={ui.playback.loop}
            >
              <UiIcon name="loop" size={15} />
            </button>
            <button
              type="button"
              className={styles.btn}
              onClick={exportPlayGif}
              disabled={gifBusy || compiled.duration < 0.3}
              title={t('gif.button')}
              aria-label={t('gif.button')}
            >
              {gifBusy ? '…' : 'GIF'}
            </button>
          </span>
          <span className={styles.barDivider} aria-hidden="true" />
          <StepBar />
          {ui.completion === 'held-result' && (
            <span className={styles.heldResult} role="status">
              {t('simple.heldResult')}
            </span>
          )}
        </div>
      </footer>

      {ui.toast && (
        <div className={styles.toast} role="status" aria-live="polite">
          {ui.toast}
        </div>
      )}
      <ShortcutsOverlay />
      <TourOverlay />
    </div>
  )
}
