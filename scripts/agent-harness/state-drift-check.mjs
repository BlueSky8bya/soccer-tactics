#!/usr/bin/env node
/**
 * state-drift-check.mjs — WARNING ONLY (UNENFORCED BR-DOC-001 helper).
 * If src/ or scripts/ changed (git) but docs/agent/CURRENT_STATE.md did not, print a reminder.
 * Never exits non-zero. Intended for Claude Code Stop hook.
 */
import { execSync } from 'node:child_process'

function git(cmd) {
  try {
    return execSync(`git ${cmd}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return null
  }
}

const inside = git('rev-parse --is-inside-work-tree')
if (inside !== 'true') process.exit(0)

const changed = new Set(
  [
    git('diff --name-only'),
    git('diff --name-only --cached'),
    git('ls-files --others --exclude-standard'),
  ]
    .filter(Boolean)
    .flatMap((s) => s.split('\n'))
    .filter(Boolean),
)

const codeChanged = [...changed].some((f) => /^(src|scripts)\//.test(f))
const stateChanged = changed.has('docs/agent/CURRENT_STATE.md')
const changelogChanged = changed.has('docs/agent/CHANGELOG_AGENT.md')

if (codeChanged && !stateChanged) {
  console.log(
    '[harness] WARN BR-DOC-001: code changed but docs/agent/CURRENT_STATE.md not updated.',
  )
}
if (codeChanged && !changelogChanged) {
  console.log(
    '[harness] note: code changed — if behavior changed, add a CHANGELOG_AGENT entry + [WH-CHANGE] annotation.',
  )
}
process.exit(0)
