/**
 * Browser probe harness — PLAN-014 D-browser.
 *
 * Every probe runs against the DEV server: the QA hooks (`__stDoc`, `__stCompiled`, `__stStateAt`,
 * `__stFlags`, `__stValidate`, `__stIntentLog`) are `import.meta.env.DEV`-gated, so a production
 * build cannot be inspected. The probes drive REAL pointer events through Playwright's mouse API,
 * never synthetic dispatch, so what they exercise is the same path a user's hand takes.
 *
 * A probe exports `{ id, describe, viewports?, run }` and returns an array of checks:
 *   { name, pass, detail }
 * The runner prints one line per check and exits non-zero if any failed.
 */
const { chromium } = require('playwright')

const BASE = process.env.ST_PROBE_URL || 'http://localhost:5173/'
const DEFAULT_VIEWPORT = { width: 1440, height: 900, dpr: 1 }

/** Open a page with the app ready and the tour suppressed. */
async function openBoard(browser, viewport = DEFAULT_VIEWPORT) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.dpr ?? 1,
    reducedMotion: viewport.reducedMotion ?? 'no-preference',
  })
  const page = await context.newPage()
  const consoleErrors = []
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(String(e)))
  // suppress the first-visit tour and any restored autosave: a probe starts from a known board
  await page.addInitScript(() => {
    try {
      localStorage.setItem('st:tour:seen:v1', '1')
      localStorage.removeItem('st:autosave:v1')
      for (const k of Object.keys(localStorage)) if (k.startsWith('st:autosave')) localStorage.removeItem(k)
    } catch {
      /* private mode */
    }
  })
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => !!window.__stDoc, null, { timeout: 15000 })
  page.__consoleErrors = consoleErrors
  return { context, page, consoleErrors }
}

/** Fill both teams so the board has 22 players and a holder. */
async function fillTeams(page) {
  // The team setup is a toolbar menu since ADR-0009 v31 — open it, then press the button.
  await page.getByRole('button', { name: '팀 구성' }).click()
  await page.getByRole('button', { name: /양 팀 채우기/ }).click()
  await page.waitForFunction(() => (window.__stDoc?.players?.length ?? 0) >= 22, null, {
    timeout: 10000,
  })
}

/**
 * Open the toolbar's 팀 구성 menu and leave it open. A menu closes on any pointer-down outside it,
 * so a probe that then touches the board is automatically back to a bare toolbar.
 */
async function openMenu(page, name) {
  const trigger = page.getByRole('button', { name, exact: true })
  if ((await trigger.getAttribute('aria-expanded')) !== 'true') await trigger.click()
  return trigger
}

/** The board's own commands live in the side column since v35 — no menu to open. */
async function boardMenuClick(page, itemName) {
  await page.getByRole('button', { name: itemName }).click()
}

/** The pitch <svg> element handle. */
function pitch(page) {
  return page.getByRole('application', { name: /pitch/i })
}

/** Pitch metres → client pixels, via the page's own CTM (the one the app picks with). */
async function toClient(page, p) {
  return page.evaluate(([x, y]) => {
    const svg = document.querySelector('svg[role="application"]') || document.querySelector('svg')
    const ctm = svg.getScreenCTM()
    return { x: ctm.a * x + ctm.c * y + ctm.e, y: ctm.b * x + ctm.d * y + ctm.f }
  }, [p.x, p.y])
}

/** Client pixels → pitch metres. */
async function toPitch(page, c) {
  return page.evaluate(([x, y]) => {
    const svg = document.querySelector('svg[role="application"]') || document.querySelector('svg')
    const inv = svg.getScreenCTM().inverse()
    return { x: inv.a * x + inv.c * y + inv.e, y: inv.b * x + inv.d * y + inv.f }
  }, [c.x, c.y])
}

/** The live document (structured-cloned out of the page). */
const doc = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__stDoc)))
/** A stable identity for "did the document change at all". */
const docBytes = (page) => page.evaluate(() => JSON.stringify(window.__stDoc))
const flags = (page) => page.evaluate(() => window.__stFlags?.() ?? null)
const validate = (page) => page.evaluate(() => window.__stValidate?.() ?? ['no hook'])
const intentLog = (page) => page.evaluate(() => (window.__stIntentLog ?? []).slice())
const clearIntentLog = (page) => page.evaluate(() => { window.__stIntentLog = [] })

/** Undo depth proxy: the app exposes no counter, so count how many undos change the document. */
async function undoDepthProbe(page, max = 6) {
  return page.evaluate((limit) => limit, max) // placeholder — probes assert via explicit undo clicks
}

/** A real press-drag-release in pitch coordinates. */
async function dragPitch(page, from, to, opts = {}) {
  const a = await toClient(page, from)
  const b = await toClient(page, to)
  await page.mouse.move(a.x, a.y)
  if (opts.modifiers) for (const m of opts.modifiers) await page.keyboard.down(m)
  await page.mouse.down()
  const steps = opts.steps ?? 8
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(a.x + ((b.x - a.x) * i) / steps, a.y + ((b.y - a.y) * i) / steps)
    if (opts.stepDelayMs) await page.waitForTimeout(opts.stepDelayMs)
  }
  if (!opts.hold) await page.mouse.up()
  if (opts.modifiers) for (const m of opts.modifiers) await page.keyboard.up(m)
  await page.waitForTimeout(opts.settleMs ?? 120)
}

/**
 * Author a movement the way the app actually asks for one: Alt+drag from the token
 * (`draw-from-token`). A PLAIN drag on a token is `press-token` — it MOVES the player and
 * authors nothing, which is how an earlier version of these probes silently compared two empty
 * boards.
 */
async function drawFrom(page, from, to, opts = {}) {
  return dragPitch(page, from, to, { ...opts, modifiers: ['Alt'] })
}

/** Authored (non-generated) path segments in the live document. */
function authoredSegments(d) {
  return d.scenes[0].timeline.tracks
    .flatMap((t) => t.segments.map((s) => ({ ...s, entityKind: t.entityKind, entityId: t.entityId })))
    .filter((s) => s.path && !s.id.startsWith('gen-'))
}

function check(name, pass, detail) {
  return { name, pass: !!pass, detail: detail === undefined ? '' : String(detail) }
}

/** Run one probe module and print its results. */
async function runProbe(probe, { headed = false } = {}) {
  const browser = await chromium.launch({ headless: !headed })
  const results = []
  try {
    const out = await probe.run({
      browser,
      openBoard: (vp) => openBoard(browser, vp),
      fillTeams,
      openMenu,
      boardMenuClick,
      pitch,
      toClient,
      toPitch,
      doc,
      docBytes,
      flags,
      validate,
      intentLog,
      clearIntentLog,
      dragPitch,
      drawFrom,
      authoredSegments,
      check,
    })
    results.push(...out)
  } catch (e) {
    results.push(check(`${probe.id} threw`, false, e && e.stack ? e.stack.split('\n')[0] : e))
  } finally {
    await browser.close()
  }
  return results
}

module.exports = {
  BASE,
  DEFAULT_VIEWPORT,
  openBoard,
  fillTeams,
  openMenu,
  boardMenuClick,
  pitch,
  toClient,
  toPitch,
  doc,
  docBytes,
  flags,
  validate,
  intentLog,
  clearIntentLog,
  dragPitch,
  drawFrom,
  authoredSegments,
  undoDepthProbe,
  check,
  runProbe,
}
