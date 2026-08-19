/**
 * Interface-motion spring (ADR-0006 D1/D2). UI ONLY — never used for tactical motion.
 *
 * Parameterised like Apple's Spring(duration:bounce:):
 *   duration  ≈ perceptual settle time (s)
 *   bounce    0 = critically damped (no overshoot), 0.15 subtle, 0.3 noticeable, <0 overdamped
 *
 * Mapping (mass = 1):
 *   ω = 2π / duration
 *   ζ = 1 - bounce                (bounce ≥ 0)   |   ζ = 1 / (1 + bounce)  (bounce < 0)
 *   stiffness = ω², damping = 2ζω
 *
 * `stepSpring` is pure and deterministic (tests). `SpringAnimator` drives rAF and preserves
 * velocity on retarget (interruptible, "탁 달라붙는" feel).
 */

export interface SpringConfig {
  duration: number
  bounce: number
}

export interface SpringParams {
  stiffness: number
  damping: number
}

export interface SpringState {
  value: number
  velocity: number
}

export const SPRINGS = {
  selection: { duration: 0.18, bounce: 0 },
  tool: { duration: 0.2, bounce: 0 },
  pickup: { duration: 0.22, bounce: 0.1 },
  drop: { duration: 0.35, bounce: 0.25 },
  timelineSnap: { duration: 0.3, bounce: 0.2 },
  panelIn: { duration: 0.3, bounce: 0.1 },
  panelOut: { duration: 0.22, bounce: 0 },
  timelineExpand: { duration: 0.32, bounce: 0.15 },
  miniBar: { duration: 0.24, bounce: 0.15 },
  toast: { duration: 0.4, bounce: 0.3 },
} as const satisfies Record<string, SpringConfig>

export function springParams({ duration, bounce }: SpringConfig): SpringParams {
  const d = Math.max(0.01, duration)
  const omega = (2 * Math.PI) / d
  const zeta = bounce >= 0 ? Math.max(0, 1 - bounce) : 1 / (1 + bounce)
  return { stiffness: omega * omega, damping: 2 * zeta * omega }
}

/** Advance one step (semi-implicit Euler, sub-stepped for stability). Pure. */
export function stepSpring(
  state: SpringState,
  target: number,
  dt: number,
  params: SpringParams,
): SpringState {
  let { value, velocity } = state
  const maxStep = 1 / 240
  let remaining = Math.min(dt, 0.1)
  while (remaining > 0) {
    const h = Math.min(maxStep, remaining)
    const accel = -params.stiffness * (value - target) - params.damping * velocity
    velocity += accel * h
    value += velocity * h
    remaining -= h
  }
  return { value, velocity }
}

export function isSettled(state: SpringState, target: number, eps = 0.001, veps = 0.01): boolean {
  return Math.abs(state.value - target) < eps && Math.abs(state.velocity) < veps
}

/** Simulate until settled; returns trajectory (tests / debugging). */
export function simulate(
  from: number,
  to: number,
  config: SpringConfig,
  dt = 1 / 60,
  maxT = 5,
): { t: number; value: number }[] {
  const params = springParams(config)
  let s: SpringState = { value: from, velocity: 0 }
  const out = [{ t: 0, value: from }]
  for (let t = dt; t <= maxT; t += dt) {
    s = stepSpring(s, to, dt, params)
    out.push({ t, value: s.value })
    if (isSettled(s, to)) break
  }
  return out
}

type Frame = (cb: (now: number) => void) => number
type Cancel = (h: number) => void

export interface SpringAnimatorOptions {
  onUpdate: (value: number) => void
  onRest?: () => void
  /** Injected for tests; defaults to requestAnimationFrame. */
  raf?: Frame
  caf?: Cancel
  now?: () => number
  /** Skip animation (reduced motion): jump to target immediately. */
  immediate?: () => boolean
}

export class SpringAnimator {
  private state: SpringState
  private target: number
  private params: SpringParams
  private handle: number | null = null
  private last = 0
  private readonly raf: Frame
  private readonly caf: Cancel
  private readonly now: () => number

  private readonly opts: SpringAnimatorOptions

  constructor(initial: number, config: SpringConfig, opts: SpringAnimatorOptions) {
    this.opts = opts
    this.state = { value: initial, velocity: 0 }
    this.target = initial
    this.params = springParams(config)
    this.raf = opts.raf ?? ((cb) => requestAnimationFrame(cb))
    this.caf = opts.caf ?? ((h) => cancelAnimationFrame(h))
    this.now = opts.now ?? (() => performance.now())
  }

  get value(): number {
    return this.state.value
  }

  setConfig(config: SpringConfig): void {
    this.params = springParams(config)
  }

  /** Retarget, preserving current velocity (interruptible). */
  to(target: number, opts: { velocity?: number; immediate?: boolean } = {}): void {
    this.target = target
    if (opts.velocity !== undefined) this.state.velocity = opts.velocity
    if (opts.immediate || this.opts.immediate?.()) {
      this.jump(target)
      return
    }
    if (this.handle === null) {
      this.last = this.now()
      this.handle = this.raf(this.tick)
    }
  }

  /** Set value without animating. */
  jump(value: number): void {
    this.stop()
    this.state = { value, velocity: 0 }
    this.target = value
    this.opts.onUpdate(value)
    this.opts.onRest?.()
  }

  stop(): void {
    if (this.handle !== null) {
      this.caf(this.handle)
      this.handle = null
    }
  }

  private tick = (now: number): void => {
    const dt = Math.max(0, (now - this.last) / 1000)
    this.last = now
    this.state = stepSpring(this.state, this.target, dt, this.params)
    if (isSettled(this.state, this.target)) {
      this.state = { value: this.target, velocity: 0 }
      this.handle = null
      this.opts.onUpdate(this.target)
      this.opts.onRest?.()
      return
    }
    this.opts.onUpdate(this.state.value)
    this.handle = this.raf(this.tick)
  }
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
