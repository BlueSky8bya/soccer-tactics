import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import type { Id, TacticDocument, Vec2 } from '@/domain/types'
import { useEditor, useEditorSnapshot } from '@/editor/EditorContext'
import { addPlayer, setEntityHome } from '@/editor/commands'
import { clampToPitch } from '@/editor/geometry'
import {
  findTrack,
  lastKnownPosition,
  moveBallStartInDraft,
  shiftEntityPathsInDraft,
  newIdFor,
  sceneOf,
} from '@/editor/segmentCommands'
import { addStepPass, addStepRun, setSegmentStep, stepOf } from '@/editor/stepCommands'

const sceneTracks = (d: TacticDocument) => sceneOf(d).timeline.tracks
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
import { deriveAttachedPathStart } from './pathPresentation'

const DRAG_THRESHOLD_PX = 4

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
      lastPt: Vec2
      /** Last applied group offset (incremental translation of homes + paths). */
      prevRaw?: Vec2
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
  const [marquee, setMarquee] = useState<{ a: Vec2; b: Vec2 } | null>(null)
  const [shiftHeld, setShiftHeld] = useState(false)
  /** Unbroken Shift chain: next press continues from the entity's last position, step auto +1. */
  const chain = useRef<{ entityId: Id; step: number } | null>(null)

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
    const step =
      chain.current && chain.current.entityId === entityId ? chain.current.step : st.currentStep
    if (entityId === doc.ball.id)
      addStepPass(core, waypoints, step, resolved.ball.holderId ?? doc.ball.initialHolderId)
    else addStepRun(core, entityId, waypoints, step)
    // Zigzag: while Shift stays down, the next press draws the next leg (step +1) from where this ended.
    chain.current = { entityId, step: Math.min(9, step + 1) }
    // Deliberately NOT selected: picking the next step chip must never retarget what was just drawn.
    st.selectSegment(null)
    ui.flashToast(t('simple.added', { n: step }))
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
    if (!commit) {
      core.cancel()
      st.setDrag(null)
      return
    }
    if (g.id === doc.ball.id && g.group.size === 1) {
      // Move the ball's starting spot: on a player → that player holds it; grass → loose there.
      // Works with authored passes too (their origin follows).
      const d = core.getDocument()
      const at = drag?.raw ?? d.ball.home
      const near = d.players
        .map((p) => ({ p, dist: Math.hypot(p.home.x - at.x, p.home.y - at.y) }))
        .filter((x) => x.dist <= 2.6)
        .sort((a, b) => a.dist - b.dist)[0]
      core.update((dd) => moveBallStartInDraft(dd as TacticDocument, at, near?.p.id ?? null))
      core.commit()
    } else {
      core.commit()
    }
    st.setDrag(null)
  }
  const endGestureRef = useRef(endGestureImpl)
  useEffect(() => {
    endGestureRef.current = endGestureImpl
  })

  // Shift shows/arms the ghosts (they sit ON TOP of tokens, but only catch clicks while Shift is down,
  // so the ball ghost under a receiver is still reachable — QA: 공이 클릭이 안 돼).
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShiftHeld(true)
    }
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setShiftHeld(false)
        chain.current = null
      }
    }
    const blur = () => {
      setShiftHeld(false)
      chain.current = null
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])

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

  const startDraw = (entityId: Id, pointerId: number, startPos: Vec2) => {
    const st = useUiStore.getState()
    st.setPlaying(false)
    st.select([entityId])
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

    // Ghost (a later position of an entity): Shift+drag = draw the next movement FROM there.
    const ghostEl = targetEl.closest('[data-ghost]') as SVGElement | null
    if (ghostEl && e.button === 0 && e.shiftKey) {
      const entityId = ghostEl.getAttribute('data-ghost')!
      const gx = Number(ghostEl.getAttribute('data-gx'))
      const gy = Number(ghostEl.getAttribute('data-gy'))
      startDraw(entityId, e.pointerId, { x: gx, y: gy })
      return
    }

    const segEl = targetEl.closest('[data-segment]') as SVGElement | null
    const tokenEl = targetEl.closest('[data-entity]') as SVGGElement | null

    // Unbroken Shift chain: any press (not on another token) continues the zigzag from the last end.
    if (e.shiftKey && e.button === 0 && chain.current && !tokenEl) {
      const entityId = chain.current.entityId
      startDraw(entityId, e.pointerId, lastKnownPosition(core.getDocument(), entityId))
      return
    }

    // Path click = select that movement (badge handles the step)
    if (segEl && !tokenEl && !ghostEl && e.button === 0) {
      st.selectSegment(segEl.getAttribute('data-segment'))
      return
    }

    if (tokenEl && e.button === 0) {
      const entityId = tokenEl.getAttribute('data-entity')!
      st.setPlaying(false)
      // Shift+drag on the token = draw a movement from its ORIGINAL spot.
      if (e.shiftKey) {
        const startPos =
          entityId === doc.ball.id ? resolved.ball.pos : (resolved.players[entityId]?.pos ?? pt)
        startDraw(entityId, e.pointerId, startPos)
        return
      }
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
    g.lastPt = pt
    const raw = clampToPitch({ x: pt.x + g.grab.x, y: pt.y + g.grab.y }, doc.pitch)
    if (g.group.size > 1) {
      // Group drag: translate homes AND every authored path (ball included) together.
      const prev = g.prevRaw ?? g.group.get(g.id) ?? g.home
      const inc = { x: raw.x - prev.x, y: raw.y - prev.y }
      g.prevRaw = raw
      core.update((d) => {
        const doc2 = d as TacticDocument
        for (const [id] of g.group) {
          if (id === doc2.ball.id)
            doc2.ball.home = { x: doc2.ball.home.x + inc.x, y: doc2.ball.home.y + inc.y }
          else {
            const pl = doc2.players.find((x) => x.id === id)
            if (pl) pl.home = { x: pl.home.x + inc.x, y: pl.home.y + inc.y }
          }
          shiftEntityPathsInDraft(doc2, id, inc)
        }
      })
      st.setDrag({ id: g.id, grab: g.grab, raw, guides: [], snapped: false })
      return
    }
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

  // Ghosts: where each entity stands after each authored movement (fading with order).
  // Shift+drag a ghost → the next movement starts from that spot.
  const ghosts = doc.scenes[0]
    ? sceneTracks(doc).flatMap((tr) => {
        const segs = tr.segments.filter((sg) => 'path' in sg && !sg.id.startsWith('gen-'))
        return segs.map((sg, i) => {
          const path = (sg as { path: { waypoints: { p: Vec2 }[] } }).path
          const end = path.waypoints[path.waypoints.length - 1]!.p
          return {
            id: `${sg.id}-ghost`,
            entityId: tr.entityId,
            kind: tr.entityKind,
            pos: end,
            opacity: Math.max(0.22, 0.55 - i * 0.11),
            number:
              tr.entityKind === 'player'
                ? doc.players.find((pl) => pl.id === tr.entityId)?.number
                : undefined,
            color: tr.entityKind === 'player' ? teamColorOf(doc, tr.entityId) : '#ffffff',
          }
        })
      })
    : []

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
            label={p.label && p.role ? `${p.label}(${p.role})` : (p.label ?? p.role)}
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
      {/* ghosts: future positions (Shift+drag to continue from there) */}
      {!isPlaying &&
        ghosts.map((g) => (
          <g
            key={g.id}
            className={styles.ghostToken}
            transform={`translate(${g.pos.x}, ${g.pos.y})`}
            style={{
              opacity: shiftHeld ? Math.min(0.85, g.opacity + 0.25) : g.opacity,
              pointerEvents: shiftHeld ? 'auto' : 'none',
            }}
            data-ghost={g.entityId}
            data-gx={g.pos.x}
            data-gy={g.pos.y}
          >
            <circle r={g.kind === 'ball' ? 1.3 : 1.7} style={{ fill: g.color }} />
            {g.number !== undefined && (
              <text textAnchor="middle" dominantBaseline="central">
                {g.number}
              </text>
            )}
          </g>
        ))}
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
