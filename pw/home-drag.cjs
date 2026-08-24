/**
 * Grabbing a player's STARTING SPOT: when does the path come along, and when does it stay?
 *
 * Both answers are wanted, and the same user asked for each of them a day apart:
 *   • 2026-08-20 (CHG-065) — "시작점만 붙어가 경로가 과도하게 꾫임" → move everything.
 *   • 2026-08-22 (CHG-141) — "미래 시점까지 전부 따라오는데 이유가 있나" → move only that one.
 * ADR-0009 v16b settles it by SELECTION SIZE: one token moves its anchor, a group translates
 * rigidly. Which means the drag means two different things depending on state you cannot see while
 * dragging (user 2026-08-25: 왜 어쪔 때랑 0단계 레이어 잡으면 전체 단계가 움직이고 어쪔 때있
 * 0단계만 움직여) — so the contract is pinned here in metres.
 */
const chip = (page, n) => page.locator('[class*=stepChip]').nth(n - 1)

const shape = async (h, page, id) => {
  const d = await h.doc(page)
  const pl = d.players.find((p) => p.id === id)
  const tr = d.scenes[0].timeline.tracks.find((t) => t.entityId === id)
  const segs = (tr ? tr.segments : [])
    .filter((s) => s.path && !s.id.startsWith('gen-'))
    .map((s) => ({
      step: s.step ?? 1,
      a: s.path.waypoints[0].p,
      b: s.path.waypoints[s.path.waypoints.length - 1].p,
    }))
  return { home: pl.home, segs }
}
const fmt = (s) =>
  `home(${s.home.x.toFixed(1)},${s.home.y.toFixed(1)}) ` +
  s.segs.map((g) => `@${g.step} ${g.a.x.toFixed(1)}→${g.b.x.toFixed(1)}`).join(' ')

module.exports = {
  id: 'home-drag',
  describe:
    'dragging a starting spot moves only its anchor when one token is selected, and the whole chain when more than one is',
  async run(h) {
    const out = []
    const { page } = await h.openBoard({ width: 1440, height: 900, dpr: 1 })
    await page.waitForFunction(() => !!window.__stDoc, null, { timeout: 15000 })
    await h.fillTeams(page)
    await page.waitForTimeout(400)
    const d0 = await h.doc(page)
    const mine = d0.players.filter((p) => p.teamId === 'team-a').sort((a, b) => a.home.x - b.home.x)
    const who = mine[4]

    // a two-step chain for one player
    await chip(page, 1).click()
    await page.waitForTimeout(150)
    await h.drawFrom(page, who.home, { x: who.home.x + 10, y: who.home.y - 6 }, { steps: 8 })
    await page.waitForTimeout(320)
    await chip(page, 2).click()
    await page.waitForTimeout(200)
    const mid = { x: who.home.x + 10, y: who.home.y - 6 }
    await h.drawFrom(page, mid, { x: mid.x + 9, y: mid.y + 8 }, { steps: 8 })
    await page.waitForTimeout(340)
    await page.keyboard.press('Escape')
    await chip(page, 1).click()
    await page.waitForTimeout(300)

    const before = await shape(h, page, who.id)
    out.push(h.check('setup: a two-step chain', before.segs.length === 2, fmt(before)))

    // (a) ONE token selected — grab the starting spot
    const start = (await shape(h, page, who.id)).home
    await h.dragPitch(page, start, { x: start.x - 8, y: start.y }, { steps: 10, settleMs: 400 })
    const afterSingle = await shape(h, page, who.id)
    const movedA = afterSingle.segs.map((g, i) =>
      Math.hypot(g.a.x - before.segs[i].a.x, g.a.y - before.segs[i].a.y).toFixed(2),
    )
    const movedB = afterSingle.segs.map((g, i) =>
      Math.hypot(g.b.x - before.segs[i].b.x, g.b.y - before.segs[i].b.y).toFixed(2),
    )
    out.push(
      h.check(
        'ONE selected: the first leg stretches — its end and every later step stay put',
        Number(movedA[0]) > 7.5 &&
          Number(movedB[0]) < 0.01 &&
          Number(movedA[1]) < 0.01 &&
          Number(movedB[1]) < 0.01,
        `${fmt(afterSingle)} | starts moved [${movedA}] ends moved [${movedB}]`,
      ),
    )

    // (b) put a SECOND player in the selection (Ctrl+click), then grab the same one
    const mid2 = await shape(h, page, who.id)
    const other = mine[7]
    const oc = await h.toClient(page, other.home)
    await page.keyboard.down('Control')
    await page.mouse.click(oc.x, oc.y)
    await page.keyboard.up('Control')
    await page.waitForTimeout(300)
    const sel = await page.evaluate(() => window.__stFlags().selection.length)
    const beforeGroup = await shape(h, page, who.id)
    await h.dragPitch(page, beforeGroup.home, { x: beforeGroup.home.x - 8, y: beforeGroup.home.y }, { steps: 10, settleMs: 400 })
    const afterGroup = await shape(h, page, who.id)
    const gMovedA = afterGroup.segs.map((g, i) =>
      Math.hypot(g.a.x - beforeGroup.segs[i].a.x, g.a.y - beforeGroup.segs[i].a.y).toFixed(2),
    )
    const gMovedB = afterGroup.segs.map((g, i) =>
      Math.hypot(g.b.x - beforeGroup.segs[i].b.x, g.b.y - beforeGroup.segs[i].b.y).toFixed(2),
    )
    out.push(
      h.check(
        `MORE THAN ONE selected (${sel}): the whole chain travels with the token`,
        sel > 1 &&
          gMovedA.every((v) => Number(v) > 7.5) &&
          gMovedB.every((v) => Number(v) > 7.5),
        `${fmt(afterGroup)} | starts moved [${gMovedA}] ends moved [${gMovedB}]`,
      ),
    )
    return out
  },
}
