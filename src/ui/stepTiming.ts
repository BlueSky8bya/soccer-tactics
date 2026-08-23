/**
 * WHERE a step sits on the clock — the three questions the board asks of the timeline.
 *
 * Both attempts at a board caption died here and left the useful part behind. First it narrated
 * the step in words, which the pitch already draws in colour (2026-08-24: 눈으로 봐도 충분히 알 수
 * 있잖아). Then it reported durations, which turned out to be no more wanted (2026-08-24: 2.7초
 * 걸림 1/5번째 이런 정보 아무짝에도 쓸모 없어). What survives is what the INTERACTION needs: where
 * to park the clock for a step, which step is running, and which step a grabbed instant belongs to.
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
