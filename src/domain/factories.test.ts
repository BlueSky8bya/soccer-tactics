import { describe, expect, it } from 'vitest'
import { createEmptyDocument, SCHEMA_VERSION } from './index'

describe('createEmptyDocument', () => {
  it('creates a serializable document with one scene and a centred ball', () => {
    const doc = createEmptyDocument({ id: 'd1', now: '2026-08-19T00:00:00.000Z' })
    expect(doc.schemaVersion).toBe(SCHEMA_VERSION)
    expect(doc.scenes).toHaveLength(1)
    expect(doc.ball.home).toEqual({ x: 52.5, y: 34 })
    expect(JSON.parse(JSON.stringify(doc))).toEqual(doc)
  })
})
