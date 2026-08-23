/**
 * Reduced motion must change DECORATION only, never the tactic.
 *
 * The suspicion: if a spring or a motion setting feeds anything the document reads, the same
 * pointer trace would author a different tactic for a user who has reduced motion on. Springs are
 * supposed to live only in `src/ui/motion` (harness invariant), so the persisted document after an
 * identical drag must be byte-identical between the two settings.
 */
const ID = 'reduced-motion'

/** Ids are minted per session, so compare the SHAPE of the tactic, not the raw bytes. */
function shapeOf(d) {
  const round = (n) => Math.round(n * 100) / 100
  const segs = d.scenes[0].timeline.tracks
    .flatMap((t) =>
      t.segments.map((s) => ({
        entity: t.entityKind,
        kind: s.kind,
        step: s.step ?? null,
        pts: s.path
          ? s.path.waypoints.map((w) => [round(w.p.x), round(w.p.y)])
          : null,
        holder: s.holderId ? 'holder' : null,
        receiver: s.receiverId ? 'receiver' : null,
      })),
    )
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  return JSON.stringify({
    players: d.players.map((p) => [round(p.home.x), round(p.home.y)]).sort(),
    ball: [round(d.ball.home.x), round(d.ball.home.y)],
    hasHolder: !!d.ball.initialHolderId,
    segs,
  })
}

async function authorTactic(h, page) {
  await h.fillTeams(page)
  const d0 = await h.doc(page)
  const holder = d0.players.find((p) => p.id === d0.ball.initialHolderId)
  const runner = d0.players.find((p) => p.teamId === holder.teamId && p.id !== holder.id)
  // an identical script of real gestures in both settings (Alt = author, not move)
  await h.drawFrom(page, runner.home, { x: runner.home.x + 12, y: runner.home.y }, { steps: 10 })
  await h.drawFrom(
    page,
    { x: d0.ball.home.x, y: d0.ball.home.y },
    { x: runner.home.x + 12, y: runner.home.y },
    { steps: 10 },
  )
  await page.waitForTimeout(250)
  return h.doc(page)
}

module.exports = {
  id: ID,
  describe: 'reduced motion changes decoration only — the authored tactic is identical',
  async run(h) {
    const out = []
    const normal = await h.openBoard({ width: 1440, height: 900, dpr: 1 })
    let shapeNormal
    try {
      const dn = await authorTactic(h, normal.page)
      shapeNormal = shapeOf(dn)
      // NON-VACUITY: two empty boards would match trivially. An earlier version of this probe
      // used plain drags (which MOVE a token and author nothing) and passed on nothing at all.
      const authored = h.authoredSegments(dn)
      out.push(
        h.check(
          'the script actually authored a tactic',
          authored.length >= 2,
          `${authored.length} authored segments`,
        ),
      )
      out.push(
        h.check('no console errors (normal motion)', normal.consoleErrors.length === 0, normal.consoleErrors[0] ?? ''),
      )
    } finally {
      await normal.context.close()
    }

    const reduced = await h.openBoard({
      width: 1440,
      height: 900,
      dpr: 1,
      reducedMotion: 'reduce',
    })
    try {
      const shapeReduced = shapeOf(await authorTactic(h, reduced.page))
      out.push(
        h.check(
          'the authored tactic is identical under reduced motion',
          shapeNormal === shapeReduced,
          shapeNormal === shapeReduced
            ? ''
            : 'documents differ — a motion setting is reaching the tactic',
        ),
      )
      const problems = await h.validate(reduced.page)
      out.push(h.check('document valid under reduced motion', problems.length === 0, problems[0] ?? ''))
      out.push(
        h.check('no console errors (reduced motion)', reduced.consoleErrors.length === 0, reduced.consoleErrors[0] ?? ''),
      )
    } finally {
      await reduced.context.close()
    }
    return out
  },
}
