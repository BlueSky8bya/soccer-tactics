import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import styles from './shell.module.css'

/**
 * Apple-style colour popover replacing the native <input type="color"> panel (OS chrome cannot
 * be themed): saturation/value square + hue bar + hex readout, all pointer-draggable.
 */

export function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return { h: 0, s: 0, v: 0 }
  const n = parseInt(m[1]!, 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d > 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60
    else if (max === g) h = ((b - r) / d + 2) * 60
    else h = ((r - g) / d + 4) * 60
  }
  return { h, s: max === 0 ? 0 : d / max, v: max }
}

export function hsvToHex(h: number, s: number, v: number): string {
  const f = (i: number) => {
    const k = (i + h / 60) % 6
    const c = v - v * s * Math.max(0, Math.min(k, 4 - k, 1))
    return Math.round(c * 255)
  }
  const to2 = (x: number) => x.toString(16).padStart(2, '0')
  return `#${to2(f(5))}${to2(f(3))}${to2(f(1))}`
}

function useDragRatio(onRatio: (x: number, y: number) => void) {
  const ref = useRef<HTMLDivElement>(null)
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el) return
    el.setPointerCapture(e.pointerId)
    const apply = (cx: number, cy: number) => {
      const r = el.getBoundingClientRect()
      onRatio(
        Math.max(0, Math.min(1, (cx - r.left) / r.width)),
        Math.max(0, Math.min(1, (cy - r.top) / r.height)),
      )
    }
    apply(e.clientX, e.clientY)
    const move = (ev: PointerEvent) => apply(ev.clientX, ev.clientY)
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  return { ref, onPointerDown }
}

export function ColorPicker(p: {
  color: string
  onChange: (hex: string) => void
  onClose: () => void
  /** Anchor element the popover opens above (the custom-colour cell). */
  anchor: HTMLElement | null
}) {
  const [hsv, setHsv] = useState(() => hexToHsv(p.color))
  const [hexText, setHexText] = useState(() => p.color.toLowerCase())
  const rootRef = useRef<HTMLDivElement>(null)
  // The bottom bar clips (overflow-x: auto) and its backdrop-filter hijacks position:fixed —
  // so the popover renders through a PORTAL on <body>, fixed above the anchor cell.
  const [pos, setPos] = useState<{ left: number; bottom: number } | null>(null)
  useLayoutEffect(() => {
    if (!p.anchor) return
    const r = p.anchor.getBoundingClientRect()
    setPos({
      left: Math.max(8, Math.min(window.innerWidth - 208, r.right - 196)),
      bottom: window.innerHeight - r.top + 10,
    })
  }, [p.anchor])

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) p.onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') p.onClose()
    }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const commit = (next: { h: number; s: number; v: number }) => {
    setHsv(next)
    const hex = hsvToHex(next.h, next.s, next.v)
    setHexText(hex)
    p.onChange(hex)
  }

  const sq = useDragRatio((x, y) => commit({ h: hsv.h, s: x, v: 1 - y }))
  const hueBar = useDragRatio((x) => commit({ h: x * 360, s: hsv.s, v: hsv.v }))

  const hex = hsvToHex(hsv.h, hsv.s, hsv.v)
  const hueColor = hsvToHex(hsv.h, 1, 1)

  return createPortal(
    <div
      className={styles.cpop}
      ref={rootRef}
      role="dialog"
      aria-label="색 선택"
      style={pos ? { left: pos.left, bottom: pos.bottom } : { visibility: 'hidden' }}
    >
      <div
        className={styles.cpSquare}
        ref={sq.ref}
        onPointerDown={sq.onPointerDown}
        style={{
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})`,
        }}
      >
        <span
          className={styles.cpThumb}
          style={{
            left: `${hsv.s * 100}%`,
            top: `${(1 - hsv.v) * 100}%`,
            background: hex,
          }}
        />
      </div>
      <div className={styles.cpHue} ref={hueBar.ref} onPointerDown={hueBar.onPointerDown}>
        <span
          className={styles.cpHueThumb}
          style={{ left: `${(hsv.h / 360) * 100}%`, background: hueColor }}
        />
      </div>
      <div className={styles.cpRow}>
        <span className={styles.cpSwatch} style={{ background: hex }} />
        <input
          className={styles.cpHex}
          value={hexText}
          onChange={(e) => {
            setHexText(e.target.value)
            const m = /^#?[0-9a-f]{6}$/i.exec(e.target.value.trim())
            if (m) {
              const norm = e.target.value.trim().startsWith('#')
                ? e.target.value.trim().toLowerCase()
                : `#${e.target.value.trim().toLowerCase()}`
              setHsv(hexToHsv(norm))
              p.onChange(norm)
            }
          }}
          spellCheck={false}
          aria-label="HEX"
        />
      </div>
    </div>,
    document.body,
  )
}
