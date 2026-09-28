---
name: dispatch
description: How the Lead starts spec-writers, builders, checkers, testers and scouts, locally or in the cloud, how branches are named, and how reports come back. Use before every dispatch.
---

# Dispatch

Before any dispatch: write the NOW.md "In flight" row (card, role, where, started, branch). The budget hook logs the dispatch by itself.

## The prompt
Only the role word and the card: `build R07`, `spec R07`, `check R07`, `check R07 full`, `test R07`. Add one line only if something changed since the card was written. Never paste file contents; the helper reads them.

## Local helpers (laptop)
Agent tool, `run_in_background: true`:
- builder: `subagent_type: builder`, `isolation: worktree`, model per the mode table.
- spec-writer: `subagent_type: spec-writer`, `isolation: worktree`.
- checker: `subagent_type: checker`, in the builder's worktree path.
- scout: `subagent_type: scout`, no worktree, with the findings path in the prompt.
They notify you when done. Heavy commands queue through `node tools/heavy.mjs`.

## Cloud helpers (routines)
- The Agent tool's remote option is gated and can silently run locally (decision 0005, S-7): use routines.
- Slots: saved routines `returns-slot-1` to `returns-slot-6` on the GitHub repo kingkinapi-boop/ashbridge-returns, created once with the `schedule` skill after the repo exists. Each is a one-time run, never recurring.
- To dispatch: pick a free slot, update its prompt to the role word and card, set `run_once_at` 2 minutes ahead. Start slots at least 2 minutes apart.
- A cloud session pushes only to `claude/` branches: the card's branch is `claude/<card>`.
- It writes `reports/<card>-<role>.md` on that branch and pushes.
- At each wake-up: `git fetch -q`, then for each cloud row in NOW.md, `git log -1 --format=%cr origin/claude/<card>` and `git show origin/claude/<card>:reports/<card>-<role>.md`. Read only the report.
- The Reviewer routine `returns-review` is the only recurring routine, and only after Zo's yes (TODO-ZO item 2).

## Which helper where
- Local: builders in prep and steady; spec-writers; checkers (fast check); scouts.
- Cloud: `check <card> full` (full suite and browser journeys) for every merge; testers; extra builders in steady and ultra.
- GitHub Actions, if Zo says yes (TODO-ZO item 2): typecheck and tests on every `claude/` branch for free; then `check <card> full` in the cloud is needed only for cards with screens or journeys. Read results with `gh run list --branch claude/<card> --limit 1`.
