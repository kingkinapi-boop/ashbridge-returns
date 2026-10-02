# NOW

True at every moment. 60 lines max. Last rewritten: 2 Oct 2026 02:37Z by the Lead. Times are UTC from `date -u`.

## State

- **Mode: turbo** (Zo 2 Oct ~02:00Z "turbo on", decision 0018, after the Reviewer SLOW of 01:50Z, reviews/REVIEW.md). Wind-down Fri 9 Oct 18:00 Toronto. The Reviewer HOLD stands: nothing using money.ts, ids.ts or the clock lands until card F00T lands.
- **Workers:** cloud routine trig_01MWQ7hW5yecn8VaiMTq1xbp (RemoteTrigger `run`; runs cannot notify: poll claims, ScheduleWakeup ~30 min). Queue repair 3 landed 2 Oct 03:15Z: sign-off conditions met, up to 6 cloud runs. Laptop: the Lead, 2 local queue workers (0018), one Chrome walker, helpers.
- **Zo:** to-do has no open question. Day 4 (Auto-fill, Zo) Sat 3 Oct. Decisions 0016 to 0018 today.
- **Landed:** F00, F05, F08, DG round 1, queue repairs 1 to 3. Train A05 + W14 requested (fbe5c4b). Day 5 of the trial done; to-do #1 red (pasted diagnostics, T05 waits).

## In flight

| Card | Role | Where | Started | Branch |
|---|---|---|---|---|
| Cloud queue: builds TH, W14 (r3), DG (r2, R22), A05 check (r2, released by hand) | 2 cloud runs | cloud | 2 Oct 02:40Z | claude/<card> |
| Local queue workers: F03 build (r2), F09 build (r3) | 2 workers (0018) | local worktrees | 2 Oct 02:05Z | claude/F03, claude/F09 |
| Clauses and cards from day 5 (RULE-2, RT-1, RT-2, RT-7, RT-14/15, RT-17; F03 apostrophe on inputs) | Opus helper | local worktree | 2 Oct 03:20Z | claude/clauses-day5 |
| Queue repair 3: gap fixed (b8d5847); checker re-verifying, then local train | checker | local worktree | 2 Oct 02:30Z | claude/queue-repair-3 |
| Design sitting served at http://localhost:8765/ (python http.server from scratchpad/sitting, started by the bundle helper; restart with `python -m http.server 8765` in that folder) | none | local | 2 Oct 03:45Z | to-do #1 |

F05M check PASS but waits on F00T (Reviewer HOLD). F00T queued.

## Next, in order

1. Reviewer SLOW fixes first: F00T card (core tests by a spec job, seeded; HOLD on money/ids/clock users), per-file mutation break 100 on `@mutate` files (DG), F09 and TH ahead of everything. Fix the metrics tokens and minutes (real numbers, or "unknown" with a note).
2. Queue repair 3: after the gap fix, local train (skill merge: rebuild on main, code-diff guard), land, then widen to 6 cloud runs.
3. Checks and trains: board each PASS card (scope, GitHub checks, security review if tagged) into a train via plan/train.json; E03 boards only after TH (gitleaks).
4. Findings: W14 round 2 report, then cards. F01 waits on F09; F09A after F09.
5. Taxprep: day 5 DONE (159 of 159 cells back, 156 exact, 3 apostrophe negatives; no diagnostics page; no token cell; import adds copies; FINDINGS interim 979363f). Next: day 6 Sun 4 Oct (changes after lock, check export, roll forward); day 4 Zo Sat 3 Oct. Chrome is free tonight.
6. Designs: all four round 2 DONE. Sitting bundle assembling; publish as a private Artifact and add one to-do line (Zo answers Q1 to Q6 in chat). Then D00, D01, D05.
7. B01 can be specced (reference/qbo/gfi-file.md, A305). W16 card to write (W14 KNOWN R8 fails on 03, 04, 07, 08, 10).

## Watch out

- Landing a train: MERGE origin/main into the train (never rebase --rebase-merges: it replays card history and stops midway), run the code-diff guard, then ff main. Record done, release claims and delete branches only AFTER the push to main succeeded.
- Only the "Ashbridge Test" Chrome (browser 8f110f0a), one walker at a time, window in front. QBO and iFirm sign out after a while: a walker that meets a sign-in page stops; ask Zo in the to-do. Walkers never type passwords.
- Taking a helper branch: only the files in `git diff --name-only $(git merge-base main B) B`; plan/slices.json by `git merge-file`.
- Always `git add plan/ledger.jsonl` before `git pull --rebase`; never `git stash` (shared stack).
- Subagents cannot write report files: record their text under reports/ yourself.
- Findings review before every fix round (a single-cause gap may go straight back, A306); aim for two rounds; a third failure parks or splits the card.
- Push guard: only plan/, reviews/, decisions/, reference/, blueprint/, reports/, CLAUDE.md, README.md, .claude/ straight to main. design/ and code only through a branch or train.
- Never kill processes by name. Another Lead works in ashbridge-app: read-only there.
