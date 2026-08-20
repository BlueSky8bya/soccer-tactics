import { memo, useCallback, useEffect, useRef, type ReactNode } from 'react'
import type { Vec2 } from '@/domain/types'
import { Token, type TokenProps } from '@/renderer/Token'
import { SPRINGS } from '../motion/spring'
import { useSpringAnimator } from '../motion/useSpring'

export interface AnimatedTokenProps extends Omit<TokenProps, 'wrap'> {
  /** Pointer is down on this token but not yet dragging — quick acknowledgement (M4). */
  pressed?: boolean
  /** Offset (metres) from the release point to the settled position; animated to 0 on drop. */
  dropFrom: Vec2 | null
  dropKey: number
  /** Increment to fire a "pop" (kick / receive / select) — pure interface feedback. */
  pulseKey?: number
  pulseScale?: number
}

const PULSE = { duration: 0.32, bounce: 0.45 } as const

/**
 * Interface-motion wrapper (ADR-0006 D2): pickup scale spring, drop/snap offset spring, event pulse.
 * The document position is the truth; this only decorates the last few pixels.
 */
export const AnimatedToken = memo(function AnimatedToken(p: AnimatedTokenProps) {
  const inner = useRef<SVGGElement>(null)
  const scaleRef = useRef(1)
  const pulseRef = useRef(1)
  const offsetRef = useRef<Vec2>({ x: 0, y: 0 })
  const dropVec = useRef<Vec2>({ x: 0, y: 0 })

  const apply = useCallback(() => {
    const el = inner.current
    if (!el) return
    const { x, y } = offsetRef.current
    el.setAttribute(
      'transform',
      `translate(${x} ${y}) scale(${scaleRef.current * pulseRef.current})`,
    )
  }, [])

  const scale = useSpringAnimator(1, SPRINGS.pickup, (v) => {
    scaleRef.current = v
    apply()
  })
  const drop = useSpringAnimator(0, SPRINGS.drop, (v) => {
    offsetRef.current = { x: dropVec.current.x * v, y: dropVec.current.y * v }
    apply()
  })
  const pulse = useSpringAnimator(1, PULSE, (v) => {
    pulseRef.current = v
    apply()
  })

  useEffect(() => {
    // press = instant small lift acknowledgement; drag = full pickup (M4 contract)
    scale.to(p.dragging ? 1.08 : p.pressed ? 1.035 : 1)
  }, [p.dragging, p.pressed, scale])

  useEffect(() => {
    if (!p.dropFrom) return
    dropVec.current = p.dropFrom
    drop.jump(1)
    drop.to(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.dropKey])

  useEffect(() => {
    if (!p.pulseKey) return
    pulse.jump(p.pulseScale ?? 1.35)
    pulse.to(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.pulseKey])

  const wrap = useCallback((body: ReactNode) => <g ref={inner}>{body}</g>, [])

  const { pressed: _pr, dropFrom: _d, dropKey: _k, pulseKey: _p, pulseScale: _s, ...rest } = p
  return <Token {...rest} wrap={wrap} />
})
