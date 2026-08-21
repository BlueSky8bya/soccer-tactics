import { setPlayerLabel, setPlayerNumber, setPlayerRole } from '@/editor/commands'
import { useEditor, useEditorSnapshot } from '@/editor/EditorContext'
import { useUiStore } from '@/editor/uiStore'
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
      <label>
        {t('player.role')}
        <select
          value={player.role ?? ''}
          onChange={(e) => setPlayerRole(core, player.id, e.target.value)}
        >
          <option value="">—</option>
          {player.role && !ALL_ROLES.includes(player.role) && (
            <option value={player.role}>{player.role}</option>
          )}
          {ROLE_GROUPS.map((g) => (
            <optgroup key={g.group} label={g.group}>
              {g.roles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
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
