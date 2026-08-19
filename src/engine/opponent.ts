/**
 * Reactive opponent — ADR-0007 Phase 1 (rule-based). Pure & deterministic.
 *
 * Given the authored document, generates defensive reactions for one team as ordinary move
 * segments (press / cover / shape-shift) anchored to ball events via onEvent triggers, so the
 * result stays editable and follows the user's timing when passes are retimed.
 *
 * Heuristics (football-marl-lab lineage: PPDA-style presser count by intensity):
 *   pressers = 1 + round(intensity * 2)       (1..3)
 *   press  → goal-side point ~1 m from the predicted ball position, sprint
 *   cover  → on the ball→own-goal line, 7 m from the ball (2nd cover offset laterally), run
 *   shape  → shift toward the ball (x 35 %, y 25 %) from home, jog — only if > 1.5 m
 */
import type { Id, PlayerSegment, TacticDocument, Trigger, Vec2 } from '@/domain/types'
import { compile, type CompiledTimeline } from './compile'
import { stateAt } from './stateAt'

export interface ReactionOptions {
  teamId: Id
  /** 0..1 — press intensity (low block → gegenpress). */
  intensity?: number
  /** Reaction delay after each ball event (s). */
  reactionDelay?: number
  /** Look-ahead used to predict where the ball will be (s). */
  lookAhead?: number
}

export interface GeneratedReaction {
  /** playerId → generated segments (ids prefixed `gen-`). */
  segments: Record<Id, PlayerSegment[]>
  /** Human-readable summary for UI/tests. */
  summary: { playerId: Id; role: 'press' | 'cover' | 'shape'; at: number }[]
}

export const GEN_PREFIX = 'gen-'

const SPEED = { press: 7, cover: 5.5, shape: 3.5 }

function unit(from: Vec2, to: Vec2): Vec2 {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy) || 1
  return { x: dx / len, y: dy / len }
}

function clampPitch(p: Vec2, doc: TacticDocument): Vec2 {
  return {
    x: Math.max(0.5, Math.min(doc.pitch.length - 0.5, p.x)),
    y: Math.max(0.5, Math.min(doc.pitch.width - 0.5, p.y)),
  }
}

export function generateReaction(
  doc: TacticDocument,
  opts: ReactionOptions,
  compiled: CompiledTimeline = compile(stripGenerated(doc, opts.teamId)),
): GeneratedReaction {
  const intensity = Math.max(0, Math.min(1, opts.intensity ?? 0.6))
  const delay = opts.reactionDelay ?? 0.3
  const look = opts.lookAhead ?? 0.6
  const team = doc.teams.find((t) => t.id === opts.teamId)
  const players = doc.players.filter((p) => p.teamId === opts.teamId)
  const out: GeneratedReaction = { segments: {}, summary: [] }
  if (!team || players.length === 0) return out

  const base = stripGenerated(doc, opts.teamId)
  const ownGoal: Vec2 = { x: team.side === 'left' ? 0 : base.pitch.length, y: base.pitch.width / 2 }
  const centre: Vec2 = { x: base.pitch.length / 2, y: base.pitch.width / 2 }

  // Key moments: scene start + every ball release/receive.
  const moments: { t: number; trigger: Trigger }[] = [{ t: 0, trigger: { type: 'at', t: 0.2 } }]
  for (const ev of compiled.events) {
    if (ev.kind === 'ball.released' || ev.kind === 'ball.received') {
      moments.push({
        t: ev.t,
        trigger: {
          type: 'onEvent',
          event: { kind: ev.kind, segmentId: ev.segmentId },
          offset: delay,
        },
      })
    }
  }
  moments.sort((a, b) => a.t - b.t)

  // Per-player plan state (plan M4): where the last generated move ends, when it nominally ends,
  // the segment itself (for retarget/coalesce) and the last role (presser hysteresis).
  interface PlanState {
    lastEnd: Vec2
    nominalEnd: number
    seg: PlayerSegment
    role: 'press' | 'cover' | 'shape'
    at: number
  }
  const plan = new Map<Id, PlanState>()
  const counters = new Map<Id, number>()
  const PRESS_HYSTERESIS_M = 2 // challenger must be clearly closer to take over pressing
  const SHUTTLE_MIN_LEG_M = 5
  const SHUTTLE_COS = -0.8
  const nPress = 1 + Math.round(intensity * 2)
  const nCover =
    players.length > nPress + 1
      ? Math.min(2, players.length - nPress)
      : Math.max(0, players.length - nPress)

  for (const m of moments) {
    const now = stateAt(compiled, base, m.t + delay)
    const ahead = stateAt(compiled, base, m.t + delay + look)
    const ballPred = ahead.ball.pos
    // Only react while the other team has the ball (or it is loose)
    const holder = now.ball.holderId
      ? base.players.find((p) => p.id === now.ball.holderId)
      : undefined
    if (holder && holder.teamId === opts.teamId) continue

    const posOf = (pl: (typeof players)[number]): Vec2 =>
      plan.get(pl.id)?.lastEnd ?? now.players[pl.id]?.pos ?? pl.home
    const distBall = (pl: (typeof players)[number]) => {
      const q = posOf(pl)
      return Math.hypot(q.x - ballPred.x, q.y - ballPred.y)
    }
    // Deterministic order: distance, then document order. Presser hysteresis: a current presser
    // keeps the job unless a challenger is closer by the margin.
    const byDoc = new Map(players.map((pl, i) => [pl.id, i]))
    const ordered = [...players].sort((a, b) => {
      let da = distBall(a)
      let db = distBall(b)
      if (plan.get(a.id)?.role === 'press') da -= PRESS_HYSTERESIS_M
      if (plan.get(b.id)?.role === 'press') db -= PRESS_HYSTERESIS_M
      return da - db || byDoc.get(a.id)! - byDoc.get(b.id)!
    })
    const toGoal = unit(ballPred, ownGoal)
    const lateral: Vec2 = { x: -toGoal.y, y: toGoal.x }

    ordered.forEach((p, idx) => {
      const prevPlan = plan.get(p.id)
      const start = prevPlan?.lastEnd ?? now.players[p.id]?.pos ?? p.home
      const actualStart = m.t + delay
      let role: 'press' | 'cover' | 'shape'
      let target: Vec2
      if (idx < nPress) {
        role = 'press'
        const spread = nPress > 1 ? (idx - (nPress - 1) / 2) * 2.2 : 0
        target = {
          x: ballPred.x + toGoal.x * 1.2 + lateral.x * spread,
          y: ballPred.y + toGoal.y * 1.2 + lateral.y * spread,
        }
      } else if (idx < nPress + nCover) {
        role = 'cover'
        const k = idx - nPress
        const side = k === 0 ? -1 : 1
        target = {
          x: ballPred.x + toGoal.x * 7 + lateral.x * side * 3,
          y: ballPred.y + toGoal.y * 7 + lateral.y * side * 3,
        }
      } else {
        role = 'shape'
        target = {
          x: p.home.x + (ballPred.x - centre.x) * 0.35,
          y: p.home.y + (ballPred.y - centre.y) * 0.25,
        }
      }
      target = clampPitch(target, base)
      const dist = Math.hypot(target.x - start.x, target.y - start.y)
      if (dist < 1.5) return

      // Anti-shuttle / coalesce: if the previous generated move has not finished by this moment,
      // or the new leg would just run back the way we came, retarget the previous move instead
      // of queueing an out-and-back.
      if (prevPlan) {
        const prevSeg = prevPlan.seg
        const prevFrom = prevSeg.kind === 'move' ? prevSeg.path.waypoints[0]!.p : start
        const legA = { x: start.x - prevFrom.x, y: start.y - prevFrom.y }
        const legB = { x: target.x - start.x, y: target.y - start.y }
        const la = Math.hypot(legA.x, legA.y)
        const lb = Math.hypot(legB.x, legB.y)
        const cos = la > 0 && lb > 0 ? (legA.x * legB.x + legA.y * legB.y) / (la * lb) : 1
        const unfinished = actualStart < prevPlan.nominalEnd - 1e-6
        const shuttle = la >= SHUTTLE_MIN_LEG_M && lb >= SHUTTLE_MIN_LEG_M && cos <= SHUTTLE_COS
        if ((unfinished || shuttle) && prevSeg.kind === 'move') {
          const newTarget = target
          const newDist = Math.hypot(newTarget.x - prevFrom.x, newTarget.y - prevFrom.y)
          if (newDist < 1.5) return
          prevSeg.path.waypoints[1]!.p = newTarget
          prevSeg.timing = { speed: SPEED[role] }
          prevPlan.lastEnd = newTarget
          prevPlan.nominalEnd = prevPlan.at + newDist / SPEED[role]
          prevPlan.role = role
          const sIdx = out.summary.findIndex((x) => x.playerId === p.id && x.at === prevPlan.at)
          if (sIdx >= 0) out.summary[sIdx]!.role = role
          return
        }
      }

      const k = (counters.get(p.id) ?? 0) + 1
      counters.set(p.id, k)
      const seg: PlayerSegment = {
        id: `${GEN_PREFIX}${p.id}-${k}`,
        kind: 'move',
        trigger: m.trigger,
        timing: { speed: SPEED[role] },
        path: {
          waypoints: [
            { id: `${GEN_PREFIX}${p.id}-${k}-a`, p: start },
            { id: `${GEN_PREFIX}${p.id}-${k}-b`, p: target },
          ],
        },
      }
      ;(out.segments[p.id] ??= []).push(seg)
      plan.set(p.id, {
        lastEnd: target,
        nominalEnd: actualStart + dist / SPEED[role],
        seg,
        role,
        at: actualStart,
      })
      out.summary.push({ playerId: p.id, role, at: actualStart })
    })
  }
  return out
}

/** Document without previously generated segments for the team (so regeneration is idempotent). */
export function stripGenerated(doc: TacticDocument, teamId: Id): TacticDocument {
  const ids = new Set(doc.players.filter((p) => p.teamId === teamId).map((p) => p.id))
  const scene = doc.scenes[0]
  if (!scene) return doc
  const tracks = scene.timeline.tracks
    .map((t) =>
      ids.has(t.entityId)
        ? { ...t, segments: t.segments.filter((s) => !s.id.startsWith(GEN_PREFIX)) }
        : t,
    )
    .filter((t) => t.segments.length > 0)
  return {
    ...doc,
    scenes: [{ ...scene, timeline: { ...scene.timeline, tracks } }, ...doc.scenes.slice(1)],
  }
}
