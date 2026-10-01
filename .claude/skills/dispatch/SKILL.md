---
name: dispatch
description: How work reaches workers - the queue (tools/claim.mjs), cloud workers the Lead starts, the one local worker, helpers for findings reviews, sign-offs and research, and how reports come back. Use before starting any helper.
---

# Dispatch

All card work goes through one queue. A job is a spec, a build or a check of one card. `tools/claim.mjs` hands out jobs on the branch `claude/claims`, so many workers can pull at once without two taking the same job, and nobody checks their own work. Before starting any worker: write the NOW.md "In flight" row.

## What the Lead reads each wake-up
- `node tools/claim.mjs list`: every job, its worker, state and age.
- A reported build or check: `git fetch -q origin claude/<card>` then `git show origin/claude/<card>:reports/<card>-<role>.md`. Read only the report.
- GitHub checks on a branch: `gh run list --branch claude/<card> --limit 1`.

## Cloud workers (most of the work; decision 0009)
- Start one with `claude --cloud "work"` from the main checkout, with the model set to Sonnet 5.5 (pass `--model sonnet` if the CLI takes it with `--cloud`; the rehearsal confirms the model from the worker's report, and if it cannot be set the worker hands builds to Sonnet subagents). Push main first: a cloud session clones from GitHub.
- No routines and no schedules (decision 0008). The Lead re-fires a cloud worker whose session ended while the queue still has jobs.
- A cloud session stalls on an unanswered permission prompt: every command a worker needs must be allowed in `.claude/settings.json` (the rehearsal finds the gaps).
- Zo may also open cloud sessions and type `work`; they pull from the same queue.

## The one local worker
Agent tool, `run_in_background: true`, `subagent_type: worker`, `isolation: worktree`, prompt `work`. Only one: Zo uses the laptop too. Heavy commands queue through `node tools/heavy.mjs`.

## Helpers outside the queue (Lead-dispatched, fresh context each time)
| Helper | Agent file | Model | When |
|---|---|---|---|
| Findings reviewer | `findings-reviewer.md` | Opus | a check FAIL, tester findings, a red train: before any fix round |
| Cold sign-off | `signoff.md` | Opus | a phase gate or another big chunk (CLAUDE.md loop 7) |
| Value | `value.md` | Opus | before a card family is written; when a clause looks costly |
| Design researcher | `design-researcher.md` | Sonnet | before a screen family is designed |
| Designer | `designer.md` | Sonnet | after its brief: two or three clickable versions |
| Usability panel | `tester.md` (panel mode) | Sonnet | on design versions before Zo's sitting; on built screens |
| Research pair | `researcher.md` twice, then `research-checker.md` | Sonnet, then Opus | any question that decides something |
Research and design helpers can run as cloud sessions too: `claude --cloud "<the helper's orders file and its question>"`.

## After a job is reported
- spec reported: the build job opens by itself.
- build reported: a check job opens by itself for a different worker.
- check PASS: the card joins the next train (skill `merge`).
- check FAIL or tester findings: the Lead runs a findings review first (CLAUDE.md loop 4). Its consolidated fix list goes into the card; tests it asks for go through a spec job; only then does the build reopen. After a third failed round the queue stops handing it out: the Lead parks the card (reason on the card, amber row) or re-cards it smaller.
- A job "working" for 90 minutes with no new commit: `node tools/claim.mjs update <card> <role> released --worker lead --note stale`.
