#!/usr/bin/env node
/**
 * session-brief.mjs — Claude Code SessionStart hook. Prints a compact harness brief:
 * current objective / next exact steps from CURRENT_STATE, active plan status, latest handoff.
 * Output is injected as context. Keep it short.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..')
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '')

const cs = read(join(ROOT, 'docs/agent/CURRENT_STATE.md'))
const section = (md, title) => {
  const m = md.match(new RegExp(`## ${title}\\n([\\s\\S]*?)(?=\\n## |$)`))
  return m ? m[1].trim() : '(none)'
}
const plan = read(join(ROOT, 'docs/agent/plans/ACTIVE_PLAN.md'))
const planStatus = plan.match(/^Status:\s*(.+)$/m)?.[1] ?? 'none'
const planId = plan.match(/^Plan ID:\s*(.+)$/m)?.[1] ?? '-'
const hoDir = join(ROOT, 'docs/agent/handoffs')
const latestHandoff = existsSync(hoDir)
  ? (readdirSync(hoDir)
      .filter((f) => f.endsWith('.md'))
      .sort()
      .at(-1) ?? 'none')
  : 'none'

console.log(`[WHITEHAVEN harness] Soccer Tactics — hook active (SessionStart)
Last Updated: ${cs.match(/^Last Updated:\s*(.+)$/m)?.[1] ?? '?'}
Objective: ${section(cs, 'Current Objective').split('\n')[0]}
Active Plan: ${planId} — ${planStatus}
Latest Handoff: ${latestHandoff}
Next Exact Steps:
${section(cs, 'Next Exact Steps')}
Read order: AGENTS.md → docs/agent/CONSTITUTION.md → CURRENT_STATE.md → PROJECT_MAP.md → local AGENTS.md → decisions.`)
