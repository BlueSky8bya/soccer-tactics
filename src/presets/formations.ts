/**
 * Data-driven formation presets. Presets, never constraints (ADR-0001 §3).
 * Adding a formation = editing formations.json only.
 */
import raw from './formations.json'
import type { Vec2 } from '@/domain/types'

export interface FormationLine {
  role: string
  x: number
  y: number[]
}

export interface Formation {
  id: string
  name: string
  tags?: string[]
  lines: FormationLine[]
}

export interface FormationSlot {
  role: string
  /** Fraction of pitch, left-defending orientation. */
  frac: Vec2
  /** 1-based shirt number assigned in order (GK first). */
  number: number
}

function isFiniteFraction(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1
}

export function validateFormation(f: unknown): f is Formation {
  if (!f || typeof f !== 'object') return false
  const o = f as Record<string, unknown>
  if (typeof o.id !== 'string' || typeof o.name !== 'string' || !Array.isArray(o.lines))
    return false
  let count = 0
  for (const line of o.lines as unknown[]) {
    if (!line || typeof line !== 'object') return false
    const l = line as Record<string, unknown>
    if (typeof l.role !== 'string' || !isFiniteFraction(l.x) || !Array.isArray(l.y)) return false
    for (const y of l.y as unknown[]) if (!isFiniteFraction(y)) return false
    count += (l.y as unknown[]).length
  }
  return count === 11
}

const parsed = (raw as { formations: unknown[] }).formations
const valid: Formation[] = []
const invalid: string[] = []
for (const f of parsed) {
  if (validateFormation(f)) valid.push(f)
  else invalid.push(String((f as { id?: unknown })?.id ?? '?'))
}

export const FORMATIONS: readonly Formation[] = valid
export const INVALID_FORMATION_IDS: readonly string[] = invalid

export function getFormation(id: string): Formation | undefined {
  return FORMATIONS.find((f) => f.id === id)
}

/** Flatten lines into 11 slots with numbers 1..11 (GK = 1). */
export function formationSlots(f: Formation): FormationSlot[] {
  const slots: FormationSlot[] = []
  let n = 1
  for (const line of f.lines) {
    for (const y of line.y) {
      slots.push({ role: line.role, frac: { x: line.x, y }, number: n++ })
    }
  }
  return slots
}

export function searchFormations(query: string): Formation[] {
  const q = query.trim().toLowerCase().replace(/\s+/g, '')
  if (!q) return [...FORMATIONS]
  return FORMATIONS.filter(
    (f) =>
      f.id.replace(/-/g, '').includes(q.replace(/-/g, '')) ||
      f.name.toLowerCase().includes(q) ||
      f.tags?.some((t) => t.includes(q)),
  )
}
