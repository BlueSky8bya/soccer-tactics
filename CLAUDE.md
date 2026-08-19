# Claude Code Entry Point — Soccer Tactics

@AGENTS.md

## Claude-specific

- Route with `docs/agent/PROJECT_MAP.md`; load only the local `AGENTS.md`, ADRs, plan, and product docs relevant to the task.
- Prefer planning (ACTIVE_PLAN) before editing for L2/L3 work. Milestone-by-milestone, verify each.
- Hooks (`.claude/settings.json`): `SessionStart` prints a harness brief; `Stop` runs `verify-harness` + state-drift warning. Hooks are supplementary — the manual gates in `agent-harness.yaml` still apply.
- Permissions deny (`.claude/settings.json`): `git push`, `git reset --hard`, `git clean`, force operations. Ask the user explicitly if any is needed.
- Docs in Korean; code, identifiers, commit messages in English.
- Bash here is Git Bash on Windows; quote the path (`"c:/Projects/soccer tactics"`).
