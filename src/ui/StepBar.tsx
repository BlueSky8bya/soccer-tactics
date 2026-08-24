import type { CSSProperties } from 'react'
import { useEditorSnapshot } from '@/editor/EditorContext'
import { useCompiled } from '@/editor/useCompiled'
import { MAX_STEP, stepCounts } from '@/editor/stepCommands'
import { activeStepAt } from './stepTiming'
import { pickStep } from './stepPick'
import { useUiStore } from '@/editor/uiStore'
import { entityChipOf } from './teamColor'
import { t } from './i18n'
import styles from './shell.module.css'

/**
 * Step chips ①-⑨ (ADR-0009, PLAN-005 M1). A chip NEVER changes the document: it picks the step new
 * movements get and stands the board at the frame that step opens at. For a while it broke that
 * promise — with a movement selected it re-filed it — and reading a tactic step by step quietly
 * rewrote it (2026-08-24). Retargeting is Shift+number now; this row only ever looks.
 *
 * ONE job, and therefore one constant width. Scoped replay and the view switch used to sit here
 * as context actions, appearing and disappearing with the state — which made this centred row grow
 * and shrink and slid every chip sideways under the cursor (user 2026-08-24). They live over the
 * board now (StepPanel), where nothing they do can move anything else.
 */
export function StepBar() {
  const { doc } = useEditorSnapshot()
  const currentStep = useUiStore((s) => s.currentStep)
  const selectedSegmentId = useUiStore((s) => s.selectedSegmentId)
  const counts = stepCounts(doc)
  const compiled = useCompiled()
  const playingT = useUiStore((s) => (s.playback.playing ? s.playback.t : null))
  // Which step is running NOW (aria-current, M4). Shared with the board caption via
  // activeStepAt — two places answering "which step is this" separately is how they drift.
  const activeStep = playingT !== null ? activeStepAt(doc, compiled, playingT) : null

  /**
   * Pick a step to LOOK at. The chip is a VIEW control again, and this is the same three lines the
   * number keys run (useEditorKeyboard) — one implementation, so the two cannot drift.
   *
   * It used to also re-file the selected movement, added so the click would match what the number
   * key did. Both jobs are now on the key WITH SHIFT: a press that only means "show me step 3"
   * must not rewrite the tactic (user 2026-08-24: 계속 누르니까 단계들이 서로 섞여서 보임).
   *
   * It also used to set the playhead itself. The board pins the clock to the step's opening on its
   * own (SimplePitch), and under 전체 보기 that pin promptly undid this line — two writers, one of
   * them always losing. The pin is the writer now.
   */
  const preview = (n: number) => pickStep(doc, compiled, n)

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
    </div>
  )
}
