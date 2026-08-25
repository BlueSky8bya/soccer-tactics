import { applyFormations } from '@/editor/commands'
import { useEditor, useEditorSnapshot } from '@/editor/EditorContext'
import { FORMATIONS } from '@/presets/formations'
import { MenuButton } from './MenuButton'
import { SelectMenu } from './SelectMenu'
import { useState } from 'react'
import { t } from './i18n'
import styles from './shell.module.css'

/*
 * WHAT THE LEFT COLUMN BECAME (ADR-0009 v31; 정리·설정 moved back to the side in v35).
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
