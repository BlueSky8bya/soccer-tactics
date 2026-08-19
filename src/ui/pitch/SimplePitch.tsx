import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import type { Id, TacticDocument, Vec2 } from '@/domain/types'
import { useEditor, useEditorSnapshot } from '@/editor/EditorContext'
import { addPlayer, setEntityHome } from '@/editor/commands'
import { clampToPitch } from '@/editor/geometry'
import { findTrack, giveBallToInDraft, newIdFor } from '@/editor/segmentCommands'
import { addStepPass, addStepRun, setSegmentStep, stepOf } from '@/editor/stepCommands'
import { useUiStore } from '@/editor/uiStore'
import { useCompiled, useResolvedState } from '@/editor/useCompiled'
import { beautifyStroke } from '@/engine/path'
import { DrawingLayer } from '@/renderer/DrawingLayer'
import { PathLayer } from '@/renderer/PathLayer'
import { PitchMarkings } from '@/renderer/PitchMarkings'
import styles from '@/renderer/pitch.module.css'
import { clientToPitch } from '@/renderer/pointer'
import { t } from '../i18n'
import { teamColorOf } from '../teamColor'
import { AnimatedToken } from './AnimatedToken'
import { releaseVelocity } from './fling'
import { deriveAttachedPathStart } from './pathPresentation'

const DRAG_THRESHOLD_PX = 4
const DBLCLICK_MS = 350

type Gesture =
  | {
      type: 'token'
      id: Id
      pointerId: number
      startClient: { x: number; y: number }
      grab: Vec2
      home: Vec2
      /** Every selected entity moves together (marquee multi-select). id → home at drag start. */
      group: Map<Id, Vec2>
      started: boolean
      samples: { p: Vec2; at: number }[]
      lastPt: Vec2
    }
  | { type: 'marquee'; pointerId: number; a: Vec2; b: Vec2 }
  | { type: 'draw'; entityId: Id; pointerId: number; points: Vec2[] }
  | {
      type: 'add'
      team: 'home' | 'away'
      pointerId: number
      at: Vec2
      startClient: { x: number; y: number }
    }

/**
 * Simple-mode pitch (ADR-0009). The whole gesture language:
 *   click grass = add our player · right-click grass = add opponent · drag = move
 *   double-click player/ball then drag = run / pass · fast release = fling
 * Steps (1-10) come from uiStore.currentStep; timing is derived, never typed.
 */
export function SimplePitch() {
  const core = useEditor()
  const { doc } = useEditorSnapshot()
  const compiled = useCompiled()
  const resolved = useResolvedState()
  const ui = useUiStore()
  const svgRef = useRef<SVGSVGElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const lastClick = useRef<{ id: Id; at: number } | null>(null)
  const [marquee, setMarquee] = useState<{ a: Vec2; b: Vec2 } | null>(null)

  const L = doc.pitch.length
  const W = doc.pitch.width

  // Ball kick/receive pulses (interface feedback)
  const [pulses, setPulses] = useState<Record<Id, number>>({})
  const pulseKey = useRef(0)
  const prevBall = useRef<{ status: string; holderId?: Id }>({ status: resolved.ball.status })
  const ballStatus = resolved.ball.status
  const ballHolder = resolved.ball.holderId
  useEffect(() => {
    const prev = prevBall.current
    if (prev.status !== ballStatus || prev.holderId !== ballHolder) {
      const hits: Id[] = [doc.ball.id]
      if (prev.status === 'possessed' && ballStatus === 'travel' && prev.holderId)
        hits.push(prev.holderId)
      if (ballStatus === 'possessed' && ballHolder && prev.status === 'travel')
        hits.push(ballHolder)
      pulseKey.current++
      const k = pulseKey.current
      setPulses((m) => {
        const n = { ...m }
        for (const id of hits) n[id] = k
        return n
      })
      prevBall.current = { status: ballStatus, holderId: ballHolder }
    }
  }, [ballStatus, ballHolder, doc.ball.id])

  const finishDraw = (entityId: Id, raw: Vec2[]) => {
    const st = useUiStore.getState()
    if (raw.length < 2) return
    const waypoints = beautifyStroke(raw, () => newIdFor('w'))
    const length = waypoints.reduce(
      (acc, w, i) =>
        i ? acc + Math.hypot(w.p.x - waypoints[i - 1]!.p.x, w.p.y - waypoints[i - 1]!.p.y) : 0,
      0,
    )
    if (length < 1.5) return
    if (entityId === doc.ball.id)
      addStepPass(
        core,
        waypoints,
        st.currentStep,
        resolved.ball.holderId ?? doc.ball.initialHolderId,
      )
    else addStepRun(core, entityId, waypoints, st.currentStep)
    // Deliberately NOT selected: picking the next step chip must never retarget what was just drawn.
    st.selectSegment(null)
    ui.flashToast(t('simple.added', { n: st.currentStep }))
  }

  const endGestureImpl = (commit: boolean) => {
    const g = gesture.current
    gesture.current = null
    const svg = svgRef.current
    if (!g) return
    if (svg && svg.hasPointerCapture(g.pointerId)) svg.releasePointerCapture(g.pointerId)
    const st = useUiStore.getState()

    if (g.type === 'marquee') {
      setMarquee(null)
      if (!commit) return
      const x1 = Math.min(g.a.x, g.b.x)
      const x2 = Math.max(g.a.x, g.b.x)
      const y1 = Math.min(g.a.y, g.b.y)
      const y2 = Math.max(g.a.y, g.b.y)
      if ((x2 - x1) * (y2 - y1) < 1) return // a click, not a box
      const hit = (v: Vec2) => v.x >= x1 && v.x <= x2 && v.y >= y1 && v.y <= y2
      const ids: Id[] = doc.players
        .filter((pl) => hit(resolved.players[pl.id]?.pos ?? pl.home))
        .map((pl) => pl.id)
      if (hit(resolved.ball.pos)) ids.push(doc.ball.id)
      st.select(ids)
      return
    }

    if (g.type === 'add') {
      if (!commit) return
      const team = doc.teams[g.team === 'home' ? 0 : 1]
      if (!team) return
      const id = addPlayer(core, team.id, g.at)
      st.select([id])
      return
    }

    if (g.type === 'draw') {
      st.setPathDraft(null)
      if (commit) finishDraw(g.entityId, g.points)
      return
    }

    // token drag
    if (!g.started) return
    const drag = st.drag
    // Fling → run / pass along the drag stroke (current step)
    if (commit && g.group.size === 1 && useUiStore.getState().animMode) {
      const v = releaseVelocity(g.samples, performance.now())
      if (v && g.samples.length >= 3) {
        core.cancel()
        st.setDrag(null)
        finishDraw(
          g.id,
          [g.home, ...g.samples.map((s) => s.p)].map((p) => clampToPitch(p, doc.pitch)),
        )
        return
      }
    }
    if (!commit) {
      core.cancel()
      st.setDrag(null)
      return
    }
    if (g.id === doc.ball.id && g.group.size === 1) {
      // Drop on a player → that player holds the ball; empty grass → loose (only without authored passes).
      const d = core.getDocument()
      const at = drag?.raw ?? d.ball.home
      const near = d.players
        .map((p) => ({ p, dist: Math.hypot(p.home.x - at.x, p.home.y - at.y) }))
        .filter((x) => x.dist <= 2.6)
        .sort((a, b) => a.dist - b.dist)[0]
      const authored = (findTrack(d, d.ball.id)?.segments.length ?? 0) > 0
      if (near) {
        core.update((dd) => giveBallToInDraft(dd as TacticDocument, near.p.id))
        core.commit()
      } else if (authored) {
        core.cancel()
      } else {
        core.update((dd) => giveBallToInDraft(dd as TacticDocument, null))
        core.commit()
      }
    } else {
      core.commit()
    }
    st.setDrag(null)
  }
  const endGestureRef = useRef(endGestureImpl)
  useEffect(() => {
    endGestureRef.current = endGestureImpl
  })

  // Esc cancels any gesture
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && gesture.current) {
        e.preventDefault()
        endGestureRef.current(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const startDraw = (entityId: Id, pt: Vec2, pointerId: number) => {
    const st = useUiStore.getState()
    st.setPlaying(false)
    st.select([entityId])
    const startPos =
      entityId === doc.ball.id ? resolved.ball.pos : (resolved.players[entityId]?.pos ?? pt)
    gesture.current = { type: 'draw', entityId, pointerId, points: [startPos] }
    st.setPathDraft({ entityId, points: [startPos] })
    svgRef.current?.setPointerCapture(pointerId)
  }

  const onPointerDown = (e: RPointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg) return
    const targetEl = e.target as Element
    const pt = clientToPitch(svg, e.clientX, e.clientY)
    svg.focus({ preventScroll: true })
    const st = useUiStore.getState()

    // Path click = select that movement (badge handles the step)
    const segEl = targetEl.closest('[data-segment]') as SVGElement | null
    const tokenEl = targetEl.closest('[data-entity]') as SVGGElement | null
    if (segEl && !tokenEl && e.button === 0) {
      st.selectSegment(segEl.getAttribute('data-segment'))
      return
    }

    if (tokenEl && e.button === 0) {
      const entityId = tokenEl.getAttribute('data-entity')!
      st.setPlaying(false)
      // double-click → draw
      const now = performance.now()
      const isDouble =
        !!lastClick.current &&
        lastClick.current.id === entityId &&
        now - lastClick.current.at < DBLCLICK_MS
      lastClick.current = isDouble ? null : { id: entityId, at: now }
      if (isDouble && st.animMode) {
        startDraw(entityId, pt, e.pointerId)
        return
      }
      if (isDouble && !st.animMode) ui.flashToast(t('simple.needAnim'))
      // Keep an existing multi-selection when grabbing one of its members (group drag).
      if (!st.selection.includes(entityId)) st.select([entityId])
      const sel = useUiStore.getState().selection
      const group = new Map<Id, Vec2>()
      for (const id of sel.length > 1 && sel.includes(entityId) ? sel : [entityId]) {
        const h = id === doc.ball.id ? doc.ball.home : doc.players.find((pl) => pl.id === id)?.home
        if (h) group.set(id, h)
      }
      const home =
        entityId === doc.ball.id
          ? doc.ball.home
          : (doc.players.find((p) => p.id === entityId)?.home ?? pt)
      const cur =
        entityId === doc.ball.id ? resolved.ball.pos : (resolved.players[entityId]?.pos ?? home)
      gesture.current = {
        type: 'token',
        id: entityId,
        pointerId: e.pointerId,
        startClient: { x: e.clientX, y: e.clientY },
        grab: { x: cur.x - pt.x, y: cur.y - pt.y },
        home,
        group,
        started: false,
        samples: [{ p: pt, at: performance.now() }],
        lastPt: pt,
      }
      svg.setPointerCapture(e.pointerId)
      return
    }

    // Empty grass + Ctrl: left = our player, right = opponent (Ctrl keeps plain clicks harmless).
    if (!tokenEl && !segEl && (e.button === 0 || e.button === 2)) {
      const inside = pt.x >= 0 && pt.x <= L && pt.y >= 0 && pt.y <= W
      if (!inside) return
      if (!(e.ctrlKey || e.metaKey)) {
        // Drag on empty grass = rubber-band multi-select.
        st.clearSelection()
        if (e.button !== 0) return
        gesture.current = { type: 'marquee', pointerId: e.pointerId, a: pt, b: pt }
        svg.setPointerCapture(e.pointerId)
        return
      }
      st.clearSelection()
      gesture.current = {
        type: 'add',
        team: e.button === 2 ? 'away' : 'home',
        pointerId: e.pointerId,
        at: clampToPitch(pt, doc.pitch),
        startClient: { x: e.clientX, y: e.clientY },
      }
      svg.setPointerCapture(e.pointerId)
    }
  }

  const onPointerMove = (e: RPointerEvent<SVGSVGElement>) => {
    const g = gesture.current
    if (!g || g.pointerId !== e.pointerId) return
    const svg = svgRef.current
    if (!svg) return
    const pt = clientToPitch(svg, e.clientX, e.clientY)
    const st = useUiStore.getState()

    if (g.type === 'marquee') {
      g.b = pt
      setMarquee({ a: g.a, b: g.b })
      return
    }

    if (g.type === 'add') {
      const moved = Math.hypot(e.clientX - g.startClient.x, e.clientY - g.startClient.y)
      if (moved > DRAG_THRESHOLD_PX * 2) gesture.current = null // a drag on grass is not an add
      return
    }

    if (g.type === 'draw') {
      const p = clampToPitch(pt, doc.pitch)
      const lastP = g.points[g.points.length - 1]!
      if (Math.hypot(p.x - lastP.x, p.y - lastP.y) > 0.25) {
        g.points.push(p)
        st.setPathDraft({ entityId: g.entityId, points: [...g.points] })
      }
      return
    }

    // token drag
    if (!g.started) {
      const dx = e.clientX - g.startClient.x
      const dy = e.clientY - g.startClient.y
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return
      g.started = true
      core.begin(g.id === doc.ball.id ? 'Move ball' : 'Move player')
    }
    g.samples.push({ p: pt, at: performance.now() })
    if (g.samples.length > 8) g.samples.shift()
    g.lastPt = pt
    const raw = clampToPitch({ x: pt.x + g.grab.x, y: pt.y + g.grab.y }, doc.pitch)
    const origin = g.group.get(g.id) ?? g.home
    const delta = { x: raw.x - origin.x, y: raw.y - origin.y }
    core.update((d) => {
      for (const [id, h] of g.group)
        setEntityHome(d as TacticDocument, id, { x: h.x + delta.x, y: h.y + delta.y })
      if (g.group.has(d.ball.id) && g.id === d.ball.id) {
        const tr = findTrack(d as TacticDocument, d.ball.id)
        if (!tr || tr.segments.length === 0) delete d.ball.initialHolderId
      }
    })
    st.setDrag({ id: g.id, grab: g.grab, raw, guides: [], snapped: false })
  }

  const onPointerUp = (e: RPointerEvent<SVGSVGElement>) => {
    const g = gesture.current
    if (!g || g.pointerId !== e.pointerId) return
    endGestureRef.current(true)
  }

  // ---------- render ----------
  const drag = ui.drag
  const selection = ui.selection
  const isPlaying = ui.playback.playing
  const draftColor = ui.pathDraft
    ? ui.pathDraft.entityId === doc.ball.id
      ? 'var(--st-ball-path, #f5f5f7)'
      : teamColorOf(doc, ui.pathDraft.entityId)
    : ''
  const attachedStart = deriveAttachedPathStart(doc, compiled, ui.selectedSegmentId)

  // Step badges at authored path ends
  const badges = doc.scenes[0]
    ? doc.scenes[0].timeline.tracks.flatMap((tr) =>
        tr.segments
          .filter((s) => 'path' in s && !s.id.startsWith('gen-'))
          .map((s) => {
            const path = (s as { path: { waypoints: { p: Vec2 }[] } }).path
            const end = path.waypoints[path.waypoints.length - 1]!.p
            return { id: s.id, step: stepOf(s as { step?: number }), end, entityId: tr.entityId }
          }),
      )
    : []

  return (
    <svg
      ref={svgRef}
      className={styles.stage}
      viewBox={`-2 -2 ${L + 4} ${W + 4}`}
      role="application"
      aria-label="Tactical pitch"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => endGestureRef.current(false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <PitchMarkings pitch={doc.pitch} />
      <DrawingLayer drawings={doc.drawings} selectedIds={ui.selectedDrawingIds} t={ui.playback.t} />
      <PathLayer
        doc={doc}
        teamColorOf={(pid) => teamColorOf(doc, pid)}
        selectedEntityIds={selection}
        selectedSegmentId={ui.selectedSegmentId}
        attachedStart={attachedStart}
        draft={
          ui.pathDraft
            ? {
                points: ui.pathDraft.points,
                color: draftColor,
                dashed: ui.pathDraft.entityId === doc.ball.id,
              }
            : null
        }
        dimOthers={isPlaying}
      />
      {/* step badges */}
      {!isPlaying &&
        badges.map((b) => (
          <g
            key={b.id}
            className={styles.stepBadge}
            transform={`translate(${b.end.x + 1.6}, ${b.end.y - 1.6})`}
            onPointerDown={(e) => {
              e.stopPropagation()
              const next = (b.step % 9) + 1
              setSegmentStep(core, b.id, next)
              useUiStore.getState().selectSegment(b.id)
            }}
            role="button"
            aria-label={t('simple.badge', { n: b.step })}
          >
            <circle r={1.35} />
            <text textAnchor="middle" dominantBaseline="central">
              {b.step}
            </text>
          </g>
        ))}
      {doc.players.map((p) => {
        const rp = resolved.players[p.id]
        return (
          <AnimatedToken
            key={p.id}
            id={p.id}
            kind="player"
            pos={rp?.pos ?? p.home}
            color={teamColorOf(doc, p.id)}
            number={p.number}
            label={p.label}
            selected={selection.includes(p.id)}
            hovered={false}
            dragging={drag?.id === p.id}
            heading={rp?.heading}
            moving={!!rp?.moving && isPlaying}
            dropFrom={null}
            dropKey={0}
            pulseKey={pulses[p.id]}
          />
        )
      })}
      <AnimatedToken
        id={doc.ball.id}
        kind="ball"
        pos={resolved.ball.pos}
        height={resolved.ball.height}
        spin={resolved.ball.spin}
        ballStatus={resolved.ball.status}
        selected={selection.includes(doc.ball.id)}
        hovered={false}
        dragging={drag?.id === doc.ball.id}
        dropFrom={null}
        dropKey={0}
        pulseKey={pulses[doc.ball.id]}
      />
      {marquee && (
        <rect
          x={Math.min(marquee.a.x, marquee.b.x)}
          y={Math.min(marquee.a.y, marquee.b.y)}
          width={Math.abs(marquee.a.x - marquee.b.x)}
          height={Math.abs(marquee.a.y - marquee.b.y)}
          className={styles.marquee}
        />
      )}
      {drag &&
        drag.id === doc.ball.id &&
        Math.hypot(drag.raw.x - resolved.ball.pos.x, drag.raw.y - resolved.ball.pos.y) > 0.6 && (
          <g className={styles.ballGhost} aria-hidden="true">
            <line
              x1={resolved.ball.pos.x}
              y1={resolved.ball.pos.y}
              x2={drag.raw.x}
              y2={drag.raw.y}
              className={styles.ballGhostLine}
            />
            <circle cx={drag.raw.x} cy={drag.raw.y} r={1.0} className={styles.ballGhostDot} />
          </g>
        )}
    </svg>
  )
}
