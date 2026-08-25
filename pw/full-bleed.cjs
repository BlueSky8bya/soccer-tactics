/**
 * FULL-BLEED CANVAS — the layout contract, in pixels (ADR-0009 v31).
 *
 * The layout this replaced spent 460px — 32% of a 1440 window, 36% of a 1280 one — on two docked
 * columns, five of whose six cards were static reference text the `?` overlay already carried.
 * Deleting them is easy to do and easy to undo by accident: a future card, a re-docked panel, a
 * taller transport bar all quietly take the board's pixels back. So the contract is measured here
 * rather than described in a document.
 *
 * Three things are pinned:
 *   1. the board fills the window (no docked column may reappear),
 *   2. the PITCH MARKINGS end above the floating transport (the bar may cover grass, never play),
 *   3. the guide is a STATE — nothing on an idle board, at most three rows while a cue is live,
 *      and gone again when the key comes up.
 */
const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
]

/** Board geometry straight from the page's own CTM — the same matrix the app picks with. */
const geometry = (page) =>
  page.evaluate(() => {
    const svg = document.querySelector('main svg')
    const m = svg.getScreenCTM()
    const board = svg.getBoundingClientRect()
    const bar = document.querySelector('[class*=simpleBar]').getBoundingClientRect()
    return {
      marksW: Math.round(105 * m.a),
      marksH: Math.round(68 * m.d),
      marksBottom: Math.round(m.f + 68 * m.d),
      boardW: Math.round(board.width),
      barTop: Math.round(bar.y),
      win: window.innerWidth,
    }
  })

const hintRows = (page) => page.locator('[class*=boardHints] > div')

module.exports = {
  id: 'full-bleed',
  describe:
    'the board fills the window, the pitch markings stay clear of the floating transport, and the guide only appears while a cue is live',
  async run(h) {
    const out = []

    for (const vp of VIEWPORTS) {
      const { context, page } = await h.openBoard({ ...vp, dpr: 1 })
      await h.fillTeams(page)
      await page.waitForTimeout(300)
      const g = await geometry(page)
      const tag = `${vp.width}x${vp.height}`
      out.push(
        h.check(
          `${tag} the board fills the window`,
          g.boardW >= vp.width - 30,
          `board ${g.boardW} of ${vp.width}`,
        ),
      )
      out.push(
        h.check(
          `${tag} the markings end above the transport`,
          g.marksBottom <= g.barTop,
          `markings end ${g.marksBottom}, bar top ${g.barTop}`,
        ),
      )
      // The floor is the layout this replaced (921 at 1440, 767 at 1280) plus a margin; the point
      // is that a re-docked panel would drop straight through it.
      const floor = Math.round(vp.width * 0.7)
      out.push(
        h.check(
          `${tag} the pitch keeps its share of the window`,
          g.marksW >= floor,
          `markings ${g.marksW}x${g.marksH} = ${Math.round((g.marksW / vp.width) * 100)}% (floor ${floor})`,
        ),
      )
      await context.close()
    }

    // ---- menus, hints, zen ------------------------------------------------
    const { context, page, consoleErrors } = await h.openBoard({ width: 1440, height: 900, dpr: 1 })
    const teamBtn = page.getByRole('button', { name: '팀 구성', exact: true })
    const boardBtn = page.getByRole('button', { name: '보드', exact: true })

    out.push(h.check('no docked column survives', (await page.locator('aside').count()) === 0))
    out.push(
      h.check('an idle board says nothing', (await page.locator('[class*=boardHints]').count()) === 0),
    )

    await teamBtn.click()
    out.push(
      h.check('팀 구성 holds the fill button', await page.getByRole('button', { name: /양 팀 채우기/ }).isVisible()),
    )
    await page.getByRole('button', { name: /양 팀 채우기/ }).click()
    await page.waitForTimeout(400)
    const players = (await h.doc(page)).players.length
    out.push(h.check('the menu still fills the board', players === 22, `${players} players`))
    out.push(
      h.check(
        'a command closes the card it was pressed in',
        (await page.getByRole('button', { name: /양 팀 채우기/ }).count()) === 0,
      ),
    )

    await boardBtn.click()
    const sw = page.getByRole('switch', { name: /공 휙 던지기/ })
    await sw.click()
    out.push(
      h.check(
        'a setting leaves the card open',
        (await sw.isVisible()) && (await sw.getAttribute('aria-checked')) === 'true',
      ),
    )
    await sw.click()
    await page.keyboard.press('Escape')
    await page.waitForTimeout(150)
    out.push(h.check('Escape closes the card', (await sw.count()) === 0))
    out.push(
      h.check(
        'and hands focus back to the trigger',
        await page.evaluate(() => document.activeElement?.textContent?.includes('보드')),
      ),
    )

    // Ctrl — the modifier families
    await page.mouse.move(700, 400)
    await page.keyboard.down('Control')
    await page.waitForTimeout(420)
    const ctrl = await hintRows(page).allTextContents()
    await page.keyboard.up('Control')
    out.push(
      h.check(
        'holding Ctrl explains Ctrl',
        ctrl.length > 0 && ctrl.join('|').includes('선수 추가'),
        ctrl.join(' | '),
      ),
    )
    out.push(h.check('at most three rows', ctrl.length <= 3, `${ctrl.length} rows`))
    await page.waitForTimeout(600)
    out.push(
      h.check('and they leave with the key', (await page.locator('[class*=boardHints]').count()) === 0),
    )

    // selection — the "I clicked this, now what" families
    const ballPt = await page.evaluate(() => {
      const m = document.querySelector('main svg').getScreenCTM()
      const b = window.__stDoc.ball.home
      return { x: m.a * b.x + m.e, y: m.d * b.y + m.f }
    })
    await page.mouse.click(ballPt.x, ballPt.y)
    await page.waitForTimeout(420)
    const ball = await hintRows(page).allTextContents()
    out.push(h.check('picking the ball explains the ball', ball.length > 0, ball.join(' | ')))
    await page.keyboard.press('Escape')

    // zen gives the reserved strip back to the pitch
    const before = (await geometry(page)).marksW
    await page.keyboard.press('f')
    await page.waitForTimeout(500)
    const zen = await page.evaluate(() => ({
      bar: getComputedStyle(document.querySelector('[class*=bottomWrap]')).opacity,
      marks: Math.round(105 * document.querySelector('main svg').getScreenCTM().a),
    }))
    out.push(h.check('zen hides the floating chrome', Number(zen.bar) < 0.05, `opacity ${zen.bar}`))
    out.push(
      h.check(
        'zen hands the reserved strip back to the pitch',
        zen.marks > before,
        `${before} → ${zen.marks}`,
      ),
    )
    await page.keyboard.press('f')

    out.push(
      h.check('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | ')),
    )
    await context.close()
    return out
  },
}
