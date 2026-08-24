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
      {/*
       * A SEGMENTED control, not a toggle button. A single button showing one label cannot say
       * whether it reports the current mode or the mode it would switch to — the user read
       * "보기: 전체" and could not tell which of the two they were in (2026-08-24: 이 버튼을 누르면
       * 전체보기 모드로 된다는건지 지금 현재가 전체보기 모드인지 인식이 안 돼). Two segments with
       * one lit answer both questions at once, and the lit segment also carries the step number, so
       * the buttons below can drop it and stay short.
       */}
      <span className={styles.viewSeg} role="group" aria-label={t('step.viewLabel')}>
        <button
          type="button"
          className={`${styles.viewSegBtn} ${stepIsolate ? styles.viewSegOn : ''}`}
          onClick={() => setStepIsolate(true)}
          aria-pressed={stepIsolate}
          title={t('step.isolateHint')}
        >
          {t('step.isolateOn', { n: currentStep })}
        </button>
        <button
          type="button"
          className={`${styles.viewSegBtn} ${!stepIsolate ? styles.viewSegOn : ''}`}
          onClick={() => setStepIsolate(false)}
          aria-pressed={!stepIsolate}
          title={t('step.allHint')}
        >
          {t('step.isolateOff')}
        </button>
      </span>
      {used && (
        <>
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
        </>
      )}
    </div>
  )
}
