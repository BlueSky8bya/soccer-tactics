import { createEmptyDocument } from '@/domain'
import { seedDefaultTeams } from '@/editor/commands'
import { replaceDocument } from '@/editor/moreCommands'
import { clearAllMovements } from '@/editor/stepCommands'
import { useEditor } from '@/editor/EditorContext'
import { useUiStore } from '@/editor/uiStore'
import { t } from './i18n'
import styles from './shell.module.css'

/**
 * 정리 + 동작 설정, in the side column (ADR-0009 v35, user 2026-08-25: 이 박스도 사이드로 옮겨줘).
 *
 * These two commands and one switch were a toolbar popover (v31), which was the right call while
 * the board had no free space to give them. It has since: the pitch is height-constrained, the
 * left margin is grass no scaling can ever use, and the key guide already lives there. A card in
 * that column costs the board nothing and saves the user a menu.
 *
 * Both commands are destructive and both are UNDOABLE in one step — that is what lets them stand
 * in the open rather than behind a menu. Their key caps ride on the buttons themselves, which is
 * where a shortcut label belongs (ExposeHK): the guide above does not repeat them.
 */
export function BoardActions() {
  const core = useEditor()
  const flashToast = useUiStore((s) => s.flashToast)
  const ballFling = useUiStore((s) => s.ballFling)
  const setBallFling = useUiStore((s) => s.setBallFling)
  return (
    <div className={styles.guideGroup}>
      <div className={styles.guideGroupLabel} aria-hidden="true">
        {t('panel.cleanup')}
      </div>
      <button
        type="button"
        className={`${styles.btn} ${styles.panelBtn} ${styles.btnQuietDanger}`}
        onClick={() => {
          const n = clearAllMovements(core)
          flashToast(n > 0 ? t('panel.clearAllDone', { n }) : t('panel.clearHint'))
        }}
        title={`${t('panel.clearAll')} (X)`}
      >
        <span className={styles.panelBtnLabel}>{t('panel.clearAll')}</span>
        <span className={styles.btnKbd}>X</span>
      </button>
      <button
        type="button"
        className={`${styles.btn} ${styles.panelBtn} ${styles.btnQuietDanger}`}
        onClick={() => {
          replaceDocument(core, seedDefaultTeams(createEmptyDocument({ title: t('doc.untitled') })))
          const u = useUiStore.getState()
          u.clearSelection()
          u.returnToAuthoringStart()
          // the board in front of you is a different board now — same signal the variant switch
          // uses, so "it changed" always looks the same wherever it comes from
          u.announceIdentitySwap()
        }}
        title={`${t('panel.reset')} (Shift+R)`}
      >
        <span className={styles.panelBtnLabel}>{t('panel.reset')}</span>
        <span className={styles.btnKbd}>⇧R</span>
      </button>
      <div className={styles.menuSep} aria-hidden="true" />
      <div className={styles.guideGroupLabel} aria-hidden="true">
        {t('panel.settings')}
      </div>
      {/* One row, one line (user 2026-08-24): a switch and its name. The full sentence lives in
          the tooltip and in the guide row that appears with the feature. */}
      <button
        type="button"
        role="switch"
        aria-checked={ballFling}
        className={styles.headerSwitch}
        onClick={() => setBallFling(!ballFling)}
        title={t('setting.ballFlingHint')}
      >
        <span className={styles.switchTrack} aria-hidden="true">
          <span className={styles.switchKnob} />
        </span>
        <span className={styles.panelBtnLabel}>{t('setting.ballFling')}</span>
      </button>
    </div>
  )
}
