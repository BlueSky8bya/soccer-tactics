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
      /*
       * The footer must not breathe. Its width used to depend on state — the scoped-replay pair
       * appeared only for a used step, and the view toggle's label is four characters shorter in
       * one position than the other — so every step chip slid sideways under the cursor
       * (user 2026-08-24: 단계 선택하는 버튼이 계속 좌우로 왔다갔다거리는게 불편해).
       */
      const barWidth = () =>
        page.evaluate(() =>
          Math.round(document.querySelector('[class*=simpleBar]').getBoundingClientRect().width),
        )
      const chipX = () =>
        page.evaluate(() =>
          Math.round(
            document
              .querySelectorAll('[class*=stepBar] button[aria-pressed]')[0]
              .getBoundingClientRect().x,
          ),
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
      const replay = page.locator('[class*=stepPanel]').first()
      out.push(
        h.check(
          'a used step offers its scoped replay beside the board',
          (await page.getByRole('button', { name: /단계만 재생/ }).count()) === 1,
          (await replay.innerText()).split(String.fromCharCode(10)).join(' / '),
        ),
      )

      // width/position must be identical for a used step, an empty step and either view mode
      const w1 = await barWidth()
      const x1 = await chipX()
      await chip(page, 7).click()
      await page.waitForTimeout(200)
      const w7 = await barWidth()
      const x7 = await chipX()
      out.push(
        h.check(
          'an empty step does not resize the footer',
          w1 === w7 && x1 === x7,
          `width ${w1} vs ${w7}, chip x ${x1} vs ${x7}`,
        ),
      )
      out.push(
        h.check(
          'and its scoped replay is simply absent (the view switch stays)',
          (await page.getByRole('button', { name: /단계만 재생/ }).count()) === 0,
        ),
      )
      await chip(page, 1).click()
      await page.waitForTimeout(200)

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
      out.push(
        h.check(
          'and the shorter label does not move the chips either',
          (await barWidth()) === w1 && (await chipX()) === x1,
          `width ${await barWidth()} vs ${w1}, chip x ${await chipX()} vs ${x1}`,
        ),
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
      out.push(
        h.check(
          'and the bar moved with it',
          (await page.evaluate(() =>
            [...document.querySelectorAll('[class*=stepBar] button[aria-pressed]')].findIndex(
              (b) => b.getAttribute('aria-pressed') === 'true',
            ),
          )) === 1,
        ),
      )

      /*
       * REGRESSION (user 2026-08-24: 같은 선수한테 또 공을 2번 이상 주면 반응을 안 해). The live ball
       * token reported its moment as step 0 unconditionally, which was only ever true because the
       * authoring clock was always kickoff. Parked at a step's opening, a pass drawn from the live
       * ball therefore truncated the chain and rebuilt the FIRST pass — the board did not change,
       * so a second pass looked like nothing at all had happened.
       */
      const holderNow = (await h.doc(page)).ball.initialHolderId
      const target = (await h.doc(page)).players.find(
        (p) => p.id !== holderNow && p.id !== a.id && p.id !== b.id,
      )
      const ballAt = () => page.evaluate(() => window.__stStateAt(window.__stClock().t).ball.pos)
      await h.drawFrom(page, await ballAt(), target.home, { steps: 10 })
      await page.waitForTimeout(320)
      const afterFirst = h.authoredSegments(await h.doc(page)).filter((s) => s.kind === 'travel')
      out.push(h.check('a pass can be drawn from the live ball', afterFirst.length >= 1, `${afterFirst.length} travels`))

      // advance to the next step: the board stands where the ball arrived, and the NEXT pass must
      // extend the chain rather than replace it
      await chip(page, (afterFirst[afterFirst.length - 1]?.step ?? 1) + 1).click()
      await page.waitForTimeout(250)
      const target2 = (await h.doc(page)).players.find(
        (p) => p.id !== holderNow && p.id !== a.id && p.id !== b.id && p.id !== target.id,
      )
      await h.drawFrom(page, await ballAt(), target2.home, { steps: 10 })
      await page.waitForTimeout(320)
      const afterSecond = h.authoredSegments(await h.doc(page)).filter((s) => s.kind === 'travel')
      out.push(
        h.check(
          'the next pass EXTENDS the chain instead of replacing it',
          afterSecond.length === afterFirst.length + 1,
          `${afterFirst.length} → ${afterSecond.length} travels (steps ${afterSecond.map((s) => s.step).join(',')})`,
        ),
      )

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

      /*
       * The speed row is the only thing that says the play button can be SLID. Opening it after the
       * first millimetre of travel taught nobody (user 2026-08-24: 마우스를 누르고 있을때부터
       * 보여야지) — it opens on the press, and a press that never travels still toggles play.
       */
      // a toast is a floating element over the footer; let it clear before pressing through it
      await page
        .waitForFunction(() => !document.querySelector('[class*=toast]'), null, { timeout: 4000 })
        .catch(() => {})
      const playBtn = page.getByRole('button', { name: /^(재생|일시정지)$/ }).first()
      const box = await playBtn.boundingBox()
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down()
      await page.waitForTimeout(90)
      const scrubCount = await page.locator('[class*=speedScrub]').count()
      out.push(
        h.check('the speed row opens on the press, before any movement', scrubCount > 0, `count=${scrubCount}`),
      )
      await page.mouse.up()
      await page.waitForTimeout(120)
      const playingAfterClick = await page.evaluate(() => window.__stClock().playing)
      out.push(
        h.check('a press that never travels is still play/pause', playingAfterClick === true, `playing=${playingAfterClick}`),
      )
      await page.keyboard.press('Space')
      await page.waitForTimeout(150)

      const problems = await h.validate(page)
      out.push(h.check('document valid throughout', problems.length === 0, problems[0] ?? ''))
      out.push(h.check('no console errors', consoleErrors.length === 0, consoleErrors[0] ?? ''))
    } finally {
      await context.close()
    }
    return out
  },
}
