import type { Id, TacticDocument } from '@/domain/types'

/** Team colour for a player id (CSS value). Shared by pitch, timeline, inspector. */
export function teamColorOf(doc: TacticDocument, playerId: Id): string {
  const p = doc.players.find((x) => x.id === playerId)
  return doc.teams.find((t) => t.id === p?.teamId)?.color ?? 'var(--st-team-a)'
}
