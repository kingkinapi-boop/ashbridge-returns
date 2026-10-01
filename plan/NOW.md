# NOW

True at every moment. 60 lines max. Last rewritten: 1 Oct 2026, afternoon (the Lead, wave 1 running locally).

## State

- **Mode: turbo** since 1 Oct, "until I say off" (decision 0009). Automatic wind-down Fri 9 Oct 18:00 Toronto unless Zo removes it. Weekly usage reset on 1 Oct; cloud credit about $230.
- **Cloud first:** workers run in cloud sessions the Lead starts; the laptop runs the Lead plus at most 1 local worker (Zo works on it too). Sonnet 5.5 by default; Opus 5.5 for the Lead, core specs and adversarial checks, findings reviews and cold sign-offs (CLAUDE.md).
- **The plan:** decisions 0008 (Zo's answers) and 0009 (how turbo runs); the plain end state v1.1 (blueprint/README.md). Zo's phases: 0 prove reality; 1 evidence and the source viewer; 2 return build, lock and trace; 3 checks and the CPA review; 4 learning list and sign-off.
- **Ready before turbo:** research (reference/research/INDEX.md); ten sample clients (reference/sample-clients/, 236 checks pass); the trial plan (plan/taxprep-trial-plan.md); helper roles in .claude/agents (findings-reviewer, signoff, value, design-researcher, designer, researcher, research-checker; the tester has a panel mode).
- **Zo:** the Chrome test profile "Ashbridge Test" is made; the Auto-fill corporation is chosen; tell him in the to-do when to start the trial and when to open the profile for the walker. He reads only the to-do; chat is one line.
- **The watcher:** a separate chat may send `handover` when the Lead's context passes its threshold. Answer by CLAUDE.md loop step 9.

## In flight

All helpers run on the laptop for now: `claude --cloud` needs a person at a terminal and the Agent tool's "remote" option ran locally (amber A25; to-do #1 asks Zo). Light helpers only; one build worker.

| Card | Role | Where | Started | Branch |
|---|---|---|---|---|
| queue: F00 build, then D01 spec (the rehearsal) | worker (local, the one) | local | 1 Oct | claude/F00, claude/D01 |
| usability panel cpa-review | tester (panel) | local | 1 Oct | claude/panel-cpa-review |
| usability panels queues-record, workbench | tester (panel) x2 | local | 1 Oct | claude/panel-<family> |

Done today: trial day 1 script (Opus read) and draft import CSVs on main; all four research pairs reconciled (reference/research/INDEX.md); clauses in line with v1.1 (A28 to A43) and with the research (A46 to A74, reference/cpa-check.md for Zo); queue repairs landed through the first train (local, A44); design versions for queues-record.

## Next, in order

1. Research done for now (four pairs reconciled, clauses applied). Next research only as cards need it.
2. Phase 0 cards written and reviewed (A81 to A92). The rehearsal runs on F00 locally: build, then a check by a different worker, then a local train. Next cards to write: F06, W20, A02 to A05 (phase 1), and a card for where the real pipeline is wired (review-phase0 asks).
3. Queue repairs landed (P04 done).
4. Designs: usability panel (tester, panel mode) on each family, then the sitting link for Zo about 3 Oct.
5. Trial: day 1 script read by Opus and on main; to-do #4 says ready. On Zo's "4 started": a Sonnet walker runs day 1 with Chrome. Draft import CSVs are on main; cell ids from day 1 replace the guesses.
6. Rehearsal at small width once Zo answers to-do #1; then widen.

## Watch out

- The trial lasts one week: nothing starts on it until the to-do says ready. Real Auto-fill data: structure only, never values (decision 0008, Z8-7).
- Chrome: only the "Ashbridge Test" profile. QBO: Intuit developer sandbox companies only, never the firm's real client list.
- No routines, no schedules (until Zo answers to-do #1). Ask Zo in the to-do for anything only he can do; if he does not answer, keep going on everything else.
- Findings review before every fix round; cold sign-off for big chunks only.
- The main checkout stays on main; train work in .claude/worktrees/train. The push guard lets only plan/, reviews/, decisions/, reference/, blueprint/, reports/, CLAUDE.md, README.md and .claude/ go straight to main.
- Taking a helper branch onto main: check out only the files in `git diff --name-only $(git merge-base main B) B`, never `git diff main B` (that drags old plan files back).
- Edit files with the Edit tool, not shell scripts with escapes (Git Bash mangles backslashes).
- Another Lead works in ashbridge-app: read-only there, always. GitHub Actions: 2,000 free minutes a month: keep branch checks lean.
