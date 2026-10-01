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

Cloud workers start by firing the routine trig_01MWQ7hW5yecn8VaiMTq1xbp (its prompt only points at .claude/cloud-worker-run.md; edit that file, not the routine) (RemoteTrigger run; decision 0010: one-off runs only, never a schedule). Light document helpers may still run locally.

| Card | Role | Where | Started | Branch |
|---|---|---|---|---|
| Taxprep trial: balance-sheet and schedule cells, round trip steps 16 to 19, Q21, Q22 | Sonnet walker, Chrome | local | 1 Oct | reference/taxprep/ |
| queue: F00 build reported (fix round 1), check next; specs reported F01, F04, F05, F08, F09, W00 (F03 parked) | 3 cloud runs cse_01Hr7Az98VbKzfckRMPp1LtF, cse_01HjjamHjojvtdvfpU7G3L4B, cse_01W4VQVBLUYDkcCpF7Np3Hej | cloud | 1 Oct 18:50Z | claude/<card> |
| design fix round (queues-record A, workbench B, cpa-review V1) | designer x3 | local | 1 Oct | claude/design-<family>-2 |
| usability panel: source viewer (D03) | tester (panel) | local | 1 Oct | claude/panel-source-viewer |

Done today: phase 0 and phase 1 cards written and independently reviewed (no phase 1 todo left); trial day 1 (reference/taxprep/); decisions 0010 to 0014; trial day 1 script (Opus read) and draft import CSVs on main; all four research pairs reconciled (reference/research/INDEX.md); clauses in line with v1.1 (A28 to A43) and with the research (A46 to A74, reference/cpa-check.md for Zo); queue repairs landed through the first train (local, A44); design versions for queues-record.

## Next, in order

1. Research done for now (four pairs reconciled, clauses applied). Next research only as cards need it.
2. Cards: phase 2 cards (M00, T01, T02, T04, T05, T07 and the rest) wait for trial day 2 findings, since RT-3, RT-9 and the cell ids change (F03 parked for the same reason). Gaps to card now: the four new sample clients for kinds K1, K5, K6, K13 (review-phase1); V05 shows "waiting on AI run"; B03 amalgamation field in the bridge.
3. Queue repairs landed (P04 done).
4. Designs: usability panel (tester, panel mode) on each family, then the sitting link for Zo about 3 Oct.
5. Trial: day 1 script read by Opus and on main; to-do #4 says ready. On Zo's "4 started": a Sonnet walker runs day 1 with Chrome. Draft import CSVs are on main; cell ids from day 1 replace the guesses.
6. Rehearsal running in the cloud (F00). Learned so far: claim.mjs hands out specs and builds whose deps are not built (needs a dep gate: queue repair 2, with F08); claim.mjs cannot reopen a spec (the Lead set F00 spec to null in slices.json and released the old spec claim instead); a cloud worker sent Zo a push notification (routine prompt now forbids it). Widen past 3 cloud runs only after F00 lands through a train and the cold sign-off on the repairs and rehearsal.

## Watch out

- The trial ends about 16 Oct (15 days left on 1 Oct; 100 PDFs left). Release CCH iFirm 2026.20.198267. The trial lasts until then: nothing starts on it until the to-do says ready. Real Auto-fill data: structure only, never values (decision 0008, Z8-7).
- Chrome: only the "Ashbridge Test" profile. QBO: Intuit developer sandbox companies only, never the firm's real client list.
- No routines, no schedules (until Zo answers to-do #1). Ask Zo in the to-do for anything only he can do; if he does not answer, keep going on everything else.
- Findings review before every fix round; cold sign-off for big chunks only.
- The main checkout stays on main; train work in .claude/worktrees/train. The push guard lets only plan/, reviews/, decisions/, reference/, blueprint/, reports/, CLAUDE.md, README.md and .claude/ go straight to main.
- Taking a helper branch onto main: check out only the files in `git diff --name-only $(git merge-base main B) B`, never `git diff main B`. For plan/slices.json the branch copy replaces main's, so re-apply any Lead edit made on main after the branch started (F03 parked was lost once).
- Cloud worker names: the first two runs both called themselves cloud-vm (same hostname); the routine prompt now uses a random id. Watch for the two cloud-vm runs blocking each other.
- Chrome downloads land in C:SERSSERDOWNLOADS (ZO, 1 OCT); WALKERS COPY ONLY THEIR OWN EXPORTS TO C:SERSSERDOCUMENTS	AXPREP-TRIALINBOX AND TOUCH NOTHING ELSE THERE.
- NEXT IN CHROME, ONE AT A TIME and only with the window visible (to-do #1): the trial walker (day 1b, then day 2), then the QBO walker on the sandbox company Zo opened (decision 0012; its own screens, no keys), then the .GFI from QBO Accountant on "Probe Co. (Test)" (decision 0013, with its limits).
- Trial checkpoint landed (300 GIFI ids; reference/taxprep/cell-map-status.md lists what to export next). Chrome order, one at a time, window visible: the QBO walker (done: Transaction List by Date carries Transaction ID and the full memo), then the trial walker (running) (balance-sheet forms S2008, S2178, S3849, then S1, S8, S50; round trip steps 16 to 19; Q21, Q22), then the QBO walker on the sandbox company Zo opened (decision 0012; its own screens, no keys), then the .GFI on "Probe Co. (Test)" in QBO Accountant (decision 0013, with its limits). Downloads land in C:\Users\User\Downloads; walkers copy only their own exports to C:\Users\User\Documents\taxprep-trial\inbox.
- Only one helper drives Chrome at a time: two walkers shared the tab group on 1 Oct and one tab was taken over.
- Edit files with the Edit tool, not shell scripts with escapes (Git Bash mangles backslashes).
- Another Lead works in ashbridge-app: read-only there, always. GitHub Actions: 2,000 free minutes a month: keep branch checks lean.
