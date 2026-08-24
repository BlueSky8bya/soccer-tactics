import { useEffect, useRef, type CSSProperties } from 'react'
import { useEditorSnapshot } from '@/editor/EditorContext'
import { useCompiled } from '@/editor/useCompiled'
import { MAX_STEP, stepCounts } from '@/editor/stepCommands'
import { activeStepAt } from './stepTiming'
import { pickAll, pickStep } from './stepPick'
import { useUiStore } from '@/editor/uiStore'
import { entityChipOf } from './teamColor'
import { t } from './i18n'
import styles from './shell.module.css'

/**
 * WHAT THE BOARD IS SHOWING — 전체, or one of ①-⑨. One row, one lit cell.
 *
 * 전체 used to be a segmented control floating over the board's top-right corner while the step
 * number lived down here in the footer: the same fact stated in two places, a diagonal apart. You
 * read one and never looked at the other, so the view mode kept turning out to be something you
 * did not remember choosing (user 2026-08-25: 전체 모드랑 해당 레이어 모드랑 어느 순간 바껴있어서
 * 인식하기 헷갈리는데). Folding 전체 in as the row's first cell removes a whole state from the
 * user's head: the thing you already watch is now the thing that answers.
 *
 * A cell NEVER changes the document — it picks what you look at, and (while a step is lit) the step
 * new movements get. Retargeting a selected movement is Shift+number (ADR-0009 v28).
 */
export function StepBar() {
  const { doc } = useEditorSnapshot()
  const currentStep = useUiStore((s) => s.currentStep)
  const stepIsolate = useUiStore((s) => s.stepIsolate)
  const stepBump = useUiStore((s) => s.stepBump)
  const reducedMotion = useUiStore((s) => s.reducedMotion)
  const selectedSegmentId = useUiStore((s) => s.selectedSegmentId)
  const counts = stepCounts(doc)
  const compiled = useCompiled()
  const playingT = useUiStore((s) => (s.playback.playing ? s.playback.t : null))
  // Which step is running NOW (aria-current, M4). Shared with the board caption via
  // activeStepAt — two places answering "which step is this" separately is how they drift.
  const activeStep = playingT !== null ? activeStepAt(doc, compiled, playingT) : null

  /*
   * A step that moved BY ITSELF flashes.
   *
   * The chip legitimately follows the work — a run drawn on step 1 that lands on 2 has to be
   * visible, a finished replay has to describe the frame it holds — but it did all of that
   * silently, so the number was simply found changed later (user 2026-08-25: 레이어 단계가 4번으로
   * 가있고). A press moves it too; a press you already know about, so only the automatic moves tick
   * `stepBump`. Animated imperatively rather than with a CSS class: an animation has to REPLAY on
   * every bump, and re-adding a class does not restart one.
   */
  const barRef = useRef<HTMLDivElement>(null)
  const seenBump = useRef(stepBump)
  useEffect(() => {
    if (seenBump.current === stepBump) return
    seenBump.current = stepBump
    if (reducedMotion) return
    const el = barRef.current?.querySelector<HTMLElement>('[data-step-active="1"]')
    el?.animate?.(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.28)' }, { transform: 'scale(1)' }],
      { duration: 420, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
    )
  }, [stepBump, reducedMotion])

  // A selected movement wears its entity's colour here, because Shift+number files it onto the
  // chip you press. With nothing selected the bar picks the step for whatever gets drawn next —
  // no entity yet, so it stays the system accent.
  const chip = selectedSegmentId
    ? entityChipOf(
        doc,
        doc.scenes[0]?.timeline.tracks.find((tr) =>
          tr.segments.some((sg) => sg.id === selectedSegmentId),
        )?.entityId ?? doc.ball.id,
      )
    : null
  return (
    <div
      ref={barRef}
      className={styles.stepBar}
      role="group"
      aria-label={t('simple.steps')}
      style={
        chip
          ? ({ '--st-entity-chip': chip.fill, '--st-entity-ink': chip.ink } as CSSProperties)
          : undefined
      }
    >
      <span className={styles.stepLabel}>{t('simple.steps')}</span>
      <button
        type="button"
        className={`${styles.stepAll} ${!stepIsolate ? styles.stepAllOn : ''}`}
        onClick={() => pickAll()}
        title={t('step.allHint')}
        aria-pressed={!stepIsolate}
        data-step-active={!stepIsolate ? '1' : undefined}
      >
        {t('step.isolateOff')}
      </button>
      <span className={styles.stepBarSplit} aria-hidden="true" />
      {Array.from({ length: MAX_STEP }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          /*
           * While 전체 is lit no number is: the row has ONE lit cell, or the mode it is in stops
           * being readable at a glance. The step new movements would go on still has to be
           * knowable, so it keeps a quiet outline instead (`stepChipTarget`).
           */
          className={`${styles.stepChip} ${
            stepIsolate && currentStep === n ? styles.stepChipActive : ''
          } ${!stepIsolate && currentStep === n ? styles.stepChipTarget : ''} ${
            counts[n - 1]! > 0 ? styles.stepChipUsed : ''
          }`}
          onClick={() => pickStep(doc, compiled, n)}
          title={t('simple.stepPick', { n, c: counts[n - 1]! })}
          aria-pressed={stepIsolate && currentStep === n}
          aria-current={activeStep === n ? 'step' : undefined}
          data-step-active={stepIsolate && currentStep === n ? '1' : undefined}
        >
          {n}
          {counts[n - 1]! > 0 && <span className={styles.stepCount}>{counts[n - 1]}</span>}
        </button>
      ))}
    </div>
  )
}
