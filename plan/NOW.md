# NOW

True at every moment. 60 lines max. Last rewritten: 1 Oct 2026, evening, by the Lead at handover (Zo's `handover`).

## State

- **Mode: turbo** since 1 Oct (decision 0009). Wind-down Fri 9 Oct 18:00 Toronto. Plan use at 19:32Z: 5h 35%, week 9%.
- **Cloud workers:** fire the routine trig_01MWQ7hW5yecn8VaiMTq1xbp with RemoteTrigger `run` (decision 0010: one-off runs, never a schedule). Its prompt only points at `.claude/cloud-worker-run.md`: edit that file, not the routine. Runs cannot notify the Lead: poll `list_runs` and `node tools/claim.mjs list` (ScheduleWakeup about 30 min). Keep at most 3 runs until F00 lands through a train and a cold sign-off covers the repairs and the rehearsal.
- **Zo:** reads only the to-do; no small questions (decision 0014, in CLAUDE.md). Decisions 0010 to 0014 hold today's answers. CPA check of the 32 tax rules done ("cpa ok", 0012).
- **Phases:** 0 and 1 fully carded and independently reviewed; phase 2 cards wait for the trial findings (now interim in `reference/taxprep/FINDINGS.md`).

## In flight (background helpers of the old session may still finish; read their branches)

| Card | Role | Where | Started | Branch |
|---|---|---|---|---|
| F00 fix round 2 build (spec reported; build reopened) + W14/D01 specs | 2 cloud runs | cloud | 1 Oct 19:40Z | claude/F00 |
| queue repair 2 (dep gate, spec reopen): built 23 of 23; check running | checker (local) | local | 1 Oct | claude/queue-repair-2 |
| Trial day 5 run 5A (clients 01 to 05; then 5B, 5C, 5D one at a time) | Sonnet walker, Chrome | local | 1 Oct 20:00Z | notes in reference/taxprep/2026-10-05-day5/, uncommitted |
| Phase 2 cards draft (M00 T01 T02 T04 T05 T07 V06 V12 N00) | Opus helper | local worktree | 1 Oct 19:47Z | claude/cards-phase2 |
| design fix round: cpa-review V1 | designer | local | 1 Oct | claude/design-cpa-review-2 |
| design fix round: source viewer D03 | designer | local | 1 Oct | claude/design-source-viewer-2 |

Done and on branches, not yet re-tested: claude/design-queues-record-2, claude/design-workbench-2 (fix rounds applied, check numbers in their reports).

## Next, in order

1. Trial day 3 landed partial (610666f). Not done: dividend designation (S3/S53), Schedule 23 on the Eglinton pair, Eglinton diagnostics, "Track changes" export, print "More options", whether diagnostics print. The iFirm tab group vanished mid-run: next walker re-establishes it (to-do item if it cannot). Fold these into day 4 planning (item 6).
2. Queue repair 2: read `reports/queue-repair-2-check.md` on its branch; PASS: local train (skill merge; node_modules junction into `.claude/worktrees/train`, `node tools/heavy.mjs -- npx vitest run tools/test`), land, delete branches. FAIL: findings review first.
3. F00: when its round 2 spec is reported, `node tools/claim.mjs update F00 build reopened --worker lead`, fire a cloud run. Then check by a different worker, then a train in the cloud. F00 landing ends the rehearsal; then a cold sign-off (signoff.md) on the queue repairs and the rehearsal, then widen to 6 runs.
4. Re-specs: F03 and S00 were re-carded from the trial (any earlier spec void). Specs reported for F01, F04, F05, F08, F09, W00 wait on F00 being done (the dep gate).
5. .GFI: BLOCKED, to-do #1. The walker (1 Oct 19:50Z) found the Ashbridge Test Chrome signed in to the QBO sandbox company only, no Accountant view (reference/qbo/gfi-file.md). On Zo's "1 done": run the .GFI walker with decision 0013's limits (open the Accountant view, add "Probe Co. (Test)", five made-up accounts, Workpapers, save .GFI, delete the client; stop at any billing or subscription screen; never open a real client). Write `reference/qbo/gfi-file.md`; then card B01 can be specced.
6. Trial: scripts for days 4 to 6 are in plan/taxprep-trial-plan.md (ab6d58c). After each day 5 run an Opus helper reads the notes and adjusts the next run; then the "After day 5" helper. Earlier text: day 4 (Auto-fill, Zo only: tell him the day before in the to-do), day 5 (all ten companies), day 6 (changes after lock, check export). Open: Q23 token cell (ask nothing; FINDINGS.md lists the fallback); part A (rest of the 395 forms). Trial ends about 16 Oct.
7. Designs: re-test only the changed tasks on the four families (tester panel mode), then the sitting page for Zo (Artifact, private) with the six questions in reports/findings-designs.md (d), about 3 Oct. Cards D00 (basis) and D01 (map) are next design work.
8. Phase 2 cards from FINDINGS.md (M00 has no card file yet; its slices.json note says what it must hold), then an independent phase 2 review.

## Watch out

- Only the "Ashbridge Test" Chrome, one helper at a time, window on screen. If the extension drops it may reconnect to Zo's other Chrome: run `switch_browser` so Zo picks it. iFirm stops drawing when hidden; QuickBooks does not. Imports through the file picker only (a JS-staged import was blocked). Downloads land in `C:\Users\User\Downloads`; walkers copy only their own files to `C:\Users\User\Documents\taxprep-trial\inbox`.
- Taking a helper branch: only the files in `git diff --name-only $(git merge-base main B) B`; for plan/slices.json use `git merge-file` (ours, base, theirs) so the Lead's edits on main survive.
- Always `git add plan/ledger.jsonl` before `git pull --rebase` (the budget hook writes it). Cloud workers sometimes push reports straight to main: pull before pushing.
- Findings review before every fix round; aim for two rounds. Cold sign-off for big chunks only.
- RemoteTrigger `run` answers are large: fire runs only when jobs wait.
- The push guard lets only plan/, reviews/, decisions/, reference/, blueprint/, reports/, CLAUDE.md, README.md and .claude/ go straight to main. Code only through a green train.
- Another Lead works in ashbridge-app (it messaged once; told it the repos are separate). Read-only there.
- Edit files with the Edit tool for anything with backslashes; Python heredocs mangle `\U` and `\t`.
