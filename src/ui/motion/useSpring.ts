import { useEffect, useMemo, useRef } from 'react'
import { useUiStore } from '@/editor/uiStore'
import { SpringAnimator, prefersReducedMotion, type SpringConfig } from './spring'

/**
 * Imperative spring bound to a DOM write (no React re-render per frame).
 * `onUpdate` receives the current value; write it to a ref'd element.
 */
export function useSpringAnimator(
  initial: number,
  config: SpringConfig,
  onUpdate: (v: number) => void,
): SpringAnimator {
  const cb = useRef(onUpdate)
  cb.current = onUpdate
  const reduced = useUiStore((s) => s.reducedMotion)
  const animator = useMemo(
    () =>
      new SpringAnimator(initial, config, {
        onUpdate: (v) => cb.current(v),
        immediate: () => reduced || prefersReducedMotion(),
      }),
    // config/initial are stable per call site by convention
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reduced],
  )
  useEffect(() => () => animator.stop(), [animator])
  return animator
}
