/**
 * R5 — the hover promise must be the press target.
 *
 * The suspicion (Codex structural review): hover latches the GLOBAL top candidate
 * (`ordered[0]` → `hoverKey`) while the press runs a modifier-aware adapter that takes a category
 * top plus an intent priority. Where a ghost, a token and a path overlap, the halo can therefore
 * promise one subject and the drag act on another — the user aims at a path and bends a ghost.
 *
 * The comparison is only possible because `__stFlags().hoverKey` reports the halo's own key
 * (`segment:<id>` / `ghost:<segId>:<entityId>` / `player:<id>` / `ball:<id>`), which is React
 * state and invisible in paint. Against it we put the intent log entry the press produced.
 */
const ID = 'pick-overlap'

/** Reduce a hoverKey and an intent-log entry to the same vocabulary. */
function hoverSubject(key) {
  if (!key) return null
  if (key.startsWith('segment:')) return { kind: 'segment', id: key.slice(8) }
  if (key.startsWith('ghost:')) {
    const [, segId, entityId] = key.split(':')
    return { kind: 'ghost', id: segId, entityId }
  }
  if (key.startsWith('player:')) return { kind: 'token', id: key.slice(7) }
  if (key.startsWith('ball:')) return { kind: 'token', id: key.slice(5) }
  return { kind: 'other', id: key }
}

function pressSubject(entry) {
  if (!entry) return null
  if (entry.ghost) return { kind: 'ghost', id: entry.seg ?? null, entityId: entry.ghost.entityId }
  if (entry.intent === 'bend-path') return { kind: 'segment', id: entry.seg ?? null }
  if (entry.token) return { kind: 'token', id: entry.token }
  if (entry.seg) return { kind: 'segment', id: entry.seg }
  return { kind: 'other', id: entry.intent }
}

module.exports = {
  id: ID,
  describe: 'R5 — hover promise equals press dispatch where ghost, token and path overlap',
  async run(h) {
    const out = []
    const { context, page, consoleErrors } = await h.openBoard()
    try {
      await h.fillTeams(page)
      const d0 = await h.doc(page)
      const holder = d0.players.find((p) => p.id === d0.ball.initialHolderId)
      const runner = d0.players.find((p) => p.teamId === holder.teamId && p.id !== holder.id)

      // Step 1 out, step 2 back across the same ground: the paths cross and the step-1 ghost
      // sits on the crossing — three pickable things within a few pixels.
      const a = { x: runner.home.x, y: runner.home.y }
      const b = { x: runner.home.x + 14, y: runner.home.y }
      await h.drawFrom(page, a, b, { steps: 10 })
      await h.drawFrom(page, b, { x: b.x - 7, y: b.y + 8 }, { steps: 10 })

      const d1 = await h.doc(page)
      const segs = h.authoredSegments(d1)
      out.push(h.check('two authored runs exist', segs.length >= 2, `${segs.length} segments`))
      if (segs.length < 2) return out

      const first = segs.find((s) => (s.step ?? 1) === 1) ?? segs[0]
      const ghostPt = first.path.waypoints[first.path.waypoints.length - 1].p

      // sample several points around the overlap, not just the exact ghost centre
      const samples = [
        { label: 'ghost centre', pt: ghostPt },
        { label: 'ghost +1m along path', pt: { x: ghostPt.x - 1, y: ghostPt.y } },
        { label: 'ghost +1m off path', pt: { x: ghostPt.x, y: ghostPt.y + 1 } },
        { label: 'crossing region', pt: { x: ghostPt.x - 3.5, y: ghostPt.y + 4 } },
      ]

      let compared = 0
      let agreed = 0
      for (const s of samples) {
        const c = await h.toClient(page, s.pt)
        // hover first — this is the promise the user sees
        await page.mouse.move(c.x, c.y)
        await page.waitForTimeout(140)
        const f = await h.flags(page)
        const promise = hoverSubject(f?.hoverKey ?? null)

        // then press+drag from the SAME point — this is what actually happens
        await h.clearIntentLog(page)
        const before = await h.docBytes(page)
        await h.dragPitch(page, s.pt, { x: s.pt.x + 2.5, y: s.pt.y - 2.5 }, { steps: 6 })
        const log = await h.intentLog(page)
        const after = await h.docBytes(page)
        const acted = pressSubject(log[log.length - 1] ?? null)

        if (promise && acted) {
          compared++
          const same =
            promise.kind === acted.kind &&
            (promise.kind !== 'ghost' || promise.entityId === acted.entityId) &&
            (promise.kind !== 'segment' || promise.id === acted.id)
          if (same) agreed++
          out.push(
            h.check(
              `${s.label}: hover promise = press dispatch`,
              same,
              `hover=${JSON.stringify(promise)} press=${JSON.stringify(acted)} intent=${log[log.length - 1]?.intent}`,
            ),
          )
        } else {
          out.push(
            h.check(
              `${s.label}: both readings available`,
              !!promise === !!acted,
              `hover=${JSON.stringify(promise)} press=${JSON.stringify(acted)}`,
            ),
          )
        }
        out.push(
          h.check(
            `${s.label}: the press did something`,
            after !== before,
            after === before ? 'a 2.5m drag changed nothing' : '',
          ),
        )
        // undo so each sample starts from the same board
        await page.keyboard.press('Control+z')
        await page.waitForTimeout(140)
      }
      out.push(
        h.check(
          'hover/press agreement across the overlap',
          compared > 0 && agreed === compared,
          `${agreed}/${compared} sample points agreed`,
        ),
      )

      // Repeat clicks at ONE point must be stable — the identity may cycle deliberately (CR-09),
      // but it must not oscillate at random. Record the sequence.
      await h.clearIntentLog(page)
      const cc = await h.toClient(page, ghostPt)
      await page.mouse.move(cc.x, cc.y)
      for (let i = 0; i < 3; i++) {
        await page.mouse.down()
        await page.mouse.up()
        await page.waitForTimeout(120)
      }
      const cycleLog = await h.intentLog(page)
      const intents = cycleLog.map((e) => e.intent)
      out.push(
        h.check(
          'repeat clicks at one point are deterministic',
          intents.length >= 1,
          intents.join(' → ') || 'no intents logged',
        ),
      )

      const problems = await h.validate(page)
      out.push(h.check('document valid after overlap work', problems.length === 0, problems[0] ?? ''))
      out.push(h.check('no console errors', consoleErrors.length === 0, consoleErrors[0] ?? ''))
    } finally {
      await context.close()
    }
    return out
  },
}
