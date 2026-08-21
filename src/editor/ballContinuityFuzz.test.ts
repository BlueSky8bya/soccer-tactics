import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from '@/domain'
import type { Id, TacticDocument, Vec2 } from '@/domain/types'
import { applyFormations, seedDefaultTeams } from './commands'
import { EditorCore } from './editorCore'
import { makePath, moveBallStartInDraft } from './segmentCommands'
import { addStepPass, addStepRun, MAX_STEP } from './stepCommands'
import { compile } from '@/engine/compile'
import { stateAt } from '@/engine/stateAt'
import { describeJump, maxBallJump } from '@/engine/ballContinuity'

/**
 * Invariant B1, fuzzed over AUTHORING ORDER.
 *
 * The defect this suite exists for was order-dependent, not geometry-dependent: a ball track
 * created before the receiver's own track left the pass anchored to that player's home, because
 * the compile fixed-point built the travel's schedule while their run was still unplaced. Hand
 * scenarios kept missing it — the same board authored in a different sequence was fine. So the
 * guard randomises the sequence: runs before passes, passes before runs, receivers whose first
 * movement is drawn after the ball already has a track.
 *
 * Deterministic (seeded LCG): a failure is always reproducible from the printed seed.
 */

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}

function board() {
  const core = new EditorCore(
    seedDefaultTeams(createEmptyDocument({ id: 'r', now: '2026-08-22T00:00:00.000Z' })),
  )
  const [home, away] = core.getDocument().teams
  applyFormations(core, [
    { teamId: home!.id, formationId: '4-3-3' },
    { teamId: away!.id, formationId: '4-4-2' },
  ])
  return core
}

/** Where the board draws the ball at rest after `segId` — the spot the user can actually grab. */
function restingBallAfter(core: EditorCore, segId: Id | null): Vec2 {
  const doc = core.getDocument()
  const cm = compile(doc)
  const t = segId ? (cm.segmentTimes[segId]?.end ?? 0) + 0.05 : 0
  return stateAt(cm, doc, t).ball.pos
}

const clampToPitch = (p: Vec2): Vec2 => ({
  x: Math.max(2, Math.min(103, p.x)),
  y: Math.max(2, Math.min(66, p.y)),
})

interface Run {
  seed: number
  log: string[]
}

/** One randomised authoring session. Returns null when the ball stayed continuous throughout. */
function session(seed: number): { jump: string; run: Run } | null {
  const rand = rng(seed)
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!
  const core = board()
  const doc0 = core.getDocument()
  const team = doc0.teams[0]!.id
  const squad = doc0.players.filter((p) => p.teamId === team)
  const opener = pick(squad)
  const log: string[] = [`seed ${seed}`, `ball to #${opener.number}`]
  core.transaction('give', (dd) =>
    moveBallStartInDraft(
      dd as TacticDocument,
      { x: opener.home.x + 2, y: opener.home.y },
      opener.id,
    ),
  )

  /** Last authored movement per player, so a run can chain from the previous one's end. */
  const tip = new Map<Id, Vec2>(squad.map((p) => [p.id, p.home]))
  let lastBallSeg: Id | null = null
  let step = 1
  let holder = opener.id
  const check = (what: string): { jump: string; run: Run } | null => {
    const j = maxBallJump(core.getDocument())
    return j ? { jump: `${what}: ${describeJump(j)}`, run: { seed, log } } : null
  }

  const actions = 3 + Math.floor(rand() * 5)
  for (let i = 0; i < actions && step <= MAX_STEP; i++) {
    const wantRun = rand() < 0.55
    if (wantRun) {
      const who = pick(squad)
      const from = tip.get(who.id)!
      const to = clampToPitch({ x: from.x + (rand() - 0.3) * 30, y: from.y + (rand() - 0.5) * 24 })
      if (Math.hypot(to.x - from.x, to.y - from.y) < 3) continue
      addStepRun(core, who.id, makePath([from, to]).waypoints, step)
      tip.set(who.id, to)
      log.push(`step ${step}: run #${who.number} → (${to.x.toFixed(1)}, ${to.y.toFixed(1)})`)
    } else {
      // pass from the ball WHERE THE BOARD SHOWS IT to some other player's current tip
      const target = pick(squad.filter((p) => p.id !== holder))
      const from = restingBallAfter(core, lastBallSeg)
      const to = tip.get(target.id)!
      if (Math.hypot(to.x - from.x, to.y - from.y) < 4) continue
      lastBallSeg = addStepPass(core, makePath([from, to]).waypoints, step, holder)
      holder = target.id
      log.push(`step ${step}: pass → #${target.number}`)
    }
    const bad = check(log[log.length - 1] ?? 'action')
    if (bad) return bad
    if (rand() < 0.6) step++
  }
  return null
}

describe('ball continuity — fuzzed authoring order (invariant B1)', () => {
  it('holds across 120 randomised authoring sessions', () => {
    const failures: string[] = []
    for (let seed = 1; seed <= 120; seed++) {
      const bad = session(seed)
      if (bad) failures.push(`${bad.jump}\n    ${bad.run.log.join('\n    ')}`)
      if (failures.length >= 3) break
    }
    expect(failures.join('\n\n') || 'continuous').toBe('continuous')
  })
})
