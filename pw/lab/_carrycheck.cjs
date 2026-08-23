/* Does a carried ball ever sit ON its holder's disc, hiding the number? */
const path = require('node:path')
const H = require(path.join(__dirname, '..', 'lib', 'harness.cjs'))
const { chromium } = require('playwright')
const BASE = process.env.ST_PROBE_URL || 'http://localhost:5177/'

function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

;(async () => {
  const browser = await chromium.launch({ headless: true })
  let worst = { d: 99, seed: null, t: null }
  const hits = []
  for (let seed = 1; seed <= 14; seed++) {
    const rand = rng(seed)
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await ctx.newPage()
    await page.addInitScript(() => {
      try {
        localStorage.setItem('st:tour:seen:v1', '1')
      } catch (e) {}
    })
    await page.goto(BASE, { waitUntil: 'networkidle' })
    await page.waitForFunction(() => !!window.__stDoc, null, { timeout: 20000 })
    await page.getByRole('button', { name: /양 팀 채우기/ }).click()
    await page.waitForFunction(() => (window.__stDoc && window.__stDoc.players.length) >= 22)
    const d0 = await H.doc(page)
    const holder = d0.players.find((p) => p.id === d0.ball.initialHolderId)
    const mates = d0.players.filter((p) => p.teamId === holder.teamId && p.id !== holder.id)
    // a carry then a pass then a carry — the shapes where the offset is recomputed
    await H.drawFrom(page, holder.home, { x: holder.home.x + 12, y: holder.home.y - 4 })
    await page.waitForTimeout(250)
    const live = await page.evaluate(() => window.__stStateAt(window.__stClock().t).ball.pos)
    const target = mates[Math.floor(rand() * mates.length)]
    await H.drawFrom(page, live, target.home, { steps: 8 })
    await page.waitForTimeout(300)
    const r = await page.evaluate(() => {
      const compiled = window.__stCompiled
      let end = 0
      for (const k of Object.keys(compiled.segmentTimes))
        end = Math.max(end, compiled.segmentTimes[k].end)
      let min = 99
      let at = null
      for (let t = 0; t <= end + 0.001; t += 0.02) {
        const s = window.__stStateAt(t)
        if (!s.ball.holderId) continue
        const p = s.players[s.ball.holderId]
        if (!p) continue
        const d = Math.hypot(s.ball.pos.x - p.pos.x, s.ball.pos.y - p.pos.y)
        if (d < min) {
          min = d
          at = Math.round(t * 100) / 100
        }
      }
      return { min: Math.round(min * 1000) / 1000, at, end: Math.round(end * 100) / 100 }
    })
    if (r.min < worst.d) worst = { d: r.min, seed, t: r.at }
    // TOKEN_R is 1.35 m and BALL_R 0.68 — inside 1.35 the ball starts covering the number
    if (r.min < 1.35) hits.push({ seed, min: r.min, at: r.at })
    await ctx.close()
  }
  await browser.close()
  console.log('worst carried-ball distance from its holder:', worst)
  console.log('sessions where the ball entered the disc (<1.35m):', hits.length, JSON.stringify(hits))
})().catch((e) => {
  console.error(e)
  process.exit(2)
})
