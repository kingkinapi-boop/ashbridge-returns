# NOW

True at every moment. 60 lines max. Last rewritten: 1 Oct 2026, about 20:40Z, by the Lead (session after `go`).

## State

- **Mode: turbo** since 1 Oct (decision 0009). Wind-down Fri 9 Oct 18:00 Toronto. Plan use at 19:32Z: 5h 35%, week 9%.
- **Cloud workers:** fire the routine trig_01MWQ7hW5yecn8VaiMTq1xbp with RemoteTrigger `run` (decision 0010: one-off runs, never a schedule). Its prompt only points at `.claude/cloud-worker-run.md`: edit that file, not the routine. Runs cannot notify the Lead: poll `list_runs` and `node tools/claim.mjs list` (ScheduleWakeup about 30 min). Keep at most 3 runs until F00 lands through a train and a cold sign-off covers the repairs and the rehearsal.
- **Zo:** reads only the to-do; no small questions (decision 0014). Open to-do: #1 QBO Accountant sign-in (blocks the .GFI and B01's spec), #2 import files by script in the trial (blocks day 5 imports). Day 4 (Auto-fill, Zo) set for Sat 3 Oct, told in the to-do.
- **Phases:** 0 and 1 carded and reviewed. Phase 2 carded 1 Oct (10 cards incl. new T12; ambers A203 to A227; reports/cards-phase2.md); all wait on S03, which waits for FINDINGS.md "final" (about 16 Oct).

## In flight

| Card | Role | Where | Started | Branch |
|---|---|---|---|---|
| F00 fix round 2 build + W14/D01 specs | 2 cloud runs cse_01QgZcxMeHrhwrAZY7pp1uXH, cse_01WjczEuvWH4dQTAwAjZ2ryZ | cloud | 1 Oct 19:40Z | claude/F00 |
| Queue repair 2: check PASS; train c9c4e88 built in .claude/worktrees/train; tools tests running (npx vitest@3, no node_modules on main until F00) | Lead | local | 1 Oct 20:30Z | train (local) |
| Trial day 5 run 5C (Eglinton pair, no imports) | Sonnet walker, Chrome | local | 1 Oct 20:35Z | notes in reference/taxprep/2026-10-05-day5/, uncommitted |
| Phase 2 card fixes (F03 apostrophe negatives, F07 client_ref, schedule family ids, T12 into J3 deps) + day 3 into FINDINGS.md | Opus helper | local worktree | 1 Oct 20:40Z | claude/phase2-fixes |
| design fix round: cpa-review V1 | designer (old session) | local | 1 Oct | claude/design-cpa-review-2 |
| design fix round: source viewer D03 | designer (old session) | local | 1 Oct | claude/design-source-viewer-2 |

Done and on branches, not yet re-tested: claude/design-queues-record-2, claude/design-workbench-2.

## Next, in order

1. Queue repair 2: if the tools tests pass on the train, land it (skill merge: ff main to train, push, delete claude/queue-repair-2, check-qr2 and the train), metrics line, NOW. Fail: findings review. Checker's minor notes: dispatch skill line 40 should name `update <card> spec reopened --worker lead`; no test that a check on a card with a parked dep still flows (add to a later queue card).
2. F00: when the cloud build reports, a check by a different worker (cloud run), then a train in the cloud (`check train full`). F00 landing ends the rehearsal; then a cold sign-off (signoff.md) on the queue repairs and the rehearsal, then widen to 6 runs.
3. Re-specs: F03 and S00 (re-carded from the trial). Specs reported for F01, F04, F05, F08, F09, W00 wait on F00 done (dep gate).
4. Phase 2: take claude/phase2-fixes (files by name; slices.json by merge-file), then an independent phase 2 card review (worker, not the drafter), cards fixed before any phase 2 spec.
5. Trial day 5: 5A created returns 02, 03, 04 (BN refused, left blank) but no imports (to-do #2). After 5C: 5D steps that need no import; on "2 yes" or "2 me": 5A steps 2 to 5, 5B, 5D imports. Then the "After day 5" helper. Day 6 Sun 4 Oct. Scripts in plan/taxprep-trial-plan.md.
6. .GFI: on Zo's "1 done", rerun the walker under decision 0013's limits; writes reference/qbo/gfi-file.md; then B01 spec.
7. Designs: when the two fix rounds report, re-test only the changed tasks on the four families (tester panel mode), then the sitting page for Zo (Artifact, private) with the six questions in reports/findings-designs.md (d), about 3 Oct. Then D00 and D01.

## Watch out

- Train worktree: create it with `git worktree add -B train .claude/worktrees/train origin/main` BEFORE any `git -C` into it. On 1 Oct `git -C` into a non-worktree folder switched the MAIN checkout to train (fixed). Main has no node_modules yet.
- Only the "Ashbridge Test" Chrome, one walker at a time, window on screen. Tab group can vanish: list_connected_browsers, select or switch_browser. iFirm host ashbridge.cchifirm.ca. Walkers cannot supply import files (no native picker; script staging blocked by the guard): to-do #2.
- Taking a helper branch: only the files in `git diff --name-only $(git merge-base main B) B`; for plan/slices.json use `git merge-file` (ours, base, theirs).
- Always `git add plan/ledger.jsonl` before `git pull --rebase`. Cloud workers sometimes push reports straight to main: pull before pushing.
- Findings review before every fix round; aim for two rounds. Cold sign-off for big chunks only.
- RemoteTrigger `run` answers are large: fire runs only when jobs wait.
- Push guard: only plan/, reviews/, decisions/, reference/, blueprint/, reports/, CLAUDE.md, README.md and .claude/ straight to main. Code only through a green train.
- Another Lead works in ashbridge-app. Read-only there.
- Edit files with the Edit tool for anything with backslashes.
