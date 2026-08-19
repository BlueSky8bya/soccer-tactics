import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from '@/domain'
import type { Track } from '@/domain/types'
import { DEFAULT_TEAMS } from '@/editor/commands'
import { buildTrackGroups } from './trackView'

function docWithTracks() {
  const doc = createEmptyDocument({ id: 'd', now: '2026-08-19T00:00:00.000Z' })
  doc.teams = DEFAULT_TEAMS.map((t) => ({ ...t }))
  for (let i = 1; i <= 11; i++) {
    doc.players.push({ id: `a${i}`, teamId: 'team-a', number: i, home: { x: 10, y: i * 5 } })
    doc.players.push({ id: `b${i}`, teamId: 'team-b', number: i, home: { x: 90, y: i * 5 } })
  }
  const tr = (id: string, kind: 'player' | 'ball', gen = 0): Track => ({
    id: `trk-${id}`,
    entityId: id,
    entityKind: kind,
    segments: Array.from({ length: 1 + gen }, (_, k) => ({
      id: k === 0 ? `s-${id}` : `gen-${id}-${k}`,
      kind: 'move' as const,
      trigger: { type: 'at' as const, t: k },
      timing: { speed: 5 },
      path: {
        waypoints: [
          { id: 'w0', p: { x: 0, y: 0 } },
          { id: 'w1', p: { x: 5, y: 0 } },
        ],
      },
    })),
  })
  const tl = doc.scenes[0]!.timeline
  // ball first on purpose — grouping must order by team then ball
  tl.tracks.push(tr('ball', 'ball'))
  for (let i = 1; i <= 11; i++) tl.tracks.push(tr(`b${i}`, 'player', 2))
  for (let i = 1; i <= 11; i++) tl.tracks.push(tr(`a${i}`, 'player'))
  tl.tracks.push(tr('ghost', 'player')) // entity no longer exists
  return doc
}

describe('buildTrackGroups', () => {
  it('groups player tracks by document team order and keeps ball separate', () => {
    const g = buildTrackGroups(docWithTracks(), {
      teamFilter: 'all',
      collapsedGroups: new Set(),
      selectedEntityIds: [],
    })
    expect(g.map((x) => x.id)).toEqual(['team:team-a', 'team:team-b', 'ball'])
    expect(g[0]!.visibleRows.length).toBe(11)
    expect(g[1]!.generatedCount).toBe(22)
    expect(g[2]!.visibleRows.length).toBe(1)
  })
  it('hides ordinary rows for a filter but forces selected entity visible exactly once', () => {
    const g = buildTrackGroups(docWithTracks(), {
      teamFilter: 'team-a',
      collapsedGroups: new Set(),
      selectedEntityIds: ['b3'],
    })
    const teamB = g.find((x) => x.id === 'team:team-b')!
    expect(teamB.filtered).toBe(true)
    expect(teamB.visibleRows.map((r) => r.track.entityId)).toEqual(['b3'])
    expect(teamB.visibleRows[0]!.forcedVisible).toBe(true)
    expect(g.find((x) => x.id === 'ball')!.visibleRows.length).toBe(1) // ball never filtered
  })
  it('keeps the selected row visible when its group is collapsed', () => {
    const g = buildTrackGroups(docWithTracks(), {
      teamFilter: 'all',
      collapsedGroups: new Set(['team:team-a']),
      selectedEntityIds: ['a5'],
    })
    const teamA = g.find((x) => x.id === 'team:team-a')!
    expect(teamA.collapsed).toBe(true)
    expect(teamA.visibleRows.map((r) => r.track.entityId)).toEqual(['a5'])
  })
  it('ignores tracks whose entity no longer exists without throwing', () => {
    const g = buildTrackGroups(docWithTracks(), {
      teamFilter: 'all',
      collapsedGroups: new Set(),
      selectedEntityIds: [],
    })
    expect(g.flatMap((x) => x.rows).some((r) => r.track.entityId === 'ghost')).toBe(false)
  })
})
