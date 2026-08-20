import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useEditor, useEditorSnapshot } from '@/editor/EditorContext'
import { useUiStore } from '@/editor/uiStore'
import { t } from '../i18n'
import styles from '../shell.module.css'
import { markTourSeen } from './tourStorage'
import { MINI_TOUR_STEPS, TOUR_STEPS, nextPendingStep, type TourContext } from './tourSteps'

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

const PAD = 8
const CARD_W = 320
const CARD_H = 190
const GAP = 14

/**
 * Interactive first-visit tour: spotlights the REAL element for the current step and advances
 * by itself when the user performs the action (document/ui predicates in tourSteps).
 * Non-blocking — the page stays fully interactive; only the card takes pointer events.
 */
export function TourOverlay() {
  const tour = useUiStore((s) => s.tour)
  const shortcutsOpen = useUiStore((s) => s.shortcutsOpen)
  if (!tour.active || shortcutsOpen) return null
  // key = step index → each step mounts fresh (captures its own entry document, rect, timers).
  return <TourStepView key={`${tour.set}-${tour.step}`} stepIndex={tour.step} stepSet={tour.set} />
}

function TourStepView({ stepIndex, stepSet }: { stepIndex: number; stepSet: 'main' | 'mini' }) {
  const STEPS = stepSet === 'mini' ? MINI_TOUR_STEPS : TOUR_STEPS
  const core = useEditor()
  const { doc } = useEditorSnapshot()
  const hasPlayed = useUiStore((s) => s.hasPlayed)
  const playScope = useUiStore((s) => s.playScope)
  const reducedMotion = useUiStore((s) => s.reducedMotion)
  const setTourStep = useUiStore((s) => s.setTourStep)
  const endTour = useUiStore((s) => s.endTour)

  const step = STEPS[stepIndex] ?? STEPS[STEPS.length - 1]!
  // Document when this step became active — "done" means "changed since you got here".
  const [entry] = useState(doc)
  const ctx: TourContext = { doc, entry, hasPlayed, playScope }
  const done = !step.terminal && step.done(ctx)

  const ctxRef = useRef(ctx)
  useEffect(() => {
    ctxRef.current = ctx
  })

  const advance = useCallback(() => {
    const d = core.getDocument()
    const u = useUiStore.getState()
    const next: TourContext = { playScope: u.playScope, doc: d, entry: d, hasPlayed: u.hasPlayed }
    setTourStep(nextPendingStep(stepIndex + 1, next, STEPS))
  }, [core, setTourStep, stepIndex, STEPS])

  // Auto-advance shortly after the action was performed (the ✓ state shows meanwhile).
  useEffect(() => {
    if (!done) return
    const h = window.setTimeout(advance, reducedMotion ? 0 : 450)
    return () => window.clearTimeout(h)
  }, [done, advance, reducedMotion])

  // Step entry side effects (open a panel, close a popover).
  useEffect(() => {
    step.onEnter?.()
  }, [step])

  // Track the target's bounding box every frame (tokens spring, panels slide).
  const [rect, setRect] = useState<Rect | null>(null)
  const [anchorRect, setAnchorRect] = useState<Rect | null>(null)
  const [avoidRect, setAvoidRect] = useState<Rect | null>(null)
  useEffect(() => {
    let raf = 0
    let last: Rect | null = null
    let lastAnchor: Rect | null = null
    let lastAvoid: Rect | null = null
    let scrolled = false
    const measure = (sel: string | null): Rect | null => {
      const el = sel ? document.querySelector(sel) : null
      if (!el) return null
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0 ? { x: r.x, y: r.y, w: r.width, h: r.height } : null
    }
    const differs = (a: Rect | null, b: Rect | null) =>
      !!a !== !!b ||
      (!!a &&
        !!b &&
        (Math.abs(a.x - b.x) > 0.5 ||
          Math.abs(a.y - b.y) > 0.5 ||
          Math.abs(a.w - b.w) > 0.5 ||
          Math.abs(a.h - b.h) > 0.5))
    const tick = () => {
      const sel = step.target(ctxRef.current)
      if (!scrolled && sel) {
        const el = document.querySelector(sel)
        if (el) {
          scrolled = true
          el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
        }
      }
      const next = measure(sel)
      if (differs(next, last)) {
        last = next
        setRect(next)
      }
      const nextAnchor = step.anchor ? measure(step.anchor(ctxRef.current)) : null
      if (differs(nextAnchor, lastAnchor)) {
        lastAnchor = nextAnchor
        setAnchorRect(nextAnchor)
      }
      const nextAvoid = step.avoid ? measure(step.avoid(ctxRef.current)) : null
      if (differs(nextAvoid, lastAvoid)) {
        lastAvoid = nextAvoid
        setAvoidRect(nextAvoid)
      }
      raf = window.requestAnimationFrame(tick)
    }
    raf = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(raf)
  }, [step])

  const finish = () => {
    markTourSeen()
    endTour()
  }
  const skipStep = () => {
    if (step.terminal) finish()
    else advance()
  }

  const vw = window.innerWidth
  const vh = window.innerHeight
  const spot = rect
    ? { x: rect.x - PAD, y: rect.y - PAD, w: rect.w + PAD * 2, h: rect.h + PAD * 2 }
    : null

  // Card placement relative to the anchor (or the spotlight): 'side' → right/left of it;
  // otherwise below if room, else above, else beside. No target → centred.
  let cardStyle: CSSProperties
  const box = anchorRect
    ? {
        x: anchorRect.x - PAD,
        y: anchorRect.y - PAD,
        w: anchorRect.w + PAD * 2,
        h: anchorRect.h + PAD * 2,
      }
    : spot
  if (box) {
    const clampTop = (y: number) => Math.max(12, Math.min(vh - CARD_H - 12, y))
    const clampLeft = (x: number) => Math.max(12, Math.min(vw - CARD_W - 12, x))
    const fitsRight = box.x + box.w + GAP + CARD_W < vw
    const fitsLeft = box.x - GAP - CARD_W > 0
    const fitsBelow = box.y + box.h + GAP + CARD_H < vh
    const fitsAbove = box.y - GAP - CARD_H > 0
    const right = { left: box.x + box.w + GAP, top: clampTop(box.y + box.h / 2 - CARD_H / 2) }
    const leftP = { left: box.x - GAP - CARD_W, top: clampTop(box.y + box.h / 2 - CARD_H / 2) }
    const below = { left: clampLeft(box.x + box.w / 2 - CARD_W / 2), top: box.y + box.h + GAP }
    const above = { left: clampLeft(box.x + box.w / 2 - CARD_W / 2), top: box.y - GAP - CARD_H }
    const fallback = {
      left: fitsRight ? box.x + box.w + GAP : clampLeft(box.x - GAP - CARD_W),
      top: clampTop(box.y),
    }
    const candidates =
      step.placement === 'side'
        ? [fitsRight && right, fitsLeft && leftP, fitsBelow && below, fitsAbove && above, fallback]
        : [fitsBelow && below, fitsAbove && above, fitsRight && right, fitsLeft && leftP, fallback]
    const overlapsAvoid = (c: { left: number; top: number }) =>
      !!avoidRect &&
      c.left < avoidRect.x + avoidRect.w + PAD &&
      c.left + CARD_W > avoidRect.x - PAD &&
      c.top < avoidRect.y + avoidRect.h + PAD &&
      c.top + CARD_H > avoidRect.y - PAD
    const valid = candidates.filter((c): c is { left: number; top: number } => !!c)
    const pick = valid.find((c) => !overlapsAvoid(c)) ?? valid[0]!
    cardStyle = { left: pick.left, top: pick.top, width: CARD_W }
  } else {
    cardStyle = { left: '50%', top: '42%', transform: 'translate(-50%, -50%)', width: CARD_W }
  }

  const radius = spot ? Math.min(14, spot.h / 2) : 0

  return (
    <div
      className={styles.tourRoot}
      data-tour-step={step.id}
      data-reduced={reducedMotion || undefined}
    >
      <svg className={styles.tourMask} width="100%" height="100%" aria-hidden="true">
        <defs>
          <mask id="st-tour-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="#fff" />
            {spot && (
              <rect
                className={styles.tourCut}
                x={spot.x}
                y={spot.y}
                width={spot.w}
                height={spot.h}
                rx={radius}
                fill="#000"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          className={styles.tourDim}
          mask="url(#st-tour-mask)"
        />
      </svg>
      {spot && (
        <div
          className={`${styles.tourRing} ${done ? styles.tourRingDone : ''}`}
          style={{ left: spot.x, top: spot.y, width: spot.w, height: spot.h, borderRadius: radius }}
          aria-hidden="true"
        />
      )}
      <div
        className={`${styles.tourCard} ${done ? styles.tourCardDone : ''}`}
        style={cardStyle}
        role="dialog"
        aria-label={t('tour.title')}
        aria-live="polite"
      >
        <div className={styles.tourHead}>
          <span className={styles.tourProgress}>
            {t('tour.title')} · {stepIndex + 1}/{STEPS.length}
          </span>
          <button type="button" className={styles.linkBtn} onClick={finish} title={t('tour.skip')}>
            {t('tour.skip')}
          </button>
        </div>
        <div className={styles.tourStepTitle}>
          {done ? '✓ ' : ''}
          {step.title}
        </div>
        <div className={styles.tourBody}>{step.body}</div>
        <div className={styles.tourFoot}>
          {step.kbd ? <span className={styles.kbd}>{step.kbd}</span> : <span />}
          <div className={styles.group}>
            {step.terminal ? (
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={finish}
              >
                {t('tour.finish')}
              </button>
            ) : (
              <button type="button" className={styles.btn} onClick={skipStep}>
                {t('tour.next')}
              </button>
            )}
          </div>
        </div>
        <div className={styles.tourDots} aria-hidden="true">
          {STEPS.map((s, i) => (
            <span
              key={s.id}
              className={`${styles.tourDot} ${i < stepIndex ? styles.tourDotDone : ''} ${i === stepIndex ? styles.tourDotNow : ''}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
