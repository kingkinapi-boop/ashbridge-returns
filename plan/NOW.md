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
| research ties CK-10..19 | researcher A (B done) | local | 1 Oct | claude/research-ties-a |
| research reconciliations CK-20..26 | researcher A (B done) | local | 1 Oct | claude/research-recs-a |
| research flags CK-30..42 | research checker (Opus) | local | 1 Oct | files on main |
| research QBO trace | research checker (Opus) | local | 1 Oct | files on main |
| research F9 lists | researcher A + B | local | 1 Oct | claude/research-f9-a, -b |
| designs cpa-review, workbench, queues-record | designer x3 | local | 1 Oct | claude/design-<family> (briefs on claude/brief-<family>) |
| clauses into line with v1.1 | Opus drafter | local | 1 Oct | claude/clauses-v1-1 |
| queue repairs | builder | local | 1 Oct | claude/queue-repairs |

Done today: trial day 1 script (plan/trial/day1-script.md); QBO pair; ties B, recs B, flags A and B; three design briefs (on branches: design/ cannot go straight to main, they ride the first train).

## Next, in order

1. As each research pair lands: put both files on main, run the research checker (Opus), add a line to reference/research/INDEX.md. Ties and flags already show clause errors (CK-15 add-back is 8670 + 8459 + 9791; CK-38 accrued bonuses get no T4; CK-19 percentages not dollars; CK-12 latest assessed figure): fold the reconciled answers into the clauses as ambers and list them for the CPA's check.
2. Clauses: review the drafter's branch (reports/clauses-v1-1.md), merge blueprint to main, add its amber rows. Then re-cut slices.json into the five phases, one phase ahead, F00 first; then the phase 1 card review by an independent worker.
3. Queue repairs: when built, a different worker checks it; then the first train (also carries the design briefs and prototypes).
4. Designs: usability panel (tester, panel mode) on each family, then the sitting link for Zo about 3 Oct.
5. Trial: day 1 script is on main; an Opus read of it, then write "ready" in the to-do with when to open the Chrome profile. Zo starts the trial.
6. Rehearsal at small width once Zo answers to-do #1; then widen.

## Watch out

- The trial lasts one week: nothing starts on it until the to-do says ready. Real Auto-fill data: structure only, never values (decision 0008, Z8-7).
- Chrome: only the "Ashbridge Test" profile. QBO: Intuit developer sandbox companies only, never the firm's real client list.
- No routines, no schedules (until Zo answers to-do #1). Ask Zo in the to-do for anything only he can do; if he does not answer, keep going on everything else.
- Findings review before every fix round; cold sign-off for big chunks only.
- The main checkout stays on main; train work in .claude/worktrees/train. The push guard lets only plan/, reviews/, decisions/, reference/, blueprint/, reports/, CLAUDE.md, README.md and .claude/ go straight to main.
- Edit files with the Edit tool, not shell scripts with escapes (Git Bash mangles backslashes).
- Another Lead works in ashbridge-app: read-only there, always. GitHub Actions: 2,000 free minutes a month: keep branch checks lean.
