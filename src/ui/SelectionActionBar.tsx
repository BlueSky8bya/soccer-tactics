import { useEditor, useEditorSnapshot } from '@/editor/EditorContext'
import { findSegment } from '@/editor/segmentCommands'
import {
  MAX_STEP,
  removeStepSegment,
  setSegmentStep,
  stepOf,
  stepWindow,
} from '@/editor/stepCommands'
import { playWindow } from '@/editor/usePlayback'
import { useUiStore } from '@/editor/uiStore'
import { t } from './i18n'
import styles from './shell.module.css'

/**
 * Native controls for the selected movement (PLAN-005 M2, C-02/C-06): what it is, an exact 1-9
 * step picker, replay of its step, delete. Renders at the PlayerCard anchor — only one card shows.
 */
export function SelectionActionBar() {
  const core = useEditor()
  const { doc } = useEditorSnapshot()
  const segId = useUiStore((s) => s.selectedSegmentId)
  const selectSegment = useUiStore((s) => s.selectSegment)
  if (!segId) return null
  const f = findSegment(doc, segId)
  if (!f || !('path' in f.segment)) return null
  const isBall = f.track.entityKind === 'ball'
  const owner = isBall
    ? t('sab.ball')
    : `#${doc.players.find((p) => p.id === f.track.entityId)?.number ?? '?'}`
  const kind = f.segment.kind === 'travel' ? t('sab.pass') : t('sab.run')
  const step = stepOf(f.segment)

  return (
    <div className={styles.playerCard} role="group" aria-label={t('sab.label')}>
      <span className={styles.sabKind}>
        {owner} {kind}
      </span>
      <label>
        {t('sab.step')}
        <select
          className={styles.panelSelect}
          value={step}
          onChange={(e) => setSegmentStep(core, segId, Number(e.target.value))}
          aria-label={t('sab.stepPicker')}
        >
          {Array.from({ length: MAX_STEP }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className={styles.btn}
        onClick={() => {
          const w = stepWindow(doc, step)
          if (w) playWindow('step', w.start, w.end)
        }}
        title={t('simple.playStepHint', { n: step })}
      >
        {t('simple.playStep')}
      </button>
      <button
        type="button"
        className={styles.btn}
        onClick={() => {
          removeStepSegment(core, segId)
          selectSegment(null)
        }}
        title={`${t('sab.delete')} (Delete)`}
      >
        🗑 {t('sab.delete')}
      </button>
      <button
        type="button"
        className={styles.btn}
        onClick={() => selectSegment(null)}
        aria-label={t('sab.close')}
        title={t('sab.close')}
      >
        ✕
      </button>
    </div>
  )
}
