# Claude Code Entry Point — Soccer Tactics

@AGENTS.md

## Claude-specific

- Route with `docs/agent/PROJECT_MAP.md`; load only the local `AGENTS.md`, ADRs, plan, and product docs relevant to the task.
- Prefer planning (ACTIVE_PLAN) before editing for L2/L3 work. Milestone-by-milestone, verify each.
- Hooks (`.claude/settings.json`): `SessionStart` prints a harness brief; `Stop` runs `verify-harness` + state-drift warning. Hooks are supplementary — the manual gates in `agent-harness.yaml` still apply.
- Permissions deny (`.claude/settings.json`): `git reset --hard`, `git clean`, force operations. Ask the user explicitly if any is needed. `git push`는 사용자 위임(2026-08-20 "푸시는 너가 항상 알아서 해") — 커밋 후 자동 push (Vercel 자동 배포 트리거).
- Docs in Korean; code, identifiers, commit messages in English.
- Bash here is Git Bash on Windows; quote the path (`"c:/Projects/soccer tactics"`).
