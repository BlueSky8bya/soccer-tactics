/**
 * E-core — the three questions the UX axis actually has to answer, on the main authoring journey:
 *
 *   E1 recognition   — does the board tell the user what will happen BEFORE they commit, and what
 *                      DID happen after? (feedforward / feedback, no silent changes)
 *   E2 intent        — does a gesture do what it looked like it would do, and does one gesture
 *                      cost exactly one undo?
 *   E3 legibility    — does the screen agree with the clock? (what is painted vs `stateAt`)
 *
 * Everything here is measured against the app's own resolved state, never against a screenshot:
 * `__stStateAt(t)` is what the document DEPICTS, and the SVG transform is what the user SEES.
 */
const ID = 'ux-core'

/** Read a token's painted centre in pitch metres, straight off its transform. */
async function paintedPos(page, entityId) {
  return page.evaluate((id) => {
    const el = document.querySelector(`[data-entity="${id}"]`)
    if (!el) return null
    const svg = document.querySelector('svg[role="application"]')
    const ctm = svg.getScreenCTM().inverse()
    const r = el.getBoundingClientRect()
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    return { x: ctm.a * cx + ctm.c * cy + ctm.e, y: ctm.b * cx + ctm.d * cy + ctm.f }
  }, entityId)
}

module.exports = {
  id: ID,
  describe: 'E-core — feedforward/feedback, one gesture one undo, screen agrees with the clock',
  async run(h) {
    const out = []
    const { context, page, consoleErrors } = await h.openBoard()
    try {
      await h.fillTeams(page)
      const d0 = await h.doc(page)
      const holder = d0.players.find((p) => p.id === d0.ball.initialHolderId)
      const runner = d0.players.find((p) => p.teamId === holder.teamId && p.id !== holder.id)

      // ---------------------------------------------------------------------------------------
      // E1 — the halo promises a subject before the press (the R5 contract, from the user's side)
      // ---------------------------------------------------------------------------------------
      const tokenC = await h.toClient(page, runner.home)
      await page.mouse.move(tokenC.x, tokenC.y)
      await page.waitForTimeout(140)
      const fHover = await h.flags(page)
      out.push(
        h.check(
          'E1 hovering a player promises that player',
          fHover?.hoverKey === `player:${runner.id}`,
          `hoverKey=${fHover?.hoverKey}`,
        ),
      )
      await page.mouse.move(5, 5)
      await page.waitForTimeout(120)
      const fAway = await h.flags(page)
      out.push(
        h.check('E1 the promise is withdrawn off-target', !fAway?.hoverKey, `hoverKey=${fAway?.hoverKey}`),
      )

      // ---------------------------------------------------------------------------------------
      // E2 — one gesture is one undo, and it does what it promised
      // ---------------------------------------------------------------------------------------
      const before = await h.docBytes(page)
      await h.drawFrom(page, runner.home, { x: runner.home.x + 12, y: runner.home.y }, { steps: 10 })
      const afterDraw = await h.doc(page)
      const segs = h.authoredSegments(afterDraw)
      out.push(h.check('E2 one Alt-drag authors one movement', segs.length === 1, `${segs.length} segments`))
      out.push(
        h.check(
          'E2 the movement belongs to the promised player',
          segs[0]?.entityId === runner.id,
          `entity=${segs[0]?.entityId} expected=${runner.id}`,
        ),
      )
      await page.keyboard.press('Control+z')
      await page.waitForTimeout(200)
      const afterUndo = await h.docBytes(page)
      out.push(
        h.check(
          'E2 one undo puts it back exactly',
          afterUndo === before,
          afterUndo === before ? '' : 'the board did not return to its previous bytes',
        ),
      )
      await page.keyboard.press('Control+y')
      await page.waitForTimeout(200)
      const afterRedo = await h.doc(page)
      out.push(
        h.check(
          'E2 redo restores the movement',
          h.authoredSegments(afterRedo).length === 1,
          `${h.authoredSegments(afterRedo).length} segments`,
        ),
      )

      // ---------------------------------------------------------------------------------------
      // E1 — a blocked action explains itself instead of doing nothing silently
      // ---------------------------------------------------------------------------------------
      const tinyBefore = await h.docBytes(page)
      await h.drawFrom(page, holder.home, { x: holder.home.x + 0.15, y: holder.home.y }, { steps: 3 })
      const tinyAfter = await h.docBytes(page)
      const toastText = await page.evaluate(() => {
        const el = [...document.querySelectorAll('div,span,p')].find(
          (n) => n.children.length === 0 && (n.textContent || '').trim().length > 0 &&
                 getComputedStyle(n).position === 'fixed',
        )
        return el ? el.textContent.trim().slice(0, 60) : null
      })
      out.push(
        h.check(
          'E1 a too-short drag either acts or explains — never silence',
          tinyAfter !== tinyBefore || !!toastText,
          tinyAfter !== tinyBefore ? 'it authored something' : `toast=${toastText}`,
        ),
      )

      // ---------------------------------------------------------------------------------------
      // E3 — what is painted equals what the clock says, at rest and mid-playback
      // ---------------------------------------------------------------------------------------
      const ballId = d0.ball.id
      const passTo = { x: runner.home.x + 12, y: runner.home.y }
      await h.drawFrom(page, { x: d0.ball.home.x, y: d0.ball.home.y }, passTo, { steps: 10 })
      await page.waitForTimeout(250)

      /*
       * Read the clock and the paint in ONE synchronous turn inside the page. Sampling them with
       * two round trips measured the round trip: 0.64 m at pass speed is ~35 ms of latency, not a
       * board that disagrees with itself.
       */
      const sampleAgreement = async (label, id) => {
        const r = await page.evaluate((entityId) => {
          const t = window.__stClock().t
          const s = window.__stStateAt(t)
          const el = document.querySelector(`[data-entity="${entityId}"]`)
          if (!el) return null
          const svg = document.querySelector('svg[role="application"]')
          const ctm = svg.getScreenCTM().inverse()
          const rect = el.getBoundingClientRect()
          const cx = rect.left + rect.width / 2
          const cy = rect.top + rect.height / 2
          const painted = {
            x: ctm.a * cx + ctm.c * cy + ctm.e,
            y: ctm.b * cx + ctm.d * cy + ctm.f,
          }
          return {
            t,
            playing: window.__stClock().playing,
            clock: s.ball.pos,
            painted,
            d: Math.hypot(painted.x - s.ball.pos.x, painted.y - s.ball.pos.y),
          }
        }, id)
        if (!r) return h.check(`E3 ${label}: ball is painted`, false, 'no ball element')
        return h.check(
          `E3 ${label}: painted ball = clock ball`,
          r.d <= 0.35,
          `Δ=${r.d.toFixed(3)}m at t=${r.t.toFixed(2)}s playing=${r.playing}` +
            ' (0.35m allows the drop/bob decoration)',
        )
      }
      out.push(await sampleAgreement('at rest', ballId))

      // play, sample mid-flight, then pause and sample the held frame
      // exact: the step panel's buttons ('N단계만 재생') also contain this word
      await page.getByRole('button', { name: '재생', exact: true }).click()
      await page.waitForTimeout(400)
      out.push(await sampleAgreement('mid-playback', ballId))
      const playingFlag = await page.evaluate(() => window.__stClock().playing)
      out.push(h.check('E3 playback is actually running', playingFlag === true, `playing=${playingFlag}`))
      // wait for the play to actually FINISH — asserting on a still-running clock proves nothing
      const ended = await page
        .waitForFunction(() => (window.__stClock().playing ? null : window.__stClock()), null, {
          timeout: 15000,
        })
        .then((hnd) => hnd.jsonValue())
        .catch(() => null)
      out.push(
        h.check(
          'E1 the play ends on a held result frame, not a snap to zero',
          !!ended && ended.t > 0 && ended.playing === false,
          ended ? `t=${ended.t.toFixed(2)} playing=${ended.playing}` : 'never stopped within 15s',
        ),
      )
      out.push(await sampleAgreement('held result', ballId))

      // ---------------------------------------------------------------------------------------
      // integrity after the whole journey
      // ---------------------------------------------------------------------------------------
      const problems = await h.validate(page)
      out.push(h.check('the document is valid after the journey', problems.length === 0, problems[0] ?? ''))
      out.push(h.check('no console errors', consoleErrors.length === 0, consoleErrors[0] ?? ''))
    } finally {
      await context.close()
    }
    return out
  },
}
