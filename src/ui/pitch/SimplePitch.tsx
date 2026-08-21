import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as RPointerEvent,
} from 'react'
import type { Id, Path, TacticDocument, Vec2 } from '@/domain/types'
import { useEditor, useEditorSnapshot } from '@/editor/EditorContext'
import { addPlayer, setEntityHome } from '@/editor/commands'
import { clampToPitch, truncateBallPathAtGoal } from '@/editor/geometry'
import {
  findSegment,
  lastKnownPosition,
  moveBallStartInDraft,
  shiftBallAnchorsForPlayerInDraft,
  shiftEntityPathsInDraft,
  newIdFor,
  sceneOf,
  moveTravelEndInDraft,
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
  shiftJunctionAnchorsInDraft,
  stepOf,
  lastBallMovedStep,
  ballMovesFromStep,
} from '@/editor/stepCommands'
import { nextChainStep, resolvePointerIntent } from './gestureIntent'
import { distToPolyline, ghostYieldTarget, pickTargets, resolvePossessionPair } from './pickTarget'
import {
  FLING_MIN_SPEED,
  SLING_MAX_SPEED,
  type GoalGeom,
  flingVelocity,
  simulateFling,
  slingAimEnd,
  slingVelocity,
} from './ballFling'

/** Goal mouth + net depth for every ball simulation — the aim preview and the commit must agree. */
function goalGeomFor(pitch: { width: number }): GoalGeom {
  const gw = 7.32 / 2
  return { top: pitch.width / 2 - gw, bot: pitch.width / 2 + gw, depth: 2 }
}
import type { FlingPoint } from './ballFling'
import type { PickSegment } from './pickTarget'
import { addFreehand } from '@/editor/moreCommands'
import { MIN_POINT_DIST_PX, mapPenPressure, mouseSpeedPressure, smoothPressure } from './inking'

const sceneTracks = (d: TacticDocument) => sceneOf(d).timeline.tracks
import { useUiStore } from '@/editor/uiStore'
import { useCompiled, useResolvedState } from '@/editor/useCompiled'
import { ATTACH_RADIUS_M, carryOffset } from '@/engine/compile'
import { beautifyStroke, buildPathLUT, pointAtDistance } from '@/engine/path'
import { stateAt } from '@/engine/stateAt'
import { DrawingLayer, PenStroke } from '@/renderer/DrawingLayer'
import { PathLayer } from '@/renderer/PathLayer'
import { PitchMarkings } from '@/renderer/PitchMarkings'
import styles from '@/renderer/pitch.module.css'
import { playableEnd } from '@/editor/usePlayback'
import { clientToPitch } from '@/renderer/pointer'
import { clampToView, usePitchView } from './useSvgMetrics'
import { t } from '../i18n'
import { entityChipOf, entityColorOf, teamColorOf } from '../teamColor'
import { AnimatedToken } from './AnimatedToken'
import {
  deriveAttachedPathStart,
  deriveFocusIds,
  derivePathPhase,
  deriveRestMutedIds,
  ghostOpacityForStep,
  placeStepBadges,
} from './pathPresentation'

/** Sampled polyline (~0.6m) of a segment's FULL authored path — geometric hit input (M1). */
const pathPtsCache = new WeakMap<object, Vec2[]>()
function samplePathPts(seg: { path: Path }): Vec2[] {
  const hit = pathPtsCache.get(seg)
  if (hit) return hit
  const lut = buildPathLUT(seg.path)
  const n = Math.max(2, Math.ceil(lut.length / 0.6) + 1)
  const pts: Vec2[] = []
  for (let i = 0; i < n; i++) pts.push(pointAtDistance(lut, (lut.length * i) / (n - 1)))
  pathPtsCache.set(seg, pts)
  return pts
}

/** Eraser cursor: a ring matching the 10px erase tolerance (user 2026-08-21), not a crosshair. */
const ERASER_CURSOR =
  'url("data:image/svg+xml;charset=utf-8,' +
  '%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2224%22 viewBox=%220 0 24 24%22%3E' +
  '%3Ccircle cx=%2212%22 cy=%2212%22 r=%2210.5%22 fill=%22none%22 stroke=%22rgba(0,0,0,0.45)%22 stroke-width=%223%22/%3E' +
  '%3Ccircle cx=%2212%22 cy=%2212%22 r=%2210.5%22 fill=%22rgba(255,255,255,0.12)%22 stroke=%22%23ffffff%22 stroke-width=%221.5%22/%3E' +
  '%3C/svg%3E") 12 12, crosshair'

const DRAG_THRESHOLD_PX = 4
/**
 * A bend INSERTS a control point, so it must be a deliberate pull — at the 4px token threshold
 * the wobble of an ordinary click was enough to drop a new point on the path and twitch the
 * curve (user 2026-08-22: 곡률 선정될 때 너무 민감하게 점이 잡혀).
 */
const BEND_START_PX = 10
/** Window for the second press of a slingshot double-click (shorter than the re-click cycle). */
const DOUBLE_CLICK_MS = 350
/**
 * Held-ball drag has two meanings and one gesture: inside the ring the ball ORBITS its holder
 * (pick the carry side), past it the ball comes AWAY. Hysteresis — leave at 3.4m, return at
 * 2.9m — so a hand resting on the boundary does not flicker between the two.
 */
/**
 * A press that travels less than this is a CLICK, not a stroke. ~0.8m is about 7 screen px on a
 * 1440px board — under the hand tremor that a deliberate drag always exceeds.
 */
const strokeLength = (pts: readonly Vec2[]): number => {
  let d = 0
  for (let i = 1; i < pts.length; i++)
    d += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y)
  return d
}
const CLICK_SLOP_M = 0.8
/** Alt+clicking back on the armed anchor disarms it. */
const AIM_CANCEL_M = 2.2
const CARRY_DETACH_M = 3.4
const CARRY_REATTACH_M = 2.9

/**
 * What a press names as the SUBJECT of the next movement — who moves, and from where.
 *
 * `atStep` is the ball's alone. A player is anchored by identity (any of its faded tokens continues
 * the same chain from the end), but the ball is anchored by a MOMENT: grabbing it at its starting
 * spot means it leaves there, on the step right after that spot exists, and the rest of its chain
 * is overwritten (user 2026-08-22: 공은 예외여서 중간의 모든 시점에서 움직일 수 있게).
 */
interface DrawSubject {
  entityId: Id
  from: Vec2
  minStep?: number
  atStep?: number
}

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
      /** Ctrl+press: a plain CLICK on an already-selected member removes it from the selection. */
      additive?: boolean
      wasSelected?: boolean
      /** Set when the dragged group holds the ball's INITIAL HOLDER (ball itself not in the group):
       *  the resting ball keeps its chosen side and travels with the player. */
      ballOrigin?: Vec2
      /** Recent drag samples (ball only) — release velocity for the fling (PLAN 2026-08-21). */
      samples?: { t: number; x: number; y: number }[]
      /** Held ball pulled clear of its holder's carry ring (hysteresis, see CARRY_DETACH_M). */
      detached?: boolean
    }
  | { type: 'marquee'; pointerId: number; a: Vec2; b: Vec2; additive: boolean }
  | {
      type: 'draw'
      entityId: Id
      pointerId: number
      points: Vec2[]
      minStep?: number
      atStep?: number
      /** Subject captured at PRESS: if this turns out to be a click, its path lands here. */
      landFor?: DrawSubject
      /** Started on a GHOST — a moment, which selection cannot name, so a click arms it. */
      fromGhost?: true
    }
  /** Landing a click-to-click path: the endpoint is wherever this pointer is released. */
  | ({ type: 'aim'; pointerId: number; to: Vec2 } & DrawSubject)
  | {
      type: 'bend'
      segmentId: Id
      entityId: Id
      pointerId: number
      startClient: { x: number; y: number }
      /** Pitch point of the PRESS — the control point belongs where the user aimed, not where
       *  the pointer had already drifted to by the time the threshold was crossed. */
      startPt: Vec2
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
   * Slingshot aim on a LOOSE ball (user 2026-08-21): a double-click that keeps dragging pulls
   * BACK, and the ball launches the opposite way. A flick throws where the hand went; this aims
   * where the hand came from, so a precise long ball no longer needs a fast swipe.
   */
  | {
      type: 'sling'
      pointerId: number
      ballAt: Vec2
      pointer: Vec2
      started: boolean
      startClient: { x: number; y: number }
    }
  /** Freehand annotation stroke (PLAN-008): pen collects points + VIC pressure factors. */
  | {
      type: 'annot-pen'
      pointerId: number
      points: Vec2[]
      pressures: number[]
      /** Pressure dynamics (VIC strokeDynRef): last event time/client pos + smoothed factor. */
      dyn: { t: number; x: number; y: number; f: number }
      /** Client position of the last KEPT point (2px gate). */
      lastKept: { x: number; y: number }
    }
  | { type: 'annot-erase'; pointerId: number; began: boolean }
  /** Carried-ball ghost orbit: set the POSSESSION carry side around the junction player —
   *  never bends the run underneath (user 2026-08-21). */
  | {
      type: 'orbit-carry'
      pointerId: number
      center: Vec2
      /** The RUN whose end junction this carry belongs to — junction-local pin. */
      runSegId: Id
      began: boolean
    }
  /** Arrival-ghost orbit (ADR-0010 D3): slide a RECEIVED pass's end around its receiver —
   *  a dedicated junction command; curvature and receiver identity never change. */
  | {
      type: 'orbit-receive'
      pointerId: number
      center: Vec2
      travelSegId: Id
      startClient: { x: number; y: number }
      began: boolean
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
  /** Re-click cycling (PLAN-007 M3, CR-06): applied on NO-DRAG pointerup only. */
  const cycleRef = useRef<{
    clientX: number
    clientY: number
    fingerprint: string
    index: number
    at: number
    docRev: number
    resultKey: string | null
  } | null>(null)
  /** Last pointerdown pick (PLAN-007): cycling input + adapter data for the intent switch. */
  const lastPickRef = useRef<{
    pick: ReturnType<typeof pickTargets>
    pt: Vec2
    clientX: number
    clientY: number
  } | null>(null)
  const [marquee, setMarquee] = useState<{ a: Vec2; b: Vec2 } | null>(null)
  const [drawKeyHeld, setDrawKeyHeld] = useState(false)
  /** While drawing: the target (player now / any future ghost) the stroke end is snapped to. */
  const [snapPos, setSnapPos] = useState<Vec2 | null>(null)
  /** Ball drop feedback (D-03): UI-only offset spring from the release point to the settled home. */
  const [ballDrop, setBallDrop] = useState<{ from: Vec2; key: number } | null>(null)
  /** Fling roll animation (UI-only): trajectory from the pure sim; doc already holds the END. */
  const [flingAnim, setFlingAnim] = useState<{ points: FlingPoint[]; key: number } | null>(null)
  /** Last plain press on the ball — the first half of a slingshot double-click. */
  const lastBallPressRef = useRef<{ at: number; x: number; y: number } | null>(null)
  /** Live slingshot aim, mirrored for rendering (pull back → fly forward). */
  const [slingAim, setSlingAim] = useState<{ from: Vec2; to: Vec2 } | null>(null)
  /** Carry/detach boundary drawn while dragging a held ball. */
  const [carryRing, setCarryRing] = useState<{ at: Vec2; detached: boolean } | null>(null)
  /**
   * Where to DRAW the ball while it is being pulled off its holder. Crossing the ring means
   * "take it from him", so the ball leaves his feet on the spot instead of staying pinned there
   * until the drop (user 2026-08-22: 점선을 넘는 순간 잔디 위에 공을 렌더). Possession itself is
   * left alone mid-drag — clearing it would orphan the pass chain — so this is render-only.
   */
  const [detachPos, setDetachPos] = useState<Vec2 | null>(null)
  const [flingPos, setFlingPos] = useState<{ pos: Vec2; spin: number } | null>(null)
  /**
   * Click-to-click path authoring (user 2026-08-22). Alt+CLICK a subject to arm it, Alt+CLICK
   * again to land a straight movement there; bend it afterwards by dragging the line. Alt+DRAG
   * still draws freehand — this is the pointer-only route beside it, not a replacement.
   */
  const [aim, setAim] = useState<DrawSubject | null>(null)
  const [aimTo, setAimTo] = useState<Vec2 | null>(null)
  /** endGesture runs from a ref and must not close over a stale `aim`. */
  const aimRef = useRef(aim)
  aimRef.current = aim
  /** Alt held with ONE entity selected: the same guide, without an arming click. */
  const quickAimRef = useRef(false)
  /**
   * The subject a click would land a path FOR, when the selection alone names it. Read from a ref
   * because endGesture runs outside the render that computed it.
   */
  const quickAimSubjectRef = useRef<DrawSubject | null>(null)
  /**
   * WHICH ball token the last press grabbed — the moment the ball leaves from.
   *
   * `step` is the last step that had already finished when the ball sat there: 0 for the live token
   * at the starting position, otherwise the step of the movement whose end that faded ball marks.
   * Null means no ball token was named, so the ball's chain simply continues from its rest.
   */
  const ballMomentRef = useRef<{ step: number; pos: Vec2 } | null>(null)
  /** viewBox that fills the element — the surround IS the board, so the pen can use all of it. */
  const view = usePitchView(svgRef, doc.pitch.length, doc.pitch.width)
  const flingDoneRef = useRef<(() => void) | null>(null)
  const flingKeyRef = useRef(0)
  /** Player under the DRAGGED ball (≤2.6m) — lights up so "give" vs "ground" is obvious. */
  const [dropTargetId, setDropTargetId] = useState<Id | null>(null)
  /** Goal-net cloth FX (benchmark: FIFA-style nets are ANCHORED at the frame and bulge at the
   *  impact, oscillating back — the stretch starts at the goal's edges, never floats inside). */
  const [netFx, setNetFx] = useState<{
    side: 'left' | 'right'
    wall: 'back' | 'top' | 'bot'
    ix: number
    iy: number
    strength: number
    key: number
  } | null>(null)
  /** Damped-oscillation amplitude (rAF-driven): e^(−4.2t)·sin(8.5t), ~0.95s. */
  const [netAmp, setNetAmp] = useState(0)
  const netFxQueueRef = useRef<{ t: number; pos: Vec2; normal: Vec2; speed: number }[]>([])
  const fireNetImpact = (imp: { pos: Vec2; normal: Vec2; speed: number }) => {
    const L2 = doc.pitch.length
    const gTop = doc.pitch.width / 2 - 3.66
    const gBot = doc.pitch.width / 2 + 3.66
    const side: 'left' | 'right' = imp.pos.x < L2 / 2 ? 'left' : 'right'
    const backX = side === 'left' ? -1.85 : L2 + 1.85
    const wall: 'back' | 'top' | 'bot' =
      Math.abs(imp.normal.x) >= Math.abs(imp.normal.y) ? 'back' : imp.normal.y < 0 ? 'top' : 'bot'
    const clampNum = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
    const ix =
      wall === 'back'
        ? backX
        : side === 'left'
          ? clampNum(imp.pos.x, backX + 0.3, -0.3)
          : clampNum(imp.pos.x, L2 + 0.3, backX - 0.3)
    const iy =
      wall === 'back' ? clampNum(imp.pos.y, gTop + 0.5, gBot - 0.5) : wall === 'top' ? gTop : gBot
    setNetFx({
      side,
      wall,
      ix,
      iy,
      strength: Math.max(0.7, Math.min(1.35, imp.speed / 16)),
      key: (flingKeyRef.current += 1),
    })
    pulseKey.current++
    setPulses((prev) => ({ ...prev, [doc.ball.id]: pulseKey.current }))
  }
  // cloth oscillation driver
  useEffect(() => {
    if (!netFx) return
    const t0 = performance.now()
    let raf = 0
    const tick = () => {
      const t2 = (performance.now() - t0) / 1000
      if (t2 >= 0.95) {
        setNetAmp(0)
        setNetFx(null)
        return
      }
      setNetAmp(Math.exp(-4.2 * t2) * Math.sin(8.5 * t2))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [netFx?.key])
  /** In-place 1-9 picker opened by clicking a step badge (faster than the action bar). */
  const [stepPicker, setStepPicker] = useState<{ segId: Id; at: Vec2 } | null>(null)
  /** One-shot expanding ring when the ball ATTACHES to a player (immersion feedback). */
  const [attachFx, setAttachFx] = useState<{ id: Id; key: number } | null>(null)
  /** Token currently pressed (pointer down, drag not started) — quick lift ack (M4). */
  const [pressedId, setPressedId] = useState<Id | null>(null)
  /** Hover preview (PLAN-007 M2): what a plain press would pick — highlight only (A-02). */
  const [hoverKey, setHoverKey] = useState<string | null>(null)
  const hoverRaf = useRef<number | null>(null)
  const hoverPt = useRef<Vec2 | null>(null)
  /** Carried-ball ghost being ORBITED — lifts + brightens so the grab is unmistakable. */
  const [orbitGrabSeg, setOrbitGrabSeg] = useState<Id | null>(null)
  /** In-progress pen stroke (PLAN-008) — rendered live with the same pressure widths. */
  const [annotDraft, setAnnotDraft] = useState<{ points: Vec2[]; pressures: number[] } | null>(null)
  /** Unbroken Alt chain: next press continues from the entity's last position, step auto +1. */
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

  // A named ball moment belongs to a selected ball. Deselect it — Escape, a click on grass, a
  // different token — and the moment goes with it, so a later press can never inherit a stale one.
  useEffect(() => {
    if (!ui.selection.includes(doc.ball.id)) ballMomentRef.current = null
  }, [ui.selection, doc.ball.id])

  const finishDraw = (entityId: Id, raw: Vec2[], minStep?: number, atStep?: number) => {
    const st = useUiStore.getState()
    if (raw.length < 2) return
    // A ball path INTO the goal mouth ends in the net — never through it (user 2026-08-21).
    const goalCut = entityId === doc.ball.id ? truncateBallPathAtGoal(raw, doc.pitch) : null
    if (goalCut) raw = goalCut
    const waypoints = beautifyStroke(raw, () => newIdFor('w'))
    if (goalCut) {
      // beautify may drift the tip — pin the end back inside the netting
      const lastWp = waypoints[waypoints.length - 1]
      const endPt = goalCut[goalCut.length - 1]!
      if (lastWp) {
        const dxe = endPt.x - lastWp.p.x
        const dye = endPt.y - lastWp.p.y
        lastWp.p = { x: endPt.x, y: endPt.y }
        if (lastWp.handleIn)
          lastWp.handleIn = { x: lastWp.handleIn.x + dxe, y: lastWp.handleIn.y + dye }
      }
    }
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
    let step = Math.max(
      chain.current && chain.current.entityId === entityId ? chain.current.step : st.currentStep,
      minStep ?? 1,
    )
    /*
     * The ball's passes are strictly sequential — continuing after the last one always lands on the
     * NEXT step, whatever the chip says (user 2026-08-21: 0단계 발사 버그).
     *
     * `atStep` overrides that outright, because it comes from a ball token the user actually
     * grabbed: it is not a floor, it is the answer. Deriving the step from the END of everything
     * instead meant grabbing the ball at its starting spot still fired the pass after its holder's
     * last run, so it left from a spot the user never pointed at (user 2026-08-22).
     */
    const wiped = atStep !== undefined ? ballMovesFromStep(core.getDocument(), atStep) : 0
    if (entityId === doc.ball.id)
      step = atStep ?? Math.max(step, lastBallMovedStep(core.getDocument()) + 1)
    // Chain past the last step: block BEFORE creating anything and say why (A-05).
    if (step > MAX_STEP) {
      ui.flashToast(t('simple.stepLimit'))
      return
    }
    if (entityId === doc.ball.id)
      addStepPass(core, waypoints, step, resolved.ball.holderId ?? doc.ball.initialHolderId, {
        exactStep: atStep !== undefined,
      })
    else addStepRun(core, entityId, waypoints, step)
    // commit confirmation: subject pops again as the arrow lands (M4)
    pulseKey.current++
    setPulses((prev) => ({ ...prev, [entityId]: pulseKey.current }))
    // Zigzag: while Shift stays down, the next press draws the next leg from where this ended.
    chain.current = { entityId, step: nextChainStep(step) ?? MAX_STEP + 1 }
    // Deliberately NOT selected: picking the next step chip must never retarget what was just drawn.
    st.selectSegment(null)
    // The grabbed moment consumed itself; the next press names a fresh one.
    ballMomentRef.current = null
    ui.flashToast(wiped > 0 ? t('simple.ballRerouted', { n: wiped }) : t('simple.added', { n: step }))
  }

  /**
   * No-drag pointerup cycling (PLAN-007 M3, A-01: 6px / 1.2s, immediate invalidation on any
   * fingerprint or document change). A repeated plain click on the same crowded spot selects the
   * NEXT overlapping candidate; a drag keeps its original anchor untouched (CR-06).
   */
  const maybeCycle = () => {
    const last = lastPickRef.current
    if (!last || last.pick.ordered.length < 2) {
      cycleRef.current = null
      return
    }
    const now = performance.now()
    const rev = core.getRevision()
    const st2 = useUiStore.getState()
    // What THIS click's normal handling selected (the down handlers already ran).
    const currentKey = st2.selectedSegmentId
      ? `segment:${st2.selectedSegmentId}`
      : st2.selection.length === 1
        ? (st2.selection[0] === doc.ball.id ? 'ball:' : 'player:') + st2.selection[0]
        : null
    const prev = cycleRef.current
    // Cycle ONLY when this is a true re-click: same spot, same candidates, same document, AND the
    // previous click's result is still what's selected (an Escape or a new intent resets — the
    // golden possession pick must never be stolen).
    const samePress =
      prev &&
      Math.hypot(last.clientX - prev.clientX, last.clientY - prev.clientY) <= 6 &&
      now - prev.at <= 1200 &&
      prev.fingerprint === last.pick.fingerprint &&
      prev.docRev === rev &&
      prev.resultKey !== null &&
      prev.resultKey === currentKey
    const index = samePress ? (prev!.index + 1) % last.pick.ordered.length : 0
    let resultKey = currentKey
    if (samePress) {
      const cand = last.pick.ordered[index]!
      if (cand.kind === 'player' || cand.kind === 'ball') st2.select([cand.id])
      else st2.selectSegment(cand.segId)
      resultKey =
        cand.kind === 'player' || cand.kind === 'ball'
          ? `${cand.kind}:${cand.id}`
          : `segment:${cand.segId}`
    }
    cycleRef.current = {
      clientX: last.clientX,
      clientY: last.clientY,
      fingerprint: last.pick.fingerprint,
      index,
      at: now,
      docRev: rev,
      resultKey,
    }
  }

  /**
   * Commit a simulated ball flight. Only the RESTING spot reaches the document (the roll itself is
   * interface motion, ADR-0006 D1); the trajectory is then replayed with net FX, and a landing
   * inside a player's attach range hands them the ball. Shared by the flick and the slingshot so
   * both aim, land and attach by exactly the same rules.
   */
  const launchBall = (sim: ReturnType<typeof simulateFling>) => {
    const d = core.getDocument()
    const at = sim.final
    const near = d.players
      .map((p) => ({ p, dist: Math.hypot(p.home.x - at.x, p.home.y - at.y) }))
      .filter((x) => x.dist <= ATTACH_RADIUS_M)
      .sort((a, b) => a.dist - b.dist)[0]
    core.update((dd) => moveBallStartInDraft(dd as TacticDocument, at, near?.p.id ?? null))
    core.commit()
    const done = () => {
      if (!near) return
      pulseKey.current++
      setPulses((prev) => ({
        ...prev,
        [near.p.id]: pulseKey.current,
        [d.ball.id]: pulseKey.current,
      }))
      setAttachFx({ id: near.p.id, key: pulseKey.current })
      ui.flashToast(t('ball.attached', { n: near.p.number }))
    }
    netFxQueueRef.current = sim.goal
      ? sim.goal.impacts.map((imp) => ({
          t: imp.t,
          pos: imp.pos,
          normal: imp.normal,
          speed: imp.speed,
        }))
      : []
    if (sim.duration > 0.05) {
      flingDoneRef.current = done
      setFlingAnim({ points: sim.points, key: (flingKeyRef.current += 1) })
    } else done()
  }

  const endGestureImpl = (commit: boolean) => {
    const g = gesture.current
    gesture.current = null
    setPressedId(null)
    setDropTargetId(null)
    setCarryRing(null)
    setDetachPos(null)
    const svg = svgRef.current
    if (!g) return
    if (svg && svg.hasPointerCapture(g.pointerId)) svg.releasePointerCapture(g.pointerId)
    const st = useUiStore.getState()

    if (g.type === 'annot-pen') {
      setAnnotDraft(null)
      if (commit && g.points.length >= 2)
        addFreehand(
          core,
          g.points,
          { color: st.annotate.color, width: st.annotate.width },
          g.pressures,
        )
      return
    }
    if (g.type === 'annot-erase') {
      if (g.began) {
        if (commit) core.commit()
        else core.cancel()
      }
      return
    }
    if (g.type === 'orbit-carry') {
      setOrbitGrabSeg(null)
      if (g.began) {
        if (commit) core.commit()
        else core.cancel()
      }
      return
    }

    if (g.type === 'orbit-receive') {
      setOrbitGrabSeg(null)
      if (g.began) {
        if (commit) {
          core.update((d) => relayoutStepsInDraft(d as TacticDocument))
          core.commit()
        } else core.cancel()
      }
      return
    }

    if (g.type === 'marquee') {
      setMarquee(null)
      if (!commit) return
      const x1 = Math.min(g.a.x, g.b.x)
      const x2 = Math.max(g.a.x, g.b.x)
      const y1 = Math.min(g.a.y, g.b.y)
      const y2 = Math.max(g.a.y, g.b.y)
      if ((x2 - x1) * (y2 - y1) < 1) return // a click, not a box
      const hit = (v: Vec2) => v.x >= x1 && v.x <= x2 && v.y >= y1 && v.y <= y2
      const ids = new Set<Id>(g.additive ? st.selection : [])
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

    if (g.type === 'sling') {
      setSlingAim(null)
      const v = commit && g.started ? slingVelocity(g.ballAt, g.pointer) : null
      if (!v) return // too short a pull to aim, or cancelled — the ball never moved
      // The aim mutates nothing, so the transaction opens here (a drag-thrown ball already has
      // one open from its drag) — one undo step for the whole throw.
      core.begin('Sling ball')
      launchBall(simulateFling(g.ballAt, v, doc.pitch, goalGeomFor(doc.pitch), SLING_MAX_SPEED))
      return
    }

    if (g.type === 'draw') {
      st.setPathDraft(null)
      setSnapPos(null)
      if (!commit) return
      /*
       * A press that never travelled is a CLICK, and a click means one of two things:
       *
       *  · a subject already stands → this is the DESTINATION, whatever is under it.
       *  · nothing stands → this press names the subject.
       *
       * Landing on a token is not an edge case, it is the main case: a pass ends ON a player. The
       * intent resolver reads a token press as "draw from this token" before it ever sees the
       * standing subject, so aiming the ball at its receiver re-armed the RECEIVER instead and tore
       * the ball's chain in half (user 2026-08-22: 시작점으로 다시 눌리면서 공 이동경로가 끊기잖아).
       * Deciding it here — at release, where a click and a drag are finally distinguishable —
       * leaves Alt+DRAG on a token drawing that token's own path exactly as before.
       *
       * ONE rule: a click LANDS for whoever is standing, whatever is under it — grass, a token, or
       * a ghost. Only when nobody stands does the click NAME a subject, and naming a token is just
       * selecting it, which `startDraw` already did (user 2026-08-22: 단축키 최대한 줄이는 방향으로).
       * A GHOST is the single thing selection cannot name, because it is a MOMENT rather than an
       * entity, so that is the one case that still holds its own state.
       */
      if (strokeLength(g.points) < CLICK_SLOP_M) {
        const subject = g.landFor
        if (subject && subject.entityId !== g.entityId) {
          setAim(null)
          setAimTo(null)
          finishDraw(subject.entityId, [subject.from, g.points[0]!], subject.minStep, subject.atStep)
          return
        }
        if (g.fromGhost) {
          setAim({
            entityId: g.entityId,
            from: g.points[0]!,
            minStep: g.minStep,
            atStep: g.atStep,
          })
          setAimTo(null)
          ui.flashToast(t('simple.aimArmed'))
        }
        return
      }
      setAim(null)
      finishDraw(g.entityId, g.points, g.minStep, g.atStep)
      return
    }

    if (g.type === 'aim') {
      setAim(null)
      setAimTo(null)
      setSnapPos(null)
      if (!commit) return
      finishDraw(g.entityId, [g.from, g.to], g.minStep, g.atStep)
      return
    }

    if (g.type === 'bend') {
      if (!g.started) {
        if (commit) maybeCycle()
        return // plain click = select only
      }
      if (!commit) {
        core.cancel()
        return
      }
      // Length changed → steps re-stretch. Receiver re-resolve ONLY when the END moved —
      // an interior curvature bend never reinterprets who receives (ADR-0010 D3 / audit R9).
      core.update((d) => {
        const doc2 = d as TacticDocument
        relayoutStepsInDraft(doc2)
        const f = findSegment(doc2, g.segmentId)
        if (f && f.segment.kind === 'travel') {
          const wps2 = f.segment.path.waypoints
          if (g.wpId === wps2[wps2.length - 1]?.id) {
            resolvePassReceiverInDraft(doc2, g.segmentId)
            relayoutStepsInDraft(doc2)
          }
        }
      })
      core.commit()
      return
    }

    // token: plain Ctrl+CLICK (no drag) on a selected member toggles it OFF (multi-select).
    if (!g.started) {
      if (commit && g.additive && g.wasSelected) st.select(st.selection.filter((id) => id !== g.id))
      else if (commit && !g.additive) maybeCycle()
      return
    }
    const drag = st.drag
    if (!commit) {
      core.cancel()
      st.setDrag(null)
      return
    }
    if (g.started && !(g.id === doc.ball.id && g.group.size === 1)) {
      // player drag commit: pass lengths may have changed with their anchors — re-derive timings
      core.update((d) => relayoutStepsInDraft(d as TacticDocument))
    }
    if (g.id === doc.ball.id && g.group.size === 1) {
      // Move the ball's starting spot: on a player → that player holds it; grass → loose there.
      // Works with authored passes too (their origin follows).
      const d = core.getDocument()
      let at = drag?.raw ?? d.ball.home
      // FLING (user 2026-08-21): a fast release throws the ball — it rolls out with drag and
      // wall bounces (pure sim), and only the RESTING spot becomes the document position.
      const grabbedAt = g.group.get(g.id) ?? g.home
      const vel =
        commit && g.samples ? flingVelocity(g.samples, performance.now(), grabbedAt) : null
      const speed = vel ? Math.hypot(vel.x, vel.y) : 0
      // Released ON a player (the drop-target highlight is showing) = GIVE, never a throw —
      // the promise the highlight makes wins over release velocity (user 2026-08-21).
      const releasedOnPlayer = d.players.some(
        (p) => Math.hypot(p.home.x - at.x, p.home.y - at.y) <= ATTACH_RADIUS_M,
      )
      let fling: ReturnType<typeof simulateFling> | null = null
      if (!releasedOnPlayer && vel && speed >= FLING_MIN_SPEED && !ui.reducedMotion) {
        const gw = 7.32 / 2
        fling = simulateFling(at, vel, doc.pitch, {
          top: doc.pitch.width / 2 - gw,
          bot: doc.pitch.width / 2 + gw,
          depth: 2,
        })
        at = fling.final
      }
      const near = d.players
        .map((p) => ({ p, dist: Math.hypot(p.home.x - at.x, p.home.y - at.y) }))
        .filter((x) => x.dist <= ATTACH_RADIUS_M) // one semantic constant (ADR-0010 D5)
        .sort((a, b) => a.dist - b.dist)[0]
      core.update((dd) => moveBallStartInDraft(dd as TacticDocument, at, near?.p.id ?? null))
      core.commit()
      // The ball may have snapped to a holder: animate the last few pixels (document is already final).
      const settled = core.getDocument().ball.home
      const dx = at.x - settled.x
      const dy = at.y - settled.y
      const settleAndAttach = () => {
        if (Math.hypot(dx, dy) > 0.05)
          setBallDrop((prev) => ({ from: { x: dx, y: dy }, key: (prev?.key ?? 0) + 1 }))
        // Unmistakable ATTACH feedback (user 2026-08-20): pop both tokens, flash an expanding
        // ring at the player, and say who holds it — the little "탁!" moment matters.
        if (near) {
          pulseKey.current++
          setPulses((prev) => ({
            ...prev,
            [near.p.id]: pulseKey.current,
            [doc.ball.id]: pulseKey.current,
          }))
          setAttachFx({ id: near.p.id, key: pulseKey.current })
          ui.flashToast(t('ball.attached', { n: near.p.number }))
        }
      }
      // A dropped ball SNAPS to where it was put — no travel animation across the gap
      // (user 2026-08-21: 순간이동 되게 하면 되잖아). Only a thrown ball is animated, because
      // there the roll IS the gesture's meaning.
      if (fling && fling.duration > 0.05) {
        // roll the visual along the simulated path; settle/attach feedback fires on arrival
        netFxQueueRef.current = fling.goal
          ? fling.goal.impacts.map((imp) => ({
              t: imp.t,
              pos: imp.pos,
              normal: imp.normal,
              speed: imp.speed,
            }))
          : []
        flingDoneRef.current = settleAndAttach
        // Pin the visual to the START of the roll in the SAME commit that starts it. The document
        // already holds the resting spot, and the roll driver only writes flingPos on its first
        // rAF — so for one frame the ball was drawn where it will END UP, which read as the ball
        // blinking to the far side and exploding back (user 2026-08-22: 순간 깜빡거리면서).
        setFlingPos({ pos: { x: fling.points[0]!.x, y: fling.points[0]!.y }, spin: 0 })
        setFlingAnim({ points: fling.points, key: (flingKeyRef.current += 1) })
      } else {
        settleAndAttach()
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

  // Fling roll driver: replay the simulated trajectory in real time, spin from rolled distance.
  useEffect(() => {
    if (!flingAnim) return
    const pts = flingAnim.points
    const total = pts[pts.length - 1]!.t
    const t0 = performance.now()
    let raf = 0
    let idx = 0
    const tick = () => {
      const el = (performance.now() - t0) / 1000
      if (el >= total) {
        // a mesh contact can land on the very last step — flush the queue before finishing
        const pending = netFxQueueRef.current[0]
        if (pending) {
          netFxQueueRef.current = []
          fireNetImpact(pending)
        }
        setFlingPos(null)
        setFlingAnim(null)
        const done = flingDoneRef.current
        flingDoneRef.current = null
        done?.()
        return
      }
      while (idx < pts.length - 2 && pts[idx + 1]!.t <= el) idx++
      const nf = netFxQueueRef.current[0]
      if (nf && el >= nf.t) {
        netFxQueueRef.current = netFxQueueRef.current.slice(1)
        fireNetImpact(nf)
      }
      const a = pts[idx]!
      const b = pts[Math.min(idx + 1, pts.length - 1)]!
      const f = b.t > a.t ? (el - a.t) / (b.t - a.t) : 0
      setFlingPos({
        pos: { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f },
        spin: (a.d + (b.d - a.d) * f) / 0.68,
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flingAnim])

  // Shift shows/arms the ghosts (they sit ON TOP of tokens, but only catch clicks while Shift is down,
  // so the ball ghost under a receiver is still reachable — QA: 공이 클릭이 안 돼).
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        e.preventDefault() // keep the browser menu from grabbing focus
        setDrawKeyHeld(true)
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        e.preventDefault()
        setDrawKeyHeld(false)
        chain.current = null
      }
    }
    const blur = () => {
      setDrawKeyHeld(false)
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

  // Esc cancels any gesture. It does NOT leave draw mode (user 2026-08-21: D alone toggles).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (gesture.current) {
        e.preventDefault()
        endGestureRef.current(false)
        return
      }
      // an armed click-to-click aim is a live gesture too, even with no pointer down
      if (aimRef.current) {
        e.preventDefault()
        setAim(null)
        setAimTo(null)
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

  /**
   * Where an entity ENDS UP once everything authored has played.
   *
   * Not the last waypoint on its own track: the ball can be CARRIED after its last pass, so a ball
   * whose final travel was step 2 really finishes wherever its holder's step-3 run left it (user
   * 2026-08-22). Asking the resolver at the end of the play answers that for every entity with one
   * rule — a player's own last end for players, possession included for the ball.
   */
  const entityRestPos = (entityId: Id): Vec2 => {
    const d = core.getDocument()
    const rs = stateAt(compiled, d, playableEnd(compiled))
    return entityId === d.ball.id
      ? rs.ball.pos
      : (rs.players[entityId]?.pos ?? lastKnownPosition(d, entityId))
  }

  /**
   * Where this entity's next movement STARTS.
   *
   * For a player: wherever it ends up — no fork exists, so identity is the whole answer. For the
   * BALL: the moment that was grabbed, if one was. A ball token is not just "the ball" — it is the
   * ball AT A TIME, and there is only one ball, so leaving from an earlier one overwrites the rest
   * of its chain rather than branching it (user 2026-08-22).
   */
  const subjectAnchor = (entityId: Id): { from: Vec2; atStep?: number } => {
    const m = entityId === doc.ball.id ? ballMomentRef.current : null
    return m ? { from: m.pos, atStep: m.step + 1 } : { from: entityRestPos(entityId) }
  }

  /**
   * Who a CLICK here would draw for, read BEFORE the press changes anything. `startDraw` selects
   * the pressed entity on pointerdown, so by release the previous subject is gone — it has to be
   * captured now or not at all.
   */
  const subjectAtPress = (): DrawSubject | null => {
    const armed = aimRef.current
    if (armed) return armed
    const sel = useUiStore.getState().selection
    if (sel.length !== 1) return null
    return { entityId: sel[0]!, ...subjectAnchor(sel[0]!) }
  }

  const startDraw = (
    entityId: Id,
    pointerId: number,
    startPos: Vec2,
    minStep?: number,
    landFor?: DrawSubject,
    fromGhost?: true,
    atStep?: number,
  ) => {
    const st = useUiStore.getState()
    st.returnToAuthoringStart()
    st.select([entityId])
    // start acknowledgement: the subject pops once so the ink clearly belongs to it (M4)
    pulseKey.current++
    setPulses((prev) => ({ ...prev, [entityId]: pulseKey.current }))
    gesture.current = {
      type: 'draw',
      entityId,
      pointerId,
      points: [startPos],
      minStep,
      landFor,
      fromGhost,
      atStep,
    }
    st.setPathDraft({ entityId, points: [startPos] })
    svgRef.current?.setPointerCapture(pointerId)
  }

  /**
   * Stroke-unit eraser (PLAN-008 D-03): any drawing whose outline passes within ~10 screen px of
   * the pointer dies whole. One drag = one undo step (begin on first hit, commit at pointerup).
   */
  const eraseAt = (pt: Vec2) => {
    const g = gesture.current
    if (!g || g.type !== 'annot-erase') return
    const svg = svgRef.current
    const width = svg ? svg.getBoundingClientRect().width : 1
    const tol = 10 * (view.w / Math.max(1, width))
    const hit = core.getDocument().drawings.find((dr) => {
      if (dr.kind === 'freehand' || dr.kind === 'line') return distToPolyline(pt, dr.points) <= tol
      if (dr.kind === 'arrow') return distToPolyline(pt, [dr.from, dr.to]) <= tol
      if (dr.kind === 'text')
        return Math.hypot(dr.at.x - pt.x, dr.at.y - pt.y) <= Math.max(tol, 1.5)
      return false // zones have no pen UI; the clear-all button covers them
    })
    if (!hit) return
    if (!g.began) {
      core.begin('Erase drawing')
      g.began = true
    }
    core.update((d) => {
      const dd = d as TacticDocument
      dd.drawings = dd.drawings.filter((x) => x.id !== hit.id)
    })
  }

  const onPointerDown = (e: RPointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg) return
    const targetEl = e.target as Element
    const pt = clientToPitch(svg, e.clientX, e.clientY)
    svg.focus({ preventScroll: true })
    const st = useUiStore.getState()

    setHoverKey(null)
    // In-place step picker swallows its own presses; anything else closes it.
    if (stepPicker) {
      if (targetEl.closest('[data-step-picker]')) return
      setStepPicker(null)
    }

    // Draw mode (PLAN-008 D-01): the pointer belongs to the pen/eraser — board gestures stop.
    // The 'select' tool keeps the NORMAL board pointer (move players/ball) inside draw mode.
    if (st.annotate.on && st.annotate.tool !== 'select') {
      if (e.button !== 0) return
      // The pen may use every millimetre the board SHOWS, surround included — clamping it to the
      // pitch rectangle collapsed strokes onto the touchline the moment the panels were hidden.
      const p = clampToView(pt, view)
      if (st.annotate.tool === 'pen') {
        // VIC pen grammar: stylus starts at its mapped pressure, mouse/touch at 0.8.
        const f0 = e.pointerType === 'pen' ? mapPenPressure(e.pressure) : 0.8
        gesture.current = {
          type: 'annot-pen',
          pointerId: e.pointerId,
          points: [p],
          pressures: [f0],
          dyn: { t: e.timeStamp, x: e.clientX, y: e.clientY, f: f0 },
          lastKept: { x: e.clientX, y: e.clientY },
        }
        setAnnotDraft({ points: [p], pressures: [f0] })
      } else {
        gesture.current = { type: 'annot-erase', pointerId: e.pointerId, began: false }
        eraseAt(pt)
      }
      svg.setPointerCapture(e.pointerId)
      return
    }

    // Armed by a previous Alt+click: THIS press lands the endpoint, wherever it is and whatever
    // sits under it. Pressing the anchor again disarms — an armed state must always be escapable.
    if (aim && !e.altKey) {
      setAim(null)
      setAimTo(null)
    }
    if (aim && e.altKey && e.button === 0) {
      if (Math.hypot(pt.x - aim.from.x, pt.y - aim.from.y) <= AIM_CANCEL_M) {
        setAim(null)
        setAimTo(null)
        return
      }
      gesture.current = {
        type: 'aim',
        pointerId: e.pointerId,
        entityId: aim.entityId,
        from: aim.from,
        minStep: aim.minStep,
        atStep: aim.atStep,
        to: pt,
      }
      setAimTo(pt)
      svg.setPointerCapture(e.pointerId)
      return
    }

    const pressToken = (entityId: Id, additive = false) => {
      st.returnToAuthoringStart()
      // Second click on a LOOSE ball, still within the double-click window → slingshot aim.
      // A held ball never slings — see the inert-drag rule just below.
      if (entityId === doc.ball.id && e.button === 0) {
        const prev = lastBallPressRef.current
        const now = performance.now()
        const isDouble =
          prev !== null &&
          now - prev.at <= DOUBLE_CLICK_MS &&
          Math.hypot(e.clientX - prev.x, e.clientY - prev.y) <= 8
        lastBallPressRef.current = { at: now, x: e.clientX, y: e.clientY }
        const heldBy =
          resolved.ball.holderId ?? (ui.playback.t === 0 ? doc.ball.initialHolderId : undefined)
        if (isDouble && !heldBy) {
          lastBallPressRef.current = null // a sling consumes the pair; no cycling, no triple
          st.select([entityId])
          gesture.current = {
            type: 'sling',
            pointerId: e.pointerId,
            ballAt: { ...resolved.ball.pos },
            pointer: pt,
            started: false,
            startClient: { x: e.clientX, y: e.clientY },
          }
          svg.setPointerCapture(e.pointerId)
          return
        }
      }
      const wasSelected = st.selection.includes(entityId)
      // Ctrl+press ADDS to the selection (user 2026-08-20); a plain press on a non-member replaces
      // it; grabbing a member keeps the multi-selection (group drag).
      if (!wasSelected) st.select(additive ? [...st.selection, entityId] : [entityId])
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
      const hid = doc.ball.initialHolderId
      setPressedId(entityId)
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
        additive,
        wasSelected,
        ballOrigin:
          hid && group.has(hid) && !group.has(doc.ball.id) ? { ...doc.ball.home } : undefined,
      }
      svg.setPointerCapture(e.pointerId)
    }

    // Geometric candidates replace DOM paint-order routing (PLAN-007 M1). Interactive DOM
    // controls (badge, picker) were already handled above; everything else is picked from
    // positions, so overlapping siblings all compete on distance — not on z-order.
    // pickNowRef carries the current render's inputs (assigned in an effect after they exist).
    const livePlayers = doc.players.map((pl) => ({
      id: pl.id,
      pos: resolved.players[pl.id]?.pos ?? pl.home,
    }))
    const liveBall = { id: doc.ball.id, pos: resolved.ball.pos }
    const pick = pickNowRef.current(pt)
    const ov = pick.overlaps
    // FOCUS isolation (user 2026-08-21): while an entity is focused, only ITS ghosts and paths
    // are grabbable — an overlapping stroke of another entity can never steal the press. Live
    // tokens stay clickable (that is how focus switches).
    const inFocus = focusIds.size > 0
    const ghostTop =
      (inFocus ? ov.ghosts.filter((g) => focusIds.has(g.entityId)) : ov.ghosts)[0] ?? null
    const segTop =
      (inFocus ? ov.segments.filter((c) => focusIds.has(c.entityId)) : ov.segments)[0] ?? null
    // Possession pair (golden G1): the historical .9/1.8 comparator, with the t=0 initial-holder
    // fallback (a step-1 pass makes the resolved status 'travel' at rest).
    const pressHolderId =
      resolved.ball.holderId ?? (ui.playback.t === 0 ? doc.ball.initialHolderId : undefined)
    let tokenEntityId: Id | null = null
    if (ov.ball && pressHolderId && resolved.players[pressHolderId]) {
      const hp = resolved.players[pressHolderId]!.pos
      tokenEntityId =
        resolvePossessionPair(pt, resolved.ball.pos, hp) === 'holder' ? pressHolderId : doc.ball.id
    } else {
      tokenEntityId = ov.players[0]?.id ?? ov.ball?.id ?? null
    }
    const yieldId = ghostTop ? ghostYieldTarget(pt, livePlayers, liveBall) : null
    /*
     * Which BALL MOMENT this press would name, if it names one at all. A player token says only
     * WHO; a ball token says who AND WHEN, because there is a single ball and it cannot be in two
     * places at once — so the faded ball at the end of step 2 is a genuinely different subject from
     * the live one at the kickoff spot (user 2026-08-22).
     *
     * Computed here, applied inside the cases below: `subjectAtPress()` has to read the PREVIOUS
     * moment (a ball already grabbed is the subject of this click), so the swap comes after it.
     */
    const ghostMoment =
      ghostTop && ghostTop.entityId === doc.ball.id
        ? { step: ghostTop.step, pos: ghostTop.pos }
        : null
    /** The live ball token: step 0 — nothing has happened yet where it stands. */
    const startMoment = () => ({ step: 0, pos: stateAt(compiled, doc, 0).ball.pos })
    const tokenMoment = tokenEntityId === doc.ball.id ? startMoment() : null
    lastPickRef.current = { pick, pt, clientX: e.clientX, clientY: e.clientY }
    const intent = resolvePointerIntent(
      {
        ghost: !!ghostTop,
        segment: !!segTop,
        token: !!tokenEntityId,
        insidePitch: pt.x >= 0 && pt.x <= L && pt.y >= 0 && pt.y <= W,
      },
      { button: e.button, draw: e.altKey, ctrl: e.ctrlKey || e.metaKey },
      {
        liveTokenNearGhost: !!yieldId,
        chainActive: !!chain.current,
        soloSelection: st.selection.length === 1,
      },
    )

    switch (intent) {
      case 'draw-from-ghost': {
        // Next movement starts at that future spot — and must PLAY after it too, or the compiled
        // start attaches to the holder's PAST position (user bug 2026-08-20). Force step >=
        // (source movement's step + 1); the chip only raises it further.
        /*
         * A ghost of ANOTHER entity is a destination — a through ball aims at where a player WILL
         * be. A ghost of the entity being drawn carries no extra information at all: with forking
         * ruled out (v23) the chain can only continue from that entity's END, so WHICH of its
         * faded tokens was clicked is irrelevant and only its identity matters (user 2026-08-22:
         * 어차피 분기도 없는데 왜 처음 토큰만 눌러야 해). Refusing the middle ones was a distinction
         * with nothing behind it.
         *
         * A BALL ghost is the exception, and the reason `ghostMoment` exists: it starts from THAT
         * faded ball, not from where the ball ends up, because grabbing the ball early is how you
         * change your mind about the rest of the play.
         */
        const landFor = subjectAtPress() ?? undefined
        if (ghostMoment) ballMomentRef.current = ghostMoment
        startDraw(
          ghostTop!.entityId,
          e.pointerId,
          ghostMoment ? ghostMoment.pos : entityRestPos(ghostTop!.entityId),
          undefined,
          landFor,
          true,
          ghostMoment ? ghostMoment.step + 1 : undefined,
        )
        return
      }
      case 'draw-to-point': {
        // The selection already named the subject; this press only says WHERE. Start from where
        // that entity currently ends up, which is the same anchor a chained drag would use.
        const subject = st.selection[0]!
        st.returnToAuthoringStart()
        gesture.current = {
          type: 'aim',
          pointerId: e.pointerId,
          entityId: subject,
          ...subjectAnchor(subject),
          to: pt,
        }
        setAimTo(pt)
        svg.setPointerCapture(e.pointerId)
        return
      }
      case 'press-live-token':
        // A live token sits right under the ghost press - the token wins.
        ballMomentRef.current = yieldId === doc.ball.id ? startMoment() : null
        pressToken(yieldId!)
        return
      case 'adjust-ghost-end': {
        // Plain drag on a ghost = fine-tune that movement's end. A CARRIED ball ghost instead
        // ORBITS its holder: the drag slides the ball around the carry ring (user 2026-08-21).
        ballMomentRef.current = ghostMoment
        const segId = ghostTop!.segId
        const f = segId ? findSegment(core.getDocument(), segId) : null
        if (!f || !('path' in f.segment)) return
        const wps = f.segment.path.waypoints
        if (ghostTop!.entityId === doc.ball.id && f.segment.kind === 'move') {
          // carried ball beside a run's junction: pin THIS junction's carry side — the run path
          // and every other junction stay untouched (user 2026-08-21: 중간만 움직여야지)
          const center = wps[wps.length - 1]!.p
          st.returnToAuthoringStart()
          gesture.current = {
            type: 'orbit-carry',
            pointerId: e.pointerId,
            center,
            runSegId: segId!,
            began: false,
          }
          setOrbitGrabSeg(segId!)
          svg.setPointerCapture(e.pointerId)
          return
        }
        if (
          ghostTop!.entityId === doc.ball.id &&
          f.segment.kind === 'travel' &&
          f.segment.receiverId
        ) {
          // RECEIVED pass arrival ghost: orbit around the receiver via the dedicated
          // junction command — the pass curvature and receiver identity stay untouched
          // (ADR-0010 D3; audit S1).
          const tmEnd = compiled.segmentTimes[segId]?.end
          const rs = tmEnd !== undefined ? stateAt(compiled, doc, tmEnd + 0.05) : undefined
          const center = rs?.players[f.segment.receiverId]?.pos
          if (center) {
            st.returnToAuthoringStart()
            st.selectSegment(segId)
            gesture.current = {
              type: 'orbit-receive',
              pointerId: e.pointerId,
              center,
              travelSegId: segId!,
              startClient: { x: e.clientX, y: e.clientY },
              began: false,
            }
            setOrbitGrabSeg(segId!)
            svg.setPointerCapture(e.pointerId)
            return
          }
        }
        st.returnToAuthoringStart()
        st.selectSegment(segId)
        gesture.current = {
          type: 'bend',
          segmentId: segId!,
          entityId: f.track.entityId,
          pointerId: e.pointerId,
          startClient: { x: e.clientX, y: e.clientY },
          startPt: pt,
          started: false,
          wpId: wps[wps.length - 1]!.id,
        }
        svg.setPointerCapture(e.pointerId)
        return
      }
      case 'draw-chain': {
        // Unbroken Alt chain: this press continues the zigzag from the last end.
        const entityId = chain.current!.entityId
        startDraw(entityId, e.pointerId, lastKnownPosition(core.getDocument(), entityId))
        return
      }
      case 'draw-from-token': {
        /*
         * Alt+DRAG on a token draws that token's own movement — unchanged. Alt+CLICK on it is the
         * other half of an aim: a pass has to be able to END on a player, and reading this press as
         * "draw from here" instead re-armed the receiver and left the ball's chain in two pieces
         * (user 2026-08-22). Which one it was is only knowable at release, so the standing subject
         * rides along and `endGesture` decides. A GHOST is left out on purpose: naming a future
         * start is the only thing clicking one can mean.
         */
        st.returnToAuthoringStart()
        const entityId = tokenEntityId!
        const landFor = subjectAtPress() ?? undefined
        ballMomentRef.current = tokenMoment
        const startPos =
          entityId === doc.ball.id ? resolved.ball.pos : (resolved.players[entityId]?.pos ?? pt)
        startDraw(
          entityId,
          e.pointerId,
          startPos,
          undefined,
          landFor,
          undefined,
          tokenMoment ? tokenMoment.step + 1 : undefined,
        )
        return
      }
      case 'press-token':
        ballMomentRef.current = tokenMoment
        pressToken(tokenEntityId!)
        return
      case 'press-token-additive':
        ballMomentRef.current = tokenMoment
        pressToken(tokenEntityId!, true)
        return
      case 'bend-path': {
        // Path drag is ALWAYS bend (C-01) - group moves use live token drags only.
        const segmentId = segTop!.segId
        st.selectSegment(segmentId)
        gesture.current = {
          type: 'bend',
          segmentId,
          entityId: segTop!.entityId,
          pointerId: e.pointerId,
          startClient: { x: e.clientX, y: e.clientY },
          startPt: pt,
          started: false,
          wpId: null,
        }
        svg.setPointerCapture(e.pointerId)
        return
      }
      case 'marquee': {
        // Shift+marquee ADDS the boxed entities to the current selection (user 2026-08-20).
        const additive = e.shiftKey
        if (!additive) st.clearSelection()
        gesture.current = { type: 'marquee', pointerId: e.pointerId, a: pt, b: pt, additive }
        svg.setPointerCapture(e.pointerId)
        return
      }
      case 'add-home-player':
      case 'add-away-player':
        // Ctrl+click is the EXPLICIT placement gesture (ADR-0009), so it always drops a player on
        // the first click — even mid-edit (user 2026-08-21: 한 번 클릭에 생겨야). Ending an edit is
        // the PLAIN click's job: that resolves to 'marquee', which clears the selection below.
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

  const updateHoverRef = useRef<(e: RPointerEvent<SVGSVGElement>) => void>(() => {})

  const onPointerMove = (e: RPointerEvent<SVGSVGElement>) => {
    const g = gesture.current
    if (!g || g.pointerId !== e.pointerId) {
      if (!g) {
        // armed (or Alt held over a selection): the rubber band follows the cursor, so what the
        // next click will do is visible before it happens
        if (aimRef.current || quickAimRef.current) {
          const sv = svgRef.current
          if (sv) setAimTo(clampToPitch(clientToPitch(sv, e.clientX, e.clientY), doc.pitch))
        }
        updateHoverRef.current(e)
      }
      return
    }
    const svg = svgRef.current
    if (!svg) return
    const pt = clientToPitch(svg, e.clientX, e.clientY)
    const st = useUiStore.getState()

    if (g.type === 'annot-pen') {
      // Pressure updates on EVERY event (VIC widthFactor); the point is kept only past the
      // 2px gate — so speed keeps affecting thickness even between kept samples.
      const dt = e.timeStamp - g.dyn.t
      const f =
        e.pointerType === 'pen'
          ? smoothPressure(g.dyn.f, mapPenPressure(e.pressure), dt)
          : mouseSpeedPressure(g.dyn.f, Math.hypot(e.clientX - g.dyn.x, e.clientY - g.dyn.y), dt)
      g.dyn = { t: e.timeStamp, x: e.clientX, y: e.clientY, f }
      const keptDist = Math.hypot(e.clientX - g.lastKept.x, e.clientY - g.lastKept.y)
      if (keptDist >= MIN_POINT_DIST_PX) {
        g.points.push(clampToView(pt, view))
        g.pressures.push(f)
        g.lastKept = { x: e.clientX, y: e.clientY }
        setAnnotDraft({ points: [...g.points], pressures: [...g.pressures] })
      }
      return
    }
    if (g.type === 'annot-erase') {
      eraseAt(pt)
      return
    }

    if (g.type === 'orbit-carry') {
      if (!g.began) {
        g.began = true
        core.begin('Set carry side')
      }
      const off = carryOffset({ x: pt.x - g.center.x, y: pt.y - g.center.y })
      core.update((d) => {
        const doc2 = d as TacticDocument
        const f2 = findSegment(doc2, g.runSegId)
        if (f2 && f2.segment.kind === 'move') f2.segment.carryEnd = off
      })
      return
    }

    if (g.type === 'orbit-receive') {
      if (!g.began) {
        const moved = Math.hypot(e.clientX - g.startClient.x, e.clientY - g.startClient.y)
        if (moved < DRAG_THRESHOLD_PX) return
        g.began = true
        core.begin('Set receive side')
      }
      const off = carryOffset({ x: pt.x - g.center.x, y: pt.y - g.center.y })
      const target = { x: g.center.x + off.x, y: g.center.y + off.y }
      core.update((d) => moveTravelEndInDraft(d as TacticDocument, g.travelSegId, target, g.center))
      return
    }

    if (g.type === 'marquee') {
      g.b = pt
      setMarquee({ a: g.a, b: g.b })
      return
    }

    if (g.type === 'bend') {
      if (!g.started) {
        const moved = Math.hypot(e.clientX - g.startClient.x, e.clientY - g.startClient.y)
        if (moved < BEND_START_PX) return
        g.started = true
        st.returnToAuthoringStart()
        core.begin('Bend path')
        core.update((d) => {
          g.wpId = bendGrabWaypointInDraft(
            d as TacticDocument,
            g.segmentId,
            clampToPitch(g.startPt, doc.pitch),
          )
        })
      }
      if (g.wpId) {
        const target = clampToPitch(pt, doc.pitch)
        core.update((d) =>
          bendMoveWaypointInDraft(d as TacticDocument, g.segmentId, g.wpId!, target),
        )
      }
      return
    }

    if (g.type === 'add') {
      const moved = Math.hypot(e.clientX - g.startClient.x, e.clientY - g.startClient.y)
      if (moved > DRAG_THRESHOLD_PX * 2) gesture.current = null // a drag on grass is not an add
      return
    }

    if (g.type === 'sling') {
      g.pointer = pt
      if (
        !g.started &&
        Math.hypot(e.clientX - g.startClient.x, e.clientY - g.startClient.y) > DRAG_THRESHOLD_PX
      )
        g.started = true
      if (!g.started) return
      // The line is a POWER meter: it mirrors the pull, and the ball carries past its tip
      // (user 2026-08-21: 이동거리라고 하지 말고 힘의 세기라고 … 저것보다 더 나가는거지).
      const v = slingVelocity(g.ballAt, pt)
      setSlingAim(v ? { from: g.ballAt, to: slingAimEnd(g.ballAt, pt, doc.pitch) } : null)
      return
    }

    if (g.type === 'aim') {
      // same snapping as a stroke's release, so landing "on" a target is equally unambiguous
      let p = clampToPitch(pt, doc.pitch)
      const t2 = nearestSnapTarget(p, g.entityId)
      if (t2) {
        p = t2
        setSnapPos(t2)
      } else setSnapPos(null)
      g.to = p
      setAimTo(p)
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
    if (g.started) cycleRef.current = null
    if (!g.started) {
      const dx = e.clientX - g.startClient.x
      const dy = e.clientY - g.startClient.y
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return
      g.started = true
      core.begin(g.id === doc.ball.id ? 'Move ball' : 'Move player')
    }
    g.lastPt = pt
    let raw = clampToPitch({ x: pt.x + g.grab.x, y: pt.y + g.grab.y }, doc.pitch)
    if (g.group.size > 1 || g.id !== doc.ball.id) {
      /*
       * TWO meanings, told apart by the SIZE of the selection (user 2026-08-22):
       *
       *  · a GROUP (marquee / Ctrl-picked) relocates as a unit — homes and whole authored paths
       *    translate in parallel so every curve keeps its exact shape. This is what the 2026-08-20
       *    report ("곡선 경로를 가진 선수를 옮기면 경로가 과도하게 꺾임", CHG-065 ②) asked for, and
       *    it stays the behaviour for group moves.
       *  · ONE token moves that ONE anchor. Dragging a player's starting spot used to drag their
       *    entire future with it, which made "put this player five metres wider" impossible without
       *    redrawing the run. It is now the exact mirror of dragging a ghost — that adjusts the END
       *    of a movement, this adjusts its START — so both ends of a run are editable the same way.
       *
       * Anything anchored AT the old spot follows (the run that starts there, the pass launched
       * from there); everything downstream stays put, which is the point.
       */
      const prev = g.prevRaw ?? g.group.get(g.id) ?? g.home
      const inc = { x: raw.x - prev.x, y: raw.y - prev.y }
      const rigid = g.group.size > 1
      g.prevRaw = raw
      core.update((d) => {
        const doc2 = d as TacticDocument
        const ballInGroup = g.group.has(doc2.ball.id)
        for (const [id] of g.group) {
          if (id === doc2.ball.id) {
            doc2.ball.home = { x: doc2.ball.home.x + inc.x, y: doc2.ball.home.y + inc.y }
            if (rigid) shiftEntityPathsInDraft(doc2, id, inc)
            continue
          }
          const pl = doc2.players.find((x) => x.id === id)
          const from = pl ? { ...pl.home } : null
          if (pl) pl.home = { x: pl.home.x + inc.x, y: pl.home.y + inc.y }
          if (rigid) {
            shiftEntityPathsInDraft(doc2, id, inc)
            // future-ball anchors of this player (skip when the ball track itself is in the group)
            if (!ballInGroup) shiftBallAnchorsForPlayerInDraft(doc2, id, inc)
          } else if (from) {
            // only what was pinned to the OLD starting spot comes along
            shiftJunctionAnchorsInDraft(doc2, id, '', from, inc)
          }
        }
        // The resting held ball keeps its chosen side of the dragged holder.
        if (g.ballOrigin && !ballInGroup)
          doc2.ball.home = { x: doc2.ball.home.x + inc.x, y: doc2.ball.home.y + inc.y }
      })
      st.setDrag({ id: g.id, grab: g.grab, raw, guides: [], snapped: false })
      return
    }
    // Ball alone: absolute move; the drop decides holder/loose in endGesture.
    // Near its HOLDER the drag ORBITS the carry ring (user 2026-08-21 사진2): pick the side
    // without disturbing the pass shape. The two meanings — orbit vs take the ball away — read as
    // one gesture unless the boundary is visible, so the drag now DRAWS the detach ring and holds
    // its state with hysteresis (user 2026-08-21: 기능이 동일한데 어떻게 하면 좋을까).
    const holderId0 = doc.ball.initialHolderId
    const holderHome0 = holderId0 ? doc.players.find((pl) => pl.id === holderId0)?.home : undefined
    // Velocity is sampled from the FREE pointer path, never the ring-snapped one: orbiting sweeps
    // the snapped point around the holder fast enough to read as a throw on release.
    g.samples = g.samples ?? []
    g.samples.push({ t: e.timeStamp, x: raw.x, y: raw.y })
    if (g.samples.length > 12) g.samples.shift()
    if (holderHome0) {
      const dist = Math.hypot(raw.x - holderHome0.x, raw.y - holderHome0.y)
      if (!g.detached && dist > CARRY_DETACH_M) g.detached = true
      else if (g.detached && dist < CARRY_REATTACH_M) g.detached = false
      setCarryRing({ at: holderHome0, detached: !!g.detached })
      if (g.detached) setDetachPos(raw)
      else {
        setDetachPos(null)
        const off = carryOffset({ x: raw.x - holderHome0.x, y: raw.y - holderHome0.y })
        raw = { x: holderHome0.x + off.x, y: holderHome0.y + off.y }
      }
    }
    const origin = g.group.get(g.id) ?? g.home
    const delta = { x: raw.x - origin.x, y: raw.y - origin.y }
    // who would RECEIVE the ball if dropped here (attach range) — light them up
    const over = doc.players
      .map((pl) => ({ id: pl.id, dist: Math.hypot(pl.home.x - raw.x, pl.home.y - raw.y) }))
      .filter((x) => x.dist <= ATTACH_RADIUS_M)
      .sort((a, b) => a.dist - b.dist)[0]
    setDropTargetId((prev) => (prev === (over?.id ?? null) ? prev : (over?.id ?? null)))
    core.update((d) => {
      const doc2 = d as TacticDocument
      if (holderId0 && holderHome0 && !g.detached) {
        /*
         * ORBITING a held ball: what changes is the carry SIDE, and that lives on the possession,
         * not on `ball.home`. Writing only the home moved nothing on screen the moment a pass
         * existed — from then on an explicit `possessed.offset` governs the render and the home is
         * ignored, so the ball sat still until the drag crossed the ring and the detach override
         * took over (user 2026-08-22: 원형 점선 바깥으로 나가니까 그제서야 움직여). This is the
         * same call the drop already makes, so the live preview and the committed result are the
         * same code rather than two that have to agree.
         */
        moveBallStartInDraft(doc2, raw, holderId0)
        return
      }
      setEntityHome(doc2, g.id, { x: origin.x + delta.x, y: origin.y + delta.y })
      // NOTE: initialHolderId is NOT touched mid-drag while DETACHED — the commit
      // (moveBallStartInDraft) decides holder/loose. Deleting it here orphaned the possession
      // chain and made passes launch from t=0 (user 2026-08-21: 5단계 공이 초기 위치에서 발사).
    })
    st.setDrag({ id: g.id, grab: g.grab, raw, guides: [], snapped: false })
  }

  const onPointerUp = (e: RPointerEvent<SVGSVGElement>) => {
    const g = gesture.current
    if (!g || g.pointerId !== e.pointerId) return
    endGestureRef.current(true)
  }

  // Dev-only QA hook: headless probes can inspect the real document/compiled state.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    // eslint-disable-next-line no-underscore-dangle
    ;(window as unknown as Record<string, unknown>).__stDoc = doc
    // eslint-disable-next-line no-underscore-dangle
    ;(window as unknown as Record<string, unknown>).__stCompiled = compiled
    // eslint-disable-next-line no-underscore-dangle
    ;(window as unknown as Record<string, unknown>).__stClock = () => useUiStore.getState().playback
  }, [doc, compiled])

  // Geometric pick inputs (PLAN-007 M1): sampled FULL paths, cached by segment identity.
  const pickSegments: PickSegment[] = doc.scenes[0]
    ? sceneTracks(doc).flatMap((tr) =>
        tr.segments
          .filter((sg) => 'path' in sg && !sg.id.startsWith('gen-'))
          .map((sg) => ({
            segId: sg.id,
            entityId: tr.entityId,
            step: stepOf(sg as { step?: number }),
            pts: samplePathPts(sg as { path: Path }),
          })),
      )
    : []

  // ---------- render ----------
  const drag = ui.drag
  const selection = ui.selection
  const isPlaying = ui.playback.playing

  // Arrival arcs (user 2026-08-21): every pass's trimmed arrow tip connects to where the ball
  // actually SETTLES (carried ghost — front-rest / pinned side included) with an arc skirting
  // the receiver's edge at a small padding. Covers single arrivals AND pass→pass relays.
  // Mid-chain passes keep no arrowhead — the arc + next tail read as ONE flow; only the chain's
  // final pass points (user 2026-08-21).
  const passNoHeads = (() => {
    const out: Record<Id, boolean> = {}
    const bt = sceneTracks(doc).find((tr) => tr.entityId === doc.ball.id)
    if (!bt) return out
    const travels = bt.segments.filter((sg) => sg.kind === 'travel' && !sg.id.startsWith('gen-'))
    for (const sg of travels) {
      const tm = compiled.segmentTimes[sg.id]
      if (!tm) continue
      const next = travels.find((n) => {
        if (n.id === sg.id) return false
        const ts = compiled.segmentTimes[n.id]?.start
        return ts !== undefined && ts >= tm.end - 0.02 && ts <= tm.end + 0.15
      })
      if (next) out[sg.id] = true
    }
    return out
  })()

  const passLinks = (() => {
    const out: { d: string }[] = []
    const bt = sceneTracks(doc).find((tr) => tr.entityId === doc.ball.id)
    if (!bt) return out
    for (const sg of bt.segments) {
      if (sg.kind !== 'travel' || sg.id.startsWith('gen-') || !sg.receiverId) continue
      const tm = compiled.segmentTimes[sg.id]
      if (!tm) continue
      const rs = stateAt(compiled, doc, tm.end + 0.05)
      const hp = rs.players[sg.receiverId]?.pos
      if (!hp) continue
      let rest: Vec2 | null = null
      if (rs.ball.holderId === sg.receiverId) {
        rest = rs.ball.pos
      } else {
        // the next pass fires IMMEDIATELY (step boundary): connect to its visible tail instead
        const next = bt.segments.find(
          (n) =>
            n.kind === 'travel' &&
            !n.id.startsWith('gen-') &&
            n.id !== sg.id &&
            (compiled.segmentTimes[n.id]?.start ?? Infinity) >= tm.end - 0.02 &&
            (compiled.segmentTimes[n.id]?.start ?? Infinity) <= tm.end + 0.15,
        )
        if (next && next.kind === 'travel') {
          const lutN = buildPathLUT(next.path)
          const tail = pointAtDistance(lutN, Math.min(0.55, lutN.length / 2))
          if (Math.hypot(tail.x - hp.x, tail.y - hp.y) <= 3.4) rest = tail
        }
      }
      if (!rest) continue
      const lut = buildPathLUT(sg.path)
      const tip = pointAtDistance(lut, Math.max(0, lut.length - 1.15)) // visible arrow tip
      const d1 = Math.hypot(tip.x - hp.x, tip.y - hp.y)
      const d2 = Math.hypot(rest.x - hp.x, rest.y - hp.y)
      if (d1 > 4.2 || d2 > 3.6 || d1 < 0.3 || d2 < 0.3) continue
      const chord = Math.hypot(rest.x - tip.x, rest.y - tip.y)
      if (chord < 0.35) continue // tip already lands on the ball
      // the arc clears the token edge with padding, bowing AWAY from the player
      const r = Math.max((d1 + d2) / 2, 1.35 + 0.55, chord / 2 + 0.05)
      const cross = (tip.x - hp.x) * (rest.y - hp.y) - (tip.y - hp.y) * (rest.x - hp.x)
      const sweep = cross > 0 ? 1 : 0
      out.push({
        d: `M ${tip.x} ${tip.y} A ${r} ${r} 0 0 ${sweep} ${rest.x} ${rest.y}`,
      })
    }
    return out
  })()

  // GOAL during PLAYBACK (user 2026-08-21): an authored pass/shot whose path ENDS inside a goal
  // fires the same net-catch ripple as the fling. Precomputed per document+timings.
  const goalArrivals = (() => {
    const L2 = doc.pitch.length
    const gw = 7.32 / 2
    const top = doc.pitch.width / 2 - gw
    const bot = doc.pitch.width / 2 + gw
    const out: { segId: Id; t: number; pos: Vec2; normal: Vec2; speed: number }[] = []
    const ballTrack = sceneTracks(doc).find((tr) => tr.entityId === doc.ball.id)
    if (!ballTrack) return out
    for (const sg of ballTrack.segments) {
      if (sg.kind !== 'travel' || sg.id.startsWith('gen-')) continue
      const wps = sg.path.waypoints
      const end = wps[wps.length - 1]?.p
      if (!end) continue
      const inMouthY = end.y > top && end.y < bot
      if (!inMouthY) continue
      const leftNet = end.x <= 0.15 && end.x >= -2.5
      const rightNet = end.x >= L2 - 0.15 && end.x <= L2 + 2.5
      if (!leftNet && !rightNet) continue
      const tm = compiled.segmentTimes[sg.id]
      if (!tm) continue
      const prev = wps[wps.length - 2]?.p ?? end
      const dx = end.x - prev.x
      const dy = end.y - prev.y
      const normal =
        Math.abs(dx) >= Math.abs(dy)
          ? { x: Math.sign(dx) || (leftNet ? -1 : 1), y: 0 }
          : { x: 0, y: Math.sign(dy) || 1 }
      const lut = buildPathLUT(sg.path)
      const dur = Math.max(0.05, tm.end - tm.start)
      // authored shots stop AT the net — path speed under-reports; floor at full punch
      const speed = Math.max(18, lut.length / dur)
      out.push({ segId: sg.id, t: tm.end, pos: end, normal, speed })
    }
    return out
  })()
  const firedGoalFx = useRef<Set<Id>>(new Set())
  const prevPlayT = useRef(0)
  useEffect(() => {
    const t2 = ui.playback.t
    const prevT = prevPlayT.current
    if (t2 < prevT - 0.2) firedGoalFx.current.clear() // restart / loop / scrub back
    prevPlayT.current = t2
    // CROSSING detection — the arrival often IS the playback end, where `playing` already
    // flipped false on the same tick; the ripple must still fire.
    for (const g of goalArrivals) {
      if (prevT < g.t && t2 >= g.t && !firedGoalFx.current.has(g.segId)) {
        firedGoalFx.current.add(g.segId)
        fireNetImpact(g)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.playback.t, isPlaying])
  /** Frame is away from the authoring start: playing, paused mid-play, held result, or step preview. */
  const viewingFrame = isPlaying || ui.playback.t > 0
  const draftColor = ui.pathDraft ? entityColorOf(doc, ui.pathDraft.entityId) : ''
  /**
   * Alt held with exactly one entity selected: the selection already names the subject, so the
   * next Alt+click lands the path — no arming click. Previewing it is what makes that discoverable
   * (user 2026-08-22: 굳이 두 번 눌러야 하는 이유가 있어?).
   */
  const stepPickerChip = entityChipOf(
    doc,
    (stepPicker
      ? sceneTracks(doc).find((tr) => tr.segments.some((sg) => sg.id === stepPicker.segId))
          ?.entityId
      : undefined) ?? doc.ball.id,
  )
  const quickAim =
    drawKeyHeld && !aim && ui.selection.length === 1 && !gesture.current
      ? { entityId: ui.selection[0]!, ...subjectAnchor(ui.selection[0]!) }
      : null
  quickAimRef.current = !!quickAim
  quickAimSubjectRef.current = quickAim
  const attachedStart = deriveAttachedPathStart(doc, compiled, ui.selectedSegmentId)

  // A-05a rest hierarchy: paths outside the CURRENT step recede (0.55) but stay readable.
  const stepMuted = !viewingFrame
    ? deriveRestMutedIds(
        sceneTracks(doc).flatMap((tr) =>
          tr.segments
            .filter((sg) => 'path' in sg && !sg.id.startsWith('gen-'))
            .map((sg) => ({ id: sg.id, step: stepOf(sg as { step?: number }) })),
        ),
        ui.currentStep,
        ui.selectedSegmentId,
      )
    : undefined

  // A-03: how many players are running right now (bob attenuation input).
  const movingCount = isPlaying
    ? doc.players.reduce((n, p) => n + (resolved.players[p.id]?.moving ? 1 : 0), 0)
    : 0

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
    ? sceneTracks(doc)
        .flatMap((tr) => {
          const segs = tr.segments.filter((sg) => 'path' in sg && !sg.id.startsWith('gen-'))
          return segs.flatMap((sg) => {
            const path = (sg as { path: { waypoints: { p: Vec2 }[] } }).path
            const end = path.waypoints[path.waypoints.length - 1]!.p
            const srcStep = stepOf(sg as { step?: number })
            const rank = usedSteps.indexOf(srcStep)
            const opacity = ghostOpacityForStep(
              rank < 0 ? 0 : rank,
              selection.includes(tr.entityId),
            )
            // A pass that lands ON a receiver: draw the ball ghost at the receiver's FEET (like a held
            // ball), so the player centre stays grabbable for the receiver's own run.
            const received =
              tr.entityKind === 'ball' &&
              sg.kind === 'travel' &&
              !!(sg as { receiverId?: Id }).receiverId
            // Received ball ghost sits where the engine will hold it (carry angle, 360°).
            let pos = end
            if (received) {
              const tmEnd = compiled.segmentTimes[(sg as { id: Id }).id]?.end
              const after = tmEnd !== undefined ? stateAt(compiled, doc, tmEnd + 0.05) : null
              pos =
                after && after.ball.holderId ? after.ball.pos : { x: end.x + 1.75, y: end.y + 1.15 }
            }
            const out = [
              {
                id: `${sg.id}-ghost`,
                segId: (sg as { id: Id }).id,
                entityId: tr.entityId,
                kind: tr.entityKind,
                step: srcStep,
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
            // Sample just BEFORE the end (user 2026-08-20): when a pass launches exactly at the
            // boundary (dribble → pass), possession is already released AT tm.end and the carried
            // ghost vanished. −0.05s still sees the holder; the ghost anchors at the true end.
            if (tr.entityKind === 'player') {
              const tm = compiled.segmentTimes[(sg as { id: Id }).id]
              if (tm && Number.isFinite(tm.end)) {
                const rs = stateAt(compiled, doc, Math.max(0, tm.end - 0.05))
                if (rs.ball.holderId === tr.entityId) {
                  // prefer the REST state just after the move (locked side / front-rest); the
                  // −0.05 sample only decides WHO holds (boundary release, CHG-080)
                  const rs2 = stateAt(compiled, doc, tm.end + 0.05)
                  const use = rs2.ball.holderId === tr.entityId ? rs2 : rs
                  const pp = use.players[tr.entityId]?.pos
                  const off = pp
                    ? { x: use.ball.pos.x - pp.x, y: use.ball.pos.y - pp.y }
                    : { x: 1.75, y: 1.15 }
                  out.push({
                    id: `${sg.id}-ball-ghost`,
                    segId: (sg as { id: Id }).id,
                    entityId: doc.ball.id,
                    kind: 'ball' as const,
                    step: srcStep,
                    pos: { x: end.x + off.x, y: end.y + off.y },
                    opacity,
                    number: undefined,
                    color: '#ffffff',
                  })
                }
              }
            }
            return out
          })
        })
        // dedupe ball ghosts that land on the same future spot (received + holder-run overlap)
        .filter((g, i, arr) => {
          if (g.kind !== 'ball') return true
          return !arr
            .slice(0, i)
            .some(
              (h) => h.kind === 'ball' && Math.hypot(h.pos.x - g.pos.x, h.pos.y - g.pos.y) < 0.8,
            )
        })
    : []

  // Step badge sits faintly at the MIDDLE of each path (the end is busy: ghost + arrowhead).
  // placeStepBadges nudges overlapping badges apart deterministically (B-03).
  const focusIds = deriveFocusIds(
    ui.selectedSegmentId,
    ui.selectedSegmentId ? (findSegment(doc, ui.selectedSegmentId)?.track.entityId ?? null) : null,
    doc.ball.id,
    isPlaying,
  )

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
  const badgeObstacles: Vec2[] = [
    ...doc.players.map((p) => resolved.players[p.id]?.pos ?? p.home),
    resolved.ball.pos,
    ...ghosts.map((g) => g.pos),
  ]
  const badgeSpots = new Map(
    placeStepBadges(badgeAnchors, 2.6, badgeObstacles).map((b) => [b.id, b.at]),
  )
  const badges = badgeAnchors.map((b) => ({ ...b, end: badgeSpots.get(b.id) ?? b.at }))

  // PLAN-007: pick with the CURRENT render's inputs (hover rAF + cycling reuse this).
  const pickNowRef = useRef<(pt: Vec2) => ReturnType<typeof pickTargets>>(() => ({
    ordered: [],
    overlaps: { players: [], ball: null, ghosts: [], segments: [] },
    fingerprint: '',
  }))
  useEffect(() => {
    pickNowRef.current = (pt: Vec2) => {
      const svg = svgRef.current
      const width = svg ? svg.getBoundingClientRect().width : 1
      return pickTargets({
        players: doc.players.map((pl) => ({
          id: pl.id,
          pos: resolved.players[pl.id]?.pos ?? pl.home,
        })),
        ball: { id: doc.ball.id, pos: resolved.ball.pos },
        ghosts: viewingFrame
          ? []
          : ghosts.map((g) => ({
              entityId: g.entityId,
              segId: g.segId,
              kind: g.kind === 'ball' ? ('ball' as const) : ('player' as const),
              pos: g.pos,
              step: g.step,
            })),
        segments: pickSegments,
        pt,
        metresPerPixel: view.w / Math.max(1, width),
        currentStep: ui.currentStep,
        selection: ui.selection,
        selectedSegmentId: ui.selectedSegmentId,
      })
    }
    updateHoverRef.current = (e) => {
      // mouse only, authoring frame only, never during a gesture or a press (CR-07 conditions)
      if (e.pointerType !== 'mouse' || viewingFrame || pressedId) return
      if (ui.annotate.on && ui.annotate.tool !== 'select') return
      const svgEl = svgRef.current
      if (!svgEl) return
      hoverPt.current = clientToPitch(svgEl, e.clientX, e.clientY)
      if (hoverRaf.current !== null) return // coalesce to one pick per frame
      hoverRaf.current = requestAnimationFrame(() => {
        hoverRaf.current = null
        const hp = hoverPt.current
        if (!hp || gesture.current) return
        const top = pickNowRef.current(hp).ordered[0] ?? null
        const key = top
          ? top.kind === 'ghost'
            ? `ghost:${top.segId}:${top.entityId}`
            : top.kind === 'segment'
              ? `segment:${top.segId}`
              : `${top.kind}:${top.id}`
          : null
        setHoverKey((prev) => (prev === key ? prev : key))
      })
    }
  })

  return (
    <svg
      ref={svgRef}
      className={styles.stage}
      viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
      role="application"
      aria-label="Tactical pitch"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => endGestureRef.current(false)}
      onPointerLeave={() => setHoverKey(null)}
      onContextMenu={(e) => e.preventDefault()}
      style={
        ui.annotate.on && ui.annotate.tool !== 'select'
          ? { cursor: ui.annotate.tool === 'eraser' ? ERASER_CURSOR : 'crosshair' }
          : undefined
      }
    >
      <PitchMarkings pitch={doc.pitch} />
      <defs>
        {/* the cloth lives INSIDE the netting area (plus stretch room), never on the field */}
        <clipPath id="net-clip-left">
          <rect x={-3.6} y={W / 2 - 3.66 - 1.6} width={3.8} height={7.32 + 3.2} />
        </clipPath>
        <clipPath id="net-clip-right">
          <rect x={L - 0.2} y={W / 2 - 3.66 - 1.6} width={3.8} height={7.32 + 3.2} />
        </clipPath>
      </defs>
      {netFx &&
        (() => {
          const gTop = W / 2 - 3.66
          const gBot = W / 2 + 3.66
          const backX = netFx.side === 'left' ? -1.85 : L + 1.85
          const postX = netFx.side === 'left' ? 0 : L
          const bulge = netAmp * netFx.strength * 1.5
          const outX = netFx.side === 'left' ? -bulge : bulge
          // anchors sit ON the goal frame (posts / back stanchions) — the cloth is pinned there
          let a: Vec2
          let b: Vec2
          let cx: number
          let cy: number
          if (netFx.wall === 'back') {
            a = { x: backX, y: gTop }
            b = { x: backX, y: gBot }
            cx = backX + outX
            cy = netFx.iy
          } else if (netFx.wall === 'top') {
            a = { x: postX, y: gTop }
            b = { x: backX, y: gTop }
            cx = netFx.ix
            cy = gTop - bulge
          } else {
            a = { x: postX, y: gBot }
            b = { x: backX, y: gBot }
            cx = netFx.ix
            cy = gBot + bulge
          }
          const line = (f: number, k: string) => (
            <path
              key={k}
              className={styles.netCloth}
              d={`M ${a.x} ${a.y} Q ${a.x + (cx - a.x) * f} ${a.y + (cy - a.y) * f} ${(a.x + b.x) / 2 + (cx - (a.x + b.x) / 2) * f} ${(a.y + b.y) / 2 + (cy - (a.y + b.y) / 2) * f} T ${b.x} ${b.y}`}
            />
          )
          return (
            <g
              clipPath={netFx.side === 'left' ? 'url(#net-clip-left)' : 'url(#net-clip-right)'}
              opacity={Math.max(0, Math.min(0.95, Math.abs(netAmp) * 4 + 0.35))}
            >
              <rect
                key={`flash-${netFx.key}`}
                className={styles.netFlash}
                x={netFx.side === 'left' ? -2 : L - 0.2}
                y={gTop}
                width={2.2}
                height={7.32}
              />
              {line(1, 'c1')}
              {line(0.66, 'c2')}
              {line(0.38, 'c3')}
            </g>
          )
        })()}
      <DrawingLayer drawings={doc.drawings} selectedIds={ui.selectedDrawingIds} t={ui.playback.t} />
      {annotDraft && (
        <g pointerEvents="none">
          <PenStroke
            points={annotDraft.points}
            pressures={annotDraft.pressures}
            color={ui.annotate.color}
            width={ui.annotate.width}
          />
        </g>
      )}
      {/* Routes hidden while the animation runs (user 2026-08-20): the moving tokens ARE the play. */}
      <g className={isPlaying ? styles.decorHidden : styles.decorShown}>
        <PathLayer
          doc={doc}
          teamColorOf={(pid) => teamColorOf(doc, pid)}
          selectedEntityIds={focusIds.size > 0 ? [...focusIds] : selection}
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
          dimOthers={focusIds.size > 0}
          pathPhase={viewingFrame ? pathPhase : undefined}
          stepMuted={stepMuted}
          hoverSegmentId={hoverKey?.startsWith('segment:') ? hoverKey.slice(8) : null}
          noHeadIds={passNoHeads}
        />
        {/* relay arcs: the dashed flow continues around the holder instead of breaking */}
        {passLinks.map((l, i) => (
          <path key={i} d={l.d} className={styles.passLink} />
        ))}
      </g>
      {/* step badges - kept mounted, faded out while viewing a frame (D-02) */}
      <g className={viewingFrame ? styles.decorHidden : styles.decorShown}>
        {badges.map((b) => (
          <g
            key={b.id}
            className={styles.stepBadge}
            style={
              {
                opacity: focusIds.size > 0 && !focusIds.has(b.entityId) ? 0.25 : undefined,
                '--st-entity-chip': entityChipOf(doc, b.entityId).fill,
              } as CSSProperties
            }
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
            {/* the badge labels ONE entity's movement — same rule as its path and waypoints */}
            <circle r={1.35} />
            <text textAnchor="middle" dominantBaseline="central">
              {b.step}
            </text>
          </g>
        ))}
      </g>
      {doc.players.map((p, pi) => {
        const rp = resolved.players[p.id]
        // Bouncy run feel (user 2026-08-20): a tiny deterministic bob derived from TACTICAL time —
        // pure f(t), so scrubbing/replay stay exact and the engine stays untouched.
        // A-03 compromise: amplitude auto-attenuates when MANY players run at once (22-player calm).
        const bobAmp = movingCount <= 4 ? 0.22 : Math.max(0.08, 0.22 * (4 / movingCount))
        const bob =
          rp?.moving && isPlaying ? -Math.abs(Math.sin(ui.playback.t * 6.5 + pi * 1.3)) * bobAmp : 0
        const pos0 = rp?.pos ?? p.home
        return (
          <g
            key={p.id}
            className={focusIds.size > 0 && !focusIds.has(p.id) ? styles.tokenFocusDim : undefined}
          >
            <AnimatedToken
              id={p.id}
              kind="player"
              pos={bob ? { x: pos0.x, y: pos0.y + bob } : pos0}
              awayKeyline={p.teamId === doc.teams[1]?.id}
              color={teamColorOf(doc, p.id)}
              number={p.number}
              label={p.label && p.role ? `${p.label}(${p.role})` : (p.label ?? p.role)}
              selected={selection.includes(p.id) || dropTargetId === p.id}
              hovered={hoverKey === `player:${p.id}`}
              dragging={drag?.id === p.id}
              pressed={pressedId === p.id && drag?.id !== p.id}
              heading={rp?.heading}
              moving={!!rp?.moving && isPlaying}
              dropFrom={null}
              dropKey={0}
              pulseKey={pulses[p.id]}
            />
          </g>
        )
      })}
      <AnimatedToken
        id={doc.ball.id}
        kind="ball"
        pos={flingPos?.pos ?? detachPos ?? resolved.ball.pos}
        height={resolved.ball.height}
        spin={flingPos ? flingPos.spin : resolved.ball.spin}
        ballStatus={
          detachPos
            ? 'loose'
            : resolved.ball.status === 'travel' && ui.playback.t === 0 && !isPlaying
              ? 'possessed'
              : resolved.ball.status
        }
        holderColor={(() => {
          if (detachPos) return undefined // off his feet the moment the ring is crossed
          const hid =
            resolved.ball.holderId ??
            (ui.playback.t === 0 && !isPlaying ? doc.ball.initialHolderId : undefined)
          return hid ? teamColorOf(doc, hid) : undefined
        })()}
        selected={selection.includes(doc.ball.id)}
        hovered={hoverKey === `ball:${doc.ball.id}`}
        dragging={drag?.id === doc.ball.id}
        pressed={pressedId === doc.ball.id && drag?.id !== doc.ball.id}
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
            style={
              {
                opacity:
                  (drawKeyHeld || hoverKey === `ghost:${g.segId}:${g.entityId}`
                    ? Math.min(0.9, g.opacity + 0.3)
                    : g.opacity) * (focusIds.size > 0 && !focusIds.has(g.entityId) ? 0.25 : 1),
                '--st-entity': g.color,
              } as CSSProperties
            }
            data-ghost={g.entityId}
            data-move-seg={g.segId}
            data-gx={g.pos.x}
            data-gy={g.pos.y}
          >
            {hoverKey === `ghost:${g.segId}:${g.entityId}` && (
              <circle r={g.kind === 'ball' ? 1.35 : 2.1} className={styles.hoverHalo} />
            )}
            {g.kind === 'ball' ? (
              <g
                className={`${styles.ghostBall} ${
                  orbitGrabSeg === g.segId ? styles.ghostGrabbed : ''
                }`}
              >
                {/* small invisible hit halo; visual matches the live ball size */}
                <circle r={1.0} fill="transparent" stroke="none" />
                <circle r={0.68} />
                <circle cx={0} cy={-0.3} r={0.15} className={styles.ghostBallDot} />
                <circle cx={-0.28} cy={0.19} r={0.15} className={styles.ghostBallDot} />
                <circle cx={0.28} cy={0.19} r={0.15} className={styles.ghostBallDot} />
              </g>
            ) : (
              <circle r={1.5} style={{ fill: g.color }} />
            )}
            {g.number !== undefined && (
              <text textAnchor="middle" dominantBaseline="central">
                {g.number}
              </text>
            )}
          </g>
        ))}
      </g>
      {/* The white drag guide is gone with the gesture that produced it: it only ever appeared
          when possession pinned the ball's render away from the pointer, and a held ball no longer
          drags at all (user 2026-08-21: 흰색 안내선 안 나오게). A loose ball follows the cursor, so
          there was never a gap to draw. */}
      {carryRing && (
        /* The boundary between "orbit the holder" and "take the ball away", drawn only while a
           held ball is being dragged. Solid-ish while carrying, faded once the ball is clear. */
        <circle
          cx={carryRing.at.x}
          cy={carryRing.at.y}
          r={CARRY_DETACH_M}
          className={carryRing.detached ? styles.carryRingOut : styles.carryRing}
          aria-hidden="true"
        />
      )}
      {quickAim && !aim && (
        <g
          className={styles.aimGuide}
          aria-hidden="true"
          style={{ '--st-entity': entityColorOf(doc, quickAim.entityId) } as CSSProperties}
        >
          {/* the anchor appears the instant Alt goes down — waiting for the first pointer move
              meant holding Alt showed nothing at all */}
          <circle cx={quickAim.from.x} cy={quickAim.from.y} r={1.15} className={styles.aimAnchor} />
          {aimTo && (
            <>
              <line
                x1={quickAim.from.x}
                y1={quickAim.from.y}
                x2={aimTo.x}
                y2={aimTo.y}
                className={styles.aimLine}
              />
              <circle cx={aimTo.x} cy={aimTo.y} r={0.7} className={styles.aimTip} />
            </>
          )}
        </g>
      )}
      {aim &&
        (() => {
          // The aim depicts THIS entity's next movement, so it is that entity's colour — blue
          // player, blue guide; ball, white guide (user 2026-08-22).
          const c = entityColorOf(doc, aim.entityId)
          return (
            <g
              className={styles.aimGuide}
              aria-hidden="true"
              style={{ '--st-entity': c } as CSSProperties}
            >
              {aimTo && (
                <line
                  x1={aim.from.x}
                  y1={aim.from.y}
                  x2={aimTo.x}
                  y2={aimTo.y}
                  className={styles.aimLine}
                />
              )}
              <circle cx={aim.from.x} cy={aim.from.y} r={1.15} className={styles.aimAnchor} />
              {aimTo && <circle cx={aimTo.x} cy={aimTo.y} r={0.7} className={styles.aimTip} />}
            </g>
          )
        })()}
      {slingAim && (
        <g className={styles.slingAim} aria-hidden="true">
          <line
            x1={slingAim.from.x}
            y1={slingAim.from.y}
            x2={slingAim.to.x}
            y2={slingAim.to.y}
            className={styles.slingAimLine}
          />
          <circle cx={slingAim.to.x} cy={slingAim.to.y} r={0.45} className={styles.slingAimDot} />
        </g>
      )}
      {attachFx &&
        (() => {
          const hp = resolved.players[attachFx.id]?.pos
          return hp ? (
            <g
              key={attachFx.key}
              className={styles.attachFx}
              transform={`translate(${hp.x}, ${hp.y})`}
              onAnimationEnd={() => setAttachFx(null)}
            >
              <circle r={1.9} className={styles.attachFxRing} />
            </g>
          ) : null
        })()}
      {stepPicker && !viewingFrame && (
        <g
          data-step-picker="true"
          className={styles.stepPicker}
          /* the picker edits ONE movement, so its active chip wears that entity's identity */
          style={
            {
              '--st-entity-chip': stepPickerChip.fill,
              '--st-entity-ink': stepPickerChip.ink,
            } as CSSProperties
          }
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
