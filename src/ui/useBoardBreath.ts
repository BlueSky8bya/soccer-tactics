/**
 * The board takes ONE BREATH when it becomes a different board.
 *
 * Switching tactic variant A→B replaces every token on the pitch and used to say nothing at all —
 * no motion, no message — so you could carry on editing the wrong plan without ever noticing the
 * swap (user 2026-08-25: A, B, C 바꿀 때 내가 이 페이지를 바꾸고 있는지를 잘 모르겠어서). The same is
 * true of opening a file or starting over: the document under your hands is not the one that was
 * there a moment ago, and that is worth exactly one gesture.
 *
 * WHY A BREATH AND NOT A FLASH. Scholl & Pylyshyn (1999) is the reason the pitch never fades or
 * shrinks its tokens: objects that vanish by imploding break tracking badly (F(1,14)=51.02,
 * p<.001). So this animates the STAGE — one container, moving as a single object — rather than
 * dissolving the pieces on it. Nothing on the board implodes; the whole board leans back and
 * returns.
 *
 * WHY BOUNCE HERE. Kao (2020, N=3018) finds juice is an inverted U: none and extreme are equally
 * bad, and the cost lands on task performance, not just taste. Frequent controls therefore get the
 * quiet press spring; this fires a handful of times a session, so it is one of the few places the
 * bouncier curve earns its keep.
 *
 * It is imperative (`Element.animate`) rather than a CSS class because it has to REPLAY on every
 * swap, and re-adding a class does not restart an animation.
 */
import { useEffect, type RefObject } from 'react'
import { useUiStore } from '@/editor/uiStore'

/** Matches `--st-spring-drop` in tokens.css — the settle curve, overshoot included. */
const BREATH_MS = 446

/**
 * MODULE SCOPE, not a ref — and that is the whole trick.
 *
 * A variant switch REPLACES the board's subtree: measured, the stage element after the swap is a
 * different DOM node from the one before it. So a `useRef` watermark is reset by the very event it
 * is supposed to notice, and a ref captured before the swap points at a node that is about to be
 * thrown away. A module-level watermark survives the remount, so the freshly mounted stage can ask
 * "was I mounted because the board changed?" and answer it.
 */
let lastBreathedAt = 0

export function useBoardBreath(ref: RefObject<HTMLElement | null>): void {
  const swap = useUiStore((s) => s.identitySwap)
  const reducedMotion = useUiStore((s) => s.reducedMotion)
  const playing = useUiStore((s) => s.playback.playing)

  useEffect(() => {
    if (swap === lastBreathedAt) return
    lastBreathedAt = swap
    // A running play owns the board; interrupting it to announce a swap would be the swap
    // announcing itself over the thing the user is actually watching.
    if (reducedMotion || playing) return
    const el = ref.current
    el?.animate?.(
      [
        { transform: 'scale(0.975)', opacity: 0.35 },
        { transform: 'scale(1)', opacity: 1 },
      ],
      { duration: BREATH_MS, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
    )
  }, [swap, reducedMotion, playing, ref])
}
