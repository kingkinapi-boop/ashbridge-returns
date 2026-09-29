---
name: dispatch
description: How work reaches workers - the queue (tools/claim.mjs), local background workers, cloud workers started by routines, extra cloud sessions Zo opens, and how reports come back. Use before starting any helper.
---

# Dispatch

All building goes through one queue. A job is a spec, a build or a check of one card. `tools/claim.mjs` hands out jobs on the branch `claude/claims`, so any number of workers can pull at once without two taking the same job, and nobody checks their own work (tested 28 Sep: four workers claiming at the same moment got four different jobs).

Before starting any worker: write the NOW.md "In flight" row (who, where, started). The budget hook logs Lead dispatches by itself; the claims branch logs every job.

## What the Lead reads each wake-up
- `node tools/claim.mjs list`: every job, its worker, state and age.
- A reported build or check: `git fetch -q origin claude/<card>` then `git show origin/claude/<card>:reports/<card>-<role>.md`. Read only the report.
- GitHub checks on a branch (after Zo's yes, decision 0007): `gh run list --branch claude/<card> --limit 1` ("C:\Program Files\GitHub CLI\gh.exe").

## Local workers (laptop)
Agent tool, `run_in_background: true`, `subagent_type: worker`, `isolation: worktree`, prompt `work` (or `work --roles spec` to fill the spec queue). Model by the mode table. Heavy commands queue through `node tools/heavy.mjs`. The laptop takes 4 to 6 in turbo, 1 otherwise.

## Cloud workers (routines)
- Routines draw on the cloud credit first, then plan usage. They can push only to `claude/` branches, which is all a worker needs.
- Created once, the first time Zo types `turbo on` (never before): routines `returns-worker-1` to `returns-worker-12` on the GitHub repo kingkinapi-boop/ashbridge-returns, each with the prompt `work`, no recurring schedule. Use the `schedule` skill. If creating one needs a click only Zo can make, put the exact clicks in TODO-ZO section 1 once.
- To start one: give it a one-off run time 2 minutes ahead (one-off runs do not count against the daily routine cap, per Anthropic's routines docs), or "run now" if the cap allows. Start them at least 2 minutes apart.
- A routine run ends when its worker stops (queue empty, paused, or 4 jobs done). Re-fire it at the next wake-up if the queue still has jobs.
- The Reviewer routine `returns-review` (prompt `review`) runs daily in normal and every 12 hours in turbo (decision 0007, Z-3). Create it once, after "blueprint ok".

## Extra cloud sessions (Zo's own, optional)
In turbo, Zo can open claude.ai/code, pick the ashbridge-returns repo, type `work`, and send; as many as he likes. Each pulls jobs like any worker. In other modes the queue refuses them politely ("Paused by mode ...").

## After a job is reported
- spec reported: nothing to do; the build job opens by itself.
- build reported: nothing to do; a check job opens by itself for a different worker.
- check PASS: the card joins the next train (skill `merge`).
- check FAIL: the build job reopens for round 2 (the checker set it failed). After a third failed round the queue stops handing it out: the Lead parks the card (reason on the card, amber row) or re-cards it smaller.
- A job "working" for 90 minutes with no new commit: `node tools/claim.mjs update <card> <role> released --worker lead --note stale` so it goes back in the queue.
