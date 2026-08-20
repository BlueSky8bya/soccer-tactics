/**
 * VIC Schedule Studio pen grammar, ported verbatim (user 2026-08-21: "레퍼런스처럼 똑같이").
 * Per-point width factor 0..1: stylus = real pressure (gamma curve + time-based EMA), mouse/touch
 * = speed inverse (fast → thin, slow → thick — fountain-pen feel). Rendering: midpoint quadratic
 * segments, each with lineWidth = width × (0.45 + p × 0.85), round caps.
 * Pure — no DOM; unit-tested against the reference numbers.
 */
import type { Vec2 } from '@/domain/types'

export const PEN_PRESSURE_GAMMA = 0.65
export const PEN_PRESSURE_FLOOR = 0.12
export const PRESSURE_SMOOTHING_TAU_MS = 12
/** CSS px — points closer than this to the last KEPT point are dropped (long-scribble memory). */
export const MIN_POINT_DIST_PX = 2
/** VIC 판서 팔레트 17색 + 마지막 칸 '직접 고르기'(네이티브 색상판). */
export const PEN_COLORS = [
  '#000000',
  '#94a3b8',
  '#c26a2d',
  '#f43f5e',
  '#fb923c',
  '#fbbf24',
  '#facc15',
  '#a3e635',
  '#4ade80',
  '#2dd4bf',
  '#22d3ee',
  '#60a5fa',
  '#818cf8',
  '#a78bfa',
  '#c084fc',
  '#e879f9',
  '#f472b6',
]
/** 굵기 6단(펜 기준 px) — VIC PEN_WIDTHS 그대로. */
export const PEN_WIDTHS = [2, 3, 5, 8, 12, 18]

function clamp01(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(1, Math.max(0, value))
}

/** Expands low stylus pressures while preserving a non-zero visible stroke. */
export function mapPenPressure(pressure: number): number {
  const normalized = clamp01(pressure, 0)
  return Math.max(PEN_PRESSURE_FLOOR, normalized ** PEN_PRESSURE_GAMMA)
}

/** Time-based low-pass: equal elapsed time → equal smoothing, independent of sample rate. */
export function smoothPressure(
  previous: number,
  target: number,
  deltaMs: number,
  tauMs: number = PRESSURE_SMOOTHING_TAU_MS,
): number {
  const safeTarget = clamp01(target, PEN_PRESSURE_FLOOR)
  const safePrevious = clamp01(previous, safeTarget)
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) return safePrevious
  const safeTau = Number.isFinite(tauMs) && tauMs > 0 ? tauMs : PRESSURE_SMOOTHING_TAU_MS
  const alpha = 1 - Math.exp(-deltaMs / safeTau)
  return clamp01(safePrevious + (safeTarget - safePrevious) * alpha, safeTarget)
}

/** Mouse/touch: speed inverse — v px/ms, target = clamp(1 − v/1.7, 0.3, 1), EMA 0.65/0.35. */
export function mouseSpeedPressure(previousF: number, distPx: number, deltaMs: number): number {
  const v = distPx / Math.max(1, deltaMs)
  const target = Math.min(1, Math.max(0.3, 1 - v / 1.7))
  return previousF * 0.65 + target * 0.35
}

/** Per-point stroke width multiplier — VIC wOf. Neutral (no data) = 0.7 → ×1.045. */
export function penWidthFactor(p?: number): number {
  return 0.45 + (p ?? 0.7) * 0.85
}

const midOf = (a: Vec2, b: Vec2): Vec2 => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
const fmt = (n: number) => (Math.round(n * 1000) / 1000).toString()

/**
 * VIC drawPenPath geometry as SVG path segments: head (start → first midpoint), body
 * (midpoint → midpoint quadratics, control = the point), tail (last midpoint → end).
 * Each segment carries its own width factor — SVG cannot vary width along one path.
 */
export function penSegments(
  points: readonly Vec2[],
  pressures?: readonly number[],
): { d: string; f: number }[] {
  const f = (i: number) => penWidthFactor(pressures?.[i])
  if (points.length === 0) return []
  if (points.length === 1) {
    const p = points[0]!
    return [{ d: `M ${fmt(p.x)} ${fmt(p.y)} L ${fmt(p.x + 0.01)} ${fmt(p.y + 0.01)}`, f: f(0) }]
  }
  const out: { d: string; f: number }[] = []
  const m0 = midOf(points[0]!, points[1]!)
  out.push({
    d: `M ${fmt(points[0]!.x)} ${fmt(points[0]!.y)} L ${fmt(m0.x)} ${fmt(m0.y)}`,
    f: f(0),
  })
  for (let j = 1; j < points.length - 1; j++) {
    const a = midOf(points[j - 1]!, points[j]!)
    const b = midOf(points[j]!, points[j + 1]!)
    out.push({
      d: `M ${fmt(a.x)} ${fmt(a.y)} Q ${fmt(points[j]!.x)} ${fmt(points[j]!.y)} ${fmt(b.x)} ${fmt(b.y)}`,
      f: f(j),
    })
  }
  const last = points[points.length - 1]!
  const mL = midOf(points[points.length - 2]!, last)
  out.push({
    d: `M ${fmt(mL.x)} ${fmt(mL.y)} L ${fmt(last.x)} ${fmt(last.y)}`,
    f: f(points.length - 1),
  })
  return out
}
