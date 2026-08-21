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
 */
export function usePitchView(
  svgRef: RefObject<SVGSVGElement | null>,
  pitchLength: number,
  pitchWidth: number,
  pad: number = PITCH_MARGIN_M,
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
      // `meet` scale — the axis that binds keeps exactly the base box
      const scale = Math.min(r.width / baseW, r.height / baseH)
      const w = round(r.width / scale)
      const h = round(r.height / scale)
      const next = {
        x: round(pitchLength / 2 - w / 2),
        y: round(pitchWidth / 2 - h / 2),
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
  }, [svgRef, baseW, baseH, pitchLength, pitchWidth])
  return view
}

/** Clamp to what is actually ON SCREEN — the pen may use every millimetre the board shows. */
export function clampToView(p: { x: number; y: number }, v: PitchView): { x: number; y: number } {
  return {
    x: Math.min(v.x + v.w, Math.max(v.x, p.x)),
    y: Math.min(v.y + v.h, Math.max(v.y, p.y)),
  }
}
