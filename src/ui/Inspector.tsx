import {
  removeEntities,
  setEntityPosition,
  setPlayerLabel,
  setPlayerNumber,
} from '@/editor/commands'
import { useEditor, useEditorSnapshot } from '@/editor/EditorContext'
import { removeDrawings } from '@/editor/moreCommands'
import { findTrack, giveBallTo } from '@/editor/segmentCommands'
import { useUiStore } from '@/editor/uiStore'
import { useCompiled } from '@/editor/useCompiled'
import { t } from './i18n'
import { SegmentInspector } from './SegmentInspector'
import styles from './shell.module.css'

/**
 * Always-docked properties panel (user decision 2026-08-20: no slide in/out).
 * Content switches with the selection; the column itself never moves.
 */
export function Inspector() {
  const core = useEditor()
  const { doc } = useEditorSnapshot()
  const compiled = useCompiled()
  const selection = useUiStore((s) => s.selection)
  const selectedSegmentId = useUiStore((s) => s.selectedSegmentId)
  const selectedDrawingIds = useUiStore((s) => s.selectedDrawingIds)
  const selectDrawings = useUiStore((s) => s.selectDrawings)
  const setTextEdit = useUiStore((s) => s.setTextEdit)
  const clearSelection = useUiStore((s) => s.clearSelection)
  const selectSegment = useUiStore((s) => s.selectSegment)
  const setTool = useUiStore((s) => s.setTool)
  const select = useUiStore((s) => s.select)

  const ids = selection
  const player = ids.length === 1 ? doc.players.find((p) => p.id === ids[0]) : undefined
  const isBall = ids.length === 1 && ids[0] === doc.ball.id
  const pos = player?.home ?? (isBall ? doc.ball.home : undefined)
  const team = player ? doc.teams.find((x) => x.id === player.teamId) : undefined
  const num = (v: number) => (Number.isFinite(v) ? Math.round(v * 10) / 10 : 0)
  const track = player
    ? findTrack(doc, player.id)
    : isBall
      ? findTrack(doc, doc.ball.id)
      : undefined
  const segs = track?.segments.filter((s) => 'path' in s) ?? []

  const heading = selectedSegmentId ? (
    <button type="button" className={styles.linkBtn} onClick={() => selectSegment(null)}>
      ‹ {player ? `#${player.number}` : isBall ? t('inspector.ball') : t('inspector.title')}
    </button>
  ) : ids.length > 1 ? (
    t('inspector.multi', { n: ids.length })
  ) : player ? (
    `${t('inspector.player')} #${player.number}`
  ) : isBall ? (
    t('inspector.ball')
  ) : (
    t('inspector.title')
  )

  return (
    <section className={styles.inspector} aria-label={t('inspector.title')}>
      <div className={styles.inspectorHead}>
        <span>{heading}</span>
        {(ids.length > 0 || selectedDrawingIds.length > 0) && (
          <button
            type="button"
            className={styles.btn}
            onClick={() => clearSelection()}
            title={`${t('inspector.close')} (Esc)`}
            aria-label={t('inspector.close')}
          >
            ✕
          </button>
        )}
      </div>

      {selectedSegmentId && <SegmentInspector segmentId={selectedSegmentId} />}

      {!selectedSegmentId && ids.length === 0 && selectedDrawingIds.length > 0 && (
        <div className={styles.card}>
          <div className={styles.sectionLabel}>
            {t('draw.title')} · {selectedDrawingIds.length}
          </div>
          {selectedDrawingIds.length === 1 &&
            (() => {
              const dr = doc.drawings.find((x) => x.id === selectedDrawingIds[0])
              if (!dr) return null
              return (
                <div className={styles.actions}>
                  <span className={styles.muted}>
                    {dr.kind === 'zone'
                      ? t('draw.zone')
                      : dr.kind === 'arrow'
                        ? t('draw.arrow')
                        : dr.kind === 'text'
                          ? t('draw.text')
                          : dr.kind}
                  </span>
                  {dr.kind === 'text' && (
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.actionBtn}`}
                      onClick={() => setTextEdit({ at: dr.at, id: dr.id, value: dr.text })}
                    >
                      ✎ {t('draw.edit')}
                    </button>
                  )}
                </div>
              )
            })()}
          <button
            type="button"
            className={`${styles.btn} ${styles.actionBtn}`}
            onClick={() => {
              removeDrawings(core, selectedDrawingIds)
              selectDrawings([])
            }}
          >
            🗑 {t('draw.delete')} <span className={styles.kbd}>Del</span>
          </button>
        </div>
      )}

      {!selectedSegmentId && ids.length === 0 && selectedDrawingIds.length === 0 && (
        <p className={styles.muted}>{t('inspector.empty')}</p>
      )}

      {!selectedSegmentId && (player || isBall) && (
        <div className={styles.card}>
          <div className={styles.sectionLabel}>{t('inspector.actions')}</div>
          <div className={styles.actions}>
            <button
              type="button"
              className={`${styles.btn} ${styles.actionBtn}`}
              onClick={() => setTool('path')}
            >
              ↝ {player ? t('inspector.drawPath') : t('inspector.drawPass')}{' '}
              <span className={styles.kbd}>E</span>
            </button>
            {player && doc.ball.initialHolderId !== player.id && (
              <button
                type="button"
                className={`${styles.btn} ${styles.actionBtn}`}
                onClick={() => giveBallTo(core, player.id)}
              >
                ⚽ {t('minibar.give')}
              </button>
            )}
            {player && doc.ball.initialHolderId === player.id && (
              <button
                type="button"
                className={`${styles.btn} ${styles.actionBtn}`}
                onClick={() => {
                  select([doc.ball.id])
                  setTool('path')
                }}
              >
                ⚽ {t('inspector.drawPass')}
              </button>
            )}
          </div>
          {segs.length > 0 && (
            <>
              <div className={styles.sectionLabel}>{t('inspector.movements')}</div>
              <div className={styles.actions}>
                {segs.map((s, i) => {
                  const tm = compiled.segmentTimes[s.id]
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={`${styles.btn} ${styles.actionBtn}`}
                      onClick={() => selectSegment(s.id)}
                    >
                      {s.kind === 'travel' ? '⚽' : '↝'} {i + 1} ·{' '}
                      {tm ? `${tm.start.toFixed(1)}s` : ''}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}

      {!selectedSegmentId && player && (
        <div className={styles.card}>
          <label className={styles.field}>
            <span>{t('inspector.team')}</span>
            <span className={styles.group}>
              <span className={styles.teamDot} style={{ background: team?.color }} />
              {team?.name}
            </span>
          </label>
          <label className={styles.field}>
            <span>{t('inspector.number')}</span>
            <input
              className={styles.input}
              type="number"
              min={0}
              max={99}
              value={player.number}
              onChange={(e) => setPlayerNumber(core, player.id, Number(e.target.value))}
            />
          </label>
          <label className={styles.field}>
            <span>{t('inspector.label')}</span>
            <input
              className={styles.input}
              type="text"
              value={player.label ?? ''}
              placeholder="—"
              onChange={(e) => setPlayerLabel(core, player.id, e.target.value)}
            />
          </label>
          {player.role && (
            <label className={styles.field}>
              <span>{t('inspector.role')}</span>
              <span>{player.role}</span>
            </label>
          )}
        </div>
      )}

      {!selectedSegmentId && pos && ids[0] && (
        <details className={styles.details}>
          <summary className={styles.muted}>{t('inspector.precise')}</summary>
          <div className={styles.card}>
            <label className={styles.field}>
              <span>{t('inspector.x')}</span>
              <input
                className={styles.input}
                type="number"
                step={0.5}
                value={num(pos.x)}
                onChange={(e) =>
                  setEntityPosition(core, ids[0]!, { x: Number(e.target.value), y: pos.y })
                }
              />
            </label>
            <label className={styles.field}>
              <span>{t('inspector.y')}</span>
              <input
                className={styles.input}
                type="number"
                step={0.5}
                value={num(pos.y)}
                onChange={(e) =>
                  setEntityPosition(core, ids[0]!, { x: pos.x, y: Number(e.target.value) })
                }
              />
            </label>
          </div>
        </details>
      )}

      {!selectedSegmentId && ids.some((id) => id !== doc.ball.id) && (
        <button
          type="button"
          className={styles.btn}
          onClick={() => {
            removeEntities(
              core,
              ids.filter((id) => id !== doc.ball.id),
            )
            clearSelection()
          }}
        >
          🗑 {t('inspector.delete')} <span className={styles.kbd}>Del</span>
        </button>
      )}
    </section>
  )
}
