/**
 * PLAN-015 — the three view/behaviour switches, checked in a real browser.
 *
 * All three are preferences, and a preference is exactly the kind of thing unit tests bless while
 * the running app ignores it: the pure derivation can be perfect while the render, the hit-testing
 * or the stored value disagree. So this probe asks the DOM, not the module:
 *
 *  - the theme actually paints, cycles in one direction, and survives a reload;
 *  - step isolation actually removes the other steps from the document tree (an element that is
 *    merely transparent still catches presses) AND parks the clock at the step's opening, which is
 *    what makes the earlier steps' outcome visible as solid tokens instead of a pile of ghosts;
 *  - the throw is off until it is switched on, and the guide row goes with it.
 */
const ID = 'step-view'

/** Chips wear a count badge once used, so their accessible name is not just the number. */
const chip = (page, n) => page.locator('[class*=stepBar] button[aria-pressed]').nth(n - 1)
const themeBtn = (page) => page.locator('button[data-theme-pref]')
const themeAttr = (page) => page.evaluate(() => document.documentElement.dataset.theme)
/** Path groups actually present in the tree — not "visible", PRESENT. */
const drawnPaths = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('g[data-segment]')].map((g) => g.getAttribute('class') || ''),
  )

async function cycleThemeTo(page, want) {
  for (let i = 0; i < 4; i++) {
    if ((await themeBtn(page).getAttribute('data-theme-pref')) === want) return true
    await themeBtn(page).click()
    await page.waitForTimeout(60)
  }
  return (await themeBtn(page).getAttribute('data-theme-pref')) === want
}

module.exports = {
  id: ID,
  describe:
    'theme cycles and persists; step isolation removes later steps from the tree and hit-testing; the throw is opt-in',
  async run(h) {
    const out = []
    const { context, page, consoleErrors } = await h.openBoard({
      width: 1440,
      height: 900,
      dpr: 1,
    })
    try {
      // ---- theme ---------------------------------------------------------
      out.push(
        h.check(
          'a theme is painted before the first interaction',
          ['light', 'dark'].includes(await themeAttr(page)),
          await themeAttr(page),
        ),
      )
      const seen = []
      for (let i = 0; i < 4; i++) {
        seen.push(await themeBtn(page).getAttribute('data-theme-pref'))
        await themeBtn(page).click()
        await page.waitForTimeout(60)
      }
      out.push(
        h.check(
          'theme cycles system → light → dark → system',
          JSON.stringify(seen) === JSON.stringify(['system', 'light', 'dark', 'system']),
          seen.join(' → '),
        ),
      )
      await cycleThemeTo(page, 'dark')
      const bg = await page.evaluate(
        () => getComputedStyle(document.querySelector('[class*=shell]')).backgroundColor,
      )
      out.push(
        h.check(
          'dark repaints the shell, not just the attribute',
          (await themeAttr(page)) === 'dark' && Number(bg.match(/\d+/)[0]) < 60,
          bg,
        ),
      )
      await page.reload({ waitUntil: 'networkidle' })
      await page.waitForFunction(() => !!window.__stDoc, null, { timeout: 15000 })
      out.push(
        h.check('the choice survives a reload', (await themeAttr(page)) === 'dark', await themeAttr(page)),
      )
      await cycleThemeTo(page, 'light')

      // ---- step isolation -------------------------------------------------
      await h.fillTeams(page)
      const caption = page.locator('[class*=stepStatus]').first()
      const capText = async () => (await caption.innerText()).replace(/\n/g, ' | ')
      out.push(
        h.check('the caption is there on an untouched board', await caption.isVisible(), await capText()),
      )

      const d0 = await h.doc(page)
      const a = d0.players[9]
      const b = d0.players[10]
      await h.drawFrom(page, a.home, { x: a.home.x + 12, y: a.home.y - 6 })
      await chip(page, 2).click()
      await page.waitForTimeout(120)
      const bNow = (await h.doc(page)).players.find((p) => p.id === b.id)
      await h.drawFrom(page, bNow.home, { x: bNow.home.x + 10, y: bNow.home.y + 7 })
      await page.waitForTimeout(150)

      const segs = h.authoredSegments(await h.doc(page))
      out.push(
        h.check(
          'the script authored one movement in each of two steps',
          segs.length === 2 && segs.some((s) => s.step === 1) && segs.some((s) => s.step === 2),
          segs.map((s) => s.step).join(','),
        ),
      )

      await chip(page, 2).click()
      await page.waitForTimeout(200)
      let drawn = await drawnPaths(page)
      out.push(
        h.check(
          'at step 2 only step 2 is drawn — the rest is standing on the board already',
          drawn.length === 1,
          `${drawn.length} of ${segs.length} in the tree`,
        ),
      )
      const clockAt2 = await page.evaluate(() => window.__stClock?.().t ?? null)
      out.push(
        h.check(
          "the clock is parked at the step's opening, not at kickoff",
          typeof clockAt2 === 'number' && clockAt2 > 0,
          `t=${clockAt2}`,
        ),
      )

      /*
       * The relay arc that joins a pass to its receiver is a DECORATION on that pass. It used to
       * be drawn from the document rather than from the layer map, so isolation removed the pass
       * and left the arc floating on the grass beside a player with no line attached
       * (user 2026-08-24: 이상한 흰색 찌꺼기들).
       */
      const orphanLinks = await page.evaluate(() => {
        const links = document.querySelectorAll('[class*=passLink]').length
        const passes = [...document.querySelectorAll('g[data-segment]')].filter((g) =>
          /pathPass|pathLofted|pathShot|pathLoose/.test(g.innerHTML),
        ).length
        return { links, passes }
      })
      out.push(
        h.check(
          'no relay arc survives a pass that isolation removed',
          orphanLinks.links <= orphanLinks.passes,
          `${orphanLinks.links} arcs for ${orphanLinks.passes} drawn passes`,
        ),
      )

      await chip(page, 1).click()
      await page.waitForTimeout(200)
      drawn = await drawnPaths(page)
      out.push(
        h.check(
          'at step 1 the later step is REMOVED, not merely faded',
          drawn.length === 1,
          `${drawn.length} of ${segs.length} in the tree`,
        ),
      )
      const cap = await capText()
      out.push(h.check('the caption names the step it is showing', /1단계/.test(cap), cap))
      out.push(
        h.check(
          'and reports the clock, which the picture cannot',
          /초/.test(cap),
          cap,
        ),
      )

      /*
       * One direction language: a run and a pass are both dashed, both marching, and the white
       * casing carries the SAME dash — a solid casing under a dashed stroke fills every gap with
       * pale white, which is what made the ball's dotted pass read as a smear.
       */
      await page.getByRole('button', { name: /보기: 이 단계/ }).click()
      await page.waitForTimeout(200)
      drawn = await drawnPaths(page)
      out.push(
        h.check('turning isolation off brings every path back', drawn.length === segs.length, `${drawn.length} of ${segs.length}`),
      )
      const flow = await page.evaluate(() =>
        [...document.querySelectorAll('g[data-segment]')].map((g) => {
          const stroke = getComputedStyle(g.querySelector('[class*=path_]'))
          const casing = getComputedStyle(g.querySelector('[class*=pathCasing]'))
          return {
            dash: stroke.strokeDasharray,
            casing: casing.strokeDasharray,
            anim: stroke.animationName,
            casingAnim: casing.animationName,
          }
        }),
      )
      out.push(
        h.check(
          'every path is dashed and its casing breaks in the same places',
          flow.length > 0 && flow.every((f) => f.dash !== 'none' && f.dash === f.casing),
          JSON.stringify(flow.map((f) => `${f.dash} / ${f.casing}`)),
        ),
      )
      out.push(
        h.check(
          'the step being authored marches; the rest hold still',
          flow.some((f) => f.anim !== 'none' && f.anim === f.casingAnim) &&
            flow.some((f) => f.anim === 'none'),
          JSON.stringify(flow.map((f) => f.anim)),
        ),
      )
      await page.getByRole('button', { name: /보기: 전체/ }).click()
      await page.waitForTimeout(120)

      /*
       * REGRESSION (user 2026-08-24: 1단계 이상으로 경로가 안 그려져). The step a movement LANDS on
       * is often past the one the chip asked for — a player's second run cannot share a step with
       * its first. With isolation on and the chip left behind, that movement was authored and then
       * hidden: to the hand that drew it, nothing happened.
       */
      await chip(page, 1).click()
      await page.waitForTimeout(150)
      const before = h.authoredSegments(await h.doc(page)).map((s) => s.id)
      const again = (await h.doc(page)).players.find((p) => p.id === a.id)
      await h.drawFrom(
        page,
        { x: again.home.x + 12, y: again.home.y - 6 },
        { x: again.home.x + 22, y: again.home.y - 12 },
      )
      await page.waitForTimeout(300)
      const made = h.authoredSegments(await h.doc(page)).find((s) => !before.includes(s.id))
      const inTree = made
        ? await page.evaluate((id) => !!document.querySelector(`g[data-segment="${id}"]`), made.id)
        : false
      out.push(
        h.check(
          'a movement that auto-bumps past the chip is still on the board',
          !!made && made.step === 2 && inTree,
          `landed on ${made ? made.step : 'nothing'}, inTree=${inTree}`,
        ),
      )
      out.push(h.check('and the bar/caption moved with it', /2단계/.test(await capText()), await capText()))

      // ---- the throw ------------------------------------------------------
      const flingSwitch = page.getByRole('switch', { name: /공 휙 던지기/ })
      out.push(
        h.check(
          'the throw is off by default',
          (await flingSwitch.getAttribute('aria-checked')) === 'false',
          await flingSwitch.getAttribute('aria-checked'),
        ),
      )
      out.push(
        h.check(
          'the guide does not teach a gesture the board will not perform',
          (await page.getByText('빠르게 놓으면 굴러감').count()) === 0,
        ),
      )

      // The LIVE ball, not `doc.ball.home`: with a step isolated the clock sits at that step's
      // opening, so the ball is wherever the play has carried it by then.
      const ball = await page.evaluate(() => window.__stStateAt(window.__stClock().t).ball.pos)
      const to = { x: ball.x + 22, y: ball.y + 2 }
      await h.dragPitch(page, { x: ball.x, y: ball.y }, to, { steps: 6, settleMs: 900 })
      const rest = (await h.doc(page)).ball.home
      const overshoot = Math.hypot(rest.x - to.x, rest.y - to.y)
      out.push(
        h.check(
          'a fast sweep with the throw OFF leaves the ball where it was released',
          overshoot < 3.5,
          `overshoot=${overshoot.toFixed(2)}m`,
        ),
      )

      await flingSwitch.click()
      await page.waitForTimeout(80)
      out.push(
        h.check(
          'switching it on restores both the gesture and its guide row',
          (await flingSwitch.getAttribute('aria-checked')) === 'true' &&
            (await page.getByText('빠르게 놓으면 굴러감').count()) > 0,
        ),
      )

      const problems = await h.validate(page)
      out.push(h.check('document valid throughout', problems.length === 0, problems[0] ?? ''))
      out.push(h.check('no console errors', consoleErrors.length === 0, consoleErrors[0] ?? ''))
    } finally {
      await context.close()
    }
    return out
  },
}
