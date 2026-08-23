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

export function distToPolyline(pt: Vec2, pts: Vec2[]): number {
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
    // canonical (rank-independent): selection-driven reordering must not break cycling (CR-09)
    fingerprint: out.map(stableKey).sort().join('|'),
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

/**
 * WHICH SUBJECT A PRESS WOULD ACT ON — the one answer the halo and the press must share.
 *
 * The hover halo used to mark `ordered[0]`: the global rank top, which compares a ghost and a
 * path by NORMALISED distance. The press instead takes a per-category top and applies a fixed
 * precedence in which a ghost always outranks a path. A ghost is a run's endpoint and an endpoint
 * always lies ON its own path, so the two answers disagreed in a band around every run end: the
 * halo lit the path, the drag moved the ghost, and a user aiming to bend a curve retargeted the
 * run instead (audit R5, browser scan 2026-08-23 — mismatch from −1.5 m to +0.5 m of the ghost).
 *
 * The precedence encoded here mirrors `resolvePointerIntent` exactly:
 *   ghost (unless a live token sits under it) → path (only when no token) → token → nothing.
 * `resolvePointerIntent` stays the authority on what the press then MEANS; this says who it is
 * about, so both consumers can ask the same question.
 */
export function pressSubject(input: {
  ghostTop: Extract<Candidate, { kind: 'ghost' }> | null
  segTop: Extract<Candidate, { kind: 'segment' }> | null
  tokenId: Id | null
  /** `ghostYieldTarget` result: a live token underneath claims the press (golden G2). */
  yieldTokenId: Id | null
}): Candidate | { kind: 'token'; id: Id } | null {
  const { ghostTop, segTop, tokenId, yieldTokenId } = input
  if (ghostTop) {
    if (yieldTokenId) return { kind: 'token', id: yieldTokenId }
    return ghostTop
  }
  if (segTop && !tokenId) return segTop
  if (tokenId) return { kind: 'token', id: tokenId }
  return null
}

/** The hover-halo key for a subject, in the key space the renderer already uses. */
export function subjectKey(
  s: ReturnType<typeof pressSubject>,
  ballId: Id,
): string | null {
  if (!s) return null
  if (s.kind === 'ghost') return `ghost:${s.segId}:${s.entityId}`
  if (s.kind === 'segment') return `segment:${s.segId}`
  if (s.kind === 'token') return `${s.id === ballId ? 'ball' : 'player'}:${s.id}`
  return `${s.kind}:${s.id}`
}

/**
 * FOCUS ISOLATION, without the dead zone.
 *
 * While one movement is being edited its entity is focused, so an overlapping stroke belonging to
 * someone else cannot steal the press (2026-08-21). That filter used to be unconditional: every
 * other entity's paths and ghosts were removed from the candidates outright, even when nothing of
 * the focused entity was anywhere near the cursor. Pressing another player's path then read as
 * bare grass — the press started a marquee, and only after a second press (which dropped focus)
 * could that path be grabbed. That is the "I have to double-click to edit another entity's path"
 * report (user 2026-08-23), measured at 46 m of separation.
 *
 * Focus now holds the press only while it has something IN REACH to hold it with. If the focused
 * entity has neither a ghost nor a path in range, the board answers normally. Overlap — the case
 * the rule exists for — is unaffected, because there the focused candidate is in range by
 * definition.
 */
export function applyFocus(
  ghosts: Extract<Candidate, { kind: 'ghost' }>[],
  segments: Extract<Candidate, { kind: 'segment' }>[],
  focusIds: ReadonlySet<Id>,
): {
  ghosts: Extract<Candidate, { kind: 'ghost' }>[]
  segments: Extract<Candidate, { kind: 'segment' }>[]
} {
  if (focusIds.size === 0) return { ghosts, segments }
  const mineG = ghosts.filter((c) => focusIds.has(c.entityId))
  const mineS = segments.filter((c) => focusIds.has(c.entityId))
  // Something of the focused entity is under the cursor: it keeps the press, as designed.
  if (mineG.length > 0 || mineS.length > 0) return { ghosts: mineG, segments: mineS }
  // Nothing of it is in reach — isolating here would only hide what the user is pointing at.
  return { ghosts, segments }
}
