import { setPlayerLabel, setPlayerNumber, setPlayerRole } from '@/editor/commands'
import { useEditor, useEditorSnapshot } from '@/editor/EditorContext'
import { useUiStore } from '@/editor/uiStore'
import { SelectMenu } from './SelectMenu'
import { t } from './i18n'
import styles from './shell.module.css'

/**
 * Positions, with a plain-language gloss on every one. The menu used to be a scrolling column of
 * bare codes whose first row repeated its own group name ("GK" under "GK") — nothing in it could
 * be read at a glance (user 2026-08-22: 가독성이 너무 없어). The gloss is the readable part; the
 * code stays because that is what goes on the token.
 */
const ROLE_GROUPS: { group: string; roles: [string, string][] }[] = [
  { group: '골키퍼', roles: [['GK', '골키퍼']] },
  {
    group: '수비',
    roles: [
      ['DF', '수비수'],
      ['CB', '센터백'],
      ['LCB', '왼쪽 센터백'],
      ['RCB', '오른쪽 센터백'],
      ['LB', '왼쪽 풀백'],
      ['RB', '오른쪽 풀백'],
      ['LWB', '왼쪽 윙백'],
      ['RWB', '오른쪽 윙백'],
      ['SW', '스위퍼'],
    ],
  },
  {
    group: '미드필더',
    roles: [
      ['MF', '미드필더'],
      ['DM', '수비형'],
      ['CDM', '중앙 수비형'],
      ['CM', '중앙'],
      ['AM', '공격형'],
      ['CAM', '중앙 공격형'],
      ['LM', '왼쪽 미드필더'],
      ['RM', '오른쪽 미드필더'],
    ],
  },
  {
    group: '공격',
    roles: [
      ['FW', '공격수'],
      ['ST', '스트라이커'],
      ['CF', '센터 포워드'],
      ['SS', '섀도 스트라이커'],
      ['LW', '왼쪽 윙어'],
      ['RW', '오른쪽 윙어'],
    ],
  },
]
const ALL_ROLES = ROLE_GROUPS.flatMap((g) => g.roles.map(([code]) => code))

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
          columns={2}
          options={[
            { id: '', label: '—', sub: t('player.roleNone') },
            ...(player.role && !ALL_ROLES.includes(player.role)
              ? [{ id: player.role, group: t('player.role') }]
              : []),
            ...ROLE_GROUPS.flatMap((g) =>
              g.roles.map(([code, name]) => ({ id: code, sub: name, group: g.group })),
            ),
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
