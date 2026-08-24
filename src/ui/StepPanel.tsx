import { useEditorSnapshot } from '@/editor/EditorContext'
import { stepCounts, stepWindow } from '@/editor/stepCommands'
import { useUiStore } from '@/editor/uiStore'
import { playWindow } from '@/editor/usePlayback'
import { t } from './i18n'
import { UiIcon } from './UiIcon'
import styles from './shell.module.css'

/**
 * The two ways to REPLAY the step in hand, in one column at the board's top-right.
 *
 * It used to carry the view switch too, and that was the mistake: the view mode belongs beside the
 * step NUMBER, and the number lives in the footer bar. Stating the same fact in two corners is how
 * the mode kept turning out to be something the user did not remember choosing (2026-08-25). 전체
 * is a cell of the step bar now; this panel keeps only what is genuinely about the step in hand,
 * and disappears when there is no step being shown or nothing in it to replay.
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

  // While the play runs the board belongs to the play (same rule as the paths and badges).
  if (playing) return null
  /*
   * Only while a STEP is being shown. “현재 단계” means nothing under 전체 보기, and offering it
   * there is what let the board's corner and the footer's bar disagree about which mode was on.
   */
  if (!stepIsolate) return null
  const used = (stepCounts(doc)[currentStep - 1] ?? 0) > 0
  if (!used) return null

  const replay = (scope: 'step' | 'from-step') => {
    const w = stepWindow(doc, currentStep)
    if (w) playWindow(scope, w.start, scope === 'step' ? w.end : null)
  }

  return (
    <div className={styles.stepPanel} role="group" aria-label={t('simple.stepPanel')}>
      <button
        type="button"
        className={styles.stepPanelBtn}
        onClick={() => replay('step')}
        title={t('simple.playStepHint', { n: currentStep })}
      >
        <UiIcon name="play" size={10} filled />
        {t('simple.playStep')}
      </button>
      <button
        type="button"
        className={styles.stepPanelBtn}
        onClick={() => replay('from-step')}
        title={t('simple.playFromHint', { n: currentStep })}
      >
        <UiIcon name="play" size={10} filled />
        {t('simple.playFrom')}
      </button>
    </div>
  )
}
