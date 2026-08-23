import { useMemo } from 'react'
import { useEditorSnapshot } from '@/editor/EditorContext'
import { useCompiled } from '@/editor/useCompiled'
import { useUiStore } from '@/editor/uiStore'
import { t } from './i18n'
import { activeStepAt, secs, stepTiming } from './stepTiming'
import styles from './shell.module.css'

/**
 * The step's CLOCK, top-right of the board.
 *
 * This used to narrate the step in words and the user cut it, correctly: "10번이 공을 가지고 있고
 * 7번에게 패스한다" is already drawn on the pitch in colour at full size, so saying it again is
 * noise (2026-08-24: 눈으로 봐도 충분히 알 수 있잖아).
 *
 * Timing is the information the picture genuinely cannot carry. A two-second run and a
 * five-second run draw the identical arrow, and this is a sequencer — when a step fires and how
 * long it lasts is the thing being authored. So: which of the play's steps this is, how long it
 * takes, and where it sits in the whole. While the play runs it becomes the stopwatch.
 */
export function StepStatus() {
  const { doc } = useEditorSnapshot()
  const compiled = useCompiled()
  const currentStep = useUiStore((s) => s.currentStep)
  const playing = useUiStore((s) => s.playback.playing)
  const clock = useUiStore((s) => s.playback.t)

  const running = playing ? activeStepAt(doc, compiled, clock) : null
  const step = running ?? currentStep
  // Keyed on the STEP, not the clock: this is a property of the step, so playback must not
  // re-derive it sixty times a second.
  const timing = useMemo(() => stepTiming(doc, compiled, step), [doc, compiled, step])

  return (
    <div className={styles.stepStatus} role="status" aria-live="polite" data-running={!!running}>
      <span className={styles.stepStatusBadge}>{t('step.badge', { n: step })}</span>
      <span className={styles.stepStatusBody}>
        {playing ? (
          <>
            <span className={styles.stepStatusMain}>
              {t('step.clock', { t: secs(clock), all: secs(timing.playEnd) })}
            </span>
            <span className={styles.stepStatusSub}>
              {timing.index
                ? t('step.ofTotal', { i: timing.index, n: timing.total })
                : t('step.empty')}
            </span>
          </>
        ) : (
          <>
            <span className={styles.stepStatusMain}>
              {timing.used
                ? t('step.takes', { d: secs(timing.end - timing.start) })
                : t('step.empty')}
            </span>
            <span className={styles.stepStatusSub}>
              {timing.used
                ? t('step.window', {
                    i: timing.index ?? 1,
                    n: timing.total,
                    from: secs(timing.start),
                    all: secs(timing.playEnd),
                  })
                : t('step.startsAt', { from: secs(timing.start) })}
            </span>
          </>
        )}
      </span>
    </div>
  )
}
