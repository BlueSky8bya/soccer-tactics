import type { Id, TacticDocument } from '@/domain/types'

/** Team colour for a player id (CSS value). Shared by pitch, timeline, inspector. */
export function teamColorOf(doc: TacticDocument, playerId: Id): string {
  const p = doc.players.find((x) => x.id === playerId)
  return doc.teams.find((t) => t.id === p?.teamId)?.color ?? 'var(--st-team-a)'
}

/**
 * Colour for ANY board entity — the ball included.
 *
 * The rule this exists to enforce: anything that depicts a particular entity (its path, its
 * waypoints, its step badge, the aim guide while it is armed) wears that entity's colour, and only
 * genuine system affordances (marquee, snap guides, the step picker) wear the accent. Painting
 * entity marks accent-blue put blue dots along a red team's run and made them vanish on a blue one
 * (user 2026-08-22: 엔티티 색에 따라서 안내 점이 다르게 보여야지).
 */
export function entityColorOf(doc: TacticDocument, entityId: Id): string {
  return entityId === doc.ball.id ? 'var(--st-ball-path, #f5f5f7)' : teamColorOf(doc, entityId)
}

/**
 * The same identity, but for a FILLED chip rather than a mark on grass.
 *
 * On the pitch the ball is white, which is right against green — but a white chip on a light panel
 * has no edge at all, so a control that belongs to the ball goes dark with white type instead
 * (user 2026-08-22 proposed exactly this). Players keep their team colour with white type.
 * Two roles, because "the ball's colour" honestly differs by ground.
 */
export function entityChipOf(doc: TacticDocument, entityId: Id): { fill: string; ink: string } {
  return entityId === doc.ball.id
    ? { fill: 'var(--st-ball-chip, #1d1d1f)', ink: '#fff' }
    : { fill: teamColorOf(doc, entityId), ink: '#fff' }
}
