import { describe, expect, it } from 'vitest'
import {
  COL_LEFT_MAX,
  COL_LEFT_MIN,
  COL_RIGHT_MAX,
  COL_RIGHT_MIN,
  GAP_LEFT,
  GAP_RIGHT,
  sideColumns,
} from './sideColumns'

/** The pitch area for a viewport: the window minus the 48px toolbar and 12px of padding. */
const area = (w: number, h: number) => [w - 24, h - 48 - 24] as const
const SAFE_BOTTOM = 72

describe('side columns', () => {
  it('never asks for more grass than the board has spare', () => {
    for (const [w, h] of [
      [1280, 800],
      [1440, 900],
      [1920, 1080],
      [1905, 858],
      [2560, 1080],
    ] as const) {
      const c = sideColumns(...area(w, h), SAFE_BOTTOM)
      // …except where both floors together already exceed it, which is the regime the layout
      // folds to a single column in anyway (see NO_SIDE_ROOM).
      const floors = COL_LEFT_MIN + GAP_LEFT + COL_RIGHT_MIN + GAP_RIGHT
      if (c.slack >= floors)
        expect(c.reserveLeft + c.reserveRight, `${w}x${h}`).toBeLessThanOrEqual(c.slack)
    }
  })

  it('makes the right column yield first when the grass runs short', () => {
    // a laptop: the left keeps its words, the right gives up its width
    const laptop = sideColumns(...area(1280, 800), SAFE_BOTTOM)
    expect(laptop.widthLeft).toBe(COL_LEFT_MIN)
    expect(laptop.reserveLeft + laptop.reserveRight).toBeLessThanOrEqual(laptop.slack)
    // a wide window: both get real width and they are within one band of each other
    const wide = sideColumns(...area(1887, 832), SAFE_BOTTOM)
    expect(wide.widthLeft - wide.widthRight).toBeLessThan(100)
  })

  it('grows with the slack instead of staying starved on a wide window', () => {
    const laptop = sideColumns(...area(1440, 900), SAFE_BOTTOM)
    const wide = sideColumns(...area(1905, 858), SAFE_BOTTOM)
    expect(laptop.slack).toBeLessThan(wide.slack)
    expect(wide.widthLeft).toBeGreaterThan(laptop.widthLeft)
    expect(wide.widthRight).toBeGreaterThan(laptop.widthRight)
  })

  it('stops at both ends — a keycap needs a floor, a reading column has a ceiling', () => {
    const huge = sideColumns(4000, 900, SAFE_BOTTOM)
    expect(huge.widthLeft).toBe(COL_LEFT_MAX)
    expect(huge.widthRight).toBe(COL_RIGHT_MAX)
    // a window with no slack at all still reports the minimum, and the caller collapses instead
    const none = sideColumns(1000, 800, SAFE_BOTTOM)
    expect(none.widthLeft).toBe(COL_LEFT_MIN)
    expect(none.widthRight).toBe(COL_RIGHT_MIN)
  })

  it('pins the columns to the frame at every size', () => {
    // v38: the leftover grass pools between column and pitch, not as padding around the column
    for (const [w, h] of [
      [1280, 800],
      [1440, 900],
      [2560, 1080],
    ] as const) {
      const c = sideColumns(...area(w, h), SAFE_BOTTOM)
      expect(c.insetLeft, `${w}x${h}`).toBe(c.insetRight)
      expect(c.insetLeft).toBeLessThanOrEqual(16)
    }
  })

  it('keeps width and reserve in step', () => {
    const c = sideColumns(...area(1920, 1080), SAFE_BOTTOM)
    expect(c.reserveLeft - c.widthLeft).toBe(GAP_LEFT)
    expect(c.reserveRight - c.widthRight).toBe(GAP_RIGHT)
  })
})
