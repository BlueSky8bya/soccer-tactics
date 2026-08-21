import { setPlayerLabel, setPlayerNumber, setPlayerRole } from '@/editor/commands'
import { useEditor, useEditorSnapshot } from '@/editor/EditorContext'
import { useUiStore } from '@/editor/uiStore'
import { SelectMenu } from './SelectMenu'
import { t } from './i18n'
import styles from './shell.module.css'

const ROLE_GROUPS: { group: string; roles: string[] }[] = [
  { group: 'GK', roles: ['GK'] },
  { group: '수비', roles: ['DF', 'CB', 'LCB', 'RCB', 'LB', 'RB', 'LWB', 'RWB', 'SW'] },
  { group: '미드필더', roles: ['MF', 'DM', 'CDM', 'CM', 'AM', 'CAM', 'LM', 'RM'] },
  { group: '공격', roles: ['FW', 'ST', 'CF', 'SS', 'LW', 'RW'] },
]
const ALL_ROLES = ROLE_GROUPS.flatMap((g) => g.roles)

/**
 * Compact editor for the selected player (number / name / position).
 * The token itself shows only the number by default; the name appears under it once set.
 */
export function PlayerCard() {
  const core = useEditor()
  const { doc } = useEditorSnapshot()
  const selection = useUiStore((s) => s.selection)
  const clearSelection = useUiStore((s) => s.clearSelection)
  const player = selection.length === 1 ? doc.players.find((p) => p.id === selection[0]) : undefined
  if (!player) return null
  const team = doc.teams.find((tm) => tm.id === player.teamId)
  return (
    <div className={styles.playerCard} role="group" aria-label={t('player.card')}>
      <span className={styles.teamDot} style={{ background: team?.color }} />
      <label>
        {t('player.number')}
        <input
          className={styles.playerNum}
          type="number"
          min={1}
          max={99}
          value={player.number}
          onChange={(e) => setPlayerNumber(core, player.id, Number(e.target.value))}
        />
      </label>
      <label>
        {t('player.name')}
        <input
          className={styles.playerName}
          type="text"
          placeholder="—"
          value={player.label ?? ''}
          onChange={(e) => setPlayerLabel(core, player.id, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur()
          }}
        />
      </label>
      <label className={styles.playerRoleField}>
        {t('player.role')}
        {/* Was a native <select>, whose popup the OS draws and no stylesheet can reach — a grey
            system list dropping out of a frosted card (user 2026-08-22). SelectMenu renders the
            list itself, so it matches the panels around it and flips up when the card is low. */}
        <SelectMenu
          value={player.role ?? ''}
          ariaLabel={t('player.role')}
          placeholder="—"
          options={[
            { id: '', label: '—' },
            ...(player.role && !ALL_ROLES.includes(player.role)
              ? [{ id: player.role, group: t('player.role') }]
              : []),
            ...ROLE_GROUPS.flatMap((g) => g.roles.map((r) => ({ id: r, group: g.group }))),
          ]}
          onChange={(v) => setPlayerRole(core, player.id, v)}
        />
      </label>
      <button
        type="button"
        className={styles.btn}
        onClick={() => clearSelection()}
        title={`${t('inspector.close')} (Esc)`}
        aria-label={t('inspector.close')}
      >
        ✕
      </button>
    </div>
  )
}
