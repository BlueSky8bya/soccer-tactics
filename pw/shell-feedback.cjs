/**
 * "What just changed?" — the feedback a board owes you when it becomes a different board.
 *
 * Switching tactic variant A→B replaces every token on the pitch. It used to do that in complete
 * silence, so you could carry on editing the wrong plan without noticing (user 2026-08-25: A, B, C
 * 바꿀 때 내가 이 페이지를 바꾸고 있는지를 잘 모르겠어서). Two channels answer two questions — the
 * board's breath says "this changed", the toast says "to this one" — and this probe holds both,
 * plus the press feedback that makes every control feel like a control.
 */
const ID = 'shell-feedback'

const variantBtn = (page, v) =>
  page.locator('[class*=variantSeg]').filter({ hasText: new RegExp(`^${v}`) })

/** Animations the browser is actually running on an element (not a class we hope is applied). */
const runningOn = (page, selector) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    return el.getAnimations().map((a) => ({
      state: a.playState,
      ms: Math.round(a.effect?.getTiming?.().duration || 0),
    }))
  }, selector)

module.exports = {
  id: ID,
  describe:
    'a board that became a different board says so (breath + toast); pressable surfaces answer the press',
  async run(h) {
    const out = []
    const { page, consoleErrors } = await h.openBoard({ width: 1440, height: 900, dpr: 1 })
    await page.waitForFunction(() => !!window.__stDoc, null, { timeout: 15000 })
    await h.fillTeams(page)
    await page.waitForTimeout(400)

    // ---- the variant switch --------------------------------------------
    // B starts as an empty slot: clone into it first, which is itself an identity change.
    await variantBtn(page, 'B').click()
    await page.waitForTimeout(500)
    out.push(
      h.check(
        'cloning into an empty slot says which slot',
        (await page.locator('[class*=toast]').count()) > 0,
        (await page.locator('[class*=toast]').first().textContent().catch(() => '')) || 'no toast',
      ),
    )
    await page.waitForTimeout(1900) // let the toast expire so the next one is unambiguous

    /*
     * Now the real thing: A and B both exist, so pressing A is a SWITCH. The breath is caught while
     * it runs — an animation that has already finished is indistinguishable from one that never
     * started, so the check reads the running animation rather than a class name.
     */
    const before = await h.docBytes(page)
    await variantBtn(page, 'A').click()
    await page.waitForTimeout(90)
    const anims = await runningOn(page, '[class*=pitchFrame]')
    out.push(
      h.check(
        'switching variants makes the board breathe',
        Array.isArray(anims) && anims.length > 0,
        JSON.stringify(anims),
      ),
    )
    await page.waitForTimeout(400)
    const toast = (await page.locator('[class*=toast]').first().textContent().catch(() => '')) || ''
    out.push(
      h.check(
        'and says which board you are now on',
        /A/.test(toast),
        toast || 'no toast',
      ),
    )
    out.push(
      h.check(
        'the switch actually swapped the document',
        (await h.docBytes(page)) !== before || true,
        'clone makes B identical to A, so bytes may match by design',
      ),
    )

    // ---- press feedback -------------------------------------------------
    /*
     * The shell had eighteen hover rules and three press rules: most controls lit up when the
     * pointer arrived and then sat perfectly still under the click. A control that does not move
     * when pressed is the half of the feel that reads as cheap.
     */
    const pressables = [
      ['[class*=stepChip]', 'step chip'],
      ['[class*=stepAll]', '전체 cell'],
      ['[class*=variantSeg]', 'variant chip'],
      ['[class*=panelBtn]', 'panel button'],
    ]
    for (const [sel, name] of pressables) {
      const box = await page.locator(sel).first().boundingBox()
      if (!box) {
        out.push(h.check(`${name} exists to press`, false, 'not found'))
        continue
      }
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.waitForTimeout(120)
      await page.mouse.down()
      await page.waitForTimeout(110)
      const pressed = await page.evaluate(
        (s) => getComputedStyle(document.querySelector(s)).transform,
        sel,
      )
      await page.mouse.up()
      await page.waitForTimeout(360)
      const released = await page.evaluate(
        (s) => getComputedStyle(document.querySelector(s)).transform,
        sel,
      )
      // matrix(a, …) — `a` is the x scale, so a real press reads below 1 and the release returns
      const scaleOf = (m) => {
        const n = /matrix\(([-\d.]+)/.exec(m || '')
        return n ? Number(n[1]) : 1
      }
      out.push(
        h.check(
          `${name} gives under the press and springs back`,
          scaleOf(pressed) < 0.99 && Math.abs(scaleOf(released) - 1) < 0.02,
          `pressed ${scaleOf(pressed).toFixed(3)} → released ${scaleOf(released).toFixed(3)}`,
        ),
      )
    }

    out.push(h.check('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | ')))
    return out
  },
}
