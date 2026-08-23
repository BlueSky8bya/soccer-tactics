/**
 * R5 diagnosis — narrow the disagreement to a rule, and find out why the exact ghost centre
 * produced no intent at all. Scan a line of sample points across the overlap and report, for each,
 * the hover key, the element under the cursor, and the intent the press resolves to.
 */
const ID = 'r5-diagnose'

module.exports = {
  id: ID,
  describe: 'R5 diagnosis — hover vs press across a scan line through the ghost',
  async run(h) {
    const out = []
    const { context, page, consoleErrors } = await h.openBoard()
    try {
      await h.fillTeams(page)
      const d0 = await h.doc(page)
      const holder = d0.players.find((p) => p.id === d0.ball.initialHolderId)
      const runner = d0.players.find((p) => p.teamId === holder.teamId && p.id !== holder.id)
      const a = { x: runner.home.x, y: runner.home.y }
      const b = { x: runner.home.x + 14, y: runner.home.y }
      await h.drawFrom(page, a, b, { steps: 10 })
      await h.drawFrom(page, b, { x: b.x - 7, y: b.y + 8 }, { steps: 10 })

      const segs = h.authoredSegments(await h.doc(page))
      const first = segs.find((s) => (s.step ?? 1) === 1) ?? segs[0]
      const g = first.path.waypoints[first.path.waypoints.length - 1].p

      const rows = []
      for (let dx = -3; dx <= 1; dx += 0.5) {
        const pt = { x: g.x + dx, y: g.y }
        const c = await h.toClient(page, pt)
        await page.mouse.move(c.x, c.y)
        await page.waitForTimeout(90)
        const f = await h.flags(page)
        const el = await page.evaluate(
          ([x, y]) => {
            const e = document.elementFromPoint(x, y)
            if (!e) return null
            return {
              tag: e.tagName,
              kind: e.getAttribute('data-kind'),
              seg: e.getAttribute('data-segment'),
              entity: e.getAttribute('data-entity'),
              cls: (e.getAttribute('class') || '').slice(0, 40),
            }
          },
          [c.x, c.y],
        )
        await h.clearIntentLog(page)
        // press WITHOUT moving far: just enough to pass the drag threshold
        await page.mouse.down()
        await page.mouse.move(c.x + 12, c.y - 12, { steps: 4 })
        await page.mouse.up()
        await page.waitForTimeout(120)
        const log = await h.intentLog(page)
        const entry = log[log.length - 1] ?? null
        rows.push({
          dx,
          hover: f?.hoverKey ?? null,
          el,
          intent: entry?.intent ?? null,
          ghost: entry?.ghost ?? null,
          seg: entry?.seg ?? null,
        })
        await page.keyboard.press('Control+z')
        await page.waitForTimeout(120)
      }

      for (const r of rows) {
        const hoverKind = r.hover ? r.hover.split(':')[0] : 'none'
        const pressKind = r.ghost ? 'ghost' : r.intent === 'bend-path' ? 'segment' : (r.intent ?? 'none')
        out.push(
          h.check(
            `dx=${r.dx}m  hover=${hoverKind} press=${pressKind}`,
            true,
            `hoverKey=${r.hover} intent=${r.intent} el=${JSON.stringify(r.el)}`,
          ),
        )
      }
      const mismatches = rows.filter((r) => {
        const hk = r.hover ? r.hover.split(':')[0] : null
        const pk = r.ghost ? 'ghost' : r.intent === 'bend-path' ? 'segment' : null
        return hk && pk && hk !== pk
      })
      out.push(
        h.check(
          'no hover/press mismatch on the scan line',
          mismatches.length === 0,
          mismatches.map((m) => `dx=${m.dx}: ${m.hover} → ${m.intent}`).join(' | '),
        ),
      )
      out.push(h.check('no console errors', consoleErrors.length === 0, consoleErrors[0] ?? ''))
    } finally {
      await context.close()
    }
    return out
  },
}
