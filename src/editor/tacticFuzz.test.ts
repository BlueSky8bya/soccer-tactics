/**
 * TACTIC FUZZ — every editing operation, in random order, checked against RESULT invariants.
 * The harness itself lives in `tacticFuzz.harness.ts`; this file is only the campaign it runs.
 *
 * Every defect this campaign found was a REAL one, reachable by hand: two movements clamped onto
 * step 9, a document that was not a fixed point of its own pipeline, a ball teleporting across its
 * holder at a hairpin, a pass launching out of a player who had not touched it, a pass anchored to
 * the ball's position mid-flight on the previous pass, and a player teleporting to a run whose
 * first leg had been deleted. None of them appear in a scripted scenario — they need a particular
 * ORDER, which is the whole point of fuzzing the order.
 */
import { describe, expect, it } from 'vitest'
import type { TacticDocument } from '@/domain/types'
import { board, session, violation, type Failure } from './tacticFuzz.harness'
import { findTrack, makePath, moveBallStartInDraft } from './segmentCommands'
import { addStepPass } from './stepCommands'

const INDENT = '\n    '
/** Sessions are hundreds of compiles each; the default 5 s cannot cover the campaign. */
const BUDGET_MS = 1_800_000
/**
 * Campaign size. The committed default is what every `npm test` run pays for; a soak run widens it
 * without editing anything — `ST_FUZZ_SHORT=3000 ST_FUZZ_LONG=600 npx vitest run tacticFuzz`.
 */
const SHORT = Number(process.env.ST_FUZZ_SHORT ?? 300)
const LONG = Number(process.env.ST_FUZZ_LONG ?? 60)
/** Slide the whole campaign onto fresh seeds — a soak can run in observable slices. */
const SEED0 = Number(process.env.ST_FUZZ_SEED0 ?? 0)

function report(f: Failure): string {
  return f.why + INDENT + f.log.join(INDENT)
}

describe('tactic fuzz — every operation, random order, result invariants', () => {
  it(
    `${SHORT} short sessions stay consistent`,
    () => {
      const bad: string[] = []
      for (let seed = SEED0 + 1; seed <= SEED0 + SHORT && bad.length < 3; seed++) {
        const f = session(seed, 12)
        if (f) bad.push(report(f))
      }
      expect(bad.join('\n\n') || 'consistent').toBe('consistent')
    },
    BUDGET_MS,
  )

  it(
    `${LONG} long sessions stay consistent`,
    () => {
      const bad: string[] = []
      for (let seed = 100_001 + SEED0; seed <= 100_000 + SEED0 + LONG && bad.length < 3; seed++) {
        const f = session(seed, 40)
        if (f) bad.push(report(f))
      }
      expect(bad.join('\n\n') || 'consistent').toBe('consistent')
    },
    BUDGET_MS,
  )

  it('the invariants are not vacuous — a hand-torn document is caught', () => {
    const core = board()
    const d0 = core.getDocument()
    const squad = d0.players.filter((p) => p.teamId === d0.teams[0]!.id)
    const holder = squad[0]!
    const mate = squad[1]!
    core.transaction('give', (dd) =>
      moveBallStartInDraft(
        dd as TacticDocument,
        { x: holder.home.x + 2, y: holder.home.y },
        holder.id,
      ),
    )
    addStepPass(core, makePath([core.getDocument().ball.home, mate.home]).waypoints, 1, holder.id)
    expect(violation(core.getDocument())).toBeNull()
    // now tear the pass origin away by hand — the checker must see it
    const torn = JSON.parse(JSON.stringify(core.getDocument())) as TacticDocument
    const track = findTrack(torn, torn.ball.id)!
    const travel = track.segments.find((s) => s.kind === 'travel')!
    if ('path' in travel) travel.path.waypoints[0]!.p = { x: 95, y: 60 }
    expect(violation(torn)).toMatch(/launches|discontinuity|idempotent/)
  })

  it('the invariants are not vacuous — a detached first run is caught', () => {
    const core = board()
    const d0 = core.getDocument()
    const who = d0.players.filter((p) => p.teamId === d0.teams[0]!.id)[0]!
    const torn = JSON.parse(JSON.stringify(core.getDocument())) as TacticDocument
    const scene = torn.scenes[0]!
    scene.timeline.tracks.push({
      id: 't_torn',
      entityId: who.id,
      entityKind: 'player',
      segments: [
        {
          id: 'seg_torn',
          kind: 'move',
          trigger: { type: 'at', t: 0 },
          timing: { duration: 1 },
          step: 1,
          path: makePath([
            { x: who.home.x + 25, y: who.home.y + 15 },
            { x: who.home.x + 35, y: who.home.y + 20 },
          ]),
        },
      ],
    })
    expect(violation(torn)).toMatch(/first run/)
  })
})
