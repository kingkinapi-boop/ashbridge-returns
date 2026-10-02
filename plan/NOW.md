# NOW

True at every moment. 60 lines max. Last rewritten: 2 Oct 2026 02:10Z (22:10 Toronto, 1 Oct) by the Lead. Times are UTC from `date -u`.

## State

- **Mode: turbo** (Zo 2 Oct ~02:00Z "turbo on", decision 0018, after the Reviewer SLOW of 01:50Z, reviews/REVIEW.md). Wind-down Fri 9 Oct 18:00 Toronto. The Reviewer HOLD stands: nothing using money.ts, ids.ts or the clock lands until card F00T lands.
- **Workers:** cloud routine trig_01MWQ7hW5yecn8VaiMTq1xbp (RemoteTrigger `run`; runs cannot notify: poll claims, ScheduleWakeup ~30 min). Up to 3 cloud runs until queue repair 3 lands (sign-off condition), then 6. Laptop: the Lead, 2 local queue workers (0018), one Chrome walker, helpers.
- **Zo:** to-do has no open question. Day 4 (Auto-fill, Zo) Sat 3 Oct. Decisions 0016 to 0018 today.
- **Landed:** F00, F05, F08, queue repairs 1 and 2. Phase 2 carded and reviewed.

## In flight

| Card | Role | Where | Started | Branch |
|---|---|---|---|---|
| Cloud queue: checks A05 (r2), DG, F05M; builds F09 (r3), F03 (r2); specs TH (refit), E03 (r2) | up to 3 cloud runs | cloud | 2 Oct 01:35Z | claude/<card> |
| 2 local queue workers (0018) | worker | local worktrees | 2 Oct 02:05Z | claude/<card> |
| Taxprep day 5 exports retry 2 (iFirm signed in by Zo) | Sonnet walker, Chrome 8f110f0a | local | 2 Oct 01:55Z | notes uncommitted |
| Findings review W14 round 2 | Opus findings reviewer | local | 2 Oct 01:40Z | text report |
| Cards for the Reviewer SLOW (F00T, per-file mutation break on DG, egress test gaps on TH) | Opus helper | local worktree | 2 Oct 02:05Z | claude/cards-review-slow |
| Queue repair 3: one check gap (item 3) plus worker.md --validated (A306), then local train | builder | local worktree | 2 Oct 01:30Z | claude/queue-repair-3 |
| Design fix round 2: source viewer | designer | local worktree | 2 Oct 00:45Z | claude/design-source-viewer-2 |

## Next, in order

1. Reviewer SLOW fixes first: F00T card (core tests by a spec job, seeded; HOLD on money/ids/clock users), per-file mutation break 100 on `@mutate` files (DG), F09 and TH ahead of everything. Fix the metrics tokens and minutes (real numbers, or "unknown" with a note).
2. Queue repair 3: after the gap fix, local train (skill merge: rebuild on main, code-diff guard), land, then widen to 6 cloud runs.
3. Checks and trains: board each PASS card (scope, GitHub checks, security review if tagged) into a train via plan/train.json; E03 boards only after TH (gitleaks).
4. Findings: W14 round 2 report, then cards. F01 waits on F09; F09A after F09.
5. Taxprep: day 5 retry 2 report; then the "After day 5" helper; day 6 Sun 4 Oct; day 4 Zo Sat 3 Oct.
6. Designs: source viewer round 2 report, then the sitting page for Zo (Artifact, private) with the six questions (reports/findings-designs.md d) and the "For Zo" list (reports/findings-designs-2.md); about 3 Oct. Then D00, D01, D05.
7. B01 can be specced (reference/qbo/gfi-file.md, A305). W16 card to write (W14 KNOWN R8 fails on 03, 04, 07, 08, 10).

## Watch out

- Train worktree: `git worktree add -B train .claude/worktrees/train origin/main` BEFORE any `git -C` into it (1 Oct a `git -C` into a plain folder switched the main checkout).
- Only the "Ashbridge Test" Chrome (browser 8f110f0a), one walker at a time, window in front. QBO and iFirm sign out after a while: a walker that meets a sign-in page stops; ask Zo in the to-do. Walkers never type passwords.
- Taking a helper branch: only the files in `git diff --name-only $(git merge-base main B) B`; plan/slices.json by `git merge-file`.
- Always `git add plan/ledger.jsonl` before `git pull --rebase`; never `git stash` (shared stack).
- Subagents cannot write report files: record their text under reports/ yourself.
- Findings review before every fix round (a single-cause gap may go straight back, A306); aim for two rounds; a third failure parks or splits the card.
- Push guard: only plan/, reviews/, decisions/, reference/, blueprint/, reports/, CLAUDE.md, README.md, .claude/ straight to main. design/ and code only through a branch or train.
- Never kill processes by name. Another Lead works in ashbridge-app: read-only there.
