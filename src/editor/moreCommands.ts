/** Commands: reactive opponent, drawings (annotations), scenario presets, document lifecycle. */
import type { Drawing, Id, TacticDocument, Vec2 } from '@/domain/types'
import { generateReaction, stripGenerated, type ReactionOptions } from '@/engine/opponent'
import { newId } from './commands'
import type { EditorCore } from './editorCore'
import { sceneOf } from './segmentCommands'

// ---------- reactive opponent (ADR-0007 Phase 1) ----------

export function applyReaction(core: EditorCore, opts: ReactionOptions): number {
  const doc = core.getDocument()
  const reaction = generateReaction(doc, opts)
  const count = Object.values(reaction.segments).reduce((a, s) => a + s.length, 0)
  core.transaction('Auto-react', (d) => {
    const stripped = stripGenerated(d as TacticDocument, opts.teamId)
    const scene = sceneOf(d as TacticDocument)
    scene.timeline.tracks = stripped.scenes[0]!.timeline.tracks.map((t) => ({
      ...t,
      segments: [...t.segments],
    }))
    for (const [playerId, segs] of Object.entries(reaction.segments)) {
      let track = scene.timeline.tracks.find((t) => t.entityId === playerId)
      if (!track) {
        track = { id: newId('trk'), entityId: playerId, entityKind: 'player', segments: [] }
        scene.timeline.tracks.push(track)
      }
      track.segments.push(...segs)
    }
  })
  return count
}

export function clearReaction(core: EditorCore, teamId: Id): void {
  core.transaction('Clear auto-react', (d) => {
    const stripped = stripGenerated(d as TacticDocument, teamId)
    sceneOf(d as TacticDocument).timeline.tracks = stripped.scenes[0]!.timeline.tracks.map((t) => ({
      ...t,
      segments: [...t.segments],
    }))
  })
}

export function hasGenerated(doc: TacticDocument, teamId: Id): boolean {
  const ids = new Set(doc.players.filter((p) => p.teamId === teamId).map((p) => p.id))
  return sceneOf(doc).timeline.tracks.some(
    (t) => ids.has(t.entityId) && t.segments.some((s) => s.id.startsWith('gen-')),
  )
}

// ---------- drawings / annotations ----------

export function addZone(
  core: EditorCore,
  shape: 'rect' | 'ellipse',
  a: Vec2,
  b: Vec2,
  color?: string,
): Id {
  const id = newId('dr')
  const minX = Math.min(a.x, b.x)
  const minY = Math.min(a.y, b.y)
  const w = Math.abs(b.x - a.x)
  const h = Math.abs(b.y - a.y)
  core.transaction('Add zone', (d) => {
    const drawing: Drawing =
      shape === 'rect'
        ? {
            id,
            kind: 'zone',
            shape: { type: 'rect', at: { x: minX, y: minY }, size: { x: w, y: h } },
            style: { color },
          }
        : {
            id,
            kind: 'zone',
            shape: {
              type: 'ellipse',
              center: { x: minX + w / 2, y: minY + h / 2 },
              radius: { x: w / 2, y: h / 2 },
            },
            style: { color },
          }
    d.drawings.push(drawing)
  })
  return id
}

export function addArrow(
  core: EditorCore,
  from: Vec2,
  to: Vec2,
  color?: string,
  dashed = false,
): Id {
  const id = newId('dr')
  core.transaction('Add arrow', (d) => {
    d.drawings.push({ id, kind: 'arrow', from, to, style: { color, dashed } })
  })
  return id
}

export function addText(core: EditorCore, at: Vec2, text: string, color?: string): Id {
  const id = newId('dr')
  core.transaction('Add text', (d) => {
    d.drawings.push({ id, kind: 'text', at, text, style: { color } })
  })
  return id
}

export function updateDrawingText(core: EditorCore, id: Id, text: string): void {
  core.transaction('Edit text', (d) => {
    const dr = d.drawings.find((x) => x.id === id)
    if (dr && dr.kind === 'text') dr.text = text
  })
}

export function removeDrawings(core: EditorCore, ids: readonly Id[]): void {
  if (!ids.length) return
  const set = new Set(ids)
  core.transaction('Delete annotation', (d) => {
    d.drawings = d.drawings.filter((x) => !set.has(x.id))
  })
}

/** Move a drawing by delta inside an open transaction. */
export function moveDrawingInDraft(draft: TacticDocument, id: Id, delta: Vec2): void {
  const dr = draft.drawings.find((x) => x.id === id)
  if (!dr) return
  const sh = (p: Vec2) => ({ x: p.x + delta.x, y: p.y + delta.y })
  switch (dr.kind) {
    case 'arrow':
      dr.from = sh(dr.from)
      dr.to = sh(dr.to)
      break
    case 'text':
      dr.at = sh(dr.at)
      break
    case 'line':
    case 'freehand':
      dr.points = dr.points.map(sh)
      break
    case 'zone':
      if (dr.shape.type === 'rect') dr.shape.at = sh(dr.shape.at)
      else if (dr.shape.type === 'ellipse') dr.shape.center = sh(dr.shape.center)
      else dr.shape.points = dr.shape.points.map(sh)
      break
  }
}

export function drawingAnchor(dr: Drawing): Vec2 {
  switch (dr.kind) {
    case 'arrow':
      return { x: (dr.from.x + dr.to.x) / 2, y: (dr.from.y + dr.to.y) / 2 }
    case 'text':
      return dr.at
    case 'line':
    case 'freehand':
      return dr.points[0] ?? { x: 0, y: 0 }
    case 'zone':
      if (dr.shape.type === 'rect')
        return { x: dr.shape.at.x + dr.shape.size.x / 2, y: dr.shape.at.y + dr.shape.size.y / 2 }
      if (dr.shape.type === 'ellipse') return dr.shape.center
      return dr.shape.points[0] ?? { x: 0, y: 0 }
  }
}

// ---------- document lifecycle ----------

export function replaceDocument(core: EditorCore, doc: TacticDocument): void {
  core.load(doc)
}
