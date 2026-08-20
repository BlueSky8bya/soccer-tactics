/**
 * Pure geometric hit candidates for the pitch (PLAN-007 M1, Codex-reviewed design).
 * DOM paint order stops deciding what a press means: every overlapping candidate is collected
 * with its distance, ordered by an explicit rank tuple, and the caller's modifier-aware adapter
 * picks the behavior. Interactive DOM controls (badge, picker) stay DOM-first in SimplePitch.
 *
 * Preserved numeric contracts (M0 golden):
 * - possession pair: press belongs to the BALL only when dBall/0.9 <= dHolder/1.8 (CHG-046/055)
 * - ghost yields to a live player within 1.2m / live ball within 0.9m (CHG-046)
 * - token hit radii: player TOKEN_HIT_R (2.2m), ball TOKEN_HIT_R*0.8 (CR-02: separate radii)
 * - path hit: screen-space tolerance (px), matching the non-scaling 14px hit stroke (CR-04)
 */
import type { Id, Vec2 } from '@/domain/types'
import { BALL_R, TOKEN_HIT_R } from '@/renderer/Token'

export const PLAYER_HIT_M = TOKEN_HIT_R
export const BALL_HIT_M = TOKEN_HIT_R * 0.8
export const GHOST_PLAYER_HIT_M = 1.9
export const GHOST_BALL_HIT_M = Math.max(1.0, BALL_R + 0.25)
export const PATH_HIT_HALF_PX = 7
export const GHOST_YIELD_PLAYER_M = 1.2
export const GHOST_YIELD_BALL_M = 0.9

export interface PickPlayer {
  id: Id
  pos: Vec2
}

export interface PickGhost {
  entityId: Id
  segId: Id
  kind: 'player' | 'ball'
  pos: Vec2
  step: number
}

export interface PickSegment {
  segId: Id
  entityId: Id
  step: number
  /** Sampled polyline of the FULL displayed path (pre-trim, ~0.5m spacing). */
  pts: Vec2[]
}

export type Candidate =
  | { kind: 'player'; id: Id; d: number; norm: number }
  | { kind: 'ball'; id: Id; d: number; norm: number }
  | { kind: 'ghost'; entityId: Id; segId: Id; pos: Vec2; step: number; d: number; norm: number }
  | { kind: 'segment'; segId: Id; entityId: Id; step: number; d: number; norm: number }

export interface PickInput {
  players: PickPlayer[]
  ball: { id: Id; pos: Vec2 }
  ghosts: PickGhost[]
  segments: PickSegment[]
  pt: Vec2
  metresPerPixel: number
  currentStep: number
  selection: readonly Id[]
  selectedSegmentId: Id | null
}

export interface PickResult {
  /** All in-range candidates, best first (rank tuple below). */
  ordered: Candidate[]
  overlaps: {
    players: Extract<Candidate, { kind: 'player' }>[]
    ball: Extract<Candidate, { kind: 'ball' }> | null
    ghosts: Extract<Candidate, { kind: 'ghost' }>[]
    segments: Extract<Candidate, { kind: 'segment' }>[]
  }
  /** Stable identity of the ordered list — cycling invalidates when this changes (CR-09). */
  fingerprint: string
}

export function stableKey(c: Candidate): string {
  switch (c.kind) {
    case 'player':
    case 'ball':
      return `${c.kind}:${c.id}`
    case 'ghost':
      return `ghost:${c.segId}:${c.entityId}`
    case 'segment':
      return `segment:${c.segId}`
  }
}

function distToPolyline(pt: Vec2, pts: Vec2[]): number {
  let best = Infinity
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!
    const b = pts[i]!
    const abx = b.x - a.x
    const aby = b.y - a.y
    const len2 = abx * abx + aby * aby || 1e-9
    const t = Math.max(0, Math.min(1, ((pt.x - a.x) * abx + (pt.y - a.y) * aby) / len2))
    const dx = a.x + abx * t - pt.x
    const dy = a.y + aby * t - pt.y
    const d = Math.hypot(dx, dy)
    if (d < best) best = d
  }
  return best
}

/**
 * Possession pair comparator (golden G1): who owns a press between a held ball and its holder.
 * Returns 'ball' only when the normalized ball distance wins — the historical .9/1.8 rule.
 */
export function resolvePossessionPair(pt: Vec2, ballPos: Vec2, holderPos: Vec2): 'ball' | 'holder' {
  const dBall = Math.hypot(ballPos.x - pt.x, ballPos.y - pt.y)
  const dHolder = Math.hypot(holderPos.x - pt.x, holderPos.y - pt.y)
  return dBall / 0.9 > dHolder / 1.8 ? 'holder' : 'ball'
}

/** Rank tuple (CR-01): sticky selection > same-kind current-step > normalized distance > key. */
function rank(c: Candidate, input: PickInput): [number, number, number, string] {
  const sticky =
    (c.kind === 'segment' && c.segId === input.selectedSegmentId) ||
    ((c.kind === 'player' || c.kind === 'ball') && input.selection.includes(c.id))
      ? 0
      : 1
  const stepTier =
    c.kind === 'ghost' || c.kind === 'segment' ? (c.step === input.currentStep ? 0 : 1) : 0
  return [sticky, stepTier, c.norm, stableKey(c)]
}

export function pickTargets(input: PickInput): PickResult {
  const { pt, metresPerPixel } = input
  const out: Candidate[] = []
  for (const p of input.players) {
    const d = Math.hypot(p.pos.x - pt.x, p.pos.y - pt.y)
    if (d <= PLAYER_HIT_M) out.push({ kind: 'player', id: p.id, d, norm: d / PLAYER_HIT_M })
  }
  {
    const d = Math.hypot(input.ball.pos.x - pt.x, input.ball.pos.y - pt.y)
    if (d <= BALL_HIT_M) out.push({ kind: 'ball', id: input.ball.id, d, norm: d / BALL_HIT_M })
  }
  for (const g of input.ghosts) {
    const r = g.kind === 'ball' ? GHOST_BALL_HIT_M : GHOST_PLAYER_HIT_M
    const d = Math.hypot(g.pos.x - pt.x, g.pos.y - pt.y)
    if (d <= r)
      out.push({
        kind: 'ghost',
        entityId: g.entityId,
        segId: g.segId,
        pos: g.pos,
        step: g.step,
        d,
        norm: d / r,
      })
  }
  const pathTolM = PATH_HIT_HALF_PX * metresPerPixel
  for (const s of input.segments) {
    const d = distToPolyline(pt, s.pts)
    if (d <= pathTolM)
      out.push({
        kind: 'segment',
        segId: s.segId,
        entityId: s.entityId,
        step: s.step,
        d,
        norm: d / pathTolM,
      })
  }
  out.sort((a, b) => {
    const ra = rank(a, input)
    const rb = rank(b, input)
    for (let i = 0; i < 3; i++) {
      const x = (ra[i] as number) - (rb[i] as number)
      if (x !== 0) return x
    }
    return (ra[3] as string) < (rb[3] as string) ? -1 : 1
  })
  return {
    ordered: out,
    overlaps: {
      players: out.filter((c): c is Extract<Candidate, { kind: 'player' }> => c.kind === 'player'),
      ball: out.find((c): c is Extract<Candidate, { kind: 'ball' }> => c.kind === 'ball') ?? null,
      ghosts: out.filter((c): c is Extract<Candidate, { kind: 'ghost' }> => c.kind === 'ghost'),
      segments: out.filter(
        (c): c is Extract<Candidate, { kind: 'segment' }> => c.kind === 'segment',
      ),
    },
    fingerprint: out.map(stableKey).join('|'),
  }
}

/**
 * Ghost yield rule (golden G2/CHG-046): a plain press on a ghost belongs to a LIVE token that
 * sits underneath. Returns that token's id, or null when the ghost keeps the press.
 */
export function ghostYieldTarget(
  pt: Vec2,
  players: PickPlayer[],
  ball: { id: Id; pos: Vec2 },
): Id | null {
  const nearPlayer = players.find(
    (p) => Math.hypot(p.pos.x - pt.x, p.pos.y - pt.y) < GHOST_YIELD_PLAYER_M,
  )
  const nearBall = Math.hypot(ball.pos.x - pt.x, ball.pos.y - pt.y) < GHOST_YIELD_BALL_M
  if (nearBall) return ball.id
  return nearPlayer?.id ?? null
}
