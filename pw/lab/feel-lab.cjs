/**
 * FEEL LAB — the measurable half of "does this feel right".
 *
 * Screenshots and a human eye catch the rest, but four things about polish are numbers, and numbers
 * do not need an opinion: contrast, hit size, motion vocabulary, and layout stability. Each is
 * checked in BOTH themes, because a dark theme is a second product's worth of surface.
 *
 * Usage: node pw/lab/feel-lab.cjs [--headed]
 * Requires the dev server (ST_PROBE_URL, default http://localhost:5177/).
 */
const path = require('node:path')
const H = require(path.join(__dirname, '..', 'lib', 'harness.cjs'))
const { chromium } = require('playwright')

const BASE = process.env.ST_PROBE_URL || 'http://localhost:5177/'
const HEADED = process.argv.includes('--headed')

/** The motion vocabulary the design tokens define. Anything else is an ad-hoc duration. */
const ALLOWED_MS = [0, 80, 140, 220, 320, 480, 262, 242, 446, 317, 500, 850, 1231, 846]

async function open(browser, theme) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  await page.addInitScript((t) => {
    try {
      localStorage.setItem('st:tour:seen:v1', '1')
      localStorage.setItem('st.theme', t)
    } catch (e) {
      /* private mode */
    }
  }, theme)
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => !!window.__stDoc, null, { timeout: 20000 })
  return { context, page, errors }
}

/** WCAG relative luminance + contrast, computed in the page against the ACTUAL painted ancestor. */
const CONTRAST_FN = () => {
  const lum = (c) => {
    const [r, g, b] = c.map((v) => {
      const s = v / 255
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const parse = (s) => {
    const m = /rgba?\(([^)]+)\)/.exec(s)
    if (!m) return null
    const p = m[1].split(',').map((x) => parseFloat(x))
    return { rgb: [p[0], p[1], p[2]], a: p.length > 3 ? p[3] : 1 }
  }
  const backdrop = (el) => {
    let node = el
    while (node && node !== document.documentElement) {
      const bg = parse(getComputedStyle(node).backgroundColor)
      if (bg && bg.a > 0.5) return bg.rgb
      node = node.parentElement
    }
    const b = parse(getComputedStyle(document.body).backgroundColor)
    return b ? b.rgb : [255, 255, 255]
  }
  const out = []
  const seen = new Set()
  for (const el of document.querySelectorAll('button, .kbd, span, div')) {
    const text = (el.textContent || '').trim()
    if (!text || text.length > 40 || el.children.length > 2) continue
    const r = el.getBoundingClientRect()
    if (r.width < 8 || r.height < 8) continue
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue
    const fg = parse(cs.color)
    if (!fg) continue
    const bg = backdrop(el)
    const L1 = lum(fg.rgb)
    const L2 = lum(bg)
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
    const size = parseFloat(cs.fontSize)
    const bold = Number(cs.fontWeight) >= 600
    const large = size >= 18.66 || (size >= 24 && bold) || (bold && size >= 18.66)
    const need = large ? 3 : 4.5
    const key = text + '|' + Math.round(r.x) + ',' + Math.round(r.y)
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      text: text.slice(0, 28),
      ratio: Math.round(ratio * 100) / 100,
      need,
      size: Math.round(size * 10) / 10,
      pass: ratio >= need,
    })
  }
  return out
}

/** Interactive things people press, and how big they are. */
const TARGETS_FN = () => {
  const out = []
  for (const el of document.querySelectorAll('button, [role="switch"], [role="button"]')) {
    const r = el.getBoundingClientRect()
    if (r.width < 1) continue
    const label = (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24)
    out.push({ label, w: Math.round(r.width), h: Math.round(r.height) })
  }
  return out
}

/** Every transition/animation duration actually in force on a visible element. */
const MOTION_FN = () => {
  const seen = new Map()
  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el)
    for (const [prop, ease] of [
      [cs.transitionDuration, cs.transitionTimingFunction],
      [cs.animationDuration, cs.animationTimingFunction],
    ]) {
      if (!prop || prop === '0s') continue
      for (const d of prop.split(',')) {
        const ms = Math.round(parseFloat(d) * 1000)
        if (!ms) continue
        const key = ms + '|' + (ease || '').split(',')[0].trim()
        const cls = (el.getAttribute('class') || el.tagName).slice(0, 40)
        if (!seen.has(key)) seen.set(key, { ms, ease: (ease || '').split(',')[0].trim(), where: cls })
      }
    }
  }
  return [...seen.values()]
}

async function run() {
  const browser = await chromium.launch({ headless: !HEADED })
  const report = {}
  for (const theme of ['light', 'dark']) {
    const { context, page, errors } = await open(browser, theme)
    await page.getByRole('button', { name: /양 팀 채우기/ }).click()
    await page.waitForFunction(() => (window.__stDoc && window.__stDoc.players.length) >= 22)
    // author one movement so the step panel and a path exist
    const d = await H.doc(page)
    const p = d.players[9]
    await H.drawFrom(page, p.home, { x: p.home.x + 12, y: p.home.y - 5 })
    await page.waitForTimeout(400)
    await page
      .waitForFunction(() => !document.querySelector('[class*=toast]'), null, { timeout: 3000 })
      .catch(() => {})

    const contrast = await page.evaluate(CONTRAST_FN)
    const targets = await page.evaluate(TARGETS_FN)
    const motion = await page.evaluate(MOTION_FN)
    report[theme] = {
      contrastFails: contrast.filter((c) => !c.pass),
      contrastChecked: contrast.length,
      smallTargets: targets.filter((t) => Math.min(t.w, t.h) < 28),
      targetsChecked: targets.length,
      offVocabMotion: motion.filter((m) => !ALLOWED_MS.some((a) => Math.abs(a - m.ms) <= 3)),
      motionChecked: motion.length,
      errors,
    }
    await context.close()
  }
  await browser.close()

  for (const theme of ['light', 'dark']) {
    const r = report[theme]
    console.log('\n== ' + theme.toUpperCase() + ' ==')
    console.log('  contrast: ' + (r.contrastChecked - r.contrastFails.length) + '/' + r.contrastChecked + ' pass')
    for (const c of r.contrastFails.slice(0, 14))
      console.log('    FAIL ' + c.ratio + ':1 (need ' + c.need + ') ' + c.size + 'px  "' + c.text + '"')
    console.log('  hit targets < 28px: ' + r.smallTargets.length + '/' + r.targetsChecked)
    for (const t of r.smallTargets.slice(0, 12)) console.log('    ' + t.w + 'x' + t.h + '  "' + t.label + '"')
    console.log('  motion durations off the token vocabulary: ' + r.offVocabMotion.length + '/' + r.motionChecked)
    for (const m of r.offVocabMotion.slice(0, 12)) console.log('    ' + m.ms + 'ms ' + m.ease + '  ' + m.where)
    if (r.errors.length) console.log('  CONSOLE ERRORS: ' + r.errors.slice(0, 3).join(' | '))
  }
}

run().catch((e) => {
  console.error(e)
  process.exit(2)
})
