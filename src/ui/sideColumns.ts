/**
 * How wide the two side columns may be (ADR-0009 v37).
 *
 * The board is height-constrained at every landscape window, so there is always grass beside the
 * pitch that no scaling can use. How MUCH varies enormously — 263px at 1280×800, but 800px on a
 * 1905×858 window — and fixed 136/62 columns looked starved on the wide ones while their text
 * wrapped mid-phrase (user 2026-08-25: 비율들이 너무 멋 없는데 … 너무 너비가 짧아서 보기 힘들어).
 *
 * So the columns are a SHARE of the slack, clamped at both ends:
 *   · the minimum is what a keycap plus its word needs (136 / 52),
 *   · the maximum is where a reading column stops helping — 288px is inside the 230–340px band
 *     eight independent tool codebases converge on (DESIGN_RESEARCH §4c), and 240 puts the action
 *     column in the same band so the two read as a PAIR rather than a slab and a sliver
 *     (user 2026-08-25: 다시 조화롭지 않아 — measured 288×588 against 122×181).
 *
 * The shares are near-even (0.55 / 0.45) for the same reason: where there is room for both, the
 * board should sit between two columns of comparable weight. Where there is not — a laptop with
 * 263px of slack — the left one keeps its words and the right one falls back to its icon width,
 * because a guide you cannot read helps nobody.
 *
 * Pure on purpose: the same numbers drive the CSS widths and the pitch's own reserve, and a shared
 * function is the only way those two cannot drift apart.
 */

/** Column width bounds, in px. */
export const COL_LEFT_MIN = 136
export const COL_LEFT_MAX = 288
export const COL_RIGHT_MIN = 52
export const COL_RIGHT_MAX = 240
/** Reserve = column + its inset + a gap of grass before the pitch starts. */
export const GAP_LEFT = 32
export const GAP_RIGHT = 24
/** Share of the slack each side may claim (the left one carries the sentences). */
const SHARE_LEFT = 0.55
const SHARE_RIGHT = 0.45
/** How far the columns sit from the window edge before the hug (see `insetLeft`). */
const BASE_INSET = 12

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export interface SideColumns {
  /** Grass the pitch cannot use, at the scale it would have had with no reserve at all. */
  slack: number
  widthLeft: number
  widthRight: number
  reserveLeft: number
  reserveRight: number
  /**
   * Where each column sits, measured from its own window edge. On a wide window the columns take
   * only part of the slack, and the rest would open as a gulf between panel and pitch — so they
   * move INWARD by half of what is left over and hug the board. The grass then pools at the window
   * edge, where nothing has to be read across it.
   */
  insetLeft: number
  insetRight: number
}

/**
 * @param boardW,boardH the pitch AREA in px (the element the board draws into)
 * @param safeBottom the strip the floating transport keeps (see BOARD_SAFE_BOTTOM_PX)
 * @param baseW,baseH the pitch box in metres, surround included
 */
export function sideColumns(
  boardW: number,
  boardH: number,
  safeBottom: number,
  baseW = 109,
  baseH = 72,
): SideColumns {
  const free = Math.min(boardW / baseW, Math.max(0, boardH - safeBottom) / baseH)
  const slack = Math.max(0, boardW - baseW * free)
  let reserveLeft = clamp(Math.round(slack * SHARE_LEFT), COL_LEFT_MIN + GAP_LEFT, COL_LEFT_MAX + GAP_LEFT)
  let reserveRight = clamp(
    Math.round(slack * SHARE_RIGHT),
    COL_RIGHT_MIN + GAP_RIGHT,
    COL_RIGHT_MAX + GAP_RIGHT,
  )
  /*
   * The pair never asks for more grass than there is, and the RIGHT one yields first: it holds two
   * commands and a switch that can fall back to icons, while the left one is the only place the
   * gestures are written out. Scaling both proportionally does not work — each has a floor, and
   * two floors can add up to more than the slack (measured: 276 wanted against 263 available at
   * 1280×800), which is how a column ends up standing on the touchline.
   */
  if (reserveLeft + reserveRight > slack) {
    reserveRight = Math.max(COL_RIGHT_MIN + GAP_RIGHT, Math.floor(slack - reserveLeft))
    if (reserveLeft + reserveRight > slack)
      reserveLeft = Math.max(COL_LEFT_MIN + GAP_LEFT, Math.floor(slack - reserveRight))
  }
  const spare = Math.max(0, Math.floor((slack - reserveLeft - reserveRight) / 2))
  return {
    slack: Math.round(slack),
    widthLeft: reserveLeft - GAP_LEFT,
    widthRight: reserveRight - GAP_RIGHT,
    reserveLeft,
    reserveRight,
    insetLeft: BASE_INSET + spare,
    insetRight: BASE_INSET + spare,
  }
}
