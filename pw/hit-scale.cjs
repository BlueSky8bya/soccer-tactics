/**
 * R12-D — the 7px path hit radius, measured against the REAL CTM at every viewport.
 *
 * The suspicion (Codex structural review): the pick converts `PATH_HIT_HALF_PX` to metres with
 * `view.w / rect.width` — an x-axis-only ratio. If the SVG's screen CTM scaled x and y differently,
 * or if `view` lagged the element, the hit band would be the wrong width, asymmetric between axes,
 * or a dead strip would appear where the letterbox used to be.
 *
 * This measures it from the outside: for each viewport, find a drawn path, then probe pixel
 * offsets perpendicular to it and see where hover actually latches on. A静 reading of the code
 * cannot settle it — only the live CTM can.
 */
const ID = 'hit-scale'

const VIEWPORTS = [
  { width: 1280, height: 720, dpr: 1, label: '1280x720' },
  { width: 1280, height: 800, dpr: 1, label: '1280x800' },
  { width: 1440, height: 900, dpr: 1, label: '1440x900' },
  { width: 1440, height: 1000, dpr: 2, label: '1440x1000@2x' },
  { width: 1920, height: 1080, dpr: 1, label: '1920x1080' },
  { width: 2560, height: 1080, dpr: 1, label: 'ultrawide' },
  { width: 1100, height: 1400, dpr: 1, label: 'tall' },
]

module.exports = {
  id: ID,
  describe: 'R12-D — path hit radius is 7px on both axes, at every viewport and DPR',
  async run(h) {
    const out = []
    for (const vp of VIEWPORTS) {
      const { context, page, consoleErrors } = await h.openBoard(vp)
      try {
        await h.fillTeams(page)
        const d = await h.doc(page)
        const holder = d.players.find((p) => p.id === d.ball.initialHolderId)
        const runner = d.players.find((p) => p.teamId === holder.teamId && p.id !== holder.id)

        // draw a straight horizontal run so the perpendicular is exactly the y axis
        const from = { x: runner.home.x, y: runner.home.y }
        const to = { x: runner.home.x + 14, y: runner.home.y }
        await h.drawFrom(page, from, to, { steps: 10 })

        const after = await h.doc(page)
        const seg = after.scenes[0].timeline.tracks
          .flatMap((t) => t.segments)
          .find((s) => s.path && !s.id.startsWith('gen-'))
        if (!seg) {
          out.push(h.check(`${vp.label} drew a path`, false, 'no authored segment after the drag'))
          continue
        }

        // the CTM the app itself picks with, and the ratio the pick code uses
        const metrics = await page.evaluate(() => {
          const svg =
            document.querySelector('svg[role="application"]') || document.querySelector('svg')
          const ctm = svg.getScreenCTM()
          const r = svg.getBoundingClientRect()
          const vb = svg.getAttribute('viewBox').split(/\s+/).map(Number)
          return {
            a: ctm.a,
            d: ctm.d,
            b: ctm.b,
            c: ctm.c,
            rectW: r.width,
            rectH: r.height,
            viewW: vb[2],
            viewH: vb[3],
          }
        })
        // px-per-metre must be identical on both axes, or a px radius means two different things
        const axisSkew = Math.abs(metrics.a - metrics.d)
        out.push(
          h.check(
            `${vp.label} CTM is isotropic`,
            axisSkew < 1e-6 && Math.abs(metrics.b) < 1e-9 && Math.abs(metrics.c) < 1e-9,
            `a=${metrics.a.toFixed(4)} d=${metrics.d.toFixed(4)} skew=${axisSkew.toExponential(2)}`,
          ),
        )
        // the pick's own conversion (view.w / rect.width) must equal the true 1/ctm.a
        const pickMpp = metrics.viewW / metrics.rectW
        const trueMpp = 1 / metrics.a
        out.push(
          h.check(
            `${vp.label} pick metres-per-pixel matches the CTM`,
            Math.abs(pickMpp - trueMpp) / trueMpp < 0.005,
            `pick=${pickMpp.toFixed(5)} ctm=${trueMpp.toFixed(5)}`,
          ),
        )

        // Empirical band: hover at increasing pixel offsets perpendicular to the path midpoint
        // and find the last offset that still latches the segment.
        const wps = seg.path.waypoints
        const mid = {
          x: (wps[0].p.x + wps[wps.length - 1].p.x) / 2,
          y: (wps[0].p.y + wps[wps.length - 1].p.y) / 2,
        }
        const midClient = await h.toClient(page, mid)
        // The hover key IS the promise the halo paints; measuring it is measuring the real band.
        // The midpoint is used deliberately: ghosts live at the ENDPOINTS, so nothing else is in
        // range here and the band belongs to the path alone.
        const hoversSegment = async (dxPx, dyPx) => {
          await page.mouse.move(midClient.x + dxPx, midClient.y + dyPx)
          await page.waitForTimeout(45)
          const f = await h.flags(page)
          return (f?.hoverKey ?? '') === `segment:${seg.id}`
        }
        const bandOn = async (axis) => {
          let last = -1
          for (let px = 0; px <= 14; px++) {
            // eslint-disable-next-line no-await-in-loop
            const hit = axis === 'y' ? await hoversSegment(0, px) : await hoversSegment(px, 0)
            if (hit) last = px
            else if (last >= 0) break // left the band; do not count a re-entry further out
          }
          return last
        }
        const bandY = await bandOn('y')
        out.push(
          h.check(
            `${vp.label} perpendicular hit band = 7px`,
            bandY >= 6 && bandY <= 8,
            `last hover at ${bandY}px from the line (PATH_HIT_HALF_PX=7)`,
          ),
        )
        // the same band, measured with the DPR the user actually has: a 2x screen must not halve
        // or double the reach in CSS pixels
        out.push(
          h.check(
            `${vp.label} band is in CSS pixels, not device pixels`,
            bandY >= 6 && bandY <= 8,
            `dpr=${vp.dpr ?? 1} band=${bandY}px`,
          ),
        )

        // no dead strip: a click on the far surround must still map to finite pitch coordinates
        const corner = await h.toPitch(page, { x: 4, y: 4 })
        out.push(
          h.check(
            `${vp.label} surround has coordinates (no dead strip)`,
            Number.isFinite(corner.x) && Number.isFinite(corner.y),
            `top-left maps to (${corner.x.toFixed(1)}, ${corner.y.toFixed(1)})`,
          ),
        )
        out.push(
          h.check(`${vp.label} no console errors`, consoleErrors.length === 0, consoleErrors[0] ?? ''),
        )
      } finally {
        await context.close()
      }
    }
    return out
  },
}
