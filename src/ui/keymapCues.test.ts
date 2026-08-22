import { describe, expect, it } from 'vitest'
import { CUES, type Cue } from './cueHighlight'
import {
  CTRL_BINDINGS,
  GUIDE_ANIM_BINDINGS,
  GUIDE_PLACE_BINDINGS,
  GUIDE_PLAY_BINDINGS,
  isCued,
  type Binding,
} from './keymap'

/** Exactly what the two always-visible panels draw. */
const VISIBLE: Binding[] = [
  ...GUIDE_PLACE_BINDINGS,
  ...GUIDE_ANIM_BINDINGS,
  ...CTRL_BINDINGS,
  ...GUIDE_PLAY_BINDINGS,
]

const lit = (c: Cue) => VISIBLE.filter((b) => isCued(b, new Set<Cue>([c]))).map((b) => b.label)

describe('contextual highlighting — every state the panel can be in has something to say', () => {
  /*
   * THE REPORTED DEFECT, AS A RULE. Clicking the ball lit nothing, because the cue vocabulary only
   * knew about held modifiers (user 2026-08-22: 공 클릭했을 때 하이라이팅 되는 설명도 있어야지).
   * A state that lights no visible row is a state the panel cannot answer — so a new cue without a
   * row, or a row that stops being compact, fails here rather than shipping silent.
   */
  it.each(CUES)('%s lights at least one visible row', (c) => {
    expect(lit(c)).not.toHaveLength(0)
  })

  it('the ball rows are the ones about the ball', () => {
    expect(lit('ball').filter((l) => l.includes('공')).length).toBeGreaterThan(0)
  })

  it('editing a movement lights the token and path rows', () => {
    const rows = lit('path')
    expect(rows.some((l) => l.includes('잔상'))).toBe(true)
    expect(rows.some((l) => l.includes('경로'))).toBe(true)
  })

  it('a selection lights what you can do NEXT with it, not just what it is', () => {
    // Alt is the authoring gesture: with something selected it is the next move, so it belongs to
    // the selection families too — otherwise picking a token answers "you picked a token".
    for (const c of ['ball', 'player'] as const) {
      expect(lit(c).some((l) => l.startsWith('Alt+'))).toBe(true)
    }
  })

  it('no row claims a cue that does not exist', () => {
    const known = new Set<string>(CUES)
    for (const b of VISIBLE) for (const c of b.cues ?? []) expect(known.has(c)).toBe(true)
  })
})
