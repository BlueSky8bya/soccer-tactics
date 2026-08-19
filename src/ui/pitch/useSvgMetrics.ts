import { useEffect, useState, type RefObject } from 'react'

export interface SvgMetrics {
  /** CSS px per metre. */
  scale: number
  /** CSS px offset (relative to the svg element box) of pitch origin (0,0). */
  ox: number
  oy: number
  width: number
  height: number
}

/**
 * Maps pitch metres → CSS px inside the svg's box for HTML overlays (mini-bar, labels).
 * Mirrors `preserveAspectRatio="xMidYMid meet"` with the given viewBox padding.
 */
export function useSvgMetrics(
  svgRef: RefObject<SVGSVGElement | null>,
  pad: number,
  pitchLength: number,
  pitchWidth: number,
): SvgMetrics | null {
  const [m, setM] = useState<SvgMetrics | null>(null)
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const compute = () => {
      const r = el.getBoundingClientRect()
      const vbW = pitchLength + pad * 2
      const vbH = pitchWidth + pad * 2
      const scale = Math.min(r.width / vbW, r.height / vbH)
      const ox = (r.width - vbW * scale) / 2 + pad * scale
      const oy = (r.height - vbH * scale) / 2 + pad * scale
      setM({ scale, ox, oy, width: r.width, height: r.height })
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(el)
    window.addEventListener('resize', compute)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', compute)
    }
  }, [svgRef, pad, pitchLength, pitchWidth])
  return m
}
