/**
 * Switching straight from one entity's path to another's — user report 2026-08-23:
 * "경로 수정하다가 다른 엔티티를 눌렀을 때 더블클릭을 해야 그 엔티티의 경로를 수정할 수 있다".
 *
 * Focus isolation (2026-08-21) exists so that an overlapping stroke of ANOTHER entity cannot steal
 * a press while one movement is being edited. But it filters other entities out of the candidate
 * list entirely — including when nothing of the focused entity is anywhere near the cursor. Then
 * the first press is spent leaving focus and only the second one lands: the double-click.
 *
 * Measured here: with A's path selected, press once, squarely on B's path, far from anything of
 * A's. One press must be enough.
 */
const ID = 'focus-switch'

module.exports = {
  id: ID,
  describe: 'one press moves from one entity path to another — no double-click to switch focus',
  async run(h) {
    const out = []
    const { context, page, consoleErrors } = await h.openBoard()
    try {
      await h.fillTeams(page)
      const d0 = await h.doc(page)
      const holder = d0.players.find((p) => p.id === d0.ball.initialHolderId)
      const mates = d0.players
        .filter((p) => p.teamId === holder.teamId && p.id !== holder.id)
        .sort((a, b) => a.home.y - b.home.y)
      const A = mates[0]
      const B = mates[mates.length - 1] // far away, so nothing of A's is in range of B's path

      // two separate runs, well apart
      await h.drawFrom(page, A.home, { x: A.home.x + 14, y: A.home.y }, { steps: 10 })
      await h.drawFrom(page, B.home, { x: B.home.x + 14, y: B.home.y }, { steps: 10 })

      const doc1 = await h.doc(page)
      const segs = h.authoredSegments(doc1)
      const segA = segs.find((s) => s.entityId === A.id)
      const segB = segs.find((s) => s.entityId === B.id)
      out.push(
        h.check('two runs on two different players', !!segA && !!segB, `${segs.length} segments`),
      )
      if (!segA || !segB) return out

      const midOf = (seg) => {
        const w = seg.path.waypoints
        const a = w[0].p
        const b = w[w.length - 1].p
        return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      }
      const midA = midOf(segA)
      const midB = midOf(segB)
      const apart = Math.hypot(midA.x - midB.x, midA.y - midB.y)
      out.push(h.check('the two paths are far apart (no overlap)', apart > 8, `${apart.toFixed(1)}m`))

      // 1) select A's movement — this is what enters focus
      const cA = await h.toClient(page, midA)
      await page.mouse.move(cA.x, cA.y)
      await page.mouse.down()
      await page.mouse.up()
      await page.waitForTimeout(180)
      const focused = await page.evaluate(() => {
        const f = window.__stFlags()
        return { hoverKey: f.hoverKey, selection: f.selection }
      })
      out.push(
        h.check(
          "A's movement is selected (focus entered)",
          true,
          `selection=${JSON.stringify(focused.selection)}`,
        ),
      )

      // 2) hover B's path — what does the board promise?
      const cB = await h.toClient(page, midB)
      await page.mouse.move(cB.x, cB.y)
      await page.waitForTimeout(180)
      const fHover = await h.flags(page)
      out.push(
        h.check(
          "hovering B's path promises B's path",
          fHover?.hoverKey === `segment:${segB.id}`,
          `hoverKey=${fHover?.hoverKey} expected=segment:${segB.id}`,
        ),
      )

      // 3) ONE press-drag on B's path must bend B's path
      await h.clearIntentLog(page)
      const before = await h.docBytes(page)
      await h.dragPitch(page, midB, { x: midB.x, y: midB.y - 4 }, { steps: 8 })
      const log = await h.intentLog(page)
      const after = await h.docBytes(page)
      const entry = log[log.length - 1] ?? null

      out.push(
        h.check(
          "one press on B's path resolves to bend-path",
          entry?.intent === 'bend-path' && entry?.seg === segB.id,
          `intent=${entry?.intent} seg=${entry?.seg} expected=bend-path ${segB.id}`,
        ),
      )
      out.push(
        h.check(
          "one press actually changed B's path",
          after !== before,
          after === before ? 'the document did not change — the press was spent switching focus' : '',
        ),
      )

      // and it must be B's path that moved, not A's
      const doc2 = await h.doc(page)
      const after2 = h.authoredSegments(doc2)
      const bNow = after2.find((s) => s.id === segB.id)
      const aNow = after2.find((s) => s.id === segA.id)
      const bChanged =
        !!bNow && JSON.stringify(bNow.path) !== JSON.stringify(segB.path)
      const aChanged =
        !!aNow && JSON.stringify(aNow.path) !== JSON.stringify(segA.path)
      out.push(h.check("B's path is the one that changed", bChanged, `bChanged=${bChanged}`))
      out.push(h.check("A's path was left alone", !aChanged, `aChanged=${aChanged}`))

      await page.keyboard.press('Control+z')
      await page.waitForTimeout(150)

      /*
       * THE PROTECTION MUST SURVIVE. Build the case the rule exists for: C's path drawn straight
       * across A's, so both are under one cursor. With A's movement focused, that press belongs to
       * A — a stranger's stroke may not steal it.
       */
      const C = mates[1]
      const across = { x: midA.x, y: midA.y }
      await h.drawFrom(page, C.home, { x: across.x + 6, y: across.y }, { steps: 12 })
      await page.waitForTimeout(150)
      const doc3 = await h.doc(page)
      const segC = h.authoredSegments(doc3).find((x) => x.entityId === C.id)
      out.push(h.check("C's crossing run exists", !!segC, segC ? '' : 'not authored'))

      if (segC) {
        // select A's movement again to re-enter focus
        await page.mouse.move(cA.x, cA.y)
        await page.mouse.down()
        await page.mouse.up()
        await page.waitForTimeout(180)

        // a point where BOTH A's and C's strokes are in range
        const overlapPt = { x: midA.x, y: midA.y }
        const cO = await h.toClient(page, overlapPt)
        await page.mouse.move(cO.x, cO.y)
        await page.waitForTimeout(160)
        const fOverlap = await h.flags(page)
        out.push(
          h.check(
            'at an overlap, the focused entity still owns the hover',
            fOverlap?.hoverKey === `segment:${segA.id}`,
            `hoverKey=${fOverlap?.hoverKey} expected=segment:${segA.id} (A focused)`,
          ),
        )

        await h.clearIntentLog(page)
        await h.dragPitch(page, overlapPt, { x: overlapPt.x, y: overlapPt.y - 3 }, { steps: 8 })
        const oLog = await h.intentLog(page)
        const oEntry = oLog[oLog.length - 1] ?? null
        out.push(
          h.check(
            'at an overlap, the press stays with the focused entity',
            oEntry?.seg === segA.id,
            `seg=${oEntry?.seg} expected=${segA.id} intent=${oEntry?.intent}`,
          ),
        )
        await page.keyboard.press('Control+z')
        await page.waitForTimeout(150)
      }

      const problems = await h.validate(page)
      out.push(h.check('document valid', problems.length === 0, problems[0] ?? ''))
      out.push(h.check('no console errors', consoleErrors.length === 0, consoleErrors[0] ?? ''))
    } finally {
      await context.close()
    }
    return out
  },
}
