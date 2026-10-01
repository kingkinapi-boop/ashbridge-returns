# NOW

True at every moment. 60 lines max. Last rewritten: 1 Oct 2026, morning (the Critic, before the Lead starts turbo).

## State

- **Mode: turbo** since 1 Oct, "until I say off" (decision 0009). Automatic wind-down Fri 9 Oct 18:00 Toronto unless Zo removes it. Weekly usage reset on 1 Oct; cloud credit about $230.
- **Cloud first:** workers run in cloud sessions the Lead starts; the laptop runs the Lead plus at most 1 local worker (Zo works on it too). Sonnet 5.5 by default; Opus 5.5 for the Lead, core specs and adversarial checks, findings reviews and cold sign-offs (CLAUDE.md).
- **The plan:** decisions 0008 (Zo's answers) and 0009 (how turbo runs); the plain end state v1.1 (blueprint/README.md). Zo's phases: 0 prove reality; 1 evidence and the source viewer; 2 return build, lock and trace; 3 checks and the CPA review; 4 learning list and sign-off.
- **Ready before turbo:** research (reference/research/INDEX.md); ten sample clients (reference/sample-clients/, 236 checks pass); the trial plan (plan/taxprep-trial-plan.md); helper roles in .claude/agents (findings-reviewer, signoff, value, design-researcher, designer, researcher, research-checker; the tester has a panel mode).
- **Zo:** the Chrome test profile "Ashbridge Test" is made; the Auto-fill corporation is chosen; tell him in the to-do when to start the trial and when to open the profile for the walker. He reads only the to-do; chat is one line.
- **The watcher:** a separate chat may send `handover` when the Lead's context passes its threshold. Answer by CLAUDE.md loop step 9.

## In flight

| Card | Role | Where | Started | Branch |
|---|---|---|---|---|
| none | | | | |

## Next, in order

1. **Start the streams that need no queue, at once, as cloud sessions** (each writes files and pushes a claude/ branch; the Lead merges documents-only results):
   - Research pairs (two researchers, then the research checker): the T2 rules each check uses, with CRA sources and worked examples, one question per check group; the F9 requests (a T2 review checklist, an owner-manager issues list, a trial-balance-to-GIFI mapping, which Taxprep diagnostics may be ignored); QBO: which reports, exports and API data give the trace.
   - Design research for the first screen families: the CPA review with its source viewer; the preparer's workbench; the queues and the return record page.
   - The trial day 1 script (exact clicks for the cell map). Then write "ready" in the to-do, with when to open the Chrome profile.
2. **Queue repairs** (a branch built by a worker, checked, merged): claim.mjs retries with backoff and jitter, one batched read of claims, an owner check, a heartbeat, check FAIL in one push with a hold for the findings review before the build reopens; scope.mjs allows acceptance and golden files; wire wind_down_at; allow-list gaps (npm ci, gh, git worktree add, git -C merge and push, claude --cloud); pin model ids in .claude/settings.json env (claude-opus-5-5, claude-sonnet-5-5, claude-haiku-4-5). Evidence: reference/research/2026-09-29-plan-audit.md.
3. **Bring the clauses into line with v1.1** (one amber row each) and re-cut slices.json into the five phases, one phase ahead, F00 (the empty app) first. Then the phase 1 card review by an independent worker.
4. **Rehearsal at small width:** two cloud workers, one train, landing on main, Playwright inside a cloud session; confirm `claude --cloud` workers run on Sonnet. Cold sign-off on the repairs and the rehearsal. Then widen: 6 cloud workers, add 2 while first passes and green trains hold, 12 at most.
5. **The trial week** once Zo starts it (plan/taxprep-trial-plan.md): the walker drives the laptop's "Ashbridge Test" Chrome profile; Zo is needed on day 1 and day 4. Cold sign-off on the findings.
6. **Design sittings** for Zo about 3, 6 and 8 Oct: links in the to-do, two or three versions each, after the usability panel.

## Watch out

- The trial lasts one week: nothing starts on it until the to-do says ready. Real Auto-fill data: structure only, never values (decision 0008, Z8-7).
- Chrome: only the "Ashbridge Test" profile. QBO: Intuit developer sandbox companies only, never the firm's real client list.
- No routines, no schedules: the Lead starts and re-fires cloud workers itself. Ask Zo in the to-do for anything only he can do; if he does not answer, keep going on everything else.
- Findings review before every fix round; cold sign-off for big chunks only.
- The main checkout stays on main; train work in .claude/worktrees/train. The push guard lets only plan/, reviews/, decisions/, reference/, blueprint/, reports/, CLAUDE.md, README.md and .claude/ go straight to main.
- Edit files with the Edit tool, not shell scripts with escapes (Git Bash mangles backslashes).
- Another Lead works in ashbridge-app: read-only there, always. GitHub Actions: 2,000 free minutes a month: keep branch checks lean.
