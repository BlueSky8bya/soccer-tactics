import { useEditorSnapshot } from '@/editor/EditorContext'
import { stepCounts, stepWindow } from '@/editor/stepCommands'
import { useUiStore } from '@/editor/uiStore'
import { playWindow } from '@/editor/usePlayback'
import { t } from './i18n'
import { UiIcon } from './UiIcon'
import styles from './shell.module.css'

/**
 * Everything you do TO the step in hand, in one column at the board's top-right: what the board
 * shows of it, and the two ways to replay it.
 *
 * All three used to live in the footer bar beside the step chips, and two of them appeared only
 * when the step held movements. The bar is a centred flex row, so its width breathed with the
 * state and every chip slid sideways under the cursor (user 2026-08-24: 단계 선택하는 버튼이 계속
 * 좌우로 왔다갔다거리는게 불편해). A control that MOVES the controls beside it is in the wrong
 * place; floated over the board it cannot push anything, and the footer is left with one job —
 * picking the step, always at the same pixel.
 *
 * The corner it took over used to hold a caption about the step's duration, cut as worthless
 * (2026-08-24: 2.7초 걸림 1/5번째 이런 정보 아무짝에도 쓸모 없어). Three things you can press beat
 * three numbers you cannot.
 */
export function StepPanel() {
  const { doc } = useEditorSnapshot()
  const currentStep = useUiStore((s) => s.currentStep)
  const playing = useUiStore((s) => s.playback.playing)
  const stepIsolate = useUiStore((s) => s.stepIsolate)
  const setStepIsolate = useUiStore((s) => s.setStepIsolate)

  // While the play runs the board belongs to the play (same rule as the paths and badges).
  if (playing) return null
  const used = (stepCounts(doc)[currentStep - 1] ?? 0) > 0

  const replay = (scope: 'step' | 'from-step') => {
    const w = stepWindow(doc, currentStep)
    if (w) playWindow(scope, w.start, scope === 'step' ? w.end : null)
  }

  return (
    <div className={styles.stepPanel} role="group" aria-label={t('simple.stepPanel')}>
      <button
        type="button"
        className={`${styles.stepPanelBtn} ${styles.stepViewBtn} ${used ? styles.stepViewBtnLeads : ''}`}
        onClick={() => setStepIsolate(!stepIsolate)}
        title={t('step.isolateHint')}
        aria-pressed={stepIsolate}
      >
        <UiIcon name={stepIsolate ? 'layers' : 'layersAll'} size={13} />
        {stepIsolate ? t('step.isolateOn') : t('step.isolateOff')}
      </button>
      {used && (
        <>
          <button
            type="button"
            className={styles.stepPanelBtn}
            onClick={() => replay('step')}
            title={t('simple.playStepHint', { n: currentStep })}
          >
            <UiIcon name="play" size={11} filled />
            {t('simple.playStep', { n: currentStep })}
          </button>
          <button
            type="button"
            className={styles.stepPanelBtn}
            onClick={() => replay('from-step')}
            title={t('simple.playFromHint', { n: currentStep })}
          >
            <UiIcon name="play" size={11} filled />
            {t('simple.playFrom', { n: currentStep })}
          </button>
        </>
      )}
    </div>
  )
}
