import { useEffect, useState, type RefObject } from 'react'
import { PITCH_MARGIN_M } from '@/engine/geometry'

export interface PitchView {
  /** viewBox, in metres. */
  x: number
  y: number
  w: number
  h: number
}

const round = (n: number) => Math.round(n * 100) / 100

/**
 * The viewBox that FILLS its element.
 *
 * A fixed `-2 -2 109 72` box plus `xMidYMid meet` letterboxes: the pitch keeps its 105:68 shape
 * and the leftover strip on the long axis is dead space the SVG receives pointer events for but
 * has no coordinates for. Hiding the panels (F) hands the board a much wider box and therefore a
 * much wider dead strip — which is exactly where a user tries to draw (2026-08-22: 패널 숨겼을 때
 * 생긴 좌/우 잔디 공간으로 그리기가 먹히지 않음).
 *
 * So the box grows to the element's aspect instead: the pitch stays centred and identically
 * scaled (the constrained axis is untouched), and the strip becomes real surround with real
 * coordinates. Everything that maps through `getScreenCTM` — pointer picking, overlays, export —
 * follows automatically.
 *
 * `safeBottom` (ADR-0009 v31) is how the full-bleed board and the floating transport share the
 * window. The board fills it — every pixel keeps coordinates, so the pen and the pointer still
 * work under the bar — but the MARKINGS are laid out in the space above the bar and nudged up by
 * half of it. So the pitch is never partly hidden by the control sitting on top of it, and the
 * only thing under the bar is grass.
 */
export function usePitchView(
  svgRef: RefObject<SVGSVGElement | null>,
  pitchLength: number,
  pitchWidth: number,
  pad: number = PITCH_MARGIN_M,
  safeBottom: number = 0,
): PitchView {
  const baseW = pitchLength + pad * 2
  const baseH = pitchWidth + pad * 2
  const base: PitchView = { x: -pad, y: -pad, w: baseW, h: baseH }
  const [view, setView] = useState<PitchView>(base)
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const compute = () => {
      const r = el.getBoundingClientRect()
      if (r.width < 1 || r.height < 1) return
      // Never let the reserve eat the board: on a very short window the bar goes back to floating
      // over the markings rather than shrinking them to nothing.
      const safe = Math.max(0, Math.min(safeBottom, r.height * 0.25))
      // `meet` scale — the axis that binds keeps exactly the base box, minus the reserved strip
      const scale = Math.min(r.width / baseW, (r.height - safe) / baseH)
      const w = round(r.width / scale)
      const h = round(r.height / scale)
      const next = {
        x: round(pitchLength / 2 - w / 2),
        // half the reserve, in metres: centring the pitch in the free area is the same as moving
        // it up by half of what was taken from the bottom
        y: round(pitchWidth / 2 - h / 2 + safe / 2 / scale),
        w,
        h,
      }
      setView((prev) =>
        prev.x === next.x && prev.y === next.y && prev.w === next.w && prev.h === next.h
          ? prev
          : next,
      )
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(el)
    window.addEventListener('resize', compute)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', compute)
    }
  }, [svgRef, baseW, baseH, pitchLength, pitchWidth, safeBottom])
  return view
}

/** Clamp to what is actually ON SCREEN — the pen may use every millimetre the board shows. */
export function clampToView(p: { x: number; y: number }, v: PitchView): { x: number; y: number } {
  return {
    x: Math.min(v.x + v.w, Math.max(v.x, p.x)),
    y: Math.min(v.y + v.h, Math.max(v.y, p.y)),
  }
}

/**
 * How much of the board's bottom the floating transport claims (ADR-0009 v31).
 *
 * Derived, not guessed. The bar measures 83px and sits 12px off the bottom of the board, and the
 * markings want ~8px of grass under them, so the markings must end 91px above the board's bottom
 * edge. With the pitch centred in the free area, its bottom edge lands at 0.972·(H − R) — solve
 * that against H − 91 and R comes out at 70–73px for every laptop height from 800 to 1200. 72.
 *
 * Reserving the bar's FULL height instead (96) threw away ~25px of scale for clearance nobody
 * asked for: the pitch's own 2m surround is already drawn under the bar, which is exactly what
 * should be there.
 */
export const BOARD_SAFE_BOTTOM_PX = 72
