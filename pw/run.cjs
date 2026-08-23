#!/usr/bin/env node
/**
 * Probe runner — PLAN-014 D-browser.
 *
 * Usage:
 *   node pw/run.cjs                 # every probe in the manifest
 *   node pw/run.cjs hit-scale       # one probe by id
 *   node pw/run.cjs --headed        # watch it happen
 *
 * Requires the dev server (`npm run dev`) on ST_PROBE_URL (default http://localhost:5173/):
 * the QA hooks the probes read are DEV-only by design.
 */
const fs = require('node:fs')
const path = require('node:path')
const { runProbe, BASE } = require('./lib/harness.cjs')

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'audit-manifest.json'), 'utf8'))
const args = process.argv.slice(2)
const headed = args.includes('--headed')
const wanted = args.filter((a) => !a.startsWith('--'))

async function main() {
  const entries = manifest.probes.filter(
    (p) => p.status === 'present' && (wanted.length === 0 || wanted.includes(p.id)),
  )
  if (entries.length === 0) {
    console.error(`no probes matched ${JSON.stringify(wanted)}`)
    process.exit(2)
  }
  console.log(`probe target: ${BASE}`)
  let failed = 0
  let total = 0
  const started = Date.now()
  for (const entry of entries) {
    const probe = require(path.join(__dirname, entry.file))
    process.stdout.write(`\n▸ ${probe.id} — ${probe.describe}\n`)
    const results = await runProbe(probe, { headed })
    for (const r of results) {
      total++
      if (!r.pass) failed++
      console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? ` — ${r.detail}` : ''}`)
    }
  }
  const secs = ((Date.now() - started) / 1000).toFixed(1)
  console.log(`\n${failed === 0 ? 'ALL PASS' : `${failed} FAILED`} — ${total} checks in ${secs}s`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
