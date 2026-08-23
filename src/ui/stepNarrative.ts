/**
 * What a step IS, in words (user 2026-08-24: 레이어 단계를 하나 선택했을 때 지금 어떤 상황이고
 * 어떻게 행동할 예정인지가 더 중요하다).
 *
 * The step bar could only ever say "2" — a number with no content. A coach picking a step is
 * asking two questions, and the board alone answers neither quickly: **what is the situation as
 * this step opens**, and **what is about to happen in it**. Both are already in the document and
 * the compiled clock; this module reads them out.
 *
 * Pure: document + compiled timeline + step in, strings out. No React, no store, no clock.
 */
import type { CompiledTimeline } from '@/engine/compile'
import { stateAt } from '@/engine/stateAt'
import type { Id, Segment, TacticDocument } from '@/domain/types'
import { stepOf } from '@/editor/stepCommands'
import { t } from './i18n'

export interface StepNarrative {
  step: number
  /** Does this step hold any authored movement yet? */
  used: boolean
  /** Where the play stands as the step opens. */
  situation: string
  /** One phrase per authored movement in the step, in clock order. */
  actions: string[]
}

/** How many actions are spelled out before the tail collapses into "외 N개". */
export const ACTION_LIST_MAX = 3

const isAuthoredPath = (s: Segment): boolean => 'path' in s && !s.id.startsWith('gen-')

function tracksOf(doc: TacticDocument) {
  return doc.scenes[0]?.timeline.tracks ?? []
}

function playerName(doc: TacticDocument, id: Id | undefined | null): string {
  if (!id) return ''
  if (id === doc.ball.id) return t('step.ball')
  const p = doc.players.find((x) => x.id === id)
  return p ? t('step.playerNo', { n: p.number }) : ''
}

/** Every authored movement in `step`, earliest first. */
interface Movement {
  seg: Segment
  entityId: Id
  kind: 'player' | 'ball'
  start: number
  end: number
  /** The ball track segment that precedes this one, when this IS a ball movement. */
  prevBall?: Segment
}

function movementsIn(doc: TacticDocument, compiled: CompiledTimeline, step: number): Movement[] {
  const out: Movement[] = []
  for (const tr of tracksOf(doc))
    tr.segments.forEach((seg, i) => {
      if (!isAuthoredPath(seg) || stepOf(seg as { step?: number }) !== step) return
      const tm = compiled.segmentTimes[seg.id]
      out.push({
        seg,
        entityId: tr.entityId,
        kind: tr.entityKind === 'ball' ? 'ball' : 'player',
        start: tm?.start ?? 0,
        end: tm?.end ?? tm?.start ?? 0,
        prevBall: tr.entityKind === 'ball' ? tr.segments[i - 1] : undefined,
      })
    })
  return out.sort((a, b) => a.start - b.start)
}

/**
 * The clock time the step OPENS at.
 *
 * An empty step has no window of its own, so it opens wherever the play has got to — the end of
 * the last authored step before it. Without that, picking an unused step 4 described the kickoff
 * frame, which is exactly the confusion this whole feature exists to remove.
 */
export function stepOpensAt(doc: TacticDocument, compiled: CompiledTimeline, step: number): number {
  const { open, prevEnd } = stepBounds(doc, compiled, step)
  return Number.isFinite(open) ? open : prevEnd
}

function stepBounds(
  doc: TacticDocument,
  compiled: CompiledTimeline,
  step: number,
): { open: number; prevEnd: number } {
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
  return { open, prevEnd }
}

/**
 * The state a step INHERITS — everything before it resolved, nothing in it fired yet.
 *
 * Steps butt up against each other, so the two events that matter land on the same instant from
 * opposite sides: the previous step's pass ARRIVES at the boundary, and this step's own pass
 * LEAVES at it. Reading the clock a hair either way gets one of them wrong whichever way you
 * lean — which is how "2단계" first reported "공 이동 중" for a ball still sitting at 6번's feet.
 *
 * So: read just AFTER the boundary (arrivals resolve), then, if the ball is in flight because of
 * a movement belonging to THIS step, rewind to just before that movement launched. The step's own
 * plan never gets to describe the situation it is about to change.
 */
function situationState(
  doc: TacticDocument,
  compiled: CompiledTimeline,
  step: number,
  own: Movement[],
) {
  const { prevEnd } = stepBounds(doc, compiled, step)
  const state = stateAt(compiled, doc, prevEnd > 0 ? prevEnd + 0.02 : 0)
  if (state.ball.status !== 'travel' || !state.ball.segmentId) return state
  const mine = own.find((m) => m.seg.id === state.ball.segmentId)
  return mine ? stateAt(compiled, doc, Math.max(0, mine.start - 0.01)) : state
}

/**
 * Which step is running at clock time `t`, or null between steps. One derivation for the step
 * bar's `aria-current` and the caption's subject — two answers to "which step is this" that could
 * disagree is exactly the bug this feature is meant to prevent.
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

/** One phrase for one movement. */
function describeMovement(doc: TacticDocument, compiled: CompiledTimeline, m: Movement): string {
  if (m.kind === 'ball' && m.seg.kind === 'travel') {
    /*
     * Who kicked it. Read STRUCTURALLY from the ball track — the possession this travel follows —
     * rather than from the clock: at the travel's own start the release has already happened, and
     * a hair before it the previous leg may still be resolving. The document says it plainly.
     */
    const prev = m.prevBall
    const fromId =
      prev && prev.kind === 'possessed'
        ? prev.holderId
        : stateAt(compiled, doc, Math.max(0, m.start - 0.01)).ball.holderId
    const from = playerName(doc, fromId) || t('step.ball')
    const to = playerName(doc, (m.seg as { receiverId?: Id }).receiverId)
    if (m.seg.implicit) return t('step.actLoose')
    if (to) return t('step.actPass', { from, to })
    if (m.seg.travelKind === 'shot') return t('step.actShot', { from })
    return t('step.actOpen', { from })
  }
  // A run WITH the ball is a dribble. Sampled just inside the movement, where possession is
  // settled — on the boundary an arriving pass has not been handed over yet.
  const inside = Math.min(m.end, m.start + 0.02)
  const who = playerName(doc, m.entityId)
  return stateAt(compiled, doc, inside).ball.holderId === m.entityId
    ? t('step.actCarry', { who })
    : t('step.actRun', { who })
}

/** The step, told as situation + plan. */
export function describeStep(
  doc: TacticDocument,
  compiled: CompiledTimeline,
  step: number,
): StepNarrative {
  const movements = movementsIn(doc, compiled, step)
  const state = situationState(doc, compiled, step, movements)
  const holder = playerName(doc, state.ball.holderId)
  const situation = holder
    ? t('step.situationHeld', { who: holder })
    : state.ball.status === 'travel'
      ? t('step.situationTravel')
      : t('step.situationLoose')
  return {
    step,
    used: movements.length > 0,
    situation,
    actions: movements.map((m) => describeMovement(doc, compiled, m)),
  }
}

/** Display form of the action list: a few spelled out, the tail counted. Pure. */
export function actionSummary(actions: readonly string[]): string {
  if (actions.length === 0) return t('step.actNone')
  if (actions.length <= ACTION_LIST_MAX) return actions.join(' · ')
  return `${actions.slice(0, ACTION_LIST_MAX).join(' · ')} ${t('step.actMore', {
    n: actions.length - ACTION_LIST_MAX,
  })}`
}
