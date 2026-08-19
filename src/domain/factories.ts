import { SCHEMA_VERSION, type Pitch, type TacticDocument, type Vec2 } from './types'

export const DEFAULT_PITCH: Pitch = { length: 105, width: 68, unit: 'm', view: 'full' }

export function vec2(x: number, y: number): Vec2 {
  return { x, y }
}

export interface CreateDocumentOptions {
  id?: string
  title?: string
  now?: string
}

/** Empty document: default pitch, no players, ball on the centre spot, one empty scene. */
export function createEmptyDocument(opts: CreateDocumentOptions = {}): TacticDocument {
  const now = opts.now ?? new Date().toISOString()
  const id = opts.id ?? 'doc'
  return {
    schemaVersion: SCHEMA_VERSION,
    id,
    meta: { title: opts.title ?? 'Untitled tactic', createdAt: now, updatedAt: now },
    pitch: { ...DEFAULT_PITCH },
    teams: [],
    players: [],
    ball: { id: 'ball', home: vec2(DEFAULT_PITCH.length / 2, DEFAULT_PITCH.width / 2) },
    drawings: [],
    scenes: [{ id: 'scene-1', name: 'Scene 1', timeline: { tracks: [], markers: [] } }],
  }
}
