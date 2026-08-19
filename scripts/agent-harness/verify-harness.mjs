#!/usr/bin/env node
/**
 * verify-harness.mjs — structural integrity of the WHITEHAVEN Agent Harness
 * and MACHINE enforcement of BR-ENGINE-001 (engine/domain purity).
 *
 * Exit 0 = PASS, 1 = FAIL. Prints findings. No external deps.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..')
const failures = []
const warnings = []
const notes = []

const rel = (p) => relative(ROOT, p).replaceAll('\\', '/')
const read = (p) => readFileSync(p, 'utf8')
const exists = (p) => existsSync(join(ROOT, p))

// ---------- 1. Required files ----------
const REQUIRED = [
  'AGENTS.md',
  'CLAUDE.md',
  'agent-harness.yaml',
  'docs/agent/CONSTITUTION.md',
  'docs/agent/CURRENT_STATE.md',
  'docs/agent/PROJECT_MAP.md',
  'docs/agent/RISK_PROFILE.md',
  'docs/agent/DEFINITION_OF_DONE.md',
  'docs/agent/CHANGELOG_AGENT.md',
  'docs/agent/decisions/DECISION_INDEX.md',
  'docs/agent/plans/ACTIVE_PLAN.md',
  'docs/product/PRODUCT_BRIEF.md',
]
for (const f of REQUIRED) if (!exists(f)) failures.push(`missing required file: ${f}`)
if (!exists('docs/agent/handoffs')) failures.push('missing directory: docs/agent/handoffs')

// ---------- 2. Manifest sanity (minimal YAML scan, no parser) ----------
const manifestPath = join(ROOT, 'agent-harness.yaml')
if (existsSync(manifestPath)) {
  const y = read(manifestPath)
  if (!/protocol_source:\s*"project-initializing_\d{6}\.md"/.test(y))
    failures.push('agent-harness.yaml: protocol_source missing/invalid')
  if (!/schema_version:\s*"1\.1"/.test(y))
    warnings.push('agent-harness.yaml: schema_version is not 1.1')
  // every blocking rule must have enforcement MACHINE|UNENFORCED
  const ruleBlocks = y.split(/\n\s*- id: /).slice(1)
  for (const b of ruleBlocks) {
    const id = b.match(/^"?(BR-[A-Z]+-\d{3})"?/)?.[1]
    if (!id) {
      failures.push(`blocking rule without valid BR-<AREA>-<NNN> id: ${b.slice(0, 40)}`)
      continue
    }
    const enf = b.match(/enforcement:\s*"(MACHINE|UNENFORCED|UNKNOWN)"/)?.[1]
    if (!enf) failures.push(`${id}: enforcement missing or not MACHINE|UNENFORCED`)
    if (enf === 'UNKNOWN') failures.push(`${id}: enforcement UNKNOWN not allowed after init`)
    if (enf === 'MACHINE') {
      if (!/mechanism:\s*"[^"\n]+"/.test(b))
        failures.push(`${id}: MACHINE rule needs mechanism path`)
      if (!/trigger:\s*"[^"\n]+"/.test(b)) failures.push(`${id}: MACHINE rule needs trigger`)
      if (!/activation_check:\s*"[^"\n]+"/.test(b))
        failures.push(`${id}: MACHINE rule needs activation_check`)
    }
    if (enf === 'UNENFORCED') {
      for (const k of ['manual_gate', 'owner', 'evidence'])
        if (!new RegExp(`${k}:\\s*"[^"\\n]+"`).test(b))
          failures.push(`${id}: UNENFORCED rule needs ${k}`)
    }
    // entrypoint paths exist
  }
  const entryPaths = [...y.matchAll(/^\s{2}[a-z_]+:\s*"([^"]+)"\s*$/gm)]
    .map((m) => m[1])
    .filter((p) => p.startsWith('docs/') || p.endsWith('.md'))
  for (const p of entryPaths) if (!exists(p)) failures.push(`manifest entrypoint not found: ${p}`)
  const refRoots = [...y.matchAll(/-\s*path:\s*"([^"]+)"/g)].map((m) => m[1])
  for (const p of refRoots) if (!exists(p)) failures.push(`reference_root not found: ${p}`)
}

// ---------- 3. Decision index ↔ files, Accepted VDR needs canonical artifact ----------
const decDir = join(ROOT, 'docs/agent/decisions')
if (existsSync(decDir)) {
  const idx = read(join(decDir, 'DECISION_INDEX.md'))
  const files = readdirSync(decDir).filter((f) => /^(ADR|VDR|GDR)-\d{4}-.*\.md$/.test(f))
  for (const f of files) {
    const id = f.match(/^((?:ADR|VDR|GDR)-\d{4})/)[1]
    if (!idx.includes(id)) failures.push(`DECISION_INDEX missing ${id} (${f})`)
    const body = read(join(decDir, f))
    const status = body.match(/^Status:\s*(\w+)/m)?.[1]
    if (!status) failures.push(`${f}: missing Status line`)
    if (/^VDR|^GDR/.test(f) && status === 'Accepted') {
      const art = body.match(/^Canonical Artifact:\s*`([^`]+)`/m)?.[1]
      if (!art) failures.push(`${f}: Accepted artifact-backed record without Canonical Artifact`)
      else if (!exists(art)) failures.push(`${f}: canonical artifact not found: ${art}`)
      if (!/Agent Misread \/ User Correction Ledger/.test(body))
        failures.push(`${f}: missing Agent Misread / User Correction Ledger`)
    }
  }
  for (const m of idx.matchAll(/\[(?:ADR|VDR|GDR)-\d{4}\]\(([^)]+)\)/g))
    if (!existsSync(join(decDir, m[1]))) failures.push(`DECISION_INDEX link broken: ${m[1]}`)
}

// ---------- 4. Active plan has Plan Reversal Log + Ambiguity Register ----------
const planPath = join(ROOT, 'docs/agent/plans/ACTIVE_PLAN.md')
if (existsSync(planPath)) {
  const p = read(planPath)
  if (!/## Plan Reversal Log/.test(p)) failures.push('ACTIVE_PLAN: missing Plan Reversal Log')
  if (!/## Ambiguity Register/.test(p)) failures.push('ACTIVE_PLAN: missing Ambiguity Register')
  if (!/^Status:\s*(Draft|Ready|In Progress|Blocked|Completed)/m.test(p))
    failures.push('ACTIVE_PLAN: invalid Status')
}

// ---------- 5. PROJECT_MAP local instruction links exist ----------
const mapPath = join(ROOT, 'docs/agent/PROJECT_MAP.md')
if (existsSync(mapPath)) {
  const m = read(mapPath)
  for (const hit of m.matchAll(/`((?:src|scripts|docs)\/[^`]*AGENTS\.md)`/g))
    if (!exists(hit[1]))
      failures.push(`PROJECT_MAP references missing local instruction: ${hit[1]}`)
}

// ---------- 6. BR-ENGINE-001: purity of src/engine, src/domain; no springs in src/renderer ----------
const FORBIDDEN_IMPORTS_ENGINE = [
  /from\s+['"]react(?:-dom)?(?:\/[^'"]*)?['"]/,
  /from\s+['"](?:motion|motion\/react|framer-motion|zustand|immer)['"]/,
  /from\s+['"]@\/(?:ui|renderer|editor|app)\//,
]
const FORBIDDEN_GLOBALS_ENGINE = [
  /\bDate\.now\s*\(/,
  /\bperformance\.now\s*\(/,
  /\brequestAnimationFrame\s*\(/,
  /\bMath\.random\s*\(/,
  /\bdocument\./,
  /\bwindow\./,
]
const FORBIDDEN_IMPORTS_RENDERER = [
  /from\s+['"](?:motion|motion\/react|framer-motion)['"]/,
  /from\s+['"]@\/ui\/motion/,
]

function walk(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (['.ts', '.tsx'].includes(extname(e))) out.push(p)
  }
  return out
}
for (const d of ['src/engine', 'src/domain']) {
  for (const f of walk(join(ROOT, d))) {
    const src = read(f)
    const isTest = /\.test\.tsx?$/.test(f)
    for (const re of FORBIDDEN_IMPORTS_ENGINE)
      if (re.test(src)) failures.push(`BR-ENGINE-001 ${rel(f)}: forbidden import ${re}`)
    if (!isTest)
      for (const re of FORBIDDEN_GLOBALS_ENGINE)
        if (re.test(src)) failures.push(`BR-ENGINE-001 ${rel(f)}: forbidden global ${re}`)
  }
}
for (const f of walk(join(ROOT, 'src/renderer'))) {
  const src = read(f)
  for (const re of FORBIDDEN_IMPORTS_RENDERER)
    if (re.test(src))
      failures.push(`BR-ENGINE-001 ${rel(f)}: spring/motion import in renderer ${re}`)
}
// factories.ts may use new Date().toISOString() for createdAt only (not engine time) — allowed by design.

// ---------- 7. CURRENT_STATE freshness hint ----------
const csPath = join(ROOT, 'docs/agent/CURRENT_STATE.md')
if (existsSync(csPath)) {
  const cs = read(csPath)
  const lu = cs.match(/^Last Updated:\s*(\d{4}-\d{2}-\d{2})/m)?.[1]
  if (!lu) failures.push('CURRENT_STATE: missing "Last Updated: YYYY-MM-DD"')
  if (!/## Next Exact Steps/.test(cs)) failures.push('CURRENT_STATE: missing Next Exact Steps')
  if (!/## Last Verified/.test(cs)) failures.push('CURRENT_STATE: missing Last Verified')
}

// ---------- report ----------
for (const n of notes) console.log(`note: ${n}`)
for (const w of warnings) console.log(`WARN: ${w}`)
for (const f of failures) console.log(`FAIL: ${f}`)
if (failures.length) {
  console.log(
    `\nharness:verify FAIL (${failures.length} failure(s), ${warnings.length} warning(s))`,
  )
  process.exit(1)
}
console.log(`harness:verify PASS (${warnings.length} warning(s))`)
