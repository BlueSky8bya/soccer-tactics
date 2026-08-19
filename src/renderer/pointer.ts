/**
 * The single place where screen pixels become pitch metres (ADR-0004).
 */
import type { Vec2 } from '@/domain/types'

export function clientToPitch(svg: SVGSVGElement, clientX: number, clientY: number): Vec2 {
  const ctm = svg.getScreenCTM()
  if (!ctm) return { x: 0, y: 0 }
  const inv = ctm.inverse()
  const x = inv.a * clientX + inv.c * clientY + inv.e
  const y = inv.b * clientX + inv.d * clientY + inv.f
  return { x, y }
}

/** Metres per CSS pixel for the current layout (used for px-based hit sizes). */
export function metresPerPixel(svg: SVGSVGElement): number {
  const ctm = svg.getScreenCTM()
  if (!ctm) return 0.1
  // ctm.a = px per metre along x (uniform because preserveAspectRatio=meet)
  return ctm.a === 0 ? 0.1 : 1 / ctm.a
}

/** Pure version for tests: apply a 2×3 affine inverse. */
export function applyInverseAffine(
  m: { a: number; b: number; c: number; d: number; e: number; f: number },
  clientX: number,
  clientY: number,
): Vec2 {
  const det = m.a * m.d - m.b * m.c
  if (det === 0) return { x: 0, y: 0 }
  const ia = m.d / det
  const ib = -m.b / det
  const ic = -m.c / det
  const id = m.a / det
  const ie = (m.c * m.f - m.d * m.e) / det
  const iff = (m.b * m.e - m.a * m.f) / det
  return { x: ia * clientX + ic * clientY + ie, y: ib * clientX + id * clientY + iff }
}
