import { useEffect } from 'react'
import { setDocumentTitle } from '@/editor/commands'
import { useEditor, useEditorSnapshot } from '@/editor/EditorContext'
import { useUiStore, type Tool } from '@/editor/uiStore'
import { AutoReactPanel } from './AutoReactPanel'
import { DocMenu } from './DocMenu'
import { FormationPicker } from './FormationPicker'
import { HelpPanel } from './HelpPanel'
import { Inspector } from './Inspector'
import { ShortcutsOverlay } from './ShortcutsOverlay'
import { t } from './i18n'
import { prefersReducedMotion } from './motion/spring'
import { PitchStage } from './pitch/PitchStage'
import styles from './shell.module.css'
import { Timeline } from './timeline/Timeline'
import { KEYMAP } from './keymap'
import { useEditorKeyboard } from './useEditorKeyboard'

interface ToolDef {
  id: Tool
  icon: string
  label: 'tool.select' | 'tool.addPlayer' | 'tool.path' | 'tool.zone' | 'tool.text' | 'tool.arrow'
  short: string
  key?: string
  enabled: boolean
}

const TOOLS: ToolDef[] = [
  {
    id: 'select',
    icon: '↖',
    label: 'tool.select',
    short: '선택',
    key: KEYMAP.tools.select.label,
    enabled: true,
  },
  {
    id: 'add-player',
    icon: '＋',
    label: 'tool.addPlayer',
    short: '선수',
    key: KEYMAP.tools.addPlayer.label,
    enabled: true,
  },
  {
    id: 'path',
    icon: '↝',
    label: 'tool.path',
    short: '경로',
    key: KEYMAP.tools.path.label,
    enabled: true,
  },
  {
    id: 'arrow',
    icon: '→',
    label: 'tool.arrow',
    short: '화살표',
    key: KEYMAP.tools.arrow.label,
    enabled: true,
  },
  {
    id: 'zone',
    icon: '▭',
    label: 'tool.zone',
    short: '구역',
    key: KEYMAP.tools.zone.label,
    enabled: true,
  },
  {
    id: 'text',
    icon: 'T',
    label: 'tool.text',
    short: '텍스트',
    key: KEYMAP.tools.text.label,
    enabled: true,
  },
]

export function AppShell() {
  const core = useEditor()
  const { doc, canUndo, canRedo } = useEditorSnapshot()
  const tool = useUiStore((s) => s.tool)
  const setTool = useUiStore((s) => s.setTool)
  const activeTeamId = useUiStore((s) => s.activeTeamId)
  const setActiveTeam = useUiStore((s) => s.setActiveTeam)
  const snapEnabled = useUiStore((s) => s.snapEnabled)
  const setSnapEnabled = useUiStore((s) => s.setSnapEnabled)
  const setReducedMotion = useUiStore((s) => s.setReducedMotion)
  const setShortcutsOpen = useUiStore((s) => s.setShortcutsOpen)
  const selection = useUiStore((s) => s.selection)
  const theme = useUiStore((s) => s.theme)
  const setTheme = useUiStore((s) => s.setTheme)
  useEditorKeyboard()

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    setReducedMotion(prefersReducedMotion())
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const on = () => setReducedMotion(!!mq?.matches)
    mq?.addEventListener?.('change', on)
    return () => mq?.removeEventListener?.('change', on)
  }, [setReducedMotion])

  useEffect(() => {
    if (!activeTeamId && doc.teams[0]) setActiveTeam(doc.teams[0].id)
  }, [activeTeamId, doc.teams, setActiveTeam])

  const hasPlayers = doc.players.length > 0
  const pathNeedsSelection = tool === 'path' && selection.length === 0

  return (
    <div className={styles.shell}>
      <header className={styles.top}>
        <DocMenu />
        <input
          className={styles.title}
          value={doc.meta.title}
          onChange={(e) => setDocumentTitle(core, e.target.value)}
          aria-label={t('doc.rename')}
          spellCheck={false}
        />
        <span className={styles.group}>
          {doc.teams.map((team) => (
            <FormationPicker key={team.id} team={team} />
          ))}
        </span>
        <span className={styles.spacer} />
        <span className={styles.group}>
          <AutoReactPanel />
          <button
            type="button"
            className={`${styles.btn} ${snapEnabled ? styles.btnActive : ''}`}
            onClick={() => setSnapEnabled(!snapEnabled)}
            title={snapEnabled ? t('topbar.snapOn') : t('topbar.snapOff')}
            aria-pressed={snapEnabled}
          >
            ⌗ {t('topbar.snap')}
          </button>
          <button
            type="button"
            className={styles.btn}
            onClick={() => core.undo()}
            disabled={!canUndo}
            title={`${t('topbar.undo')} (Ctrl+Z)`}
            aria-label={t('topbar.undo')}
          >
            ↶
          </button>
          <button
            type="button"
            className={styles.btn}
            onClick={() => core.redo()}
            disabled={!canRedo}
            title={`${t('topbar.redo')} (Ctrl+Shift+Z)`}
            aria-label={t('topbar.redo')}
          >
            ↷
          </button>
          <button
            type="button"
            className={styles.btn}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={theme === 'dark' ? t('topbar.themeLight') : t('topbar.themeDark')}
            aria-label={theme === 'dark' ? t('topbar.themeLight') : t('topbar.themeDark')}
            aria-pressed={theme === 'dark'}
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.helpBtn}`}
            onClick={() => setShortcutsOpen(true)}
            title={t('topbar.help')}
            aria-label={t('topbar.help')}
          >
            ?
          </button>
        </span>
      </header>

      <nav className={styles.rail} aria-label="Tools">
        {TOOLS.map((td) => (
          <button
            key={td.id}
            type="button"
            className={`${styles.btn} ${styles.railBtn} ${tool === td.id ? styles.btnActive : ''}`}
            onClick={() => td.enabled && setTool(td.id)}
            disabled={!td.enabled}
            title={`${t(td.label)}${td.key ? ` (${td.key})` : ''}${td.enabled ? '' : ` — ${t('tool.soon')}`}`}
            aria-label={`${t(td.label)}${td.key ? ` (${td.key})` : ''}`}
            aria-pressed={tool === td.id}
          >
            <span>{td.icon}</span>
            <span className={styles.railLabel}>{td.short}</span>
          </button>
        ))}
        <span className={styles.railSep} />
        {doc.teams.map((team) => (
          <button
            key={team.id}
            type="button"
            className={`${styles.btn} ${styles.railBtn} ${activeTeamId === team.id && tool === 'add-player' ? styles.btnActive : ''}`}
            onClick={() => {
              setActiveTeam(team.id)
              setTool('add-player')
            }}
            title={`${t('tool.addPlayer')} — ${team.name}`}
            aria-label={`${t('tool.addPlayer')} — ${team.name}`}
          >
            <span
              className={styles.teamDot}
              style={{ background: team.color, width: 14, height: 14 }}
            />
            <span className={styles.railLabel}>{team.name}</span>
          </button>
        ))}
      </nav>

      <main className={styles.pitchArea}>
        <div className={styles.pitchFrame}>
          <PitchStage />
        </div>
        {!hasPlayers && <div className={styles.emptyHint}>{t('empty.hint')}</div>}
        {pathNeedsSelection && <div className={styles.emptyHint}>{t('path.needSelection')}</div>}
        {tool === 'path' && selection.length > 0 && (
          <div className={styles.emptyHint}>{t('path.drawHint')}</div>
        )}
        {tool === 'zone' && <div className={styles.emptyHint}>{t('draw.zoneHint')}</div>}
      </main>

      <aside className={styles.side}>
        <Inspector />
        <HelpPanel />
      </aside>

      <footer className={styles.bottomWrap}>
        <Timeline />
      </footer>

      <ShortcutsOverlay />
    </div>
  )
}
