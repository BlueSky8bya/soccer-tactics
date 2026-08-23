/**
 * What a step is worth on the CLOCK.
 *
 * The first version of the board caption narrated the step in words — "10번 보유 · 10번→7번 패스".
 * The user threw it out for the right reason (2026-08-24: 전혀 의미있는 정보가 아닌데? 눈으로 봐도
 * 충분히 알 수 있잖아): every one of those facts is drawn on the pitch already, in colour, at
 * full size. A caption that repeats the picture is noise wearing a label.
 *
 * Timing is the opposite case. This is a SEQUENCER — how long a step takes, when it starts, how
 * much of the play it is — and none of it is visible anywhere. Two seconds and five seconds draw
 * the identical arrow. So the caption carries the clock, and nothing else.
 *
 * Pure: document + compiled timeline in, numbers out.
 */
import type { CompiledTimeline } from '@/engine/compile'
import type { Segment, TacticDocument } from '@/domain/types'
import { stepOf } from '@/editor/stepCommands'

const isAuthoredPath = (s: Segment): boolean => 'path' in s && !s.id.startsWith('gen-')

function tracksOf(doc: TacticDocument) {
  return doc.scenes[0]?.timeline.tracks ?? []
}

export interface StepTiming {
  step: number
  /** Does this step hold any authored movement? */
  used: boolean
  /** 1-based position among the steps that ARE used; null when this one is empty. */
  index: number | null
  /** How many steps the play actually uses. */
  total: number
  /** Clock window of the step (seconds); zero-length when empty. */
  start: number
  end: number
  /** End of the whole play. */
  playEnd: number
  /** Authored movements in this step. */
  count: number
}

/**
 * The clock time a step OPENS at.
 *
 * An empty step has no window of its own, so it opens wherever the play has got to — the end of
 * the last authored step before it. Without that, picking an unused step 4 showed the kickoff
 * frame, which is exactly the confusion isolation exists to remove.
 */
export function stepOpensAt(doc: TacticDocument, compiled: CompiledTimeline, step: number): number {
  let open = Infinity
  let prevEnd = 0
  for (const tr of tracksOf(doc))
    for (const seg of tr.segments) {
      if (!isAuthoredPath(seg)) continue
      const tm = compiled.segmentTimes[seg.id]
      if (!tm) continue
      const s = stepOf(seg as { step?: number })
      if (s === step) open = Math.min(open, tm.start)
      else if (s < step) prevEnd = Math.max(prevEnd, tm.end)
    }
  return Number.isFinite(open) ? open : prevEnd
}

/**
 * Which step is running at clock time `clock`, or null between steps. One derivation for the step
 * bar's `aria-current` and the caption's subject — two answers to "which step is this" that could
 * disagree is exactly the bug this prevents.
 */
export function activeStepAt(
  doc: TacticDocument,
  compiled: CompiledTimeline,
  clock: number,
): number | null {
  for (const tr of tracksOf(doc))
    for (const seg of tr.segments) {
      if (!isAuthoredPath(seg)) continue
      const w = compiled.segmentTimes[seg.id]
      if (w && clock >= w.start - 1e-9 && clock <= w.end + 1e-9)
        return stepOf(seg as { step?: number })
    }
  return null
}

/**
 * The last step FULLY COMPLETED by `at` — the moment the board is standing in.
 *
 * This is what the live ball token means when the clock is not at kickoff. Grabbing it says "the
 * ball leaves from here, and whatever it did after this instant does not happen"; `here` is this
 * step, and the new movement goes on the one after it.
 *
 * It used to be hard-coded to 0, which was true only because the authoring clock was always
 * kickoff. Once a step could park the board mid-play, every pass drawn from the live ball
 * truncated the chain and rebuilt the FIRST pass — so drawing a second pass changed nothing at all
 * (user 2026-08-24: 같은 선수한테 또 공을 2번 이상 주면 반응을 안 해).
 */
export function completedStepAt(
  doc: TacticDocument,
  compiled: CompiledTimeline,
  at: number,
): number {
  let last = 0
  for (const tr of tracksOf(doc))
    for (const seg of tr.segments) {
      if (!isAuthoredPath(seg)) continue
      const tm = compiled.segmentTimes[seg.id]
      if (!tm || tm.end > at + 1e-6) continue
      const s = stepOf(seg as { step?: number })
      if (s > last) last = s
    }
  return last
}

/** Everything the caption shows, in one pass over the timeline. */
export function stepTiming(
  doc: TacticDocument,
  compiled: CompiledTimeline,
  step: number,
): StepTiming {
  const usedSteps = new Set<number>()
  let start = Infinity
  let end = 0
  let prevEnd = 0
  let playEnd = 0
  let count = 0
  for (const tr of tracksOf(doc))
    for (const seg of tr.segments) {
      if (!isAuthoredPath(seg)) continue
      const tm = compiled.segmentTimes[seg.id]
      if (!tm) continue
      const s = stepOf(seg as { step?: number })
      usedSteps.add(s)
      if (tm.end > playEnd) playEnd = tm.end
      if (s === step) {
        count++
        start = Math.min(start, tm.start)
        end = Math.max(end, tm.end)
      } else if (s < step) prevEnd = Math.max(prevEnd, tm.end)
    }
  const used = count > 0
  const sorted = [...usedSteps].sort((a, b) => a - b)
  const at = used ? start : prevEnd
  return {
    step,
    used,
    index: used ? sorted.indexOf(step) + 1 : null,
    total: sorted.length,
    start: at,
    end: used ? end : at,
    playEnd,
    count,
  }
}

/** One decimal, no trailing ".0" noise beyond what a stopwatch would show. */
export function secs(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1)
}
