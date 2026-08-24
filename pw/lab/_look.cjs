/** Screenshot sweep for the redesign: both themes, a built tactic, the surfaces that matter. */
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const OUT = path.join(__dirname, process.env.LOOK_OUT || 'out-look')

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const b = await chromium.launch()
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await page.addInitScript(() => {
    try {
      localStorage.setItem('st:tour:seen:v1', '1')
    } catch {}
  })
  await page.goto(process.env.ST_PROBE_URL || 'http://localhost:5178/')
  await page.waitForTimeout(1300)
  await page
    .getByRole('button', { name: /양 팀 채우기/ })
    .click()
    .catch(() => {})
  await page.waitForTimeout(700)

  const toClient = async (p) =>
    page.evaluate(
      ([x, y]) => {
        const svg = document.querySelector('svg[role="application"]')
        const m = svg.getScreenCTM()
        return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f }
      },
      [p.x, p.y],
    )
  const draw = async (from, to) => {
    const a = await toClient(from)
    const z = await toClient(to)
    await page.mouse.move(a.x, a.y)
    await page.keyboard.down('Alt')
    await page.mouse.down()
    for (let i = 1; i <= 8; i++)
      await page.mouse.move(a.x + ((z.x - a.x) * i) / 8, a.y + ((z.y - a.y) * i) / 8)
    await page.mouse.up()
    await page.keyboard.up('Alt')
    await page.waitForTimeout(320)
  }
  const chip = (n) => page.locator('[class*=stepChip]').nth(n - 1)
  const d = await page.evaluate(() => window.__stDoc)
  const mine = d.players.filter((p) => p.teamId === 'team-a').sort((a, b) => a.home.x - b.home.x)
  for (let i = 0; i < 3; i++) {
    await chip(i + 1).click()
    await page.waitForTimeout(160)
    const p = mine[i + 2]
    await draw(p.home, { x: p.home.x + 12, y: p.home.y + (i % 2 ? -7 : 7) })
  }
  await page.keyboard.press('Escape')
  await chip(2).click()
  await page.waitForTimeout(400)

  const themeBtn = page.locator('button[data-theme-pref]')
  for (const want of ['light', 'dark']) {
    for (let i = 0; i < 3; i++) {
      const now = await page.evaluate(() => document.documentElement.dataset.theme)
      if (now === want) break
      await themeBtn.click()
      await page.waitForTimeout(120)
    }
    await page.waitForTimeout(350)
    await page.screenshot({ path: path.join(OUT, `full-${want}.png`) })
    await page.locator('aside').first().screenshot({ path: path.join(OUT, `left-${want}.png`) })
    await page.locator('[class*=simpleBar]').screenshot({ path: path.join(OUT, `bar-${want}.png`) })
    await page.locator('header').screenshot({ path: path.join(OUT, `head-${want}.png`) })
  }
  await b.close()
})()
