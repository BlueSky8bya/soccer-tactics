import type { CSSProperties } from 'react'
import { useEditor, useEditorSnapshot } from '@/editor/EditorContext'
import { useCompiled } from '@/editor/useCompiled'
import {
  MAX_STEP,
  setSegmentStep,
  stepCounts,
  stepRangeFor,
  stepWindow,
} from '@/editor/stepCommands'
import { playWindow } from '@/editor/usePlayback'
import { useUiStore } from '@/editor/uiStore'
import { entityChipOf } from './teamColor'
import { t } from './i18n'
import styles from './shell.module.css'

/**
 * Step chips ①-⑨ (ADR-0009, PLAN-005 M1). A chip NEVER changes the document: it picks the step new
 * movements get and — when the step is already used — previews its starting frame. Scoped replay
 * ("이 단계만" / "여기부터") lives next to the chips as context actions.
 */
export function StepBar() {
  const core = useEditor()
  const { doc } = useEditorSnapshot()
  const currentStep = useUiStore((s) => s.currentStep)
  const setCurrentStep = useUiStore((s) => s.setCurrentStep)
  const setPlayhead = useUiStore((s) => s.setPlayhead)
  const setPlaying = useUiStore((s) => s.setPlaying)
  const selectedSegmentId = useUiStore((s) => s.selectedSegmentId)
  const flashToast = useUiStore((s) => s.flashToast)
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
        if (sg.kind === 'travel' && sg.implicit) continue
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
    // A number KEY already retargeted the selected movement while a CLICK on the same chip did
    // not — one control, two behaviours. Now that the bar visibly wears the selected movement's
    // colour, the click has to mean what the colour says (and it is what makes the action bar's
    // own step dropdown redundant).
    if (selectedSegmentId) {
      const range = stepRangeFor(doc, selectedSegmentId)
      const landed = setSegmentStep(core, selectedSegmentId, n)
      if (landed !== null && landed !== n && range)
        flashToast(t('simple.stepRange', { a: range.lo, b: range.hi }))
    }
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

  // With a movement selected the bar RETARGETS it (number keys change its step), so the active
  // chip belongs to that entity and wears its identity. With nothing selected the bar picks the
  // step for whatever gets drawn next — no entity yet, so it stays the system accent.
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
            className={`${styles.btn} ${styles.stepActionBtn}`}
            onClick={replayStep}
            title={t('simple.playStepHint', { n: currentStep })}
          >
            {t('simple.playStep')}
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.stepActionBtn}`}
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
