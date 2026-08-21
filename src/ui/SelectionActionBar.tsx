import { useEditor, useEditorSnapshot } from '@/editor/EditorContext'
import { findSegment } from '@/editor/segmentCommands'
import { removeStepSegment, stepOf, stepWindow } from '@/editor/stepCommands'
import { playWindow } from '@/editor/usePlayback'
import { useUiStore } from '@/editor/uiStore'
import { t } from './i18n'
import styles from './shell.module.css'

/**
 * Controls for the selected movement (PLAN-005 M2, C-02/C-06): what it is, which step it is on,
 * replay of that step, delete. Renders at the PlayerCard anchor — only one card shows.
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
      {/* The step is SHOWN, not edited here. Three controls already assign it — the footer chips,
          the badge's in-place 1-9 picker on the board, and the number keys — and a fourth native
          dropdown in a floating pill was the worst of them (user 2026-08-22: 이거 없애도 될 것
          같지 않아?). */}
      <span className={styles.sabStep}>{t('sab.stepIs', { n: step })}</span>
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
