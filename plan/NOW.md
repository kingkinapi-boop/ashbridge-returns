# NOW

True at every moment. 60 lines max. Last rewritten: 29 Sep 2026, evening (the Critic, after Zo's answers).

## State

- The plan review is settled: decision 0008 records Zo's answers. The plain end state v1.1 is approved (first section of blueprint/README.md). The review doc is archived; Zo talks through plan/TODO-ZO.md from now on.
- What changed: the books live in QBO (no bookkeeping module); Zo's five phases are the spine, and real Taxprep is proven first on a one-week trial; tax choices are made in Taxprep; one lock export plus one check before transmit; AI runs through a Claude project on the subscription, not the API; no chat runs by itself (no routines); the Critic runs about every two days when Zo opens it, and he approves each proposal.
- Mode: prep. Weekly usage 86% until the reset on Thu 1 Oct, 12:00 Toronto. Cloud credit about $230.
- Ten sample clients: done and verified (reference/sample-clients/, verify.mjs 236 passes). CPA-confirm items listed in its README.
- Taxprep trial: not started. Zo starts it only when the to-do says "ready". Plan: plan/taxprep-trial-plan.md.
- Research: reference/research/INDEX.md. The prompt for redesigning the client app's /internal sits in toDelete/ (kept out of git).

## In flight

| Card | Role | Where | Started | Branch |
|---|---|---|---|---|
| none | | | | |

## Next, in order (the Lead, after the reset)

1. **Repairs before any scale** (tools/ is code: branch, check, merge). claim.mjs: retries with backoff and jitter, one read of all claims, an owner check on update, a heartbeat, check FAIL in one push. scope.mjs: allow the spec-writer's acceptance and golden files. Wire wind-down or drop the claim. Pin model ids in .claude/settings.json env (ANTHROPIC_DEFAULT_OPUS_MODEL=claude-opus-5-5, ANTHROPIC_DEFAULT_SONNET_MODEL=claude-sonnet-5-5, ANTHROPIC_DEFAULT_HAIKU_MODEL=claude-haiku-4-5). Fill allow-list gaps (npm ci, gh, git worktree add, git -C merge and push). Evidence: reference/research/2026-09-29-plan-audit.md findings 2, 3, 6, 7.
2. **Skills and roles.** dispatch and modes lose routines (Z8-19): cloud workers start only after `turbo on`, as cloud sessions, if Zo agrees (to-do 4). Write agent files for Value, Design research, Designers, Usability panel and Research pairs (each under 60 lines; research helpers capped at 60 tool calls and read pages through a cheap summarizer). Split CLAUDE.md: the loop, modes and Zo's chat rules move into a Lead orders file.
3. **Bring the clauses into line with v1.1** (the list under the plain end state), one amber row each. Then re-cut slices.json into Zo's phases: 0 the Taxprep trial and QBO sandboxes; 1 evidence and the source viewer, plus an early CPA review slice; 2 the return build and lock-and-trace; 3 checks and the CPA review screen; 4 the learning list and client sign-off. Card one phase ahead, not all 255 at once. Metrics lines gain tokens and minutes.
4. **Trial readiness** (plan/taxprep-trial-plan.md): sample clients verified, the Chrome test profile done by Zo, the day 1 script written. Then write "ready" in the to-do.
5. **Rehearsal** (skill modes) with the repaired queue at real width: 6 workers, a train, landing, Playwright inside a cloud session. Fix every prompt it meets.
6. **Turbo** only on Zo's `turbo on`. Streams: research pairs (including the F9 requests), the test world grown from the sample clients, designs with three sittings, the engine for phases 1 and 2, the document-reading scorecard. Start 6 cloud workers, add 2 while first passes and green trains hold, 12 at most; the laptop runs the Lead plus 3.

## Watch out

- The trial lasts one week: nothing starts on it until the to-do says ready. Real Auto-fill data: record structure only, never values (Z8-7).
- Chrome: only the separate test profile (Z8-9). QBO: sandbox companies only, never the firm's real client list.
- The main checkout stays on main; train work in .claude/worktrees/train (hook enforced). The push guard lets only plan/, reviews/, decisions/, reference/, blueprint/, reports/, CLAUDE.md, README.md and .claude/ go straight to main.
- Heredocs in Git Bash mangle backslashes: edit files with the Edit tool, not shell scripts with escapes.
- Another Lead works in ashbridge-app. Read-only there, always.
- GitHub Actions: 2,000 free minutes a month on a private repo, and the full plan would need far more: keep branch checks lean.
