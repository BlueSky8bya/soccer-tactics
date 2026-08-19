import { useEffect, useRef, useState } from 'react'
import { applyFormation } from '@/editor/commands'
import { useEditor, useEditorSnapshot } from '@/editor/EditorContext'
import { applyReaction, clearReaction, hasGenerated } from '@/editor/moreCommands'
import { useUiStore } from '@/editor/uiStore'
import { useResolvedState } from '@/editor/useCompiled'
import { t } from './i18n'
import styles from './shell.module.css'

/** ADR-0007 Phase 1 — generate a defending team's reactions as editable segments. */
export function AutoReactPanel() {
  const core = useEditor()
  const { doc } = useEditorSnapshot()
  const resolved = useResolvedState()
  const open = useUiStore((s) => s.autoReactOpen)
  const setOpen = useUiStore((s) => s.setAutoReactOpen)
  const anchor = useRef<HTMLDivElement>(null)
  const [intensity, setIntensity] = useState(0.6)
  const [delay, setDelay] = useState(0.3)
  const [teamId, setTeamId] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)

  // Default reacting team = the one NOT holding the ball; with no holder, the team with fewer authored
  // movements (the "other" team), ties → second team (Away).
  const holderTeam = doc.players.find(
    (p) => p.id === (resolved.ball.holderId ?? doc.ball.initialHolderId),
  )?.teamId
  const authoredByTeam = (tid: string) =>
    doc.scenes.reduce(
      (n, sc) =>
        n +
        sc.timeline.tracks
          .filter((tr) => doc.players.find((p) => p.id === tr.entityId)?.teamId === tid)
          .reduce((m, tr) => m + tr.segments.filter((sg) => !sg.id.startsWith('gen-')).length, 0),
      0,
    )
  const defaultTeam =
    (holderTeam ? doc.teams.find((tm) => tm.id !== holderTeam)?.id : undefined) ??
    [...doc.teams]
      .map((tm, i) => ({ id: tm.id, n: authoredByTeam(tm.id), i }))
      .sort((a, b) => a.n - b.n || b.i - a.i)[0]?.id ??
    null
  const team = teamId ?? defaultTeam
  const teamObj = doc.teams.find((tm) => tm.id === team)
  const teamPlayerCount = doc.players.filter((p) => p.teamId === team).length

  const shortcutsOpen = useUiStore((s) => s.shortcutsOpen)
  useEffect(() => {
    if (!open) return
    if (shortcutsOpen) {
      setOpen(false)
      return
    }
    const onDown = (e: PointerEvent) => {
      if (!anchor.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [open, setOpen, shortcutsOpen])

  const generated = team ? hasGenerated(doc, team) : false
  const anyGenerated = doc.teams.some((tm) => hasGenerated(doc, tm.id))
  const label =
    intensity < 0.34 ? t('react.low') : intensity < 0.67 ? t('react.mid') : t('react.high')

  return (
    <div className={styles.popoverAnchor} ref={anchor}>
      <button
        type="button"
        className={`${styles.btn} ${open || generated ? styles.btnActive : ''}`}
        onClick={() => setOpen(!open)}
        data-tour="auto-react"
        title={t('react.title')}
        aria-expanded={open}
      >
        ⚡ {t('react.button')}
      </button>
      {open && (
        <div
          className={`${styles.popover} ${styles.menu}`}
          role="dialog"
          aria-label={t('react.title')}
        >
          <div className={styles.sectionLabel}>{t('react.team')}</div>
          <div className={styles.pills}>
            {doc.teams.map((tm) => (
              <button
                key={tm.id}
                type="button"
                className={`${styles.btn} ${styles.pill} ${team === tm.id ? styles.btnActive : ''}`}
                onClick={() => setTeamId(tm.id)}
              >
                <span className={styles.teamDot} style={{ background: tm.color }} /> {tm.name}
              </button>
            ))}
          </div>
          <label className={`${styles.field} ${styles.fieldWide}`}>
            <span>
              {t('react.intensity')} · {label}
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={intensity}
              onChange={(e) => setIntensity(Number(e.target.value))}
            />
          </label>
          <label className={styles.field}>
            <span>{t('react.delay')}</span>
            <input
              className={styles.input}
              type="number"
              min={0}
              max={2}
              step={0.1}
              value={delay}
              onChange={(e) => setDelay(Number(e.target.value))}
            />
          </label>
          <p className={styles.muted}>{t('react.hint')}</p>
          {team && teamObj && teamPlayerCount === 0 && (
            <div className={styles.warnRow}>
              <span>{t('react.noPlayers', { team: teamObj.name })}</span>
              <button
                type="button"
                className={styles.btn}
                onClick={() => applyFormation(core, team, '4-4-2')}
              >
                {t('react.fill', { team: teamObj.name })}
              </button>
            </div>
          )}
          <div className={styles.group}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              disabled={!team || teamPlayerCount === 0}
              onClick={() => {
                if (!team) return
                const n = applyReaction(core, { teamId: team, intensity, reactionDelay: delay })
                setResult(t('react.done', { n }))
                useUiStore.getState().setTimelineExpanded(true)
              }}
            >
              {generated ? t('react.regen') : t('react.generate')}
            </button>
            {anyGenerated && (
              <button
                type="button"
                className={styles.btn}
                onClick={() => {
                  for (const tm of doc.teams)
                    if (hasGenerated(doc, tm.id)) clearReaction(core, tm.id)
                  setResult(null)
                }}
              >
                {t('react.clear')}
              </button>
            )}
          </div>
          {result && <div className={styles.muted}>{result}</div>}
        </div>
      )}
    </div>
  )
}
