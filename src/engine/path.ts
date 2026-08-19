/**
 * Path geometry (ADR-0003): polyline / cubic-bezier waypoints → arc-length lookup table.
 * Pure. Deterministic. No DOM.
 */
import type { Path, Vec2, Waypoint } from '@/domain/types'
import { distance, lerp } from './vec'

export interface PathLUT {
  /** Total arc length (m). */
  length: number
  /** Sample points along the path (≥ 2). */
  pts: Vec2[]
  /** Cumulative arc length at each sample; cum[0] = 0, cum[last] = length. */
  cum: number[]
  /** Cumulative arc length at each waypoint index. */
  waypointS: number[]
}

function cubic(p0: Vec2, c1: Vec2, c2: Vec2, p3: Vec2, t: number): Vec2 {
  const mt = 1 - t
  const a = mt * mt * mt
  const b = 3 * mt * mt * t
  const c = 3 * mt * t * t
  const d = t * t * t
  return {
    x: a * p0.x + b * c1.x + c * c2.x + d * p3.x,
    y: a * p0.y + b * c1.y + c * c2.y + d * p3.y,
  }
}

function isCurved(a: Waypoint, b: Waypoint): boolean {
  return !!(a.handleOut || b.handleIn)
}

/** Build the LUT. Lines use 1 sample per ~0.5 m (min 4), curves 32 samples. */
export function buildPathLUT(path: Path, curveSamples = 32): PathLUT {
  const wps = path.waypoints
  const pts: Vec2[] = []
  const cum: number[] = []
  const waypointS: number[] = []
  if (wps.length === 0) return { length: 0, pts: [{ x: 0, y: 0 }], cum: [0], waypointS: [] }
  if (wps.length === 1) {
    const p = wps[0]!.p
    return { length: 0, pts: [p, p], cum: [0, 0], waypointS: [0] }
  }
  let s = 0
  pts.push(wps[0]!.p)
  cum.push(0)
  waypointS.push(0)
  for (let i = 0; i < wps.length - 1; i++) {
    const a = wps[i]!
    const b = wps[i + 1]!
    if (isCurved(a, b)) {
      const c1 = a.handleOut ?? a.p
      const c2 = b.handleIn ?? b.p
      let prev = a.p
      for (let k = 1; k <= curveSamples; k++) {
        const q = cubic(a.p, c1, c2, b.p, k / curveSamples)
        s += distance(prev, q)
        pts.push(q)
        cum.push(s)
        prev = q
      }
    } else {
      const d = distance(a.p, b.p)
      const n = Math.max(4, Math.ceil(d / 0.5))
      let prev = a.p
      for (let k = 1; k <= n; k++) {
        const q = lerp(a.p, b.p, k / n)
        s += distance(prev, q)
        pts.push(q)
        cum.push(s)
        prev = q
      }
    }
    waypointS.push(s)
  }
  return { length: s, pts, cum, waypointS }
}

/** Point at arc-length distance `s` (clamped). Binary search + linear interpolation. */
export function pointAtDistance(lut: PathLUT, s: number): Vec2 {
  const { pts, cum } = lut
  if (pts.length === 1) return pts[0]!
  if (s <= 0) return pts[0]!
  if (s >= lut.length) return pts[pts.length - 1]!
  let lo = 0
  let hi = cum.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (cum[mid]! <= s) lo = mid
    else hi = mid
  }
  const s0 = cum[lo]!
  const s1 = cum[hi]!
  const t = s1 === s0 ? 0 : (s - s0) / (s1 - s0)
  return lerp(pts[lo]!, pts[hi]!, t)
}

/** Heading (radians) at distance s, using a small forward difference. */
export function headingAtDistance(lut: PathLUT, s: number): number {
  const eps = Math.max(0.05, lut.length * 0.005)
  const a = pointAtDistance(lut, Math.max(0, s - eps))
  const b = pointAtDistance(lut, Math.min(lut.length, s + eps))
  return Math.atan2(b.y - a.y, b.x - a.x)
}

// ---------- easing ----------

export type EasingFn = (u: number) => number
export const EASINGS: Record<'linear' | 'easeIn' | 'easeOut' | 'easeInOut', EasingFn> = {
  linear: (u) => u,
  easeIn: (u) => u * u,
  easeOut: (u) => 1 - (1 - u) * (1 - u),
  easeInOut: (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2),
}

// ---------- polyline helpers (used by the editor's path tool, pure) ----------

/** Ramer–Douglas–Peucker simplification. */
export function simplifyPolyline(points: readonly Vec2[], epsilon = 0.8): Vec2[] {
  if (points.length <= 2) return [...points]
  const first = points[0]!
  const last = points[points.length - 1]!
  let maxD = 0
  let idx = 0
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpDistance(points[i]!, first, last)
    if (d > maxD) {
      maxD = d
      idx = i
    }
  }
  if (maxD > epsilon) {
    const left = simplifyPolyline(points.slice(0, idx + 1), epsilon)
    const right = simplifyPolyline(points.slice(idx), epsilon)
    return [...left.slice(0, -1), ...right]
  }
  return [first, last]
}

function perpDistance(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return distance(p, a)
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  return distance(p, { x: a.x + t * dx, y: a.y + t * dy })
}

/**
 * Catmull-Rom → cubic bezier handles: turns a sparse polyline into a smooth path.
 * `tension` 0 = straight segments, 0.5 = standard Catmull-Rom.
 */
export function smoothWaypoints(
  points: readonly Vec2[],
  ids: readonly string[],
  tension = 0.5,
): Waypoint[] {
  const n = points.length
  if (n < 3) return points.map((p, i) => ({ id: ids[i] ?? `w${i}`, p }))
  const out: Waypoint[] = []
  for (let i = 0; i < n; i++) {
    const p0 = points[Math.max(0, i - 1)]!
    const p1 = points[i]!
    const p2 = points[Math.min(n - 1, i + 1)]!
    const wp: Waypoint = { id: ids[i] ?? `w${i}`, p: p1 }
    if (i > 0) {
      wp.handleIn = {
        x: p1.x - ((p2.x - p0.x) * tension) / 3,
        y: p1.y - ((p2.y - p0.y) * tension) / 3,
      }
    }
    if (i < n - 1) {
      wp.handleOut = {
        x: p1.x + ((p2.x - p0.x) * tension) / 3,
        y: p1.y + ((p2.y - p0.y) * tension) / 3,
      }
    }
    out.push(wp)
  }
  return out
}

/** SVG path `d` for rendering (same geometry as the LUT). */
export function pathToSvgD(path: Path): string {
  const wps = path.waypoints
  if (wps.length === 0) return ''
  let d = `M ${wps[0]!.p.x} ${wps[0]!.p.y}`
  for (let i = 0; i < wps.length - 1; i++) {
    const a = wps[i]!
    const b = wps[i + 1]!
    if (isCurved(a, b)) {
      const c1 = a.handleOut ?? a.p
      const c2 = b.handleIn ?? b.p
      d += ` C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${b.p.x} ${b.p.y}`
    } else {
      d += ` L ${b.p.x} ${b.p.y}`
    }
  }
  return d
}

// ---------- stroke beautification (editor input → clean geometry; pure) ----------

export interface BeautifyOptions {
  /** Resample spacing (m). */
  step?: number
  /** Simplification tolerance (m). */
  epsilon?: number
  /** Max deviation from the chord (m) under which the stroke becomes a straight line. */
  straightTolerance?: number
  /** Snap near-axis straight lines to exact horizontal/vertical (degrees). */
  axisSnapDeg?: number
  /** Cap on waypoints (epsilon grows until satisfied). */
  maxWaypoints?: number
  /** Catmull-Rom tension for curves. */
  tension?: number
}

export function resamplePolyline(points: readonly Vec2[], step = 0.5): Vec2[] {
  if (points.length < 2) return [...points]
  const out: Vec2[] = [points[0]!]
  let carry = 0
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    const d = distance(a, b)
    if (d === 0) continue
    let s = step - carry
    while (s <= d) {
      out.push(lerp(a, b, s / d))
      s += step
    }
    carry = d - (s - step)
  }
  const last = points[points.length - 1]!
  if (distance(out[out.length - 1]!, last) > 1e-6) out.push(last)
  return out
}

/** Gaussian-ish smoothing with a 5-tap kernel; endpoints fixed. */
export function smoothPolyline(points: readonly Vec2[], passes = 2): Vec2[] {
  let pts = [...points]
  const k = [1, 4, 6, 4, 1]
  const ksum = 16
  for (let p = 0; p < passes; p++) {
    if (pts.length < 5) break
    const next = pts.map((q, i) => {
      if (i < 2 || i > pts.length - 3) return q
      let x = 0
      let y = 0
      for (let j = -2; j <= 2; j++) {
        x += pts[i + j]!.x * k[j + 2]!
        y += pts[i + j]!.y * k[j + 2]!
      }
      return { x: x / ksum, y: y / ksum }
    })
    pts = next
  }
  return pts
}

function maxChordDeviation(points: readonly Vec2[]): number {
  const a = points[0]!
  const b = points[points.length - 1]!
  let m = 0
  for (const p of points) m = Math.max(m, perpDistance(p, a, b))
  return m
}

/**
 * Raw pointer trail → clean waypoints:
 *   resample → smooth → RDP → (straight if nearly straight, axis-snapped) | Catmull-Rom bezier.
 * Deterministic; same trail → same waypoints. Waypoint ids are supplied by the caller.
 */
export function beautifyStroke(
  raw: readonly Vec2[],
  ids: (i: number) => string,
  opts: BeautifyOptions = {},
): Waypoint[] {
  const step = opts.step ?? 0.5
  const eps0 = opts.epsilon ?? 1.0
  const straightTol = opts.straightTolerance ?? 1.2
  const axisDeg = opts.axisSnapDeg ?? 6
  const maxW = opts.maxWaypoints ?? 6
  const tension = opts.tension ?? 0.45
  if (raw.length < 2) return raw.map((p, i) => ({ id: ids(i), p }))
  const res = resamplePolyline(raw, step)
  const sm = smoothPolyline(res, 2)
  const first = sm[0]!
  const last = sm[sm.length - 1]!
  // Straight intent
  if (maxChordDeviation(sm) <= straightTol) {
    let end = last
    const ang = (Math.atan2(end.y - first.y, end.x - first.x) * 180) / Math.PI
    const len = distance(first, end)
    const near = (a: number) => Math.abs(((ang - a + 180) % 360) - 180) <= axisDeg
    if (near(0)) end = { x: first.x + len, y: first.y }
    else if (near(180)) end = { x: first.x - len, y: first.y }
    else if (near(90)) end = { x: first.x, y: first.y + len }
    else if (near(-90)) end = { x: first.x, y: first.y - len }
    return [
      { id: ids(0), p: first },
      { id: ids(1), p: end },
    ]
  }
  let eps = eps0
  let simp = simplifyPolyline(sm, eps)
  while (simp.length > maxW && eps < 20) {
    eps *= 1.4
    simp = simplifyPolyline(sm, eps)
  }
  return smoothWaypoints(
    simp,
    simp.map((_, i) => ids(i)),
    tension,
  )
}
