/** Pitch geometry helpers (metres). Pure; safe for engine and editor. */
import type { Pitch, Vec2 } from '@/domain/types'

/** Player/ball are allowed slightly outside the lines (throw-ins, corners). */
export const PITCH_MARGIN_M = 2

export function clampToPitch(p: Vec2, pitch: Pitch, margin = PITCH_MARGIN_M): Vec2 {
  return {
    x: Math.min(pitch.length + margin, Math.max(-margin, p.x)),
    y: Math.min(pitch.width + margin, Math.max(-margin, p.y)),
  }
}

/** Standard markings (IFAB Law 1), derived from pitch size. */
export interface PitchMarkings {
  length: number
  width: number
  centre: Vec2
  centreCircleR: number
  penaltyAreaDepth: number
  penaltyAreaWidth: number
  goalAreaDepth: number
  goalAreaWidth: number
  penaltySpotDist: number
  goalWidth: number
  goalDepth: number
  cornerR: number
  /** Landmarks used for snapping (centre spot, penalty spots, box corners, halfway ends). */
  landmarks: { id: string; p: Vec2 }[]
}

export function pitchMarkings(pitch: Pitch): PitchMarkings {
  const L = pitch.length
  const W = pitch.width
  const m: PitchMarkings = {
    length: L,
    width: W,
    centre: { x: L / 2, y: W / 2 },
    centreCircleR: 9.15,
    penaltyAreaDepth: 16.5,
    penaltyAreaWidth: 40.32,
    goalAreaDepth: 5.5,
    goalAreaWidth: 18.32,
    penaltySpotDist: 11,
    goalWidth: 7.32,
    goalDepth: 2,
    cornerR: 1,
    landmarks: [],
  }
  const cy = W / 2
  const paTop = cy - m.penaltyAreaWidth / 2
  const paBot = cy + m.penaltyAreaWidth / 2
  m.landmarks = [
    { id: 'centre', p: { x: L / 2, y: cy } },
    { id: 'pen-left', p: { x: m.penaltySpotDist, y: cy } },
    { id: 'pen-right', p: { x: L - m.penaltySpotDist, y: cy } },
    { id: 'pa-left-top', p: { x: m.penaltyAreaDepth, y: paTop } },
    { id: 'pa-left-bot', p: { x: m.penaltyAreaDepth, y: paBot } },
    { id: 'pa-right-top', p: { x: L - m.penaltyAreaDepth, y: paTop } },
    { id: 'pa-right-bot', p: { x: L - m.penaltyAreaDepth, y: paBot } },
    { id: 'half-top', p: { x: L / 2, y: 0 } },
    { id: 'half-bot', p: { x: L / 2, y: W } },
    { id: 'corner-tl', p: { x: 0, y: 0 } },
    { id: 'corner-tr', p: { x: L, y: 0 } },
    { id: 'corner-bl', p: { x: 0, y: W } },
    { id: 'corner-br', p: { x: L, y: W } },
  ]
  return m
}

/** Convert a side-relative fraction (0..1 of own half→opponent goal, 0..1 across) to metres. */
export function fractionToPitch(frac: Vec2, pitch: Pitch, side: 'left' | 'right'): Vec2 {
  const x = frac.x * pitch.length
  const y = frac.y * pitch.width
  return side === 'left' ? { x, y } : { x: pitch.length - x, y: pitch.width - y }
}
