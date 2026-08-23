import { useMemo } from 'react'
import { useEditorSnapshot } from '@/editor/EditorContext'
import { useCompiled } from '@/editor/useCompiled'
import { useUiStore } from '@/editor/uiStore'
import { t } from './i18n'
import { actionSummary, activeStepAt, describeStep } from './stepNarrative'
import styles from './shell.module.css'

/**
 * The step, said out loud (PLAN-015 M4).
 *
 * A number on a chip is not a situation. This pill sits in the board's top-left corner and answers
 * the two questions a picked step actually raises — **지금** (where the play stands as the step
 * opens) and **이번** (what is authored to happen in it) — so the chips stop being nine identical
 * buttons. While the play runs it follows the RUNNING step instead, which turns the same pill into
 * a commentary line.
 *
 * Top-LEFT deliberately: the boost/invite pills own the top centre, and a caption that jumps out
 * of the way of another overlay is worse than one that never shares its slot.
 */
export function StepStatus() {
  const { doc } = useEditorSnapshot()
  const compiled = useCompiled()
  const currentStep = useUiStore((s) => s.currentStep)
  const playing = useUiStore((s) => s.playback.playing)
  const clock = useUiStore((s) => s.playback.t)

  const running = playing ? activeStepAt(doc, compiled, clock) : null
  const step = running ?? currentStep
  // Keyed on the STEP, not the clock: the narrative is a property of the step, so playback must
  // not re-derive it (stateAt per movement) sixty times a second.
  const narrative = useMemo(() => describeStep(doc, compiled, step), [doc, compiled, step])

  return (
    <div className={styles.stepStatus} role="status" aria-live="polite" data-running={!!running}>
      <span className={styles.stepStatusBadge}>{t('step.badge', { n: step })}</span>
      <span className={styles.stepStatusBody}>
        <span className={styles.stepStatusLine}>
          <span className={styles.stepStatusKey}>{t('step.now')}</span>
          {narrative.situation}
        </span>
        <span className={styles.stepStatusLine}>
          <span className={styles.stepStatusKey}>
            {running ? t('step.running') : t('step.plan')}
          </span>
          {actionSummary(narrative.actions)}
        </span>
      </span>
    </div>
  )
}
