#!/usr/bin/env node
/**
 * create-handoff.mjs — scaffold a Handoff Snapshot in docs/agent/handoffs/.
 * Usage: npm run harness:handoff -- <short-topic>
 * Creates YYYY-MM-DD_HHMM_<topic>.md from the protocol template and prints the path.
 */
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..')
const topic = (process.argv[2] ?? 'session').replace(/[^a-z0-9가-힣-]+/gi, '-').toLowerCase()
const now = new Date()
const pad = (n) => String(n).padStart(2, '0')
const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
const time = `${pad(now.getHours())}${pad(now.getMinutes())}`
const dir = join(ROOT, 'docs/agent/handoffs')
if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
const file = join(dir, `${date}_${time}_${topic}.md`)
if (existsSync(file)) {
  console.error(`exists: ${file}`)
  process.exit(1)
}
let version = 'UNKNOWN'
try {
  version = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version ?? version
} catch {}

writeFileSync(
  file,
  `# Handoff Snapshot

Created: ${date} ${pad(now.getHours())}:${pad(now.getMinutes())}
Agent / Tool:
Task: ${topic}
Risk Level:
Project Version: ${version}

## Session Goal

## Completed

-

## Files Touched

| File | Change | Change ID |
|---|---|---|
| | | |

## Decisions Made

-

## Decision Persistence

- UNPERSISTED DECISION: None

## Validation Evidence

- \`command\` → PASS/FAIL/NOT RUN

## Verification Ownership

- Direct / indirect verification completed:
- Delegated verification required:
- Shared verification:

## Failed Attempts

- None

## Plan Reversals

| ID | New Evidence | Previous Plan | Replacement Plan |
|---|---|---|---|
| | | | |

## Open Questions

-

## Known Risks

-

## Current Working Tree Notes

- uncommitted user changes:
- agent changes:

## Next Exact Step

1.

## Rollback

## Documents Updated

-

## Documents Possibly Stale

- None
`,
  'utf8',
)
console.log(file)
