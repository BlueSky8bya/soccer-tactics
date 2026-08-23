/**
 * TACTIC LAB — hundreds of authored tactics, driven by real pointer gestures.
 *
 * The probes in `pw/` each pin one contract. This is the other half: play the app the way a coach
 * would, many times over, from a seeded random script, and ask after every session whether the
 * board still tells the truth. Its findings are LEADS, not gates — anything it catches earns its
 * own probe once it is understood.
 *
 * Usage:
 *   node pw/lab/tactic-lab.cjs --sessions 120 [--shots 24] [--seed 1] [--headed]
 * Requires the dev server (ST_PROBE_URL, default http://localhost:5177/): the QA hooks are DEV-only.
 */
const fs = require('node:fs')
const path = require('node:path')
const H = require(path.join(__dirname, '..', 'lib', 'harness.cjs'))
const { chromium } = require('playwright')

const BASE = process.env.ST_PROBE_URL || 'http://localhost:5177/'
const OUT = process.env.LAB_OUT || path.join(__dirname, 'out')

const args = process.argv.slice(2)
const flag = (name, def) => {
  const i = args.indexOf('--' + name)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? Number(args[i + 1]) : def
}
const SESSIONS = flag('sessions', 40)
const SHOTS = flag('shots', 12)
const SEED0 = flag('seed', 1)
const HEADED = args.includes('--headed')

/** Mulberry32 — same seed, same tactic, so any finding replays exactly. */
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

async function openLab(browser, opts) {
  const dark = !!(opts && opts.dark)
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    reducedMotion: (opts && opts.reducedMotion) || 'no-preference',
  })
  const page = await context.newPage()
  const consoleErrors = []
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(String(e)))
  await page.addInitScript((theme) => {
    try {
      localStorage.setItem('st:tour:seen:v1', '1')
      localStorage.setItem('st.theme', theme)
      for (const k of Object.keys(localStorage))
        if (k.startsWith('st:autosave')) localStorage.removeItem(k)
    } catch (e) {
      /* private mode */
    }
  }, dark ? 'dark' : 'light')
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => !!window.__stDoc, null, { timeout: 20000 })
  return { context, page, consoleErrors }
}

const live = (page) => page.evaluate(() => window.__stStateAt(window.__stClock().t).ball.pos)
const chip = (page, n) => page.locator('[class*=stepBar] button[aria-pressed]').nth(n - 1)
const settle = (page, ms) => page.waitForTimeout(ms || 220)

/** Author one tactic. Returns a log of what the hand did, so a finding can be read back. */
async function authorTactic(page, rand, log) {
  const pick = (arr) => arr[Math.floor(rand() * arr.length)]
  await page.getByRole('button', { name: /양 팀 채우기/ }).click()
  await page.waitForFunction(() => (window.__stDoc && window.__stDoc.players.length) >= 22, null, {
    timeout: 15000,
  })
  log.push('fill teams')

  const d0 = await H.doc(page)
  const holder = d0.players.find((p) => p.id === d0.ball.initialHolderId)
  const mates = d0.players.filter((p) => p.teamId === holder.teamId && p.id !== holder.id)
  const foes = d0.players.filter((p) => p.teamId !== holder.teamId)
  const steps = 2 + Math.floor(rand() * 4)

  for (let step = 1; step <= steps; step++) {
    if (step > 1) {
      await chip(page, step).click()
      await settle(page)
      log.push('chip ' + step)
    }
    const runs = Math.floor(rand() * 3)
    for (let i = 0; i < runs; i++) {
      const d = await H.doc(page)
      const who = pick(rand() < 0.75 ? mates : foes)
      const from = d.players.find((p) => p.id === who.id)
      const to = {
        x: Math.max(2, Math.min(103, from.home.x + (rand() - 0.35) * 26)),
        y: Math.max(2, Math.min(66, from.home.y + (rand() - 0.5) * 22)),
      }
      if (Math.hypot(to.x - from.home.x, to.y - from.home.y) < 4) continue
      await H.drawFrom(page, from.home, to, { steps: 6 + Math.floor(rand() * 8) })
      await settle(page)
      log.push('run #' + from.number)
    }
    if (rand() < 0.7) {
      const d = await H.doc(page)
      const target = pick(mates)
      const t = d.players.find((p) => p.id === target.id)
      await H.drawFrom(page, await live(page), t.home, { steps: 8 })
      await settle(page, 280)
      log.push('pass -> #' + t.number)
    }
    if (rand() < 0.2) {
      const d = await H.doc(page)
      const who = d.players[Math.floor(rand() * d.players.length)]
      await H.dragPitch(page, who.home, { x: who.home.x + 4, y: who.home.y + 3 }, { steps: 5 })
      await settle(page)
      log.push('move #' + who.number)
    }
  }
  return { steps }
}

/** Ask the board whether it is still telling the truth. */
async function inspect(page) {
  return page.evaluate(() => {
    const doc = window.__stDoc
    const compiled = window.__stCompiled
    const authored = doc.scenes[0].timeline.tracks.flatMap((t) =>
      t.segments
        .filter((s) => s.path && !s.id.startsWith('gen-'))
        .map((s) => ({ id: s.id, step: s.step || 1 })),
    )
    const drawn = new Set(
      [...document.querySelectorAll('g[data-segment]')].map((g) => g.getAttribute('data-segment')),
    )
    const links = document.querySelectorAll('[class*=passLink]').length
    const drawnPasses = [...document.querySelectorAll('g[data-segment]')].filter((g) =>
      /pathPass|pathLofted|pathShot|pathLoose/.test(g.innerHTML),
    ).length

    let end = 0
    for (const k of Object.keys(compiled.segmentTimes))
      end = Math.max(end, compiled.segmentTimes[k].end)
    let maxJump = 0
    let prev = null
    for (let t = 0; t <= end + 0.001; t += 0.04) {
      const p = window.__stStateAt(t).ball.pos
      if (prev) maxJump = Math.max(maxJump, Math.hypot(p.x - prev.x, p.y - prev.y) / 0.04)
      prev = p
    }

    const badges = []
    for (const g of document.querySelectorAll('g[class*=stepBadge]')) {
      const m = /translate\(([-\d.]+),\s*([-\d.]+)\)/.exec(g.getAttribute('transform') || '')
      if (m) badges.push({ x: Number(m[1]), y: Number(m[2]) })
    }
    let badgeClashes = 0
    for (let i = 0; i < badges.length; i++)
      for (let j = i + 1; j < badges.length; j++)
        if (Math.hypot(badges[i].x - badges[j].x, badges[i].y - badges[j].y) < 1.6) badgeClashes++

    const t = window.__stClock().t
    const rs = window.__stStateAt(t)
    let worstDrift = 0
    for (const el of document.querySelectorAll('g[data-kind="player"]')) {
      const id = el.getAttribute('data-entity')
      const m = /translate\(([-\d.]+)\s+([-\d.]+)\)/.exec(el.getAttribute('transform') || '')
      const p = rs.players[id]
      if (!m || !p) continue
      worstDrift = Math.max(worstDrift, Math.hypot(Number(m[1]) - p.pos.x, Number(m[2]) - p.pos.y))
    }

    return {
      problems: window.__stValidate ? window.__stValidate() : ['no hook'],
      authored: authored.length,
      steps: [...new Set(authored.map((a) => a.step))].sort((a, b) => a - b),
      notDrawn: authored.filter((a) => !drawn.has(a.id)).length,
      orphanLinks: Math.max(0, links - drawnPasses),
      maxBallSpeed: Math.round(maxJump * 10) / 10,
      badgeClashes,
      worstTokenDrift: Math.round(worstDrift * 1000) / 1000,
      playEnd: Math.round(end * 100) / 100,
    }
  })
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({ headless: !HEADED })
  const findings = []
  const rows = []
  for (let i = 0; i < SESSIONS; i++) {
    const seed = SEED0 + i
    const rand = rng(seed)
    const dark = rand() < 0.3
    const wantShots = i < SHOTS
    const opened = await openLab(browser, { dark })
    const { context, page, consoleErrors } = opened
    const log = []
    let row = { seed, dark, ok: true }
    try {
      await authorTactic(page, rand, log)
      const info = await inspect(page)
      row = Object.assign(row, info, { consoleErrors: consoleErrors.length })
      const bad = []
      if (info.problems.length) bad.push('invalid document: ' + info.problems[0])
      if (consoleErrors.length) bad.push('console: ' + consoleErrors[0])
      if (info.orphanLinks > 0) bad.push(info.orphanLinks + ' relay arc(s) with no pass drawn')
      if (info.maxBallSpeed > 60) bad.push('ball reached ' + info.maxBallSpeed + ' m/s (teleport?)')
      if (info.worstTokenDrift > 0.05)
        bad.push('token drawn ' + info.worstTokenDrift + 'm from the clock')
      // Only a finding if the hand actually TRIED: the dice can legitimately roll a session with
      // no runs and no pass, and flagging that is the lab reporting on itself.
      if (info.authored === 0 && log.some((l) => l.startsWith('run') || l.startsWith('pass')))
        bad.push('gestures were made but nothing was authored')
      if (bad.length) {
        row.ok = false
        findings.push({ seed, dark, bad, log })
      }

      if (wantShots) {
        const stepsUsed = info.steps.length ? info.steps : [1]
        for (const s of stepsUsed.slice(0, 3)) {
          await chip(page, s).click()
          await settle(page, 320)
          await page
            .waitForFunction(() => !document.querySelector('[class*=toast]'), null, {
              timeout: 3000,
            })
            .catch(() => {})
          await page.screenshot({ path: path.join(OUT, 's' + seed + '-step' + s + '.png') })
        }
        /*
         * Catch the play MID-flight. The first version waited `playEnd * 400`ms, which for most
         * tactics overshot the end — so 30 of 40 "-playing" frames were actually the held result,
         * with all the authoring decoration back on screen. Aim at a third of the way in, and say
         * so in the filename when the clock proves we missed.
         */
        await page.getByRole('button', { name: '재생', exact: true }).click()
        await page.waitForTimeout(Math.max(180, Math.min(900, info.playEnd * 330)))
        const running = await page.evaluate(() => window.__stClock().playing)
        await page.screenshot({
          path: path.join(OUT, 's' + seed + (running ? '-playing.png' : '-result.png')),
        })
        await page.keyboard.press('Space')
        await settle(page, 200)
      }
    } catch (e) {
      row.ok = false
      findings.push({ seed, dark, bad: ['threw: ' + String(e).slice(0, 160)], log })
    } finally {
      rows.push(row)
      await context.close()
    }
    if ((i + 1) % 10 === 0) console.log('  ... ' + (i + 1) + '/' + SESSIONS + ' sessions')
  }
  await browser.close()
  fs.writeFileSync(path.join(OUT, 'sessions.json'), JSON.stringify({ rows, findings }, null, 1))
  const failed = rows.filter((r) => !r.ok).length
  console.log('\nTACTIC LAB — ' + rows.length + ' tactics, ' + failed + ' with findings')
  for (const f of findings.slice(0, 40))
    console.log('  seed ' + f.seed + (f.dark ? ' (dark)' : '') + ': ' + f.bad.join(' | '))
  const stat = (k) => {
    const v = rows.map((r) => r[k]).filter((x) => typeof x === 'number')
    return v.length ? Math.min.apply(null, v) + '..' + Math.max.apply(null, v) : 'n/a'
  }
  console.log(
    '  authored ' +
      stat('authored') +
      ' | play ' +
      stat('playEnd') +
      's | badge clashes ' +
      stat('badgeClashes') +
      ' | max ball speed ' +
      stat('maxBallSpeed') +
      ' m/s',
  )
  console.log('  screenshots in ' + OUT)
}

main().catch((e) => {
  console.error(e)
  process.exit(2)
})
