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
| Design fix round 2: queues-record, workbench (builds design/parts/cite-or-reason/), cpa-review V1 (V1 to V8 from claude/design-verify 1f3fdda) | 3 designers | local worktrees | 2 Oct 00:45Z | claude/design-*-2 |
| Checks of F01, F05, F08, F09 (builds reported; F01 and F09 note spec defects); F03 re-spec | 3 cloud runs | cloud | 2 Oct 03:35Z | claude/<card> |
| Queue repair 3 build (reopened build re-offers check; next.mjs reads spec claims; async tools tests A247; shellProblems A253; parked-dep check test) | builder | local worktree | 2 Oct 03:00Z | claude/queue-repair-3 |

All four design fix rounds done: claude/design-queues-record-2, -workbench-2, -cpa-review-2 (V1), -source-viewer-2 (aa385a2; A251). Re-test in flight.

## Next, in order

1. Queue repair 2 LANDED (ed9435b, A247: vitest RPC timeout noise to fix in the next queue repair; dispatch skill line 40 should name `update <card> spec reopened --worker lead`; add a test that a check on a card with a parked dep still flows; a reopened build must reset its check, today the Lead releases the check by hand).
2. F00 LANDED 5a70f12. Cold sign-off SIGNED OFF (reports/signoff-rehearsal.md) with conditions before going past 3 runs: (1) F03 and S00 specs reopened, done; (2) queue repair 3 (in flight: build, then check by another helper, then local train); (3) merge skill land step rewritten (rebase on main plus code-diff guard), done. Widen to 6 runs when queue repair 3 lands. Soon after: mutation score drift (74.43 vs 75.00 same code), dispatch skill vs decision 0010, metrics tokens and minutes.
3. Spec refits reopened 2 Oct: F01, F09, W14 (fix rounds in cards; reports/findings-W14-D01.md). After TH lands: D01 re-check, W00, D00, F04 refits; W15 re-spec after W14 spec; F08 validate. F03 and S00 re-specs reopened. New card TH (test homes) is in the queue.
4. Phase 2: reviewed and fixed (reports/review-phase2.md, A234 to A246; red 1 settled as amber A245, RT-25 changed, CPA check item 33). Specs wait on S03 (FINDINGS final). Next design: D05 brief with Ready and the clear.
5. Day 5: imports 01 to 07 done by script; exports and the 02 print (counter 96, file never arrived) blocked, window hidden. On Zo's "2 done": walker retries exports for 01 to 07, creates and imports 08 to 10, diagnostics 06, 07, then 5D. Then "After day 5" helper.
6. .GFI: Accountant view reached (firm "Ashbridge Tax"); path Your books > Workpapers > Books to tax actions > Export GIFI file; header-only file (blank books). To-do #1: made-up accounts in the firm books (red: firm data) or Zo exports one (shape only). Then gfi-file.md and B01 spec.
7. Designs: queues-record round 2 DONE (4acc091; 118 of 118 V checks; Q8 open for Zo; note: V2 must click by mouse, Playwright auto-scroll hides page moves: fix design/verify/rules.mjs on claude/design-verify before the sitting). Fix round 2 running for workbench and cpa-review; the source viewer round starts when workbench pushes its shared cite-or-reason part (its fixes 1 to 3 per reports/findings-designs-2.md). Then re-walk and V1 to V8 on all four, then the sitting page for Zo (Artifact, private) about 3 Oct. Then D00, D01, D05. claude/design-verify is merged into each design branch (design/ cannot go straight to main).

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
