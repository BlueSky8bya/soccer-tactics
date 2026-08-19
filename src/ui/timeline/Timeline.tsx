import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import type { Id, TacticDocument, Track, Trigger } from '@/domain/types'
import { useEditor, useEditorSnapshot } from '@/editor/EditorContext'
import { findSegment } from '@/editor/segmentCommands'
import { useUiStore } from '@/editor/uiStore'
import { useCompiled } from '@/editor/useCompiled'
import { usePlaybackController } from '@/editor/usePlayback'
import { t } from '../i18n'
import { SPRINGS } from '../motion/spring'
import { useSpringAnimator } from '../motion/useSpring'
import { teamColorOf } from '../pitch/PitchStage'
import styles from './timeline.module.css'
import { buildTrackGroups, type TrackGroupId } from './trackView'

const SPEEDS = [0.5, 1, 2] as const
const TRACKS_HEIGHT = 180

function fmt(sec: number): string {
  return `${sec.toFixed(1)}s`
}

export function Timeline() {
  const { doc } = useEditorSnapshot()
  const compiled = useCompiled()
  const ui = useUiStore()
  const pb = usePlaybackController(compiled.duration)
  const scrubRef = useRef<HTMLDivElement>(null)
  const tracksRef = useRef<HTMLDivElement>(null)

  const duration = compiled.duration
  const pct = Math.min(100, (ui.playback.t / duration) * 100)
  const hasSegments = Object.keys(compiled.segmentTimes).length > 0
  const errors = compiled.issues.filter((i) => i.level === 'error')

  // Tracks panel expand/collapse spring
  const expanded = ui.timelineExpanded
  const anim = useSpringAnimator(0, SPRINGS.timelineExpand, (v) => {
    const el = tracksRef.current
    if (!el) return
    el.style.height = `${Math.max(0, TRACKS_HEIGHT * v)}px`
    el.style.opacity = String(Math.min(1, v * 1.5))
  })
  useEffect(() => {
    anim.to(expanded ? 1 : 0)
  }, [expanded, anim])

  // Scrubber drag
  const scrubbing = useRef(false)
  const seekFromEvent = (e: { clientX: number }) => {
    const el = scrubRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
    pb.seek(f * duration)
  }
  const onScrubDown = (e: RPointerEvent<HTMLDivElement>) => {
    scrubbing.current = true
    ui.setPlaying(false)
    ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
    seekFromEvent(e)
  }
  const onScrubMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (scrubbing.current) seekFromEvent(e)
  }
  const onScrubUp = () => {
    scrubbing.current = false
  }

  return (
    <div className={styles.root}>
      <div className={styles.bar}>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={pb.toggle}
          title={`${ui.playback.playing ? t('tl.pause') : t('tl.play')} (Space)`}
          aria-label={ui.playback.playing ? t('tl.pause') : t('tl.play')}
        >
          {ui.playback.playing ? '❚❚' : '▶'}
        </button>
        <button
          type="button"
          className={styles.btn}
          onClick={pb.restart}
          title={`${t('tl.restart')} (Home)`}
        >
          ↺
        </button>
        <span className={styles.time}>{fmt(ui.playback.t)}</span>
        <div
          ref={scrubRef}
          className={styles.scrubber}
          role="slider"
          aria-label="timeline"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={ui.playback.t}
          aria-valuetext={`${fmt(ui.playback.t)} / ${fmt(duration)}`}
          tabIndex={0}
          onPointerDown={onScrubDown}
          onPointerMove={onScrubMove}
          onPointerUp={onScrubUp}
          onKeyDown={(e) => {
            const step = e.shiftKey ? 1 : 0.1
            const cur = useUiStore.getState().playback.t
            if (e.key === 'ArrowLeft') {
              e.preventDefault()
              pb.seek(cur - step)
            } else if (e.key === 'ArrowRight') {
              e.preventDefault()
              pb.seek(cur + step)
            } else if (e.key === 'Home') {
              e.preventDefault()
              pb.seek(0)
            } else if (e.key === 'End') {
              e.preventDefault()
              pb.seek(duration)
            }
          }}
        >
          <div className={styles.scrubFill} style={{ width: `${pct}%` }} />
          {/* event ticks */}
          {compiled.events
            .filter((ev) => ev.kind === 'ball.released' || ev.kind === 'ball.received')
            .map((ev, i) => (
              <span
                key={i}
                className={styles.tick}
                style={{ left: `${(ev.t / duration) * 100}%` }}
                title={`${ev.kind} @ ${fmt(ev.t)}`}
              />
            ))}
          <div className={styles.playhead} style={{ left: `${pct}%` }} />
        </div>
        <span className={styles.time}>{fmt(duration)}</span>
        <div className={styles.speeds} role="group" aria-label={t('tl.speed')}>
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              className={`${styles.btn} ${styles.speedBtn} ${ui.playback.speed === s ? styles.btnActive : ''}`}
              onClick={() => ui.setSpeed(s)}
            >
              {s}×
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`${styles.btn} ${ui.playback.loop ? styles.btnActive : ''}`}
          onClick={() => ui.setLoop(!ui.playback.loop)}
          title={t('tl.loop')}
          aria-label={t('tl.loop')}
          aria-pressed={ui.playback.loop}
        >
          ⟳
        </button>
        <button
          type="button"
          className={`${styles.btn} ${expanded ? styles.btnActive : ''}`}
          onClick={() => ui.setTimelineExpanded(!expanded)}
          title={t('tl.tracks')}
          aria-expanded={expanded}
        >
          {expanded ? '⌄' : '⌃'} {t('tl.tracks')}
        </button>
      </div>

      {errors.length > 0 && (
        <div className={styles.issues} role="alert">
          ⚠ {t('tl.issues')}: {errors.map((e) => e.message).join(' · ')}
        </div>
      )}

      <div
        ref={tracksRef}
        className={styles.tracks}
        style={{ height: 0, opacity: 0 }}
        aria-hidden={!expanded}
        inert={!expanded}
      >
        {!hasSegments && <div className={styles.empty}>{t('tl.empty')}</div>}
        {hasSegments && <TrackRows doc={doc} duration={duration} />}
        {hasSegments && <div className={styles.hint}>{t('tl.hint')}</div>}
      </div>
    </div>
  )
}

// ---------- tracks ----------

function TrackRows({ doc, duration }: { doc: TacticDocument; duration: number }) {
  const core = useEditor()
  const compiled = useCompiled()
  const selectedSegmentId = useUiStore((s) => s.selectedSegmentId)
  const selection = useUiStore((s) => s.selection)
  const playheadPct = (useUiStore((s) => s.playback.t) / duration) * 100
  const rowsRef = useRef<HTMLDivElement>(null)
  // Team filter / collapse — UI state only (plan M2, A-01/A-02). Normalised when the document changes.
  const [teamFilter, setTeamFilter] = useState<'all' | Id>('all')
  const [collapsed, setCollapsed] = useState<Set<TrackGroupId>>(() => new Set())
  const filterValid = teamFilter === 'all' || doc.teams.some((tm) => tm.id === teamFilter)
  const effectiveFilter = filterValid ? teamFilter : 'all'
  const groups = buildTrackGroups(doc, {
    teamFilter: effectiveFilter,
    collapsedGroups: collapsed,
    selectedEntityIds: selection,
  })
  const toggleCollapsed = (id: TrackGroupId) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const labelOf = (entityId: Id) => {
    if (entityId === doc.ball.id) return '⚽'
    const p = doc.players.find((x) => x.id === entityId)
    return p ? `#${p.number}` : '?'
  }

  // Block drag (move start) / resize (duration)
  const gesture = useRef<{
    segmentId: Id
    mode: 'move' | 'resize'
    startX: number
    startTrigger: Trigger
    startDur: number
    pxPerSec: number
    started: boolean
    pointerId: number
  } | null>(null)

  const onBlockDown = (
    e: RPointerEvent<HTMLDivElement>,
    segmentId: Id,
    mode: 'move' | 'resize',
  ) => {
    e.stopPropagation()
    const f = findSegment(core.getDocument(), segmentId)
    const rowsEl = rowsRef.current
    if (!f || !rowsEl) return
    const st = compiled.segmentTimes[segmentId]
    if (!st) return
    const laneWidth = rowsEl.querySelector(`.${styles.lane}`)?.getBoundingClientRect().width ?? 1
    gesture.current = {
      segmentId,
      mode,
      startX: e.clientX,
      startTrigger: f.segment.trigger,
      startDur: Math.max(0.1, st.end - st.start),
      pxPerSec: laneWidth / duration,
      started: false,
      pointerId: e.pointerId,
    }
    ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
    const ui = useUiStore.getState()
    ui.select([f.track.entityId])
    ui.selectSegment(segmentId)
  }
  const onBlockMove = (e: RPointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    if (!g) return
    const dx = e.clientX - g.startX
    if (!g.started) {
      if (Math.abs(dx) < 3) return
      g.started = true
      core.begin(g.mode === 'move' ? 'Move block' : 'Resize block')
    }
    const dt = dx / g.pxPerSec
    core.update((d) => {
      const f = findSegment(d as TacticDocument, g.segmentId)
      if (!f) return
      if (g.mode === 'resize') {
        const dur = Math.max(0.2, Math.round((g.startDur + dt) * 10) / 10)
        f.segment.timing = { duration: dur }
        return
      }
      const tr = g.startTrigger
      const snap = (v: number) => Math.max(0, Math.round(v * 10) / 10)
      if (tr.type === 'at') f.segment.trigger = { type: 'at', t: snap(tr.t + dt) }
      else if (tr.type === 'afterSegment')
        f.segment.trigger = { ...tr, offset: snap(tr.offset + dt) }
      else if (tr.type === 'onEvent') f.segment.trigger = { ...tr, offset: snap(tr.offset + dt) }
      else if (tr.type === 'atWaypoint') f.segment.trigger = { ...tr, offset: snap(tr.offset + dt) }
      else if (tr.type === 'atMarker') f.segment.trigger = { ...tr, offset: snap(tr.offset + dt) }
    })
  }
  const onBlockUp = () => {
    const g = gesture.current
    gesture.current = null
    if (g?.started) core.commit()
  }

  const renderRow = (track: Track, forced: boolean) => {
    const color =
      track.entityKind === 'ball'
        ? 'var(--st-ball-path, #f5f5f7)'
        : teamColorOf(doc, track.entityId)
    const entitySelected = selection.includes(track.entityId)
    return (
      <div
        key={track.id}
        className={`${styles.row} ${entitySelected ? styles.rowSelected : ''}`}
        data-track-row={track.entityId}
        data-forced-visible={forced ? 'true' : undefined}
      >
        <button
          type="button"
          className={styles.rowLabel}
          style={{ borderLeftColor: color }}
          onClick={() => useUiStore.getState().select([track.entityId])}
          aria-label={`${labelOf(track.entityId)}${forced ? ' (선택됨 · 필터 예외)' : ''}`}
        >
          {labelOf(track.entityId)}
          {forced && <span className={styles.forcedTag}>●</span>}
        </button>
        <div className={styles.lane}>
          {track.segments.map((seg) => {
            const st = compiled.segmentTimes[seg.id]
            if (!st) return null
            const isPossess = seg.kind === 'possessed' || seg.kind === 'loose'
            const end =
              Number.isFinite(st.end) && st.end > st.start
                ? st.end
                : isPossess
                  ? duration
                  : st.start + 0.1
            const left = (st.start / duration) * 100
            const width = Math.max(0.8, ((end - st.start) / duration) * 100)
            const sel = selectedSegmentId === seg.id
            return (
              <div
                key={seg.id}
                className={`${styles.block} ${isPossess ? styles.blockPossess : ''} ${seg.kind === 'travel' ? styles.blockTravel : ''} ${sel ? styles.blockSelected : ''}`}
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  background: isPossess ? undefined : color,
                }}
                onPointerDown={(e) => !isPossess && onBlockDown(e, seg.id, 'move')}
                onPointerMove={onBlockMove}
                onPointerUp={onBlockUp}
                onClick={(e) => {
                  e.stopPropagation()
                  const ui = useUiStore.getState()
                  ui.select([track.entityId])
                  ui.selectSegment(seg.id)
                }}
                title={`${seg.kind} ${fmt(st.start)} → ${fmt(end)}`}
              >
                <span className={styles.blockLabel}>
                  {seg.kind === 'move'
                    ? '↝'
                    : seg.kind === 'travel'
                      ? seg.travelKind === 'shot'
                        ? '⚡'
                        : '⚽'
                      : seg.kind === 'hold'
                        ? '⏸'
                        : ''}
                </span>
                {!isPossess && (
                  <div
                    className={styles.resize}
                    onPointerDown={(e) => onBlockDown(e, seg.id, 'resize')}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div ref={rowsRef} className={styles.rows}>
      <div className={styles.filterBar} role="group" aria-label={t('tl.filter')}>
        <button
          type="button"
          className={`${styles.btn} ${styles.filterBtn} ${effectiveFilter === 'all' ? styles.btnActive : ''}`}
          onClick={() => setTeamFilter('all')}
          aria-pressed={effectiveFilter === 'all'}
        >
          {t('tl.filterAll')}
        </button>
        {doc.teams.map((tm) => (
          <button
            key={tm.id}
            type="button"
            className={`${styles.btn} ${styles.filterBtn} ${effectiveFilter === tm.id ? styles.btnActive : ''}`}
            onClick={() => setTeamFilter(tm.id)}
            aria-pressed={effectiveFilter === tm.id}
          >
            <span className={styles.dot} style={{ background: tm.color }} /> {tm.name}
          </button>
        ))}
      </div>
      {groups.map((g) => (
        <div key={g.id} className={styles.group} data-track-group={g.id}>
          <button
            type="button"
            className={styles.groupHead}
            onClick={() => toggleCollapsed(g.id)}
            aria-expanded={!g.collapsed}
            aria-label={`${g.label} · ${g.totalRows}${g.generatedCount ? ` · ⚡${g.generatedCount}` : ''}`}
          >
            <span className={styles.groupChevron}>{g.collapsed ? '▸' : '▾'}</span>
            {g.color && <span className={styles.dot} style={{ background: g.color }} />}
            <span>{g.label}</span>
            <span className={styles.groupMeta}>
              {g.totalRows}
              {g.generatedCount ? ` · ⚡${g.generatedCount}` : ''}
              {g.filtered ? ` · ${t('tl.filtered')}` : ''}
            </span>
          </button>
          {g.visibleRows.map((r) => renderRow(r.track, r.forcedVisible))}
        </div>
      ))}
      <div
        className={styles.playheadLine}
        style={{ left: `calc(64px + (100% - 64px) * ${playheadPct / 100})` }}
      />
    </div>
  )
}
