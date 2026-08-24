/**
 * Step-view fuzz — the number keys, Space and the two replay buttons, hammered in every order.
 *
 * The report (user 2026-08-24): "숫자키로 1, 2, 3 … 눌러서 현재 단계 경로만 보는데 계속 누르니까
 * 단계들이 서로 섞여서 보일 때도 있고." Switching the step LAYER is a view act — it must never
 * change the tactic, and while one step is isolated nothing from another step may be painted.
 *
 * So the campaign builds one tactic, freezes a fingerprint of it, and then only ever LOOKS at it:
 * digits, Space, the scope buttons, the chips, the view toggle, Escape. After every single op it
 * asks the same questions.
 */
const fs = require('fs')
const path = require('path')

const ID = 'step-view-fuzz'
const OUT = path.join(__dirname, 'lab', 'out-stepfuzz')
const chip = (page, n) => page.locator('[class*=stepBar] button[aria-pressed]').nth(n - 1)
const safe = (s) => s.replace(/[^a-z0-9]+/gi, '_')
/**
 * ST_PROBE_SHOTS=1 writes a gallery (and failure frames) under pw/lab/out-stepfuzz — gitignored,
 * for looking at with your own eyes. ST_PROBE_ROUNDS raises the campaign length; three rounds is
 * the standing guard, eight is what the hunt ran.
 */
const SHOTS = process.env.ST_PROBE_SHOTS === '1'
const ROUNDS = Number(process.env.ST_PROBE_ROUNDS || 3)
/** ST_PROBE_SEED varies the order; the default is fixed so the standing run is reproducible. */
const SEED = Number(process.env.ST_PROBE_SEED || 20260824)

/** Independent reimplementation of stepOpensAt — a probe that reuses the app's math proves nothing. */
function opensAt(doc, compiled, step) {
  let open = Infinity
  let prevEnd = 0
  for (const tr of doc.scenes[0].timeline.tracks)
    for (const s of tr.segments) {
      if (!s.path || s.id.startsWith('gen-')) continue
      const tm = compiled.segmentTimes[s.id]
      if (!tm) continue
      const n = s.step ?? 1
      if (n === step) open = Math.min(open, tm.start)
      else if (n < step) prevEnd = Math.max(prevEnd, tm.end)
    }
  return Number.isFinite(open) ? open : prevEnd
}

const snapshot = (page) =>
  page.evaluate(() => {
    const doc = window.__stDoc
    const steps = {}
    for (const tr of doc.scenes[0].timeline.tracks)
      for (const s of tr.segments)
        if (s.path && !s.id.startsWith('gen-'))
          steps[s.id] = { step: s.step ?? 1, kind: s.kind, entity: tr.entityId }
    const painted = [...document.querySelectorAll('g[data-segment]')].map((g) =>
      g.getAttribute('data-segment'),
    )
    const chips = [...document.querySelectorAll('[class*=stepBar] button[aria-pressed]')]
    const f = window.__stFlags()
    const pb = window.__stClock()
    // Ghosts carry the movement they mark, so a ghost from another step is as much a leak as a path
    const ghostSegs = [...document.querySelectorAll('[data-ghost]')].map((g) => g.getAttribute('data-move-seg'))
    // Where every token is PAINTED, against where the clock says it should be
    const want = window.__stStateAt(pb.t)
    let drift = 0
    let driftOf = null
    for (const el of document.querySelectorAll('g[data-entity]')) {
      const m = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(el.getAttribute('transform') || '')
      if (!m) continue
      const id = el.getAttribute('data-entity')
      const w = id === window.__stDoc.ball.id ? want.ball.pos : want.players[id] && want.players[id].pos
      if (!w) continue
      const d = Math.hypot(+m[1] - w.x, +m[2] - w.y)
      if (d > drift) {
        drift = d
        driftOf = id
      }
    }
    return {
      ghostSegs,
      drift,
      driftOf,
      steps,
      painted: [...new Set(painted)],
      litChip: chips.findIndex((b) => b.getAttribute('aria-pressed') === 'true') + 1,
      ghosts: document.querySelectorAll('[class*=ghostToken]').length,
      clock: pb.t,
      playing: pb.playing,
      currentStep: f.currentStep,
      stepIsolate: f.stepIsolate,
      completion: f.completion,
      selectedSegmentId: f.selectedSegmentId,
      fingerprint: Object.entries(steps)
        .map(([id, v]) => id + ':' + v.step + ':' + v.kind)
        .sort()
        .join('|'),
    }
  })

module.exports = {
  id: ID,
  describe: 'the step layer is a VIEW: it never edits the tactic and never paints two steps at once',
  async run(h) {
    const out = []
    const { page, consoleErrors } = await h.openBoard({ width: 1440, height: 900, dpr: 1 })
    await page.waitForFunction(() => !!window.__stDoc, null, { timeout: 15000 })
    await h.fillTeams(page)
    await page.waitForTimeout(400)
    if (SHOTS) fs.mkdirSync(OUT, { recursive: true })

    // ---- build a five-step tactic --------------------------------------
    const d0 = await h.doc(page)
    const mine = d0.players.filter((p) => p.teamId === 'team-a').sort((a, b) => a.home.x - b.home.x)
    for (let i = 0; i < 4; i++) {
      await chip(page, i + 1).click()
      await page.waitForTimeout(180)
      const p = mine[i + 2]
      await h.drawFrom(page, p.home, { x: p.home.x + 11, y: p.home.y + (i % 2 ? -7 : 7) }, { steps: 8 })
      await page.waitForTimeout(320)
    }
    // …and a pass, so the ball has a step of its own
    await chip(page, 5).click()
    await page.waitForTimeout(200)
    const bp = await page.evaluate(() => window.__stStateAt(window.__stClock().t).ball.pos)
    await h.dragPitch(page, bp, bp, { steps: 1, settleMs: 220 })
    const recv = mine[7]
    await h.drawFrom(page, { x: bp.x + 2, y: bp.y + 2 }, recv.home, { steps: 8 })
    await page.waitForTimeout(400)

    const base = await snapshot(page)
    const stepsPresent = [...new Set(Object.values(base.steps).map((v) => v.step))].sort()
    out.push(
      h.check(
        'a multi-step tactic is standing',
        stepsPresent.length >= 4,
        'steps ' + stepsPresent.join(',') + ' · ' + Object.keys(base.steps).length + ' movements',
      ),
    )
    if (SHOTS) await page.screenshot({ path: path.join(OUT, 'built.png') })

    // ---- the campaign ---------------------------------------------------
    const scopeOnly = page.getByRole('button', { name: /현재 단계만/ })
    const scopeFrom = page.getByRole('button', { name: /현재 단계부터/ })
    const viewBtn = (which) =>
      page.locator('[class*=viewSeg] button').filter({ hasText: which === 'iso' ? /단계만/ : /^전체$/ })

    /*
     * Every op is TOLERANT. The panel unmounts while the play runs and its replay buttons only
     * exist while the chosen step holds movements, so a click that finds nothing is a fact about
     * the UI, not a broken probe — it is counted and the campaign carries on.
     */
    const missed = []
    const tap = (name, locator) => ({
      name,
      run: async () => {
        try {
          await locator().click({ timeout: 1200 })
        } catch {
          missed.push(name)
        }
      },
    })
    const ops = []
    for (let n = 1; n <= 9; n++)
      ops.push({ name: 'digit ' + n, run: () => page.keyboard.press(String(n)) })
    ops.push({ name: 'space', run: () => page.keyboard.press(' ') })
    ops.push({ name: 'escape', run: () => page.keyboard.press('Escape') })
    ops.push({ name: 'home', run: () => page.keyboard.press('Home') })
    ops.push({ name: 'loop g', run: () => page.keyboard.press('g') })
    ops.push({
      name: 'let it finish',
      run: async () => {
        for (let k = 0; k < 40; k++) {
          if (!(await page.evaluate(() => window.__stClock().playing))) return
          await page.waitForTimeout(200)
        }
      },
    })
    ops.push(tap('scope-only', () => scopeOnly))
    ops.push(tap('scope-from', () => scopeFrom))
    ops.push(tap('view-iso', () => viewBtn('iso')))
    ops.push(tap('view-all', () => viewBtn('all')))
    for (let n = 1; n <= 5; n++) ops.push(tap('chip ' + n, () => chip(page, n)))
    /*
     * Board presses belong in the campaign. Reading a tactic is not a keyboard-only act — you
     * click the path you are looking at. And a SELECTED movement changes what the digits mean
     * (keymap: 경로를 선택했으면 그 경로의 단계 변경), which is exactly the collision the report
     * describes: the same key that switches the view also re-files what you picked.
     */
    ops.push({
      name: 'click a path',
      run: async () => {
        const g = page.locator('g[data-segment] path').first()
        try {
          await g.click({ timeout: 1200, force: true })
        } catch {
          missed.push('click a path')
        }
      },
    })
    ops.push({
      name: 'click grass',
      run: async () => {
        const c = await h.toClient(page, { x: 8, y: 6 })
        await page.mouse.click(c.x, c.y)
      },
    })

    // deterministic: every op once, then three seeded shuffles over the same set
    let seed = SEED
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32)
    const plan = [...ops]
    for (let round = 0; round < ROUNDS; round++)
      for (let i = 0; i < ops.length; i++) plan.push(ops[Math.floor(rnd() * ops.length)])

    const bad = { edited: [], mixed: [], chip: [], clock: [], orphan: [], drift: [], ghost: [] }
    let shots = 0
    let maxDrift = 0
    for (let i = 0; i < plan.length; i++) {
      const op = plan[i]
      await op.run()
      await page.waitForTimeout(260)
      const s = await snapshot(page)
      const label = i + ':' + op.name

      if (s.fingerprint !== base.fingerprint) {
        bad.edited.push(label + ' → ' + s.fingerprint.slice(0, 100))
        if (SHOTS && shots < 8) {
          await page.screenshot({ path: path.join(OUT, 'edited-' + i + '-' + safe(op.name) + '.png') })
          shots++
        }
        base.fingerprint = s.fingerprint // re-baseline so the rest of the run still tests something
      }
      const orphan = s.painted.filter((id) => !s.steps[id])
      if (orphan.length) bad.orphan.push(label + ' → ' + orphan.length)
      /*
       * Tokens are SPRUNG (src/ui/motion), so a frame sampled mid-settle is a few centimetres
       * behind the clock by design. The question here is whether a token is standing in a
       * DIFFERENT STEP, and steps are metres apart — a token's own radius is 1.35 m.
       */
      maxDrift = Math.max(maxDrift, s.drift)
      if (s.drift > 1.2) bad.drift.push(label + ' → ' + s.drift.toFixed(2) + 'm (' + s.driftOf + ')')

      /*
       * `held-result` is a legitimate place to stand: a finished replay holds its last frame on
       * purpose. What must never survive it is a STEP PICK — asking for a step is asking to stand
       * in it — so the clock is judged only right after a digit or a chip.
       */
      const picked = /^(digit|chip) /.test(op.name)
      if (s.stepIsolate && !s.playing && (s.completion === 'idle' || picked)) {
        const foreign = s.painted
          .filter((id) => s.steps[id] && s.steps[id].step !== s.currentStep)
          .map((id) => s.steps[id].kind + '@' + s.steps[id].step)
        const foreignGhosts = s.ghostSegs
          .filter((id) => id && s.steps[id] && s.steps[id].step !== s.currentStep)
          .map((id) => s.steps[id].kind + '@' + s.steps[id].step)
        if (foreignGhosts.length) bad.ghost.push(label + ' (chip ' + s.currentStep + ') → ' + foreignGhosts.join(','))
        if (foreign.length) {
          bad.mixed.push(label + ' (chip ' + s.currentStep + ') → ' + foreign.join(','))
          if (SHOTS && shots < 8) {
            await page.screenshot({ path: path.join(OUT, 'mixed-' + i + '-' + safe(op.name) + '.png') })
            shots++
          }
        }
        const want = opensAt(
          await h.doc(page),
          await page.evaluate(() => window.__stCompiled),
          s.currentStep,
        )
        if (picked && Math.abs(s.clock - want) > 1e-3)
          bad.clock.push(
            label +
              ' → clock ' + s.clock.toFixed(2) + ' want ' + want.toFixed(2) +
              ' [completion=' + s.completion + ' prev=' + (i ? plan[i - 1].name : '-') + ' sel=' + (s.selectedSegmentId || '-') + ']',
          )
      }
      if (s.litChip !== s.currentStep) bad.chip.push(label + ' → lit ' + s.litChip + ' state ' + s.currentStep)
    }

    out.push(h.check('no view op edited the tactic', bad.edited.length === 0, bad.edited.slice(0, 4).join(' ; ')))
    out.push(h.check('isolation never paints another step', bad.mixed.length === 0, bad.mixed.slice(0, 4).join(' ; ')))
    out.push(h.check('the lit chip always agrees with the state', bad.chip.length === 0, bad.chip.slice(0, 4).join(' ; ')))
    out.push(h.check('the clock parks at the isolated step opening', bad.clock.length === 0, bad.clock.slice(0, 4).join(' ; ')))
    out.push(h.check('no painted path is missing from the document', bad.orphan.length === 0, bad.orphan.slice(0, 4).join(' ; ')))
    out.push(h.check('isolation never paints another step as a ghost', bad.ghost.length === 0, bad.ghost.slice(0, 4).join(' ; ')))
    out.push(
      h.check(
        'every token stands where the clock says',
        bad.drift.length === 0,
        'worst ' + maxDrift.toFixed(2) + 'm · ' + bad.drift.slice(0, 4).join(' ; '),
      ),
    )
    // ---- a gallery to LOOK at (ST_PROBE_SHOTS=1) -------------------------
    if (SHOTS) {
    const board = h.pitch(page)
    await page.keyboard.press('Escape')
    await viewBtn('iso').click()
    for (let n = 1; n <= 6; n++) {
      await chip(page, n).click()
      await page.waitForTimeout(420)
      await board.screenshot({ path: path.join(OUT, 'iso-step-' + n + '.png') })
    }
    await viewBtn('all').click()
    await page.waitForTimeout(400)
    await board.screenshot({ path: path.join(OUT, 'view-all.png') })
    await viewBtn('iso').click()
    await chip(page, 3).click()
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: /현재 단계만/ }).click()
    for (let k = 0; k < 40; k++) {
      if (!(await page.evaluate(() => window.__stClock().playing))) break
      await page.waitForTimeout(200)
    }
    await page.waitForTimeout(400)
    await board.screenshot({ path: path.join(OUT, 'held-after-scope-step3.png') })
    await page.keyboard.press('2')
    await page.waitForTimeout(450)
    await board.screenshot({ path: path.join(OUT, 'after-held-press-2.png') })

    // the whole play, watched from step 2's chip: where does the board leave you?
    await chip(page, 2).click()
    await page.waitForTimeout(300)
    await page.keyboard.press(' ')
    await page.waitForTimeout(900)
    await board.screenshot({ path: path.join(OUT, 'mid-play.png') })
    for (let k = 0; k < 40; k++) {
      if (!(await page.evaluate(() => window.__stClock().playing))) break
      await page.waitForTimeout(200)
    }
    await page.waitForTimeout(500)
    await board.screenshot({ path: path.join(OUT, 'held-after-full-play-chip2.png') })
    }

    /*
     * PAUSE HOLDS THE FRAME (A-02). The step pin used to re-park the clock on every render, so
     * stopping mid-play threw the board back to the step's opening — the frame you pressed Space
     * to look at was gone before you saw it.
     */
    await chip(page, 2).click()
    await page.waitForTimeout(300)
    const parked = await page.evaluate(() => window.__stClock().t)
    await page.keyboard.press(' ')
    await page.waitForTimeout(1400)
    const mid = await page.evaluate(() => window.__stClock().t)
    await page.keyboard.press(' ')
    await page.waitForTimeout(500)
    const held = await page.evaluate(() => window.__stClock().t)
    out.push(
      h.check(
        'pausing mid-play holds the frame instead of snapping back to the step',
        // the frame it stopped on is neither the step's opening nor kickoff, and it stays put
        mid > 0.3 && Math.abs(mid - parked) > 0.2 && Math.abs(held - mid) < 0.4,
        'step opens at ' + parked.toFixed(2) + ' → stopped at ' + mid.toFixed(2) + ' → held ' + held.toFixed(2),
      ),
    )

    /*
     * A NUMBER KEY SHOWS THAT STEP, whatever view you were in (ADR-0009 v28). Under 전체 보기 the
     * press used to move the chip and change nothing on screen.
     */
    await viewBtn('all').click()
    await page.waitForTimeout(300)
    const wasAll = await page.evaluate(() => window.__stFlags().stepIsolate)
    await page.keyboard.press('3')
    await page.waitForTimeout(400)
    const afterKey = await snapshot(page)
    const onlyThree = afterKey.painted.every(
      (id) => afterKey.steps[id] && afterKey.steps[id].step === 3,
    )
    out.push(
      h.check(
        'a number key switches to that step even from ‘전체’',
        wasAll === false && afterKey.stepIsolate === true && afterKey.currentStep === 3 && onlyThree,
        'was all=' + wasAll + ' → isolate=' + afterKey.stepIsolate + ' chip=' + afterKey.currentStep +
          ' painted=' + afterKey.painted.length,
      ),
    )

    /*
     * SPACE PLAYS THE PLAY, from the start. It used to resume from wherever the clock stood, and
     * under isolation that is the current step's opening — so Space quietly meant "현재 단계부터",
     * which is a button's job. A pause still RESUMES: that is what the anchor tells them apart.
     */
    await chip(page, 4).click()
    await page.waitForTimeout(320)
    const anchor4 = await page.evaluate(() => window.__stClock().t)
    await page.keyboard.press(' ')
    await page.waitForTimeout(220)
    const justStarted = await page.evaluate(() => window.__stClock().t)
    out.push(
      h.check(
        'Space plays from the START, not from the step you are standing in',
        anchor4 > 0.5 && justStarted < anchor4 - 0.3,
        'step 4 opens at ' + anchor4.toFixed(2) + ' · Space started at ' + justStarted.toFixed(2),
      ),
    )
    await page.waitForTimeout(700)
    const beforePause = await page.evaluate(() => window.__stClock().t)
    await page.keyboard.press(' ')
    await page.waitForTimeout(350)
    await page.keyboard.press(' ')
    await page.waitForTimeout(300)
    const resumed = await page.evaluate(() => window.__stClock())
    out.push(
      h.check(
        'but Space after a pause RESUMES instead of restarting',
        resumed.playing && resumed.t >= beforePause - 0.05,
        'paused at ' + beforePause.toFixed(2) + ' → resumed at ' + resumed.t.toFixed(2),
      ),
    )
    await page.keyboard.press(' ')
    await page.waitForTimeout(200)

    /*
     * The retarget did not disappear — it moved to Shift. This is the LAST thing the probe does,
     * because unlike everything above it is meant to change the document.
     */
    await viewBtn('all').click()
    await page.waitForTimeout(250)
    const before = h.authoredSegments(await h.doc(page)).map((x) => ({ id: x.id, step: x.step }))
    await page.locator('g[data-segment] path').first().click({ force: true })
    await page.waitForTimeout(250)
    const picked = await page.evaluate(() => window.__stFlags().selectedSegmentId)
    await page.keyboard.press('Shift+Digit3')
    await page.waitForTimeout(350)
    const moved = h.authoredSegments(await h.doc(page)).find((x) => x.id === picked)
    const was = before.find((x) => x.id === picked)
    out.push(
      h.check(
        'Shift+number files the selected movement onto that step',
        !!picked && !!moved && moved.step === 3 && was && was.step !== 3,
        'seg ' + (was ? was.step : '?') + ' → ' + (moved ? moved.step : 'gone'),
      ),
    )

    out.push(h.check('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | ')))
    out.push(h.check('(note) presses that found no control', true, missed.length + ' of ' + plan.length + ': ' + [...new Set(missed)].join(',')))
    return out
  },
}
