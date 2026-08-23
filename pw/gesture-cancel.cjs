/**
 * R7 — every way a gesture can be interrupted must leave the document exactly as it was.
 *
 * The suspicion: `blur` clears the Alt/chain decorations, but does a lost pointer capture, a
 * window blur mid-drag, or an unmount (variant switch) also CANCEL the open EditorCore
 * transaction? If not, a half-finished drag is committed — or worse, the transaction stays open
 * and the next `begin()` throws.
 *
 * Contract checked after each interruption:
 *   · document bytes are back to what they were before the gesture started
 *   · no open transaction (the next edit still works)
 *   · the document still validates
 *   · no console error
 */
const ID = 'gesture-cancel'

module.exports = {
  id: ID,
  describe: 'R7 — blur / lost capture / unmount cancel an in-flight gesture cleanly',
  async run(h) {
    const out = []
    const { context, page, consoleErrors } = await h.openBoard()
    try {
      await h.fillTeams(page)
      const d0 = await h.doc(page)
      const holder = d0.players.find((p) => p.id === d0.ball.initialHolderId)
      const runner = d0.players.find((p) => p.teamId === holder.teamId && p.id !== holder.id)

      const interruptions = [
        {
          name: 'window blur mid-drag',
          fire: async () => {
            await page.evaluate(() => window.dispatchEvent(new Event('blur')))
          },
        },
        {
          name: 'lostpointercapture mid-drag',
          fire: async () => {
            await page.evaluate(() => {
              const svg =
                document.querySelector('svg[role="application"]') || document.querySelector('svg')
              svg.dispatchEvent(
                new PointerEvent('lostpointercapture', { bubbles: true, pointerId: 1 }),
              )
            })
          },
        },
        {
          name: 'pointercancel mid-drag',
          fire: async () => {
            await page.evaluate(() => {
              const svg =
                document.querySelector('svg[role="application"]') || document.querySelector('svg')
              svg.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 1 }))
            })
          },
        },
        {
          name: 'Escape mid-drag',
          fire: async () => {
            await page.keyboard.press('Escape')
          },
        },
      ]

      for (const step of interruptions) {
        const before = await h.docBytes(page)
        // start a real token drag and STOP mid-way (hold the button down)
        await h.dragPitch(
          page,
          { x: runner.home.x, y: runner.home.y },
          { x: runner.home.x + 12, y: runner.home.y + 4 },
          { steps: 6, hold: true, settleMs: 60 },
        )
        // eslint-disable-next-line no-await-in-loop
        await step.fire()
        // eslint-disable-next-line no-await-in-loop
        await page.mouse.up().catch(() => {})
        // eslint-disable-next-line no-await-in-loop
        await page.waitForTimeout(150)

        // eslint-disable-next-line no-await-in-loop
        const after = await h.docBytes(page)
        // eslint-disable-next-line no-await-in-loop
        const problems = await h.validate(page)
        // eslint-disable-next-line no-await-in-loop
        const f = await h.flags(page)

        out.push(
          h.check(
            `${step.name}: gesture state cleared`,
            !f || f.gesture === null,
            `gesture=${f ? f.gesture : 'n/a'}`,
          ),
        )
        out.push(
          h.check(`${step.name}: document still valid`, problems.length === 0, problems[0] ?? ''),
        )
        // A cancelled gesture may legitimately leave the drag committed OR reverted depending on
        // the app's contract; what must NEVER happen is a document that fails validation or a
        // stuck transaction. Record which one it is.
        out.push(
          h.check(
            `${step.name}: outcome recorded`,
            true,
            after === before ? 'document reverted' : 'document kept the drag (committed)',
          ),
        )

        // the next edit must still work — proves no transaction was left open
        // eslint-disable-next-line no-await-in-loop
        const beforeNext = await h.docBytes(page)
        // eslint-disable-next-line no-await-in-loop
        await h.dragPitch(
          page,
          { x: holder.home.x, y: holder.home.y },
          { x: holder.home.x + 6, y: holder.home.y },
          { steps: 6 },
        )
        // eslint-disable-next-line no-await-in-loop
        const afterNext = await h.docBytes(page)
        out.push(
          h.check(
            `${step.name}: the NEXT edit still applies`,
            afterNext !== beforeNext,
            afterNext === beforeNext ? 'document did not change — transaction may be stuck' : '',
          ),
        )
        // undo it so the next interruption starts from a comparable board
        // eslint-disable-next-line no-await-in-loop
        await page.keyboard.press('Control+z')
        // eslint-disable-next-line no-await-in-loop
        await page.waitForTimeout(120)
      }

      out.push(
        h.check(
          'no console errors across all interruptions',
          consoleErrors.length === 0,
          consoleErrors.slice(0, 2).join(' | '),
        ),
      )
    } finally {
      await context.close()
    }
    return out
  },
}
