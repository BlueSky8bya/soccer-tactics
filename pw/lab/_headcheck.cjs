/* Do ball paths get an arrowhead, and does any authored path come out degenerate? */
const path = require('node:path')
const H = require(path.join(__dirname, '..', 'lib', 'harness.cjs'))
const { chromium } = require('playwright')
const BASE = process.env.ST_PROBE_URL || 'http://localhost:5177/'

;(async () => {
  const browser = await chromium.launch({ headless: true })
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

  const d = await H.doc(page)
  const holder = d.players.find((p) => p.id === d.ball.initialHolderId)
  const mates = d.players.filter((p) => p.teamId === holder.teamId && p.id !== holder.id)
  const live = () => page.evaluate(() => window.__stStateAt(window.__stClock().t).ball.pos)
  const chip = (n) => page.locator('[class*=stepBar] button[aria-pressed]').nth(n - 1)

  // one run, then a chain of three passes on their own steps
  await H.drawFrom(page, holder.home, { x: holder.home.x + 12, y: holder.home.y - 4 })
  await page.waitForTimeout(300)
  for (let i = 0; i < 3; i++) {
    const from = await live()
    await H.drawFrom(page, from, mates[i * 3].home, { steps: 8 })
    await page.waitForTimeout(320)
    const dd = await H.doc(page)
    const chipN = await page.evaluate(() => [...document.querySelectorAll('[class*=stepBar] button[aria-pressed]')].findIndex((b) => b.getAttribute('aria-pressed') === 'true') + 1)
    const t = await page.evaluate(() => Math.round(window.__stClock().t * 100) / 100)
    const toast = await page.locator('[class*=toast]').first().innerText().catch(() => '')
    console.log('pass ' + (i + 1) + ' -> #' + mates[i * 3].number +
      ' from ' + JSON.stringify({ x: +from.x.toFixed(1), y: +from.y.toFixed(1) }) +
      ' | authored=' + H.authoredSegments(dd).map((x) => x.kind + '@' + x.step).join(',') +
      ' chip=' + chipN + ' t=' + t + ' toast=' + JSON.stringify(toast))
  }

  // look at the all-steps view so every path is in the tree
  await page.getByRole('button', { name: /보기: 이 단계/ }).click()
  await page.waitForTimeout(300)

  const r = await page.evaluate(() => {
    const out = []
    for (const g of document.querySelectorAll('g[data-segment]')) {
      const stroke = g.querySelector('[class*=path_]')
      const cls = stroke ? stroke.getAttribute('class') : ''
      const marker = stroke ? stroke.getAttribute('marker-end') : null
      let len = 0
      try {
        len = Math.round(g.querySelector('[class*=pathHit]').getTotalLength() * 10) / 10
      } catch (e) {}
      out.push({
        id: g.getAttribute('data-segment'),
        pass: /pathPass|pathLofted|pathShot|pathLoose/.test(cls || ''),
        marker: marker || 'NONE',
        len,
      })
    }
    return out
  })
  console.log('paths in the tree:')
  for (const x of r) console.log('  ' + (x.pass ? 'ball' : 'run ') + '  len=' + x.len + 'm  head=' + x.marker)
  const headless = r.filter((x) => x.marker === 'NONE')
  const degenerate = r.filter((x) => x.len > 0 && x.len < 1)
  console.log('paths with NO arrowhead:', headless.length)
  console.log('degenerate paths (<1m):', degenerate.length)
  await browser.close()
})().catch((e) => {
  console.error(e)
  process.exit(2)
})
