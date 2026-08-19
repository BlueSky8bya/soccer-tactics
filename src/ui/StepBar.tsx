import { useEditor, useEditorSnapshot } from '@/editor/EditorContext'
import { MAX_STEP, setSegmentStep, stepCounts } from '@/editor/stepCommands'
import { useUiStore } from '@/editor/uiStore'
import { t } from './i18n'
import styles from './shell.module.css'

/**
 * Step chips ①-⑩ (ADR-0009). The selected chip is the step new movements get.
 * With a movement selected, clicking a chip moves THAT movement to the step.
 */
export function StepBar() {
  const core = useEditor()
  const { doc } = useEditorSnapshot()
  const currentStep = useUiStore((s) => s.currentStep)
  const setCurrentStep = useUiStore((s) => s.setCurrentStep)
  const selectedSegmentId = useUiStore((s) => s.selectedSegmentId)
  const counts = stepCounts(doc)
  const lastUsed = counts.reduce((last, n, i) => (n > 0 ? i + 1 : last), 0)
  const visible = Math.min(MAX_STEP, Math.max(3, lastUsed + 1, currentStep))

  return (
    <div className={styles.stepBar} role="group" aria-label={t('simple.steps')}>
      <span className={styles.stepLabel}>{t('simple.steps')}</span>
      {Array.from({ length: visible }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          className={`${styles.stepChip} ${currentStep === n ? styles.stepChipActive : ''} ${counts[n - 1]! > 0 ? styles.stepChipUsed : ''}`}
          onClick={() => {
            setCurrentStep(n)
            if (selectedSegmentId) setSegmentStep(core, selectedSegmentId, n)
          }}
          title={
            selectedSegmentId
              ? t('simple.stepAssign', { n })
              : t('simple.stepPick', { n, c: counts[n - 1]! })
          }
          aria-pressed={currentStep === n}
        >
          {n}
          {counts[n - 1]! > 0 && <span className={styles.stepCount}>{counts[n - 1]}</span>}
        </button>
      ))}
    </div>
  )
}
