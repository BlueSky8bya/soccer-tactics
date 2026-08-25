import { createEmptyDocument } from '@/domain'
import { applyFormations, seedDefaultTeams } from '@/editor/commands'
import { replaceDocument } from '@/editor/moreCommands'
import { clearAllMovements } from '@/editor/stepCommands'
import { useEditor, useEditorSnapshot } from '@/editor/EditorContext'
import { FORMATIONS } from '@/presets/formations'
import { MenuButton } from './MenuButton'
import { SelectMenu } from './SelectMenu'
import { useState } from 'react'
import { useUiStore } from '@/editor/uiStore'
import { t } from './i18n'
import styles from './shell.module.css'

/*
 * WHAT THE LEFT COLUMN BECAME (ADR-0009 v31).
 *
 * 팀 구성 and 정리 were four cards standing in a 222px column all session — for two buttons you
 * press once at the start of a board and two you press rarely. Measured, that column plus the
 * guide column took 32% of a 1440 window and 36% of a 1280 one, straight out of the pitch.
 *
 * They are toolbar menus now. Same controls, same names, same keyboard shortcuts printed on the
 * same rows — the only thing that changed is that they are not standing there when you are not
 * using them.
 *
 * NO emoji on these buttons (user 2026-08-24): every other control in the app is a drawn stroke
 * icon or plain text, and three coloured glyphs in one column read as a different product.
 */

/** 팀 구성 — formations for both teams, and the one button that fills the board. */
export function TeamMenu() {
  const core = useEditor()
  const { doc } = useEditorSnapshot()
  const home = doc.teams[0]
  const away = doc.teams[1]
  const [homeF, setHomeF] = useState('4-3-3')
  const [awayF, setAwayF] = useState('4-4-2')
  const formationSelect = (
    value: string,
    onChange: (v: string) => void,
    label: string,
    color?: string,
  ) => (
    <label className={styles.panelField} data-menu-keep="true">
      <span className={styles.teamName}>
        {color && <span className={styles.teamDotSmall} style={{ background: color }} />}
        {label}
      </span>
      <SelectMenu
        value={value}
        options={FORMATIONS.map((f) => ({ id: f.id }))}
        onChange={onChange}
        ariaLabel={label}
      />
    </label>
  )
  return (
    <MenuButton label={t('panel.team')} data-tour="fill">
      {formationSelect(homeF, setHomeF, home?.name ?? 'Home', home?.color)}
      {formationSelect(awayF, setAwayF, away?.name ?? 'Away', away?.color)}
      <button
        type="button"
        className={`${styles.btn} ${styles.panelBtn} ${styles.btnTintBlue} ${styles.panelPrimary}`}
        onClick={() => {
          const picks = [
            home ? { teamId: home.id, formationId: homeF } : null,
            away ? { teamId: away.id, formationId: awayF } : null,
          ].filter((x): x is { teamId: string; formationId: string } => !!x)
          if (picks.length) applyFormations(core, picks)
        }}
        title={`${home?.name ?? 'Home'} ${homeF} · ${away?.name ?? 'Away'} ${awayF}`}
      >
        {t('panel.fill')}
      </button>
    </MenuButton>
  )
}

/** 보드 — the two destructive commands and the one behaviour switch. */
export function BoardMenu() {
  const core = useEditor()
  const flashToast = useUiStore((s) => s.flashToast)
  const ballFling = useUiStore((s) => s.ballFling)
  const setBallFling = useUiStore((s) => s.setBallFling)
  return (
    <MenuButton label={t('panel.boardMenu')} ariaLabel={t('panel.boardMenu')}>
      <div className={styles.sectionLabel}>{t('panel.cleanup')}</div>
      <button
        type="button"
        className={`${styles.btn} ${styles.panelBtn} ${styles.btnQuietDanger}`}
        onClick={() => {
          const n = clearAllMovements(core)
          flashToast(n > 0 ? t('panel.clearAllDone', { n }) : t('panel.clearHint'))
        }}
        title={`${t('panel.clearAll')} (X)`}
      >
        {t('panel.clearAll')}
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
        {t('panel.reset')}
        <span className={styles.btnKbd}>⇧R</span>
      </button>
      <div className={styles.menuSep} aria-hidden="true" />
      <div className={styles.sectionLabel}>{t('panel.settings')}</div>
      {/* One row, one line (user 2026-08-24): a switch and its name. The full sentence lives in
              the tooltip and in the hint that appears with the feature. */}
      <button
        type="button"
        role="switch"
        aria-checked={ballFling}
        className={styles.headerSwitch}
        data-menu-keep="true"
        onClick={() => setBallFling(!ballFling)}
        title={t('setting.ballFlingHint')}
      >
        <span className={styles.switchTrack} aria-hidden="true">
          <span className={styles.switchKnob} />
        </span>
        {t('setting.ballFling')}
      </button>
    </MenuButton>
  )
}
