import { createEmptyDocument } from '@/domain'
import { seedDefaultTeams } from '@/editor/commands'
import { replaceDocument } from '@/editor/moreCommands'
import { clearAllMovements } from '@/editor/stepCommands'
import { useEditor } from '@/editor/EditorContext'
import { useUiStore } from '@/editor/uiStore'
import { t } from './i18n'
import { UiIcon } from './UiIcon'
import styles from './shell.module.css'

/**
 * 정리 + 동작 설정 — the board's own commands, in their own column (ADR-0009 v36).
 *
 * They were a toolbar popover (v31), then a card at the bottom of the key guide (v35). Stacking
 * them under seven key rows made that column 857px tall once a key was opened, which overflowed a
 * 1280×800 board by 130px (measured) — and it left everything on one side of the screen
 * (user 2026-08-25: 이거 왼쪽에 있는거 확장되다보면 세로로 넘어버리잖아. 오른쪽으로 좀 분배하든지
 * 해 균형적으로). So they moved to the opposite margin, and the two columns split the grass the
 * pitch cannot use: 168px on the left for the keys, 90px on the right for these.
 *
 * The column is a SHARE of the grass (v37), so its width varies: at 52px it is an icon and a cap
 * with the name in the tooltip, and from 140px up it says the name out loud. That decision is a
 * container query on the column itself — the buttons ask how much room they were given rather than
 * asking how big the window is. Both commands undo in one step, which is what lets them stand in
 * the open at all.
 */
export function BoardActions() {
  const core = useEditor()
  const flashToast = useUiStore((s) => s.flashToast)
  const ballFling = useUiStore((s) => s.ballFling)
  const setBallFling = useUiStore((s) => s.setBallFling)
  return (
    <div className={styles.guideGroup}>
      <button
        type="button"
        className={`${styles.btn} ${styles.actionBtn} ${styles.btnQuietDanger}`}
        onClick={() => {
          const n = clearAllMovements(core)
          flashToast(n > 0 ? t('panel.clearAllDone', { n }) : t('panel.clearHint'))
        }}
        title={`${t('panel.clearAll')} (X)`}
        aria-label={t('panel.clearAll')}
      >
        <UiIcon name="trash" size={17} />
        <span className={styles.actionLabel}>{t('panel.clearAll')}</span>
        <span className={styles.actionKey} aria-hidden="true">
          X
        </span>
      </button>
      <button
        type="button"
        className={`${styles.btn} ${styles.actionBtn} ${styles.btnQuietDanger}`}
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
        aria-label={t('panel.reset')}
      >
        <UiIcon name="restart" size={17} />
        <span className={styles.actionLabel}>{t('panel.reset')}</span>
        <span className={styles.actionKey} aria-hidden="true">
          ⇧R
        </span>
      </button>
      <div className={styles.menuSep} aria-hidden="true" />
      {/* The one preference that changes what the BOARD does, so it lives with the board's own
          commands rather than in a settings screen this app does not have. */}
      <button
        type="button"
        role="switch"
        aria-checked={ballFling}
        className={`${styles.headerSwitch} ${styles.actionSwitch}`}
        onClick={() => setBallFling(!ballFling)}
        title={t('setting.ballFlingHint')}
        aria-label={t('setting.ballFling')}
      >
        <span className={styles.switchTrack} aria-hidden="true">
          <span className={styles.switchKnob} />
        </span>
        <span className={styles.actionLabel}>{t('setting.ballFling')}</span>
      </button>
    </div>
  )
}
