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

/** Pure: a document with the two default teams if it has none. Used at bootstrap/new so teams are never an undo step. */
export function seedDefaultTeams(doc: TacticDocument): TacticDocument {
  if (doc.teams.length > 0) return doc
  return { ...doc, teams: DEFAULT_TEAMS.map((t) => ({ ...t })) }
}

/**
 * Ball segments that referenced players who no longer exist (formation change / clear team):
 * possessed by a gone player → removed; pass to a gone receiver → loose (no ghost passes).
 */
function pruneDanglingBallSegments(d: TacticDocument, alive: ReadonlySet<Id>): void {
  for (const scene of d.scenes) {
    for (const track of scene.timeline.tracks) {
      if (track.entityKind !== 'ball') continue
      track.segments = track.segments.filter(
        (s) => !(s.kind === 'possessed' && !alive.has(s.holderId)),
      )
      for (const s of track.segments) {
        if (s.kind === 'travel' && s.receiverId && !alive.has(s.receiverId)) {
          delete s.receiverId
          if (s.travelKind === 'pass') s.travelKind = 'loose'
        }
      }
      // Re-chain: a segment that pointed at a removed one falls back to its own nominal time.
      const ids = new Set(track.segments.map((s) => s.id))
      for (const s of track.segments) {
        if (s.trigger.type === 'afterSegment' && !ids.has(s.trigger.segmentId))
          s.trigger = { type: 'at', t: 0 }
      }
    }
  }
}

/** "공 투입": ball to the centre spot, loose (side-panel button). */
export function placeBallCenter(core: EditorCore): void {
  core.transaction('Place ball', (d) => {
    d.ball.home = { x: d.pitch.length / 2, y: d.pitch.width / 2 }
    delete d.ball.initialHolderId
    const track = d.scenes[0]?.timeline.tracks.find((t) => t.entityKind === 'ball')
    const first = track?.segments[0]
    if (first && first.kind === 'possessed' && first.trigger.type === 'at' && first.trigger.t === 0)
      track!.segments.shift()
  })
}

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
  core.transaction(
    'Set number',
    (d) => {
      const p = d.players.find((x) => x.id === id)
      if (p) p.number = Math.max(0, Math.min(99, Math.round(number)))
    },
    { coalesceKey: `number:${id}` },
  )
}

export function setPlayerLabel(core: EditorCore, id: Id, label: string): void {
  core.transaction(
    'Set label',
    (d) => {
      const p = d.players.find((x) => x.id === id)
      if (!p) return
      if (label.trim()) p.label = label.trim()
      else delete p.label
    },
    { coalesceKey: `label:${id}` },
  )
}

export function setEntityPosition(core: EditorCore, id: Id, to: Vec2): void {
  core.transaction('Set position', (d) => setEntityHome(d as TacticDocument, id, to), {
    coalesceKey: `pos:${id}`,
  })
}

export function setDocumentTitle(core: EditorCore, title: string): void {
  core.transaction(
    'Rename',
    (d) => {
      d.meta.title = title
    },
    { coalesceKey: 'title' },
  )
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
  core.transaction(`Apply ${f.name}`, (d) => {
    applyFormationInDraft(d as TacticDocument, team, f)
  })
  return true
}

/** Several teams in one undo step (quick start). Same rules as `applyFormation`. */
export function applyFormations(
  core: EditorCore,
  picks: readonly { teamId: Id; formationId: Id }[],
): boolean {
  const doc = core.getDocument()
  const resolved = picks.map((p) => ({
    team: doc.teams.find((t) => t.id === p.teamId),
    f: getFormation(p.formationId),
  }))
  if (resolved.some((r) => !r.team || !r.f)) return false
  core.transaction('Quick start', (d) => {
    for (const r of resolved) applyFormationInDraft(d as TacticDocument, r.team!, r.f!)
  })
  return true
}

function applyFormationInDraft(
  d: TacticDocument,
  team: Pick<Team, 'id' | 'side'>,
  f: NonNullable<ReturnType<typeof getFormation>>,
): void {
  const wasEmpty = d.players.length === 0
  const slots = formationSlots(f)
  const keepIds = new Set(d.players.filter((p) => p.teamId !== team.id).map((p) => p.id))
  d.players = d.players.filter((p) => keepIds.has(p.id))
  const added: Id[] = []
  for (const s of slots) {
    const id = newId('p')
    added.push(id)
    d.players.push({
      id,
      teamId: team.id,
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
  d.formationRefs = { ...(d.formationRefs ?? {}), [team.id]: f.id }
  pruneDanglingHolder(d)
  pruneDanglingBallSegments(d, keepIds)
  // First fill of an empty pitch: the ball starts with this team's player nearest to it (kick-off feel),
  // so "Alt+drag the ball = pass" works immediately. Later formation changes never reassign.
  const ballHasSegments = d.scenes.some((sc) =>
    sc.timeline.tracks.some((t) => t.entityKind === 'ball' && t.segments.length > 0),
  )
  if (wasEmpty && !d.ball.initialHolderId && !ballHasSegments && added.length > 0) {
    const ball = d.ball.home
    let best: { id: Id; dist: number } | undefined
    for (const p of d.players) {
      if (!added.includes(p.id)) continue
      const dist = Math.hypot(p.home.x - ball.x, p.home.y - ball.y)
      if (!best || dist < best.dist) best = { id: p.id, dist }
    }
    if (best) d.ball.initialHolderId = best.id
  }
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
    pruneDanglingBallSegments(d as TacticDocument, new Set(d.players.map((p) => p.id)))
  })
}
