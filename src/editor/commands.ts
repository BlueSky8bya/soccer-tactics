/**
 * Editor commands — the only way UI mutates the document.
 * Each command is a named transaction on EditorCore (ADR-0005).
 */
import type { Id, Player, TacticDocument, Team, Vec2 } from '@/domain/types'
import type { EditorCore } from './editorCore'
import { clampToPitch, fractionToPitch } from './geometry'
import { formationSlots, getFormation } from '@/presets/formations'

export function newId(prefix: string): Id {
  const rnd =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${prefix}_${rnd}`
}

export const DEFAULT_TEAMS: Team[] = [
  { id: 'team-a', name: 'Home', color: 'var(--st-team-a)', side: 'left' },
  { id: 'team-b', name: 'Away', color: 'var(--st-team-b)', side: 'right' },
]

export function ensureDefaultTeams(core: EditorCore): void {
  if (core.getDocument().teams.length > 0) return
  core.transaction('Add default teams', (d) => {
    d.teams.push(...DEFAULT_TEAMS.map((t) => ({ ...t })))
  })
}

export function nextNumber(doc: TacticDocument, teamId: Id): number {
  const used = new Set(doc.players.filter((p) => p.teamId === teamId).map((p) => p.number))
  let n = 1
  while (used.has(n)) n++
  return n
}

export function addPlayer(core: EditorCore, teamId: Id, at: Vec2): Id {
  const id = newId('p')
  core.transaction('Add player', (d) => {
    const player: Player = {
      id,
      teamId,
      number: nextNumber(d as TacticDocument, teamId),
      home: clampToPitch(at, d.pitch),
    }
    d.players.push(player)
  })
  return id
}

/** Drop ball.initialHolderId when that player no longer exists (shared by every player-removing command). */
export function pruneDanglingHolder(draft: TacticDocument): void {
  const h = draft.ball.initialHolderId
  if (h && !draft.players.some((p) => p.id === h)) delete draft.ball.initialHolderId
}

export function removeEntities(core: EditorCore, ids: readonly Id[]): void {
  if (ids.length === 0) return
  const set = new Set(ids)
  core.transaction('Delete', (d) => {
    d.players = d.players.filter((p) => !set.has(p.id))
    for (const scene of d.scenes) {
      scene.timeline.tracks = scene.timeline.tracks.filter((t) => !set.has(t.entityId))
    }
    pruneDanglingHolder(d as TacticDocument)
  })
}

/** Set the home position of a player or the ball. Used inside drag gestures via core.update. */
export function setEntityHome(draft: TacticDocument, id: Id, to: Vec2): void {
  const p = clampToPitch(to, draft.pitch)
  if (id === draft.ball.id) {
    draft.ball.home = p
    return
  }
  const player = draft.players.find((x) => x.id === id)
  if (!player) return
  const prev = player.home
  player.home = p
  // Keep the first movement attached: if its first waypoint sat on the old start, move it too.
  const track = draft.scenes[0]?.timeline.tracks.find((tr) => tr.entityId === id)
  const first = track?.segments.find((s) => s.kind === 'move')
  if (first && first.kind === 'move' && first.path.waypoints.length) {
    const w0 = first.path.waypoints[0]!
    if (Math.hypot(w0.p.x - prev.x, w0.p.y - prev.y) < 0.6) {
      const dx = p.x - w0.p.x
      const dy = p.y - w0.p.y
      w0.p = { x: p.x, y: p.y }
      if (w0.handleOut) w0.handleOut = { x: w0.handleOut.x + dx, y: w0.handleOut.y + dy }
    }
  }
}

export function getEntityHome(doc: TacticDocument, id: Id): Vec2 | undefined {
  if (id === doc.ball.id) return doc.ball.home
  return doc.players.find((p) => p.id === id)?.home
}

export function nudgeEntities(
  core: EditorCore,
  ids: readonly Id[],
  delta: Vec2,
  coalesceKey = `nudge:${ids.join(',')}`,
): void {
  if (ids.length === 0) return
  core.transaction(
    'Nudge',
    (d) => {
      for (const id of ids) {
        const cur = getEntityHome(d as TacticDocument, id)
        if (cur) setEntityHome(d as TacticDocument, id, { x: cur.x + delta.x, y: cur.y + delta.y })
      }
    },
    { coalesceKey },
  )
}

export function setPlayerNumber(core: EditorCore, id: Id, number: number): void {
  core.transaction('Set number', (d) => {
    const p = d.players.find((x) => x.id === id)
    if (p) p.number = Math.max(0, Math.min(99, Math.round(number)))
  })
}

export function setPlayerLabel(core: EditorCore, id: Id, label: string): void {
  core.transaction('Set label', (d) => {
    const p = d.players.find((x) => x.id === id)
    if (!p) return
    if (label.trim()) p.label = label.trim()
    else delete p.label
  })
}

export function setEntityPosition(core: EditorCore, id: Id, to: Vec2): void {
  core.transaction('Set position', (d) => setEntityHome(d as TacticDocument, id, to), {
    coalesceKey: `pos:${id}`,
  })
}

export function setDocumentTitle(core: EditorCore, title: string): void {
  core.transaction('Rename', (d) => {
    d.meta.title = title
  })
}

// ---------- formations ----------

/**
 * Apply a formation preset to a team: replaces that team's players with 11 positioned players.
 * Provenance recorded in formationRefs. Players remain freely movable afterwards.
 */
export function applyFormation(core: EditorCore, teamId: Id, formationId: Id): boolean {
  const f = getFormation(formationId)
  if (!f) return false
  const doc = core.getDocument()
  const team = doc.teams.find((t) => t.id === teamId)
  if (!team) return false
  const slots = formationSlots(f)
  core.transaction(`Apply ${f.name}`, (d) => {
    const keepIds = new Set(d.players.filter((p) => p.teamId !== teamId).map((p) => p.id))
    d.players = d.players.filter((p) => keepIds.has(p.id))
    for (const s of slots) {
      d.players.push({
        id: newId('p'),
        teamId,
        number: s.number,
        role: s.role,
        home: fractionToPitch(s.frac, d.pitch, team.side),
      })
    }
    for (const scene of d.scenes) {
      scene.timeline.tracks = scene.timeline.tracks.filter(
        (t) => keepIds.has(t.entityId) || t.entityKind === 'ball',
      )
    }
    d.formationRefs = { ...(d.formationRefs ?? {}), [teamId]: f.id }
    pruneDanglingHolder(d as TacticDocument)
  })
  return true
}

export function clearTeam(core: EditorCore, teamId: Id): void {
  core.transaction('Clear team', (d) => {
    const removed = new Set(d.players.filter((p) => p.teamId === teamId).map((p) => p.id))
    d.players = d.players.filter((p) => !removed.has(p.id))
    for (const scene of d.scenes) {
      scene.timeline.tracks = scene.timeline.tracks.filter((t) => !removed.has(t.entityId))
    }
    if (d.formationRefs) delete d.formationRefs[teamId]
    pruneDanglingHolder(d as TacticDocument)
  })
}
