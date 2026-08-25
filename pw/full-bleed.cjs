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
 *   3. the key guide lives in the margin the pitch cannot use (v33) — it stands there always, it
 *      never covers the markings, its detail opens only when asked (hover, click, or the key
 *      really held) and only for the key that was asked about.
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
      marksLeft: Math.round(m.e),
      boardW: Math.round(board.width),
      barTop: Math.round(bar.y),
      win: window.innerWidth,
    }
  })

const guideRows = (page) => page.locator('button[class*=guideRow]')
const openRows = (page) => page.locator('button[class*=guideRow][aria-expanded="true"]')
const heldRows = (page) => page.locator('button[class*=guideRow][data-held]')
const guideBox = (page) =>
  page.evaluate(() => {
    const l = document
      .querySelector('[class*=keyGuide]:not([class*=Right])')
      .getBoundingClientRect()
    const r = document.querySelector('[class*=keyGuideRight]')?.getBoundingClientRect()
    const board = document.querySelector('main svg').getBoundingClientRect()
    return {
      right: Math.round(l.x + l.width),
      width: Math.round(l.width),
      bottom: Math.round(l.y + l.height),
      boardBottom: Math.round(board.y + board.height),
      rightColLeft: r ? Math.round(r.x) : null,
    }
  })

module.exports = {
  id: 'full-bleed',
  describe:
    'the board fills the window, the pitch markings stay clear of the floating transport, and the guide only appears while a cue is live',
  async run(h) {
    const out = []
    const colWidths = {}

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
      const guide = await guideBox(page)
      out.push(
        h.check(
          `${tag} the guide sits beside the pitch, not on it`,
          guide.right <= g.marksLeft,
          `guide ends ${guide.right}, markings start ${g.marksLeft}`,
        ),
      )
      colWidths[tag] = guide.width
      const marksRight = g.marksLeft + g.marksW
      out.push(
        h.check(
          `${tag} the second column keeps off the pitch too`,
          guide.rightColLeft === null || guide.rightColLeft >= marksRight,
          guide.rightColLeft === null
            ? 'one column at this size'
            : `markings end ${marksRight}, column starts ${guide.rightColLeft}`,
        ),
      )
      // The floor is the layout this replaced (921 at 1440, 767 at 1280) plus a margin; the point
      // is that a re-docked panel would drop straight through it — and the guide is free, so it
      // must not move this number either.
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

    /*
     * The columns are a SHARE of the grass, not a constant: 263px of slack at 1280×800 against
     * 479px at 1920×1080, and fixed columns looked starved on the wide one and wrapped their text
     * mid-phrase (user 2026-08-25: 너무 너비가 짧아서 보기 힘들어).
     */
    out.push(
      h.check(
        'the column grows with the grass it has',
        colWidths['1920x1080'] > colWidths['1280x800'],
        `1280 ${colWidths['1280x800']}px → 1920 ${colWidths['1920x1080']}px`,
      ),
    )

    // ---- menus, hints, zen ------------------------------------------------
    const { context, page, consoleErrors } = await h.openBoard({ width: 1440, height: 900, dpr: 1 })
    const teamBtn = page.getByRole('button', { name: '팀 구성', exact: true })

    out.push(h.check('no docked column survives', (await page.locator('aside').count()) === 0))
    /*
     * v32: an idle board is not silent — it carries the one-line rail, because a gesture you only
     * learn by already performing it is not discoverable (user 2026-08-25). What it must not carry
     * is EXPLANATION: no expanded rows, and no chip lit, until you are actually in a state.
     */
    const keyCount = await guideRows(page).count()
    out.push(h.check('an idle board keeps the key guide', keyCount >= 6, `${keyCount} keys`))
    out.push(
      h.check(
        'but explains nothing until asked',
        (await openRows(page).count()) === 0 && (await heldRows(page).count()) === 0,
      ),
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

    // The board's own commands and its one setting stand in the side column (v35) — no menu.
    const sw = page.getByRole('switch', { name: /공 휙 던지기/ })
    out.push(h.check('the board settings stand in the column', await sw.isVisible()))
    await sw.click()
    out.push(
      h.check('and the switch flips in place', (await sw.getAttribute('aria-checked')) === 'true'),
    )
    await sw.click()
    for (const name of [/움직임 전체 지우기/, /새로 시작/])
      out.push(
        h.check(
          `${String(name)} is one press away`,
          await page.getByRole('button', { name }).isVisible(),
        ),
      )

    /*
     * A shortcut hint that has to be leaned into is not a hint (user 2026-08-26: 여기 단축키 안내
     * 글씨가 너무 작아). The cap in the action column never reads smaller than the cap in the key
     * guide opposite it — 11.5px — whichever width tier the column landed in, and where the column
     * says the words out loud the cap grows with them.
     */
    const capType = await page.evaluate(() => {
      const card = [...document.querySelectorAll('[class*=guideGroup]')].find((g) =>
        g.querySelector('[class*=actionBtn]'),
      )
      const cap = card.querySelector('[class*=actionKey]')
      const label = card.querySelector('[class*=actionLabel]')
      const guideCap = document.querySelector('[class*=guideCap]')
      const px = (el) => (el ? parseFloat(getComputedStyle(el).fontSize) : 0)
      return {
        cap: px(cap),
        guideCap: px(guideCap),
        label: getComputedStyle(label).display === 'none' ? null : px(label),
        colW: Math.round(card.getBoundingClientRect().width),
      }
    })
    out.push(
      h.check(
        'the shortcut cap is never smaller than the guide it echoes',
        capType.cap >= capType.guideCap,
        `cap ${capType.cap}px vs guide ${capType.guideCap}px (column ${capType.colW}px)`,
      ),
    )
    out.push(
      h.check(
        'and where the column says the words, the caps grow with them',
        capType.label === null || (capType.label >= 13.5 && capType.cap >= 12),
        `label ${capType.label}px, cap ${capType.cap}px`,
      ),
    )

    // ExposeHK's rehearsal: holding the real key opens that key's set, and only that one
    await page.mouse.move(700, 400)
    await page.keyboard.down('Control')
    await page.waitForTimeout(420)
    const held = await heldRows(page).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
    const openedText = await page
      .locator('button[class*=guideRow][data-held] + [class*=guideDrawer]')
      .allTextContents()
    await page.keyboard.up('Control')
    out.push(
      h.check(
        'holding Ctrl opens exactly the Ctrl key',
        held.length === 1 && held[0].startsWith('Ctrl'),
        held.join(' | ') || 'nothing held',
      ),
    )
    out.push(
      h.check(
        'and its detail is the Ctrl vocabulary',
        openedText.join('|').includes('선수 추가'),
        openedText.join(' | '),
      ),
    )
    await page.waitForTimeout(600)
    out.push(
      h.check(
        'the detail closes with the key, the guide stays',
        (await openRows(page).count()) === 0 &&
          (await heldRows(page).count()) === 0 &&
          (await guideRows(page).count()) === keyCount,
      ),
    )

    /*
     * The column may not outgrow the board. Stacking the actions under seven key rows made it
     * 857px once a key was opened, which ran 130px past a 1280×800 board (user 2026-08-25: 왼쪽에
     * 있는거 확장되다보면 세로로 넘어버리잖아). The tallest set — Space, four rows — is the test.
     */
    await page.locator('button[class*=guideRow][aria-label^="Space"]').click()
    await page.waitForTimeout(450)
    const opened = await guideBox(page)
    out.push(
      h.check(
        'the widest set still fits the board',
        opened.bottom <= opened.boardBottom,
        `column ends ${opened.bottom}, board ends ${opened.boardBottom}`,
      ),
    )
    await page.locator('button[class*=guideRow][aria-label^="Space"]').click()
    await page.waitForTimeout(350)

    /*
     * …and cues are NOT exclusive. Ctrl and Shift get held together all the time, and while a pin
     * is up as well "every row whose cue is live" opened three drawers at once and ran the column
     * off the bottom of the screen (user 2026-08-25: 그래도 높이가 넘쳐). Exactly one row is ever
     * open: the key in your hand first, then the pin, then focus.
     */
    await page.locator('button[class*=guideRow][aria-label^="Space"]').click() // pin one
    await page.keyboard.down('Control')
    await page.keyboard.down('Shift')
    await page.waitForTimeout(500)
    const many = await guideBox(page)
    const openCount = await openRows(page).count()
    const heldCount = await heldRows(page).count()
    await page.keyboard.up('Control')
    await page.keyboard.up('Shift')
    out.push(
      h.check(
        'two modifiers and a pin still open exactly one row',
        openCount === 1 && heldCount === 1,
        `${openCount} open, ${heldCount} held`,
      ),
    )
    out.push(
      h.check(
        'so the column cannot outgrow the board',
        many.bottom <= many.boardBottom,
        `column ends ${many.bottom}, board ends ${many.boardBottom}`,
      ),
    )
    await page.waitForTimeout(400)
    await page.locator('button[class*=guideRow][aria-label^="Space"]').click() // unpin
    await page.waitForTimeout(300)

    /*
     * Pointer: hover must NOT open anything. It used to, and sweeping down the column opened and
     * shut drawer after drawer, shoving every row below them around (user 2026-08-25: 호버링 했을
     * 때 움직임이 너무 많아서 어지럽고). Geometry moves only when the user asks: a click, or the key.
     */
    const altRow = page.locator('button[class*=guideRow][aria-label^="Alt"]')
    const rowsTop = () =>
      page.$$eval('button[class*=guideRow]', (els) => els.map((e) => Math.round(e.getBoundingClientRect().y)))
    // let the Ctrl drawer finish closing first: the cue's exit gate is 340ms and the drawer spring
    // is 317ms on top of that, so a baseline taken any earlier is a moving target.
    await page.waitForTimeout(500)
    const beforeHover = await rowsTop()
    await altRow.hover()
    await page.waitForTimeout(400)
    out.push(
      h.check('hover opens nothing', (await altRow.getAttribute('aria-expanded')) === 'false'),
    )
    out.push(
      h.check(
        'and moves no row',
        JSON.stringify(await rowsTop()) === JSON.stringify(beforeHover),
        `before ${JSON.stringify(beforeHover)} after ${JSON.stringify(await rowsTop())}`,
      ),
    )
    await altRow.click()
    await page.mouse.move(900, 500)
    await page.waitForTimeout(250)
    out.push(
      h.check('a click opens it and keeps it open', (await altRow.getAttribute('aria-expanded')) === 'true'),
    )
    await page.mouse.click(900, 500)
    await page.waitForTimeout(250)
    out.push(
      h.check('and touching the board puts it away', (await altRow.getAttribute('aria-expanded')) === 'false'),
    )
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
