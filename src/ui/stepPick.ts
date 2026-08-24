/**
 * Picking a step to LOOK at — one implementation, shared by the step chips and the number keys.
 *
 * They used to be two. The chip stopped the play, moved the clock and re-filed whatever movement
 * was selected; the key only set the number. So "show me step 3" meant different things depending
 * on how you asked, and reading a finished tactic with the number keys left the board describing a
 * step it was not standing in (user 2026-08-24: 계속 누르니까 단계들이 서로 섞여서 보일 때도 있고).
 *
 * What a pick means, in full:
 *  - the play stops — a running play is not the step you just asked to see;
 *  - the selection clears — a selected movement stays painted whatever step it is on, so keeping it
 *    would lay the old step's path over the new one;
 *  - the view switches to that step. Asking for step 3 IS asking to see step 3, and under 전체 보기
 *    the same press used to move a chip and change nothing on screen — a key that answers with
 *    nothing is worse than one that changes the mode, and 전체 is one click away in the same panel
 *    (user 2026-08-24: 숫자 키 누를 때는 자동으로 해당 단계 모드로 보여야 하고);
 *  - the board stands at the step's opening.
 *
 * It does NOT touch the document. Retargeting a selected movement is Shift+number (ADR-0009 v28).
 */
import type { CompiledTimeline } from '@/engine/compile'
import type { TacticDocument } from '@/domain/types'
import { useUiStore } from '@/editor/uiStore'
import { stepOpensAt } from './stepTiming'

/**
 * The other cell on the same bar: show the WHOLE play.
 *
 * 전체 used to be a segmented control floating over the board's top-right corner while the step
 * number lived in the footer — the same fact, two places, 700px apart diagonally, so you read one
 * and never looked at the other (user 2026-08-25: 전체 모드랑 해당 레이어 모드랑 어느 순간
 * 바꺼있어서 인식하기 헷갈려). It is one cell of the step bar now: one control, one lit cell,
 * one place to look, and “which mode am I in” stops being a second thing to remember.
 */
export function pickAll(): void {
  const st = useUiStore.getState()
  st.setPlaying(false)
  st.selectSegment(null)
  st.setStepIsolate(false)
  // the whole play is drawn from kickoff — there is no single frame “all steps” could mean
  st.setPlayhead(0)
}

export function pickStep(doc: TacticDocument, compiled: CompiledTimeline, n: number): void {
  const st = useUiStore.getState()
  st.setPlaying(false)
  st.selectSegment(null)
  st.setStepIsolate(true)
  st.setCurrentStep(n)
  st.setPlayhead(stepOpensAt(doc, compiled, n))
}
