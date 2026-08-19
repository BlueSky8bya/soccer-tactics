import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as RPointerEvent,
} from 'react'
import type { Id, TacticDocument, Vec2 } from '@/domain/types'
import { useEditor, useEditorSnapshot } from '@/editor/EditorContext'
import { addPlayer, getEntityHome, setEntityHome } from '@/editor/commands'
import { clampToPitch } from '@/editor/geometry'
import {
  addBallFling,
  addBallTravel,
  addMoveSegment,
  addPlayerFling,
  findSegment,
  findTrack,
  giveBallTo,
  lastKnownPosition,
  moveWaypointInDraft,
  newIdFor,
  shiftTailInDraft,
} from '@/editor/segmentCommands'
import { snapPosition } from '@/editor/snap'
import { useUiStore, type SnapGuide } from '@/editor/uiStore'
import { useCompiled, useResolvedState } from '@/editor/useCompiled'
import { beautifyStroke } from '@/engine/path'
import { compile as compiledAfter } from '@/engine/compile'
import { stateAt } from '@/engine/stateAt'
import { PathLayer } from '@/renderer/PathLayer'
import { PitchMarkings } from '@/renderer/PitchMarkings'
import { clientToPitch, metresPerPixel } from '@/renderer/pointer'
import styles from '@/renderer/pitch.module.css'
import { AnimatedToken } from './AnimatedToken'
import { EntityMiniBar } from './EntityMiniBar'
import { DrawingLayer } from '@/renderer/DrawingLayer'
import { addArrow, addZone, moveDrawingInDraft } from '@/editor/moreCommands'
import { TextEditOverlay } from './TextEditOverlay'
import { deriveAttachedPathStart } from './pathPresentation'
import { buildPathScrubIndex, findPathScrubHit, type PathScrubIndex } from './pathScrub'
import { MOUSE_POLICY } from '../keymap'

const DRAG_THRESHOLD_PX = 3
export const PITCH_PAD = 5 // metres of margin around the pitch in the viewBox

interface DropFx {
  vec: Vec2
  key: number
}

type Gesture =
  | {
      type: 'token'
      id: Id
      pointerId: number
      startClient: Vec2
      grab: Vec2
      started: boolean
      /** All selected entities being moved together: id → start home. */
      group: Map<Id, Vec2>
      /** 'home' edits start positions; 'tail' edits the end of the movement active at the playhead. */
      mode: 'home' | 'tail'
      /** Recent pointer samples (metres, ms) for release-velocity (fling). */
      samples: { p: Vec2; at: number }[]
      lastPt: Vec2
      startT: number
    }
  | { type: 'waypoint'; segmentId: Id; waypointId: Id; pointerId: number; started: boolean }
  | { type: 'draw'; entityId: Id; pointerId: number; points: Vec2[]; straight: boolean }
  | { type: 'marquee'; pointerId: number; start: Vec2; additive: boolean }
  | {
      type: 'scrub'
      entityId: Id
      pointerId: number
      index: PathScrubIndex
      startClient: Vec2
      started: boolean
    }
  | { type: 'shape'; kind: 'rect' | 'ellipse' | 'arrow'; pointerId: number; start: Vec2 }
  | { type: 'drawing'; ids: Id[]; pointerId: number; last: Vec2; started: boolean }

export function teamColorOf(doc: TacticDocument, playerId: Id): string {
  const p = doc.players.find((x) => x.id === playerId)
  return doc.teams.find((t) => t.id === p?.teamId)?.color ?? 'var(--st-team-a)'
}

/** Average velocity (m/s) over the last ~90 ms of samples; null when too slow for a fling. */
function releaseVelocity(samples: { p: Vec2; at: number }[]): Vec2 | null {
  if (samples.length < 2) return null
  const last = samples[samples.length - 1]!
  let i = samples.length - 2
  while (i > 0 && last.at - samples[i]!.at < 90) i--
  const first = samples[i]!
  const dt = (last.at - first.at) / 1000
  if (dt <= 0) return null
  const v = { x: (last.p.x - first.p.x) / dt, y: (last.p.y - first.p.y) / dt }
  return Math.hypot(v.x, v.y) >= 22 ? v : null
}

function isToggleModifier(e: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }): boolean {
  return MOUSE_POLICY.isAdditive(e)
}

export function PitchStage() {
  const core = useEditor()
  const { doc } = useEditorSnapshot()
  const compiled = useCompiled()
  const resolved = useResolvedState()
  const ui = useUiStore()
  const svgRef = useRef<SVGSVGElement>(null)
  const [dropFx, setDropFx] = useState<Record<Id, DropFx>>({})
  const dropKey = useRef(0)
  const gesture = useRef<Gesture | null>(null)
  const [marquee, setMarquee] = useState<{ a: Vec2; b: Vec2 } | null>(null)
  const [scrubGhost, setScrubGhost] = useState<Vec2 | null>(null)
  const [pulses, setPulses] = useState<Record<Id, number>>({})
  const pulseKey = useRef(0)
  const lastClick = useRef<{ id: Id; at: number } | null>(null)

  const L = doc.pitch.length
  const W = doc.pitch.width

  // ---------- ball status transitions → interface pulses (kick / receive) ----------
  const prevBall = useRef<{ status: string; holderId?: Id }>({ status: resolved.ball.status })
  useEffect(() => {
    const prev = prevBall.current
    const cur = resolved.ball
    if (prev.status !== cur.status || prev.holderId !== cur.holderId) {
      const hits: Id[] = [doc.ball.id]
      if (prev.status === 'possessed' && cur.status === 'travel' && prev.holderId)
        hits.push(prev.holderId)
      if (cur.status === 'possessed' && cur.holderId && prev.status === 'travel')
        hits.push(cur.holderId)
      pulseKey.current++
      const k = pulseKey.current
      setPulses((m) => {
        const n = { ...m }
        for (const id of hits) n[id] = k
        return n
      })
      prevBall.current = { status: cur.status, holderId: cur.holderId }
    }
  }, [resolved.ball.status, resolved.ball.holderId, resolved.ball, doc.ball.id])

  // ---------- ISSUE-006: selected pass start attached to the holder (presentation only) ----------
  const attachedStart = useMemo(
    () => deriveAttachedPathStart(doc, compiled, ui.selectedSegmentId),
    [doc, compiled, ui.selectedSegmentId],
  )

  // ---------- ball trail (deterministic: past states) ----------
  const t = ui.playback.t
  const trail = useMemo(() => {
    if (resolved.ball.status !== 'travel') return []
    const pts: { p: Vec2; a: number }[] = []
    for (let i = 1; i <= 5; i++) {
      const tt = t - i * 0.06
      if (tt < 0) break
      const s = stateAt(compiled, doc, tt)
      if (s.ball.status !== 'travel') break
      pts.push({ p: s.ball.pos, a: 1 - i / 6 })
    }
    return pts
  }, [compiled, doc, t, resolved.ball.status])

  // ---------- gesture end ----------
  const endGesture = useCallback(
    (commit: boolean) => {
      const g = gesture.current
      gesture.current = null
      const svg = svgRef.current
      if (!g) return
      if (svg && svg.hasPointerCapture(g.pointerId)) svg.releasePointerCapture(g.pointerId)
      const st = useUiStore.getState()

      if (g.type === 'marquee') {
        setMarquee(null)
        return
      }

      if (g.type === 'scrub') {
        setScrubGhost(null)
        return
      }

      if (g.type === 'shape') {
        const draft = st.drawDraft
        st.setDrawDraft(null)
        if (!commit || !draft) return
        const size = Math.hypot(draft.b.x - draft.a.x, draft.b.y - draft.a.y)
        if (size < 1) return
        const id =
          draft.kind === 'arrow'
            ? addArrow(core, draft.a, draft.b)
            : addZone(core, draft.kind, draft.a, draft.b)
        st.selectDrawings([id])
        return
      }

      if (g.type === 'drawing') {
        if (!g.started) return
        if (commit) core.commit()
        else core.cancel()
        return
      }

      if (g.type === 'token') {
        if (!g.started) return
        const drag = st.drag
        // Fling: fast release → cancel the positional drag and create a deterministic segment.
        if (commit && g.mode === 'home' && g.group.size === 1) {
          const v = releaseVelocity(g.samples)
          if (v) {
            core.cancel()
            st.setDrag(null)
            const d = core.getDocument()
            const from = g.group.get(g.id)!
            const playhead = st.playback.t
            if (g.id === d.ball.id) {
              const id = addBallFling(core, resolved.ball.pos, v, {
                at: playhead,
                holderId: resolved.ball.holderId ?? d.ball.initialHolderId,
                players: d.players.map((p) => ({
                  id: p.id,
                  pos: resolved.players[p.id]?.pos ?? p.home,
                })),
                pitch: d.pitch,
              })
              if (id) {
                st.selectSegment(id)
                const arrival = compiledAfter(core.getDocument()).segmentTimes[id]?.end ?? playhead
                st.setPlayhead(Math.round(arrival * 10) / 10)
              }
            } else {
              const track = findTrack(d, g.id)
              const prev = track?.segments[track.segments.length - 1]
              const id = addPlayerFling(core, g.id, prev ? lastKnownPosition(d, g.id) : from, v, {
                at: playhead,
                prevEnd: prev ? compiled.segmentTimes[prev.id]?.end : undefined,
                prevId: prev?.id,
                pitch: d.pitch,
              })
              if (id) st.selectSegment(id)
            }
            return
          }
        }
        if (commit) {
          const d = core.getDocument()
          if (g.id === d.ball.id) {
            // Ball dropped on a player → that player starts with the ball; elsewhere → loose ball.
            const at = d.ball.home
            const near = d.players
              .map((p) => ({ p, dist: Math.hypot(p.home.x - at.x, p.home.y - at.y) }))
              .filter((x) => x.dist <= 2.6)
              .sort((a, b) => a.dist - b.dist)[0]
            core.commit()
            if (near) giveBallTo(core, near.p.id)
            else if (d.ball.initialHolderId) giveBallTo(core, null)
          } else {
            core.commit()
          }
          const final = getEntityHome(core.getDocument(), g.id)
          if (drag && final && drag.snapped) {
            const vec = { x: drag.raw.x - final.x, y: drag.raw.y - final.y }
            if (Math.hypot(vec.x, vec.y) > 0.01) {
              dropKey.current++
              setDropFx((m) => ({ ...m, [g.id]: { vec, key: dropKey.current } }))
            }
          }
        } else {
          core.cancel()
        }
        st.setDrag(null)
        return
      }

      if (g.type === 'waypoint') {
        if (!g.started) return
        if (commit) core.commit()
        else core.cancel()
        st.setWaypointDrag(null)
        return
      }

      if (g.type === 'draw') {
        st.setPathDraft(null)
        if (!commit) return
        finishDraw(g.entityId, g.points, g.straight)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [core],
  )

  const finishDraw = (entityId: Id, raw: Vec2[], straight = false) => {
    const d = core.getDocument()
    const st = useUiStore.getState()
    if (raw.length < 2) return
    // Clean geometry (ADR-0006 D3 / user feedback): resample → smooth → simplify → straight|bezier.
    const waypoints = beautifyStroke(
      raw,
      () => newIdFor('w'),
      straight ? { straightTolerance: 1e9 } : undefined,
    )
    const length = waypoints.reduce(
      (acc, w, i) =>
        i ? acc + Math.hypot(w.p.x - waypoints[i - 1]!.p.x, w.p.y - waypoints[i - 1]!.p.y) : 0,
      0,
    )
    if (length < 1.5) return
    const playhead = st.playback.t

    if (entityId === d.ball.id) {
      const end = waypoints[waypoints.length - 1]!.p
      const holderId = resolved.ball.holderId ?? d.ball.initialHolderId
      const receiver = d.players
        .filter((p) => p.id !== holderId)
        .map((p) => {
          const pos = resolved.players[p.id]?.pos ?? p.home
          return { p, dist: Math.hypot(pos.x - end.x, pos.y - end.y) }
        })
        .filter((x) => x.dist <= 3.5)
        .sort((a, b) => a.dist - b.dist)[0]
      const id = addBallTravel(core, waypoints, {
        at: playhead,
        holderId,
        receiverId: receiver?.p.id,
        travelKind: 'pass',
      })
      st.selectSegment(id)
      // "Then…": move the playhead to the arrival so the next drawn action naturally follows.
      const arrival = compiledAfter(core.getDocument()).segmentTimes[id]?.end ?? playhead
      st.setPlayhead(Math.round(arrival * 10) / 10)
      return
    }

    const track = findTrack(d, entityId)
    const prev = track?.segments[track.segments.length - 1]
    const prevEnd = prev ? (compiled.segmentTimes[prev.id]?.end ?? 0) : 0
    const id = addMoveSegment(core, entityId, waypoints, {
      at: playhead,
      afterPrevious: !!prev && playhead <= prevEnd + 1e-6,
    })
    if (prev && playhead > prevEnd + 1e-6) {
      core.transaction('Set start', (dd) => {
        const f = findSegment(dd as TacticDocument, id)
        if (f)
          f.segment.trigger = {
            type: 'afterSegment',
            segmentId: prev.id,
            anchor: 'end',
            offset: playhead - prevEnd,
          }
      })
    }
    st.selectSegment(id)
  }

  // Esc cancels any gesture
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && gesture.current) {
        e.preventDefault()
        endGesture(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [endGesture])

  // ---------- pointer handlers ----------
  const onPointerDown = (e: RPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return
    const svg = svgRef.current
    if (!svg) return
    const targetEl = e.target as Element
    const pt = clientToPitch(svg, e.clientX, e.clientY)
    svg.focus({ preventScroll: true })
    const st = useUiStore.getState()

    // Annotation tools
    if (st.tool === 'zone' || st.tool === 'arrow') {
      const kind = st.tool === 'arrow' ? 'arrow' : e.shiftKey ? 'ellipse' : 'rect'
      const start = clampToPitch(pt, doc.pitch)
      gesture.current = { type: 'shape', kind, pointerId: e.pointerId, start }
      svg.setPointerCapture(e.pointerId)
      st.setDrawDraft({ kind, a: start, b: start })
      return
    }
    if (st.tool === 'text') {
      st.setTextEdit({ at: clampToPitch(pt, doc.pitch), value: '' })
      return
    }

    // Existing annotation: select / drag
    const drEl = targetEl.closest('[data-drawing]') as SVGGElement | null
    if (drEl && st.tool === 'select') {
      const id = drEl.getAttribute('data-drawing')!
      const ids = isToggleModifier(e)
        ? st.selectedDrawingIds.includes(id)
          ? st.selectedDrawingIds.filter((x) => x !== id)
          : [...st.selectedDrawingIds, id]
        : st.selectedDrawingIds.includes(id)
          ? st.selectedDrawingIds
          : [id]
      st.select([])
      st.selectDrawings(ids)
      gesture.current = { type: 'drawing', ids, pointerId: e.pointerId, last: pt, started: false }
      svg.setPointerCapture(e.pointerId)
      return
    }

    // Locked attached start marker: never a gesture target (ISSUE-006 double guard)
    if (targetEl.closest('[data-attached-start]')) return

    // Waypoint (only rendered for the selected segment)
    const wpEl = targetEl.closest('[data-waypoint]') as SVGElement | null
    if (wpEl) {
      gesture.current = {
        type: 'waypoint',
        segmentId: wpEl.getAttribute('data-segment')!,
        waypointId: wpEl.getAttribute('data-waypoint')!,
        pointerId: e.pointerId,
        started: false,
      }
      svg.setPointerCapture(e.pointerId)
      return
    }

    const tokenEl = targetEl.closest('[data-entity]') as SVGGElement | null
    const entityId = tokenEl?.getAttribute('data-entity') ?? null

    // Double-click on a player/ball → path tool (draw immediately on next drag)
    if (entityId) {
      const now = performance.now()
      if (
        lastClick.current &&
        lastClick.current.id === entityId &&
        now - lastClick.current.at < 350
      ) {
        lastClick.current = null
        st.select([entityId])
        st.setTool('path')
        return
      }
      lastClick.current = { id: entityId, at: now }
    }

    // Path drawing: path tool, or Alt+drag on a token from any tool (left-hand modifier, ADR-0006 D7 amended).
    if (st.tool === 'path' || (MOUSE_POLICY.isDraw(e) && entityId)) {
      const drawFor = entityId ?? st.selection[0] ?? null
      if (!drawFor) return
      if (entityId && !st.selection.includes(entityId)) st.select([entityId])
      const start =
        drawFor === doc.ball.id ? resolved.ball.pos : lastKnownPosition(core.getDocument(), drawFor)
      gesture.current = {
        type: 'draw',
        entityId: drawFor,
        pointerId: e.pointerId,
        points: [start],
        straight: e.shiftKey,
      }
      svg.setPointerCapture(e.pointerId)
      st.setPathDraft({ entityId: drawFor, points: [start] })
      return
    }

    // Click on a path → select that segment (and its entity)
    const segEl = targetEl.closest('[data-segment]') as SVGGElement | null
    if (segEl && !tokenEl) {
      const owner = segEl.getAttribute('data-entity-of')
      if (owner) st.select([owner])
      st.selectSegment(segEl.getAttribute('data-segment')!)
      return
    }

    // Path-scrub (ADR-0006 D4-1): select tool + Shift + token that has path segments → seek, no document change.
    if (tokenEl && entityId && st.tool === 'select' && MOUSE_POLICY.isScrub(e)) {
      const index = buildPathScrubIndex(core.getDocument(), compiled, entityId)
      if (index.points.length >= 2) {
        if (!st.selection.includes(entityId)) st.select([entityId])
        st.setPlaying(false)
        gesture.current = {
          type: 'scrub',
          entityId,
          pointerId: e.pointerId,
          index,
          startClient: { x: e.clientX, y: e.clientY },
          started: false,
        }
        svg.setPointerCapture(e.pointerId)
        return
      }
    }

    if (tokenEl && entityId) {
      const home = getEntityHome(core.getDocument(), entityId)
      if (!home) return
      st.setPlaying(false)
      // At t>0 with a movement under the playhead we edit that movement's end ("where it is now").
      const tailEditable =
        st.playback.t > 0 &&
        !!findTrack(core.getDocument(), entityId)?.segments.some((sg) => {
          const tm = compiled.segmentTimes[sg.id]
          return tm && 'path' in sg && st.playback.t >= tm.start
        })
      // Selection: Ctrl/Cmd/Shift toggles; plain click selects (keeps group if already selected)
      if (isToggleModifier(e)) st.toggleSelect(entityId)
      else if (!st.selection.includes(entityId)) st.select([entityId])
      const sel = useUiStore.getState().selection
      const group = new Map<Id, Vec2>()
      const d = core.getDocument()
      for (const id of sel.includes(entityId) ? sel : [entityId]) {
        const h = getEntityHome(d, id)
        if (h) group.set(id, h)
      }
      const curPos =
        entityId === doc.ball.id ? resolved.ball.pos : (resolved.players[entityId]?.pos ?? home)
      gesture.current = {
        type: 'token',
        id: entityId,
        pointerId: e.pointerId,
        startClient: { x: e.clientX, y: e.clientY },
        grab: tailEditable
          ? { x: curPos.x - pt.x, y: curPos.y - pt.y }
          : { x: home.x - pt.x, y: home.y - pt.y },
        started: false,
        group,
        mode: tailEditable ? 'tail' : 'home',
        samples: [{ p: pt, at: performance.now() }],
        lastPt: pt,
        startT: st.playback.t,
      }
      svg.setPointerCapture(e.pointerId)
      return
    }

    // Empty pitch
    if (st.tool === 'add-player') {
      const teamId = st.activeTeamId ?? doc.teams[0]?.id
      if (teamId) {
        const id = addPlayer(core, teamId, clampToPitch(pt, doc.pitch))
        st.select([id])
      }
      return
    }
    // Marquee selection
    gesture.current = {
      type: 'marquee',
      pointerId: e.pointerId,
      start: pt,
      additive: isToggleModifier(e),
    }
    svg.setPointerCapture(e.pointerId)
    if (!isToggleModifier(e)) st.clearSelection()
  }

  const onPointerMove = (e: RPointerEvent<SVGSVGElement>) => {
    const g = gesture.current
    const svg = svgRef.current
    if (!svg) return
    const st = useUiStore.getState()
    if (!g) {
      const target = (e.target as Element).closest?.('[data-entity]')
      const id = target?.getAttribute('data-entity') ?? null
      if (id !== st.hover) st.setHover(id)
      return
    }
    const pt = clientToPitch(svg, e.clientX, e.clientY)

    if (g.type === 'scrub') {
      if (!g.started) {
        const dx = e.clientX - g.startClient.x
        const dy = e.clientY - g.startClient.y
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return
        g.started = true
      }
      const hit = findPathScrubHit(g.index, pt, st.playback.t)
      if (hit) {
        st.setPlayhead(hit.t)
        setScrubGhost(hit.p)
      }
      return
    }

    if (g.type === 'shape') {
      st.setDrawDraft({ kind: g.kind, a: g.start, b: clampToPitch(pt, doc.pitch) })
      return
    }

    if (g.type === 'drawing') {
      if (!g.started) {
        g.started = true
        core.begin('Move annotation')
      }
      const delta = { x: pt.x - g.last.x, y: pt.y - g.last.y }
      g.last = pt
      core.update((d) => {
        for (const id of g.ids) moveDrawingInDraft(d as TacticDocument, id, delta)
      })
      return
    }

    if (g.type === 'marquee') {
      const a = g.start
      const b = pt
      setMarquee({ a, b })
      const minX = Math.min(a.x, b.x)
      const maxX = Math.max(a.x, b.x)
      const minY = Math.min(a.y, b.y)
      const maxY = Math.max(a.y, b.y)
      const inside = [...doc.players.map((p) => p.id), doc.ball.id].filter((id) => {
        const pos = id === doc.ball.id ? resolved.ball.pos : (resolved.players[id]?.pos ?? null)
        return pos && pos.x >= minX && pos.x <= maxX && pos.y >= minY && pos.y <= maxY
      })
      if (g.additive) {
        const merged = Array.from(new Set([...st.selection, ...inside]))
        if (merged.length !== st.selection.length) st.select(merged)
      } else if (
        inside.length !== st.selection.length ||
        inside.some((id) => !st.selection.includes(id))
      ) {
        st.select(inside)
      }
      return
    }

    if (g.type === 'draw') {
      g.straight = e.shiftKey
      const last = g.points[g.points.length - 1]!
      if (Math.hypot(pt.x - last.x, pt.y - last.y) >= 0.25) {
        g.points.push(clampToPitch(pt, doc.pitch))
        st.setPathDraft({ entityId: g.entityId, points: [...g.points] })
      }
      return
    }

    if (g.type === 'waypoint') {
      if (!g.started) {
        g.started = true
        core.begin('Move waypoint')
        st.setWaypointDrag({ segmentId: g.segmentId, waypointId: g.waypointId })
      }
      const p = clampToPitch(pt, doc.pitch)
      core.update((d) => moveWaypointInDraft(d as TacticDocument, g.segmentId, g.waypointId, p))
      return
    }

    // token (single or group)
    if (!g.started) {
      const dx = e.clientX - g.startClient.x
      const dy = e.clientY - g.startClient.y
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return
      g.started = true
      core.begin(
        g.group.size > 1 ? 'Move players' : g.id === doc.ball.id ? 'Move ball' : 'Move player',
      )
    }
    g.samples.push({ p: pt, at: performance.now() })
    if (g.samples.length > 8) g.samples.shift()
    const raw = clampToPitch({ x: pt.x + g.grab.x, y: pt.y + g.grab.y }, doc.pitch)
    if (g.mode === 'tail') {
      const delta = { x: pt.x - g.lastPt.x, y: pt.y - g.lastPt.y }
      g.lastPt = pt
      core.update((d) => {
        shiftTailInDraft(d as TacticDocument, g.id, compiled.segmentTimes, g.startT, delta)
      })
      st.setDrag({ id: g.id, grab: g.grab, raw, guides: [], snapped: false })
      return
    }
    const snapOn = st.snapEnabled && !MOUSE_POLICY.isSnapOff(e)
    let final = raw
    let guides: SnapGuide[] = []
    let snapped = false
    if (snapOn && g.id !== doc.ball.id) {
      const mpp = metresPerPixel(svg)
      const r = snapPosition(raw, g.id, core.getDocument().players, doc.pitch, {
        alignThreshold: Math.max(0.5, 8 * mpp),
        landmarkThreshold: Math.max(0.8, 12 * mpp),
      })
      final = r.p
      guides = r.guides
      snapped = r.snapped
    }
    const origin = g.group.get(g.id)!
    const delta = { x: final.x - origin.x, y: final.y - origin.y }
    core.update((d) => {
      for (const [id, h] of g.group) {
        setEntityHome(d as TacticDocument, id, { x: h.x + delta.x, y: h.y + delta.y })
      }
    })
    st.setDrag({ id: g.id, grab: g.grab, raw, guides, snapped })
  }

  const onPointerUp = (e: RPointerEvent<SVGSVGElement>) => {
    const g = gesture.current
    if (!g || g.pointerId !== e.pointerId) return
    endGesture(true)
  }

  // ---------- render ----------
  const drag = ui.drag
  const selection = ui.selection
  const hover = ui.hover
  const isPlaying = ui.playback.playing
  const draftColor = ui.pathDraft
    ? ui.pathDraft.entityId === doc.ball.id
      ? 'var(--st-ball-path, #f5f5f7)'
      : teamColorOf(doc, ui.pathDraft.entityId)
    : ''

  return (
    <div className={styles.stageWrap}>
      <svg
        ref={svgRef}
        className={`${styles.stage} ${ui.tool === 'path' ? styles.stagePathTool : ''} ${ui.tool === 'zone' || ui.tool === 'arrow' || ui.tool === 'text' ? styles.stageZoneTool : ''}`}
        viewBox={`${-PITCH_PAD} ${-PITCH_PAD} ${L + PITCH_PAD * 2} ${W + PITCH_PAD * 2}`}
        preserveAspectRatio="xMidYMid meet"
        tabIndex={0}
        role="application"
        aria-label="Tactical pitch"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => endGesture(false)}
        onPointerLeave={() => ui.hover && ui.setHover(null)}
      >
        <PitchMarkings pitch={doc.pitch} />

        <DrawingLayer
          drawings={doc.drawings}
          selectedIds={ui.selectedDrawingIds}
          t={t}
          draft={ui.drawDraft}
        />

        <PathLayer
          doc={doc}
          teamColorOf={(id) => teamColorOf(doc, id)}
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
          dimOthers={selection.length > 0 && !isPlaying}
        />

        {drag && drag.guides.length > 0 && (
          <g>
            {drag.guides.map((gd, i) =>
              gd.kind === 'v' ? (
                <line
                  key={i}
                  x1={gd.x}
                  y1={-PITCH_PAD}
                  x2={gd.x}
                  y2={W + PITCH_PAD}
                  className={styles.guide}
                />
              ) : gd.kind === 'h' ? (
                <line
                  key={i}
                  x1={-PITCH_PAD}
                  y1={gd.y}
                  x2={L + PITCH_PAD}
                  y2={gd.y}
                  className={styles.guide}
                />
              ) : (
                <circle key={i} cx={gd.x} cy={gd.y} r={2.6} className={styles.guidePoint} />
              ),
            )}
          </g>
        )}

        {scrubGhost && (
          <circle cx={scrubGhost.x} cy={scrubGhost.y} r={1.1} className={styles.scrubGhost} />
        )}

        {marquee && (
          <rect
            x={Math.min(marquee.a.x, marquee.b.x)}
            y={Math.min(marquee.a.y, marquee.b.y)}
            width={Math.abs(marquee.b.x - marquee.a.x)}
            height={Math.abs(marquee.b.y - marquee.a.y)}
            className={styles.marquee}
          />
        )}

        <g>
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
                hovered={hover === p.id}
                dragging={
                  drag?.id === p.id ||
                  (!!drag && selection.includes(p.id) && selection.includes(drag.id))
                }
                moving={rp?.moving}
                heading={rp?.heading}
                dropFrom={dropFx[p.id]?.vec ?? null}
                dropKey={dropFx[p.id]?.key ?? 0}
                pulseKey={pulses[p.id] ?? 0}
                pulseScale={1.18}
              />
            )
          })}
        </g>

        {/* ball trail */}
        {trail.map((d, i) => (
          <circle
            key={i}
            cx={d.p.x}
            cy={d.p.y}
            r={0.45 * d.a + 0.15}
            className={styles.trailDot}
            style={{ opacity: d.a * 0.55 }}
          />
        ))}

        <AnimatedToken
          id={doc.ball.id}
          kind="ball"
          pos={resolved.ball.pos}
          height={resolved.ball.height}
          spin={resolved.ball.spin}
          ballStatus={resolved.ball.status}
          selected={selection.includes(doc.ball.id)}
          hovered={hover === doc.ball.id}
          dragging={drag?.id === doc.ball.id}
          dropFrom={dropFx[doc.ball.id]?.vec ?? null}
          dropKey={dropFx[doc.ball.id]?.key ?? 0}
          pulseKey={pulses[doc.ball.id] ?? 0}
          pulseScale={1.45}
        />
      </svg>
      <EntityMiniBar svgRef={svgRef} pad={PITCH_PAD} />
      <TextEditOverlay svgRef={svgRef} pad={PITCH_PAD} />
    </div>
  )
}
