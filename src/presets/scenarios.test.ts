import { describe, expect, it } from 'vitest'
import { compile } from '@/engine/compile'
import { isTacticDocument } from '@/editor/persistence'
import { SCENARIOS } from './scenarios'

describe('scenario presets', () => {
  it('every preset is a valid document that compiles without errors', () => {
    for (const s of SCENARIOS) {
      const doc = s.build()
      expect(isTacticDocument(doc)).toBe(true)
      const c = compile(doc)
      expect(c.issues.filter((i) => i.level === 'error')).toEqual([])
      expect(c.duration).toBeGreaterThan(0)
      expect(JSON.parse(JSON.stringify(doc))).toEqual(doc)
    }
  })
})
