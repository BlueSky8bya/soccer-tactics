import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import type { Id, Path, TacticDocument, Vec2 } from '@/domain/types'
import { useEditor, useEditorSnapshot } from '@/editor/EditorContext'
import { addPlayer, setEntityHome } from '@/editor/commands'
import { clampToPitch } from '@/editor/geometry'
import {
  findSegment,
  findTrack,
  lastKnownPosition,
  moveBallStartInDraft,
  shiftEntityPathsInDraft,
  newIdFor,
  sceneOf,
} from '@/editor/segmentCommands'
import {
  MAX_STEP,
  addStepPass,
  addStepRun,
  setSegmentStep,
  bendGrabWaypointInDraft,
  bendMoveWaypointInDraft,
  relayoutStepsInDraft,
  resolvePassReceiverInDraft,
  stepOf,
} from '@/editor/stepCommands'
import { nextChainStep, resolvePointerIntent } from './gestureIntent'

const sceneTracks = (d: TacticDocument) => sceneOf(d).timeline.tracks
import { useUiStore } from '@/editor/uiStore'
import { useCompiled, useResolvedState } from '@/editor/useCompiled'
import { beautifyStroke, buildPathLUT, pointAtDistance } from '@/engine/path'
import { stateAt } from '@/engine/stateAt'
import { DrawingLayer } from '@/renderer/DrawingLayer'
import { PathLayer } from '@/renderer/PathLayer'
import { PitchMarkings } from '@/renderer/PitchMarkings'
import styles from '@/renderer/pitch.module.css'
import { clientToPitch } from '@/renderer/pointer'
import { t } from '../i18n'
import { teamColorOf } from '../teamColor'
import { AnimatedToken } from './AnimatedToken'
import {
  deriveAttachedPathStart,
  derivePathPhase,
  ghostOpacityForStep,
  placeStepBadges,
} from './pathPresentation'

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
      type: 'bend'
      segmentId: Id
      entityId: Id
      pointerId: number
      startClient: { x: number; y: number }
      started: boolean
      wpId: Id | null
    }
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
  /** While drawing: the target (player now / any future ghost) the stroke end is snapped to. */
  const [snapPos, setSnapPos] = useState<Vec2 | null>(null)
  /** Ball drop feedback (D-03): UI-only offset spring from the release point to the settled home. */
  const [ballDrop, setBallDrop] = useState<{ from: Vec2; key: number } | null>(null)
  /** In-place 1-9 picker opened by clicking a step badge (faster than the action bar). */
  const [stepPicker, setStepPicker] = useState<{ segId: Id; at: Vec2 } | null>(null)
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
    if (length < 1.5) {
      // Too short to mean anything - say WHY nothing happened instead of a silent no-op (C-03).
      ui.flashToast(t('simple.tooShort'))
      return
    }
    const step =
      chain.current && chain.current.entityId === entityId ? chain.current.step : st.currentStep
    // Chain past the last step: block BEFORE creating anything and say why (A-05).
    if (step > MAX_STEP) {
      ui.flashToast(t('simple.stepLimit'))
      return
    }
    if (entityId === doc.ball.id)
      addStepPass(core, waypoints, step, resolved.ball.holderId ?? doc.ball.initialHolderId)
    else addStepRun(core, entityId, waypoints, step)
    // Zigzag: while Shift stays down, the next press draws the next leg from where this ended.
    chain.current = { entityId, step: nextChainStep(step) ?? MAX_STEP + 1 }
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
      const ids = new Set<Id>()
      for (const pl of doc.players) if (hit(resolved.players[pl.id]?.pos ?? pl.home)) ids.add(pl.id)
      if (hit(resolved.ball.pos)) ids.add(doc.ball.id)
      // A box that crosses an authored path grabs that entity too (공 경로도 묶이게) —
      // true segment/box intersection, not just waypoints (a straight pass has only two).
      const segHitsBox = (a: Vec2, b: Vec2): boolean => {
        if (hit(a) || hit(b)) return true
        const dx = b.x - a.x
        const dy = b.y - a.y
        let t0 = 0
        let t1 = 1
        const clip = (p: number, q: number): boolean => {
          if (p === 0) return q >= 0
          const r = q / p
          if (p < 0) {
            if (r > t1) return false
            if (r > t0) t0 = r
          } else {
            if (r < t0) return false
            if (r < t1) t1 = r
          }
          return true
        }
        return (
          clip(-dx, a.x - x1) && clip(dx, x2 - a.x) && clip(-dy, a.y - y1) && clip(dy, y2 - a.y)
        )
      }
      for (const tr of sceneTracks(doc))
        for (const sg of tr.segments) {
          if (!('path' in sg) || sg.id.startsWith('gen-')) continue
          const wps = sg.path.waypoints
          for (let i = 1; i < wps.length; i++) {
            if (segHitsBox(wps[i - 1]!.p, wps[i]!.p)) {
              ids.add(tr.entityId)
              break
            }
          }
        }
      st.select([...ids])
      return
    }

    if (g.type === 'add') {
      if (!commit) return
      const team = doc.teams[g.team === 'home' ? 0 : 1]
      if (!team) return
      st.returnToAuthoringStart()
      const id = addPlayer(core, team.id, g.at)
      st.select([id])
      return
    }

    if (g.type === 'draw') {
      st.setPathDraft(null)
      setSnapPos(null)
      if (commit) finishDraw(g.entityId, g.points)
      return
    }

    if (g.type === 'bend') {
      if (!g.started) return // plain click = select only
      if (!commit) {
        core.cancel()
        return
      }
      // Length changed → steps re-stretch; a moved pass end → receiver re-resolve.
      core.update((d) => {
        const doc2 = d as TacticDocument
        relayoutStepsInDraft(doc2)
        const f = findSegment(doc2, g.segmentId)
        if (f && f.segment.kind === 'travel') resolvePassReceiverInDraft(doc2, g.segmentId)
      })
      core.commit()
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
      // The ball may have snapped to a holder: animate the last few pixels (document is already final).
      const settled = core.getDocument().ball.home
      const dx = at.x - settled.x
      const dy = at.y - settled.y
      if (Math.hypot(dx, dy) > 0.05)
        setBallDrop((prev) => ({ from: { x: dx, y: dy }, key: (prev?.key ?? 0) + 1 }))
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

  /** Player positions now + every authored segment end (the ghost spots) within 2.5 m of `p`. */
  const nearestSnapTarget = (p: Vec2, drawingEntityId: Id): Vec2 | null => {
    const d = core.getDocument()
    const candidates: Vec2[] = []
    for (const pl of d.players) {
      if (pl.id !== drawingEntityId) candidates.push(resolved.players[pl.id]?.pos ?? pl.home)
    }
    for (const tr of sceneTracks(d)) {
      for (const sg of tr.segments) {
        if (!('path' in sg) || sg.id.startsWith('gen-')) continue
        const wps = sg.path.waypoints
        const end = wps[wps.length - 1]?.p
        if (end) candidates.push(end)
      }
    }
    let best: Vec2 | null = null
    let bestD = 2.5
    for (const c of candidates) {
      const dist = Math.hypot(c.x - p.x, c.y - p.y)
      if (dist < bestD) {
        bestD = dist
        best = c
      }
    }
    return best
  }

  const startDraw = (entityId: Id, pointerId: number, startPos: Vec2) => {
    const st = useUiStore.getState()
    st.returnToAuthoringStart()
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

    // In-place step picker swallows its own presses; anything else closes it.
    if (stepPicker) {
      if (targetEl.closest('[data-step-picker]')) return
      setStepPicker(null)
    }

    const pressToken = (entityId: Id) => {
      st.returnToAuthoringStart()
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
    }

    // Reduce the press to flags, let the pure resolver pick ONE intent (PLAN-005 M3, FRAG-02).
    const ghostEl = targetEl.closest('[data-ghost]') as SVGElement | null
    const segEl = targetEl.closest('[data-segment]') as SVGElement | null
    const tokenEl = targetEl.closest('[data-entity]') as SVGGElement | null
    // The ball paints ABOVE its holder, so it wins every overlapping press. Disambiguate by
    // visual-radius-normalized distance: pressing the player's body grabs the PLAYER (run/move),
    // pressing the little ball itself still grabs the BALL (pass) — user 2026-08-20.
    let tokenEntityId = tokenEl?.getAttribute('data-entity') ?? null
    if (tokenEntityId === doc.ball.id && resolved.ball.holderId) {
      const hp = resolved.players[resolved.ball.holderId]?.pos
      if (hp) {
        const dBall = Math.hypot(resolved.ball.pos.x - pt.x, resolved.ball.pos.y - pt.y)
        const dHolder = Math.hypot(hp.x - pt.x, hp.y - pt.y)
        if (dBall / 0.9 > dHolder / 1.8) tokenEntityId = resolved.ball.holderId
      }
    }
    const nearPlayer = ghostEl
      ? doc.players.find((pl) => {
          const pos = resolved.players[pl.id]?.pos ?? pl.home
          return Math.hypot(pos.x - pt.x, pos.y - pt.y) < 1.2
        })
      : undefined
    const nearBall = ghostEl
      ? Math.hypot(resolved.ball.pos.x - pt.x, resolved.ball.pos.y - pt.y) < 0.9
      : false
    const intent = resolvePointerIntent(
      {
        ghost: !!ghostEl,
        segment: !!segEl,
        token: !!tokenEl,
        insidePitch: pt.x >= 0 && pt.x <= L && pt.y >= 0 && pt.y <= W,
      },
      { button: e.button, shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey },
      { liveTokenNearGhost: !!nearPlayer || nearBall, chainActive: !!chain.current },
    )

    switch (intent) {
      case 'draw-from-ghost': {
        // Next movement starts at that future spot.
        const entityId = ghostEl!.getAttribute('data-ghost')!
        const gx = Number(ghostEl!.getAttribute('data-gx'))
        const gy = Number(ghostEl!.getAttribute('data-gy'))
        startDraw(entityId, e.pointerId, { x: gx, y: gy })
        return
      }
      case 'press-live-token':
        // A live token sits right under the ghost press - the token wins.
        pressToken(nearBall ? doc.ball.id : nearPlayer!.id)
        return
      case 'adjust-ghost-end': {
        // Plain drag on a ghost = fine-tune that movement's end.
        const segId = ghostEl!.getAttribute('data-move-seg')
        const f = segId ? findSegment(core.getDocument(), segId) : null
        if (!f || !('path' in f.segment)) return
        const wps = f.segment.path.waypoints
        st.returnToAuthoringStart()
        st.selectSegment(segId)
        gesture.current = {
          type: 'bend',
          segmentId: segId!,
          entityId: f.track.entityId,
          pointerId: e.pointerId,
          startClient: { x: e.clientX, y: e.clientY },
          started: false,
          wpId: wps[wps.length - 1]!.id,
        }
        svg.setPointerCapture(e.pointerId)
        return
      }
      case 'draw-chain': {
        // Unbroken Shift chain: this press continues the zigzag from the last end.
        const entityId = chain.current!.entityId
        startDraw(entityId, e.pointerId, lastKnownPosition(core.getDocument(), entityId))
        return
      }
      case 'draw-from-token': {
        // Shift+drag on the token = draw a movement from its ORIGINAL spot.
        st.returnToAuthoringStart()
        const entityId = tokenEntityId!
        const startPos =
          entityId === doc.ball.id ? resolved.ball.pos : (resolved.players[entityId]?.pos ?? pt)
        startDraw(entityId, e.pointerId, startPos)
        return
      }
      case 'press-token':
        pressToken(tokenEntityId!)
        return
      case 'bend-path': {
        // Path drag is ALWAYS bend (C-01) - group moves use live token drags only.
        const segmentId = segEl!.getAttribute('data-segment')!
        st.selectSegment(segmentId)
        gesture.current = {
          type: 'bend',
          segmentId,
          entityId: segEl!.getAttribute('data-entity-of') ?? '',
          pointerId: e.pointerId,
          startClient: { x: e.clientX, y: e.clientY },
          started: false,
          wpId: null,
        }
        svg.setPointerCapture(e.pointerId)
        return
      }
      case 'marquee':
        st.clearSelection()
        gesture.current = { type: 'marquee', pointerId: e.pointerId, a: pt, b: pt }
        svg.setPointerCapture(e.pointerId)
        return
      case 'add-home-player':
      case 'add-away-player':
        st.clearSelection()
        gesture.current = {
          type: 'add',
          team: intent === 'add-away-player' ? 'away' : 'home',
          pointerId: e.pointerId,
          at: clampToPitch(pt, doc.pitch),
          startClient: { x: e.clientX, y: e.clientY },
        }
        svg.setPointerCapture(e.pointerId)
        return
      default:
        return
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

    if (g.type === 'bend') {
      if (!g.started) {
        const moved = Math.hypot(e.clientX - g.startClient.x, e.clientY - g.startClient.y)
        if (moved < DRAG_THRESHOLD_PX) return
        g.started = true
        st.returnToAuthoringStart()
        core.begin('Bend path')
        core.update((d) => {
          g.wpId = bendGrabWaypointInDraft(
            d as TacticDocument,
            g.segmentId,
            clampToPitch(pt, doc.pitch),
          )
        })
      }
      if (g.wpId)
        core.update((d) =>
          bendMoveWaypointInDraft(
            d as TacticDocument,
            g.segmentId,
            g.wpId!,
            clampToPitch(pt, doc.pitch),
          ),
        )
      return
    }

    if (g.type === 'add') {
      const moved = Math.hypot(e.clientX - g.startClient.x, e.clientY - g.startClient.y)
      if (moved > DRAG_THRESHOLD_PX * 2) gesture.current = null // a drag on grass is not an add
      return
    }

    if (g.type === 'draw') {
      let p = clampToPitch(pt, doc.pitch)
      // Connection feedback: near a player (now) or any future spot (ghost) → snap + highlight,
      // so releasing "on" a target is unambiguous (QA: 이어진 건지 땅인지 인식이 안 돼).
      const target = nearestSnapTarget(p, g.entityId)
      if (target) {
        p = target
        setSnapPos(target)
      } else setSnapPos(null)
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
  /** Frame is away from the authoring start: playing, paused mid-play, held result, or step preview. */
  const viewingFrame = isPlaying || ui.playback.t > 0
  const draftColor = ui.pathDraft
    ? ui.pathDraft.entityId === doc.ball.id
      ? 'var(--st-ball-path, #f5f5f7)'
      : teamColorOf(doc, ui.pathDraft.entityId)
    : ''
  const attachedStart = deriveAttachedPathStart(doc, compiled, ui.selectedSegmentId)

  // Playback focus (M4): classify every path as past/active/future for the current frame.
  const pathPhase: Record<Id, 'past' | 'active' | 'future'> = {}
  if (viewingFrame) {
    for (const tr of sceneTracks(doc))
      for (const sg of tr.segments) {
        if (!('path' in sg)) continue
        pathPhase[sg.id] = derivePathPhase(compiled.segmentTimes[sg.id], ui.playback.t)
      }
  }

  // Ghosts: where each entity stands after each authored movement (fading with order).
  // Shift+drag a ghost → the next movement starts from that spot.
  // Used steps sorted → a movement's ghost fades with its step's GLOBAL rank (A-05a), so at 22
  // players the earliest upcoming positions stay strongest. Selected entities stay boosted.
  const usedSteps = [
    ...new Set(
      sceneTracks(doc)
        .flatMap((tr) => tr.segments)
        .filter((sg) => 'path' in sg && !sg.id.startsWith('gen-'))
        .map((sg) => stepOf(sg as { step?: number })),
    ),
  ].sort((a, b) => a - b)
  const ghosts = doc.scenes[0]
    ? sceneTracks(doc).flatMap((tr) => {
        const segs = tr.segments.filter((sg) => 'path' in sg && !sg.id.startsWith('gen-'))
        return segs.flatMap((sg) => {
          const path = (sg as { path: { waypoints: { p: Vec2 }[] } }).path
          const end = path.waypoints[path.waypoints.length - 1]!.p
          const rank = usedSteps.indexOf(stepOf(sg as { step?: number }))
          const opacity = ghostOpacityForStep(rank < 0 ? 0 : rank, selection.includes(tr.entityId))
          // A pass that lands ON a receiver: draw the ball ghost at the receiver's FEET (like a held
          // ball), so the player centre stays grabbable for the receiver's own run.
          const received =
            tr.entityKind === 'ball' &&
            sg.kind === 'travel' &&
            !!(sg as { receiverId?: Id }).receiverId
          const pos = received ? { x: end.x + 1.1, y: end.y + 0.7 } : end
          const out = [
            {
              id: `${sg.id}-ghost`,
              segId: (sg as { id: Id }).id,
              entityId: tr.entityId,
              kind: tr.entityKind,
              pos,
              opacity,
              number:
                tr.entityKind === 'player'
                  ? doc.players.find((pl) => pl.id === tr.entityId)?.number
                  : undefined,
              color: tr.entityKind === 'player' ? teamColorOf(doc, tr.entityId) : '#ffffff',
            },
          ]
          // The runner still HOLDS the ball at the end of this movement → the ball travels with them:
          // show a faint ball there too, so the next pass can start from that future spot.
          if (tr.entityKind === 'player') {
            const tm = compiled.segmentTimes[(sg as { id: Id }).id]
            if (tm && Number.isFinite(tm.end)) {
              const rs = stateAt(compiled, doc, tm.end)
              if (rs.ball.holderId === tr.entityId)
                out.push({
                  id: `${sg.id}-ball-ghost`,
                  segId: (sg as { id: Id }).id,
                  entityId: doc.ball.id,
                  kind: 'ball' as const,
                  pos: rs.ball.pos,
                  opacity,
                  number: undefined,
                  color: '#ffffff',
                })
            }
          }
          return out
        })
      })
    : []

  // Step badge sits faintly at the MIDDLE of each path (the end is busy: ghost + arrowhead).
  // placeStepBadges nudges overlapping badges apart deterministically (B-03).
  const badgeAnchors = doc.scenes[0]
    ? doc.scenes[0].timeline.tracks.flatMap((tr) =>
        tr.segments
          .filter((s) => 'path' in s && !s.id.startsWith('gen-'))
          .map((s) => {
            const path = (s as { path: Path }).path
            const lut = buildPathLUT(path)
            const mid = pointAtDistance(lut, lut.length / 2)
            return {
              id: s.id,
              step: stepOf(s as { step?: number }),
              at: mid,
              entityId: tr.entityId,
            }
          }),
      )
    : []
  const badgeSpots = new Map(placeStepBadges(badgeAnchors).map((b) => [b.id, b.at]))
  const badges = badgeAnchors.map((b) => ({ ...b, end: badgeSpots.get(b.id) ?? b.at }))

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
      {/* Routes hidden while the animation runs (user 2026-08-20): the moving tokens ARE the play. */}
      <g className={isPlaying ? styles.decorHidden : styles.decorShown}>
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
          dimOthers={false}
          pathPhase={viewingFrame ? pathPhase : undefined}
        />
      </g>
      {/* step badges - kept mounted, faded out while viewing a frame (D-02) */}
      <g className={viewingFrame ? styles.decorHidden : styles.decorShown}>
        {badges.map((b) => (
          <g
            key={b.id}
            className={styles.stepBadge}
            transform={`translate(${b.end.x}, ${b.end.y})`}
            onPointerDown={(e) => {
              // Select + open the in-place 1-9 picker right here (user 2026-08-20: 단계 바꾸기 간소화).
              e.stopPropagation()
              useUiStore.getState().selectSegment(b.id)
              setStepPicker({ segId: b.id, at: b.end })
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
      </g>
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
        dropFrom={ballDrop?.from ?? null}
        dropKey={ballDrop?.key ?? 0}
        pulseKey={pulses[doc.ball.id]}
      />
      {snapPos && ui.pathDraft && (
        <g className={styles.snapRing} transform={`translate(${snapPos.x}, ${snapPos.y})`}>
          <circle r={2.3} />
        </g>
      )}
      {marquee && (
        <rect
          x={Math.min(marquee.a.x, marquee.b.x)}
          y={Math.min(marquee.a.y, marquee.b.y)}
          width={Math.abs(marquee.a.x - marquee.b.x)}
          height={Math.abs(marquee.a.y - marquee.b.y)}
          className={styles.marquee}
        />
      )}
      {/* ghosts: future positions - kept mounted, faded while viewing a frame (D-02) */}
      <g className={viewingFrame ? styles.decorHidden : styles.decorShown}>
        {ghosts.map((g) => (
          <g
            key={g.id}
            className={styles.ghostToken}
            transform={`translate(${g.pos.x}, ${g.pos.y})`}
            style={{ opacity: shiftHeld ? Math.min(0.85, g.opacity + 0.25) : g.opacity }}
            data-ghost={g.entityId}
            data-move-seg={g.segId}
            data-gx={g.pos.x}
            data-gy={g.pos.y}
          >
            {g.kind === 'ball' ? (
              <g className={styles.ghostBall}>
                {/* small invisible hit halo; visual matches the live ball size */}
                <circle r={1.0} fill="transparent" stroke="none" />
                <circle r={0.75} />
                <circle cx={0} cy={-0.3} r={0.15} className={styles.ghostBallDot} />
                <circle cx={-0.28} cy={0.19} r={0.15} className={styles.ghostBallDot} />
                <circle cx={0.28} cy={0.19} r={0.15} className={styles.ghostBallDot} />
              </g>
            ) : (
              <circle r={1.7} style={{ fill: g.color }} />
            )}
            {g.number !== undefined && (
              <text textAnchor="middle" dominantBaseline="central">
                {g.number}
              </text>
            )}
          </g>
        ))}
      </g>
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
      {stepPicker && !viewingFrame && (
        <g
          data-step-picker="true"
          className={styles.stepPicker}
          transform={`translate(${Math.min(Math.max(stepPicker.at.x, 11), L - 11)}, ${Math.max(stepPicker.at.y - 3.4, 2)})`}
        >
          <rect
            x={-10.4}
            y={-1.5}
            width={20.8}
            height={3}
            rx={1.5}
            className={styles.stepPickerBg}
          />
          {Array.from({ length: 9 }, (_, i) => i + 1).map((n, i) => {
            const cur = stepOf(
              (sceneTracks(doc)
                .flatMap((tr) => tr.segments)
                .find((sg) => sg.id === stepPicker.segId) ?? {}) as { step?: number },
            )
            return (
              <g
                key={n}
                transform={`translate(${(i - 4) * 2.25}, 0)`}
                className={`${styles.stepPickerItem} ${cur === n ? styles.stepPickerItemActive : ''}`}
                role="button"
                aria-label={t('simple.stepAssign', { n })}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  setSegmentStep(core, stepPicker.segId, n)
                  setStepPicker(null)
                }}
              >
                <circle r={1.02} />
                <text textAnchor="middle" dominantBaseline="central">
                  {n}
                </text>
              </g>
            )
          })}
        </g>
      )}
    </svg>
  )
}
