# NOW

True at every moment. 60 lines max. Last rewritten: 1 Oct 2026, about 20:40Z, by the Lead (session after `go`).

## State

- **Mode: turbo** since 1 Oct (decision 0009). Wind-down Fri 9 Oct 18:00 Toronto. Plan use at 19:32Z: 5h 35%, week 9%.
- **Cloud workers:** fire the routine trig_01MWQ7hW5yecn8VaiMTq1xbp with RemoteTrigger `run` (decision 0010: one-off runs, never a schedule). Its prompt only points at `.claude/cloud-worker-run.md`: edit that file, not the routine. Runs cannot notify the Lead: poll `list_runs` and `node tools/claim.mjs list` (ScheduleWakeup about 30 min). Keep at most 3 runs until F00 lands through a train and a cold sign-off covers the repairs and the rehearsal.
- **Zo:** reads only the to-do; no small questions (decision 0014). No open to-do questions (decision 0016: 1 done, 2 yes, browser not QB Desktop). Day 4 (Auto-fill, Zo) set for Sat 3 Oct, told in the to-do.
- **Phases:** 0 and 1 carded and reviewed. Phase 2 carded 1 Oct (10 cards incl. new T12; ambers A203 to A227; reports/cards-phase2.md); all wait on S03, which waits for FINDINGS.md "final" (about 16 Oct).

## In flight

| Card | Role | Where | Started | Branch |
|---|---|---|---|---|
| Design re-test, changed tasks on the four families (panel mode) | tester | local worktree | 1 Oct 23:15Z | claude/design-retest |
| F00 round 3 spec (security fixes, reports/F00-findings-3.md; spec reopened) | cloud run | cloud | 1 Oct 22:25Z | claude/F00 |

All four design fix rounds done: claude/design-queues-record-2, -workbench-2, -cpa-review-2 (V1), -source-viewer-2 (aa385a2; A251). Re-test in flight.

## Next, in order

1. Queue repair 2 LANDED (ed9435b, A247: vitest RPC timeout noise to fix in the next queue repair; dispatch skill line 40 should name `update <card> spec reopened --worker lead`; add a test that a check on a card with a parked dep still flows).
2. F00: after findings review 3, card updated, spec job (rule tests), build, check, then board the train: write plan/train.json {status: requested}, merge into claude/train, fire a cloud run (it takes the train first, A249). Green: land, cold sign-off on queue repairs + rehearsal, widen to 6 runs.
3. Re-specs: F03 and S00 (re-carded from the trial). Specs reported for F01, F04, F05, F08, F09, W00 wait on F00 done (dep gate).
4. Phase 2: reviewed and fixed (reports/review-phase2.md, A234 to A246; red 1 settled as amber A245, RT-25 changed, CPA check item 33). Specs wait on S03 (FINDINGS final). Next design: D05 brief with Ready and the clear.
5. Day 5: imports 01 to 07 done by script; exports and the 02 print (counter 96, file never arrived) blocked, window hidden. On Zo's "2 done": walker retries exports for 01 to 07, creates and imports 08 to 10, diagnostics 06, 07, then 5D. Then "After day 5" helper.
6. .GFI: Accountant view reached (firm "Ashbridge Tax"); path Your books > Workpapers > Books to tax actions > Export GIFI file; header-only file (blank books). To-do #1: made-up accounts in the firm books (red: firm data) or Zo exports one (shape only). Then gfi-file.md and B01 spec.
7. Designs: when the two fix rounds report, re-test only the changed tasks on the four families (tester panel mode), then the sitting page for Zo (Artifact, private) with the six questions in reports/findings-designs.md (d), about 3 Oct. Then D00 and D01.

## Watch out

- Train worktree: create it with `git worktree add -B train .claude/worktrees/train origin/main` BEFORE any `git -C` into it. On 1 Oct `git -C` into a non-worktree folder switched the MAIN checkout to train (fixed). Main has no node_modules yet.
- Only the "Ashbridge Test" Chrome, one walker at a time, window on screen. Tab group can vanish: list_connected_browsers, select or switch_browser. Zo (1 Oct): "connected. send a request again if connection needed again": walkers may run switch_browser again and wait up to 10 minutes; no to-do item for reconnects. iFirm host ashbridge.cchifirm.ca. Imports: no native picker; walkers stage made-up files by script on (Test) returns (decision 0016 Z16-3); quote it in the walker prompt.
- Taking a helper branch: only the files in `git diff --name-only $(git merge-base main B) B`; for plan/slices.json use `git merge-file` (ours, base, theirs).
- Always `git add plan/ledger.jsonl` before `git pull --rebase`. Cloud workers sometimes push reports straight to main: pull before pushing.
- Findings review before every fix round; aim for two rounds. Cold sign-off for big chunks only.
- RemoteTrigger `run` answers are large: fire runs only when jobs wait.
- Push guard: only plan/, reviews/, decisions/, reference/, blueprint/, reports/, CLAUDE.md, README.md and .claude/ straight to main. Code only through a green train.
- Another Lead works in ashbridge-app. Read-only there.
- Edit files with the Edit tool for anything with backslashes.
