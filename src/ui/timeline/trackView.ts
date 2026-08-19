/**
 * Timeline track grouping / visibility (plan M2). Pure; UI state in, rows out. Never touches the document.
 */
import type { Id, TacticDocument, Track } from '@/domain/types'

export type TrackGroupId = 'ball' | `team:${string}`

export interface TrackRow {
  track: Track
  /** Visible only because the entity is selected while its group is filtered/collapsed. */
  forcedVisible: boolean
  generatedCount: number
}

export interface TrackGroup {
  id: TrackGroupId
  label: string
  color?: string
  rows: TrackRow[]
  /** Rows actually shown after filter/collapse + selection override. */
  visibleRows: TrackRow[]
  collapsed: boolean
  filtered: boolean
  totalRows: number
  generatedCount: number
}

export interface TrackVisibilityInput {
  /** 'all' or a team id. Ball group is never filtered (A-01). */
  teamFilter: 'all' | Id
  collapsedGroups: ReadonlySet<TrackGroupId>
  selectedEntityIds: readonly Id[]
}

export function buildTrackGroups(doc: TacticDocument, input: TrackVisibilityInput): TrackGroup[] {
  const scene = doc.scenes[0]
  if (!scene) return []
  const playerTeam = new Map(doc.players.map((p) => [p.id, p.teamId]))
  const selected = new Set(input.selectedEntityIds)
  const groups: TrackGroup[] = []

  const mk = (
    id: TrackGroupId,
    label: string,
    color: string | undefined,
    tracks: Track[],
    filtered: boolean,
  ): TrackGroup => {
    const collapsed = input.collapsedGroups.has(id)
    const rows: TrackRow[] = tracks.map((track) => ({
      track,
      forcedVisible: (filtered || collapsed) && selected.has(track.entityId),
      generatedCount: track.segments.filter((s) => s.id.startsWith('gen-')).length,
    }))
    const visibleRows = filtered || collapsed ? rows.filter((r) => r.forcedVisible) : rows
    return {
      id,
      label,
      color,
      rows,
      visibleRows,
      collapsed,
      filtered,
      totalRows: rows.length,
      generatedCount: rows.reduce((a, r) => a + r.generatedCount, 0),
    }
  }

  for (const team of doc.teams) {
    const tracks = scene.timeline.tracks.filter(
      (t) => t.entityKind === 'player' && playerTeam.get(t.entityId) === team.id,
    )
    if (!tracks.length) continue
    groups.push(
      mk(
        `team:${team.id}`,
        team.name,
        team.color,
        tracks,
        input.teamFilter !== 'all' && input.teamFilter !== team.id,
      ),
    )
  }
  const ballTracks = scene.timeline.tracks.filter((t) => t.entityKind === 'ball')
  if (ballTracks.length) groups.push(mk('ball', '⚽', undefined, ballTracks, false))
  // Tracks whose entity vanished are ignored (not thrown).
  return groups
}
