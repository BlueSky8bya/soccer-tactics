import type { Id, Segment, Trigger } from '@/domain/types'
import { useEditor, useEditorSnapshot } from '@/editor/EditorContext'
import {
  PASS_SPEED_PRESETS,
  SPEED_PRESETS,
  findSegment,
  removeSegment,
  setSegmentEasing,
  setSegmentTiming,
  setSegmentTrigger,
  setWaypointHold,
} from '@/editor/segmentCommands'
import { useUiStore } from '@/editor/uiStore'
import { useCompiled } from '@/editor/useCompiled'
import { t } from './i18n'
import styles from './shell.module.css'

type StartMode = 'at' | 'afterPrev' | 'afterOther' | 'onReceive' | 'onRelease'

export function SegmentInspector({ segmentId }: { segmentId: Id }) {
  const core = useEditor()
  const { doc } = useEditorSnapshot()
  const compiled = useCompiled()
  const found = findSegment(doc, segmentId)
  if (!found) return null
  const { track, segment, index } = found
  const times = compiled.segmentTimes[segmentId]
  const prev = track.segments[index - 1]
  const isBall = track.entityKind === 'ball'

  // Ball travel segments the user could react to (for onEvent triggers)
  const ballTravels = (
    doc.scenes[0]?.timeline.tracks.find((tr) => tr.entityKind === 'ball')?.segments ?? []
  ).filter((s) => s.kind === 'travel')

  // Other entities' movements (for "relative to another action")
  const otherSegs = (doc.scenes[0]?.timeline.tracks ?? [])
    .filter((trk) => trk.entityId !== track.entityId)
    .flatMap((trk) =>
      trk.segments
        .filter((sg) => sg.kind === 'move' || sg.kind === 'travel')
        .map((sg) => {
          const pl = doc.players.find((p) => p.id === trk.entityId)
          const who = trk.entityKind === 'ball' ? '⚽' : '#' + (pl?.number ?? '?')
          const tm = compiled.segmentTimes[sg.id]
          const when = tm ? tm.start.toFixed(1) + 's' : ''
          return {
            id: sg.id,
            label: who + ' ' + (sg.kind === 'travel' ? '패스' : '이동') + ' ' + when,
          }
        }),
    )

  const tr = segment.trigger
  const mode: StartMode =
    tr.type === 'at'
      ? 'at'
      : tr.type === 'afterSegment'
        ? prev && tr.segmentId === prev.id
          ? 'afterPrev'
          : 'afterOther'
        : tr.type === 'onEvent'
          ? tr.event.kind === 'ball.received'
            ? 'onReceive'
            : 'onRelease'
          : 'at'
  const offset = tr.type === 'at' ? tr.t : 'offset' in tr ? tr.offset : 0

  const setMode = (m: StartMode) => {
    const start = times?.start ?? 0
    let next: Trigger
    if (m === 'at') next = { type: 'at', t: Math.round(start * 10) / 10 }
    else if (m === 'afterPrev' && prev)
      next = { type: 'afterSegment', segmentId: prev.id, anchor: 'end', offset: 0 }
    else if (m === 'afterOther' && otherSegs[0])
      next = { type: 'afterSegment', segmentId: otherSegs[0].id, anchor: 'start', offset: 0 }
    else if ((m === 'onReceive' || m === 'onRelease') && ballTravels[0]) {
      const ref =
        (tr.type === 'onEvent' && ballTravels.find((b) => b.id === tr.event.segmentId)) ||
        ballTravels[ballTravels.length - 1]!
      next = {
        type: 'onEvent',
        event: { kind: m === 'onReceive' ? 'ball.received' : 'ball.released', segmentId: ref.id },
        offset: 0,
      }
    } else next = { type: 'at', t: Math.round(start * 10) / 10 }
    setSegmentTrigger(core, segmentId, next)
  }
  const setOffset = (v: number) => {
    const val = Math.max(0, Number.isFinite(v) ? v : 0)
    const next: Trigger =
      tr.type === 'at'
        ? { type: 'at', t: val }
        : tr.type === 'atMarker'
          ? { ...tr, offset: val }
          : tr.type === 'afterSegment' || tr.type === 'atWaypoint' || tr.type === 'onEvent'
            ? { ...tr, offset: val }
            : tr
    setSegmentTrigger(core, segmentId, next, true)
  }

  const hasPath = 'path' in segment
  const speed = 'speed' in segment.timing ? segment.timing.speed : undefined
  const duration = times ? Math.max(0, times.end - times.start) : 0
  const presets = isBall ? PASS_SPEED_PRESETS : SPEED_PRESETS

  return (
    <>
      <div className={styles.card}>
        <div className={styles.inspectorHead}>
          <span>{segment.kind === 'travel' ? `⚽ ${t('seg.pass')}` : `↝ ${t('seg.title')}`}</span>
          <span className={styles.muted}>
            {times
              ? `${times.start.toFixed(1)}s → ${(Number.isFinite(times.end) ? times.end : times.start).toFixed(1)}s`
              : ''}
          </span>
        </div>

        <label className={styles.field}>
          <span>{t('seg.start')}</span>
          <select
            className={styles.input}
            value={mode}
            onChange={(e) => setMode(e.target.value as StartMode)}
          >
            <option value="at">{t('seg.startAt')}</option>
            {prev && <option value="afterPrev">{t('seg.afterPrev')}</option>}
            {otherSegs.length > 0 && <option value="afterOther">{t('seg.afterOther')}</option>}
            {!isBall && ballTravels.length > 0 && (
              <option value="onReceive">{t('seg.onReceive')}</option>
            )}
            {!isBall && ballTravels.length > 0 && (
              <option value="onRelease">{t('seg.onRelease')}</option>
            )}
          </select>
        </label>
        {mode === 'afterOther' && tr.type === 'afterSegment' && (
          <>
            <label className={styles.field}>
              <span>{t('seg.refSegment')}</span>
              <select
                className={styles.input}
                value={tr.segmentId}
                onChange={(e) =>
                  setSegmentTrigger(core, segmentId, { ...tr, segmentId: e.target.value })
                }
              >
                {otherSegs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>
                {t('seg.anchorStart')}/{t('seg.anchorEnd')}
              </span>
              <select
                className={styles.input}
                value={tr.anchor}
                onChange={(e) =>
                  setSegmentTrigger(core, segmentId, {
                    ...tr,
                    anchor: e.target.value as 'start' | 'end',
                  })
                }
              >
                <option value="start">{t('seg.anchorStart')}</option>
                <option value="end">{t('seg.anchorEnd')}</option>
              </select>
            </label>
          </>
        )}
        {(mode === 'onReceive' || mode === 'onRelease') &&
          tr.type === 'onEvent' &&
          ballTravels.length > 1 && (
            <label className={styles.field}>
              <span>{t('seg.refSegment')}</span>
              <select
                className={styles.input}
                value={tr.event.segmentId}
                onChange={(e) =>
                  setSegmentTrigger(core, segmentId, {
                    ...tr,
                    event: { ...tr.event, segmentId: e.target.value },
                  })
                }
              >
                {ballTravels.map((b, i) => (
                  <option key={b.id} value={b.id}>
                    ⚽ {i + 1} · {compiled.segmentTimes[b.id]?.start.toFixed(1) ?? ''}s
                  </option>
                ))}
              </select>
            </label>
          )}
        <label className={styles.field}>
          <span>{mode === 'at' ? t('seg.startAt') : '+ s'}</span>
          <input
            className={styles.input}
            type="number"
            min={0}
            step={0.1}
            value={Math.round(offset * 10) / 10}
            onChange={(e) => setOffset(Number(e.target.value))}
          />
        </label>
        {!isBall && <p className={styles.muted}>{t('seg.linkHint')}</p>}
      </div>

      {hasPath && (
        <div className={styles.card}>
          <div className={styles.field}>
            <span>{t('seg.speed')}</span>
            <div className={styles.pills}>
              {presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`${styles.btn} ${styles.pill} ${speed === p.speed ? styles.btnActive : ''}`}
                  onClick={() => setSegmentTiming(core, segmentId, { speed: p.speed })}
                  title={`${p.speed} m/s`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <label className={styles.field}>
            <span>{t('seg.duration')}</span>
            <input
              className={styles.input}
              type="number"
              min={0.2}
              step={0.1}
              value={Math.round(duration * 10) / 10}
              onChange={(e) =>
                setSegmentTiming(core, segmentId, {
                  duration: Math.max(0.2, Number(e.target.value)),
                })
              }
            />
          </label>
          {!isBall && (
            <label className={styles.field}>
              <span>{t('seg.easing')}</span>
              <select
                className={styles.input}
                value={segment.easing ?? 'linear'}
                onChange={(e) =>
                  setSegmentEasing(
                    core,
                    segmentId,
                    e.target.value === 'linear' ? undefined : (e.target.value as Segment['easing']),
                  )
                }
              >
                <option value="linear">linear</option>
                <option value="easeIn">ease in</option>
                <option value="easeOut">ease out</option>
                <option value="easeInOut">ease in-out</option>
              </select>
            </label>
          )}
          {segment.kind === 'travel' && (
            <>
              <label className={styles.field}>
                <span>{t('seg.kind')}</span>
                <select
                  className={styles.input}
                  value={segment.travelKind}
                  onChange={(e) =>
                    core.transaction('Set kind', (d) => {
                      const f = findSegment(d, segmentId)
                      if (f && f.segment.kind === 'travel')
                        f.segment.travelKind = e.target.value as typeof f.segment.travelKind
                    })
                  }
                >
                  <option value="pass">{t('seg.kind.pass')}</option>
                  <option value="throughBall">{t('seg.kind.throughBall')}</option>
                  <option value="cross">{t('seg.kind.cross')}</option>
                  <option value="shot">{t('seg.kind.shot')}</option>
                </select>
              </label>
              <div className={styles.field}>
                <span>{t('seg.flight')}</span>
                <div className={styles.pills}>
                  {(['ground', 'lofted'] as const).map((fl) => (
                    <button
                      key={fl}
                      type="button"
                      className={[
                        styles.btn,
                        styles.pill,
                        (segment.flight ?? 'ground') === fl ? styles.btnActive : '',
                      ].join(' ')}
                      onClick={() =>
                        core.transaction('Set flight', (d) => {
                          const f = findSegment(d, segmentId)
                          if (f && f.segment.kind === 'travel') f.segment.flight = fl
                        })
                      }
                    >
                      {fl === 'ground' ? t('seg.ground') : t('seg.lofted')}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          {segment.kind === 'travel' && (
            <label className={styles.field}>
              <span>{t('seg.receiver')}</span>
              <select
                className={styles.input}
                value={segment.receiverId ?? ''}
                onChange={(e) => {
                  const v = e.target.value || undefined
                  core.transaction('Set receiver', (d) => {
                    const f = findSegment(d, segmentId)
                    if (f && f.segment.kind === 'travel') {
                      if (v) f.segment.receiverId = v
                      else delete f.segment.receiverId
                      // keep the following possessed segment in sync
                      const nx = f.track.segments[f.index + 1]
                      if (nx && nx.kind === 'possessed') {
                        if (v) nx.holderId = v
                        else f.track.segments.splice(f.index + 1, 1)
                      } else if (v) {
                        f.track.segments.splice(f.index + 1, 0, {
                          id: `${segmentId}-recv`,
                          kind: 'possessed',
                          trigger: { type: 'afterSegment', segmentId, anchor: 'end', offset: 0 },
                          timing: { duration: 0 },
                          holderId: v,
                        })
                      }
                    }
                  })
                }}
              >
                <option value="">—</option>
                {doc.players.map((p) => (
                  <option key={p.id} value={p.id}>
                    #{p.number} {doc.teams.find((tm) => tm.id === p.teamId)?.name ?? ''}
                  </option>
                ))}
              </select>
            </label>
          )}
          {segment.kind === 'move' && segment.path.waypoints.length > 2 && (
            <div className={styles.field}>
              <span>{t('seg.hold')}</span>
              <div className={styles.pills}>
                {segment.path.waypoints.slice(1, -1).map((w, i) => (
                  <input
                    key={w.id}
                    className={`${styles.input} ${styles.tiny}`}
                    type="number"
                    min={0}
                    step={0.5}
                    value={w.hold ?? 0}
                    title={`waypoint ${i + 2}`}
                    onChange={(e) => setWaypointHold(core, segmentId, w.id, Number(e.target.value))}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        className={styles.btn}
        onClick={() => {
          removeSegment(core, segmentId)
          useUiStore.getState().selectSegment(null)
        }}
      >
        🗑 {t('seg.delete')}
      </button>
    </>
  )
}
