import { useEditorSnapshot } from '@/editor/EditorContext'
import { useCompiled } from '@/editor/useCompiled'
import { MAX_STEP, stepCounts, stepWindow } from '@/editor/stepCommands'
import { playWindow } from '@/editor/usePlayback'
import { useUiStore } from '@/editor/uiStore'
import { t } from './i18n'
import styles from './shell.module.css'

/**
 * Step chips ①-⑨ (ADR-0009, PLAN-005 M1). A chip NEVER changes the document: it picks the step new
 * movements get and — when the step is already used — previews its starting frame. Scoped replay
 * ("이 단계만" / "여기부터") lives next to the chips as context actions.
 */
export function StepBar() {
  const { doc } = useEditorSnapshot()
  const currentStep = useUiStore((s) => s.currentStep)
  const setCurrentStep = useUiStore((s) => s.setCurrentStep)
  const setPlayhead = useUiStore((s) => s.setPlayhead)
  const setPlaying = useUiStore((s) => s.setPlaying)
  const counts = stepCounts(doc)
  const currentUsed = counts[currentStep - 1]! > 0
  const compiled = useCompiled()
  const playingT = useUiStore((s) => (s.playback.playing ? s.playback.t : null))
  // Which step is running NOW (aria-current, M4) — derived from compiled times, no recompiles.
  let activeStep: number | null = null
  if (playingT !== null && doc.scenes[0]) {
    outer: for (const tr of doc.scenes[0].timeline.tracks)
      for (const sg of tr.segments) {
        if (!('path' in sg) || sg.id.startsWith('gen-')) continue
        const w = compiled.segmentTimes[sg.id]
        if (w && playingT >= w.start - 1e-9 && playingT <= w.end + 1e-9) {
          activeStep = Math.max(
            1,
            Math.min(MAX_STEP, Math.round((sg as { step?: number }).step ?? 1)),
          )
          break outer
        }
      }
  }

  const preview = (n: number) => {
    setCurrentStep(n)
    if ((counts[n - 1] ?? 0) === 0) return
    const w = stepWindow(doc, n)
    if (!w) return
    // Show the step's starting frame — pure UI time, no document change (A-01).
    setPlaying(false)
    setPlayhead(w.start)
  }

  const replayStep = () => {
    const w = stepWindow(doc, currentStep)
    if (w) playWindow('step', w.start, w.end)
  }
  const replayFrom = () => {
    const w = stepWindow(doc, currentStep)
    if (w) playWindow('from-step', w.start, null)
  }

  return (
    <div className={styles.stepBar} role="group" aria-label={t('simple.steps')}>
      <span className={styles.stepLabel}>{t('simple.steps')}</span>
      {Array.from({ length: MAX_STEP }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          className={`${styles.stepChip} ${currentStep === n ? styles.stepChipActive : ''} ${counts[n - 1]! > 0 ? styles.stepChipUsed : ''}`}
          onClick={() => preview(n)}
          title={t('simple.stepPick', { n, c: counts[n - 1]! })}
          aria-pressed={currentStep === n}
          aria-current={activeStep === n ? 'step' : undefined}
        >
          {n}
          {counts[n - 1]! > 0 && <span className={styles.stepCount}>{counts[n - 1]}</span>}
        </button>
      ))}
      {currentUsed && (
        <span className={styles.stepActions}>
          <button
            type="button"
            className={styles.btn}
            onClick={replayStep}
            title={t('simple.playStepHint', { n: currentStep })}
          >
            {t('simple.playStep')}
          </button>
          <button
            type="button"
            className={styles.btn}
            onClick={replayFrom}
            title={t('simple.playFromHint', { n: currentStep })}
          >
            {t('simple.playFrom')}
          </button>
        </span>
      )}
    </div>
  )
}
