# NOW

True at every moment. 60 lines max. Last rewritten: 1 Oct 2026, about 20:40Z, by the Lead (session after `go`).

## State

- **Mode: turbo** (Zo again 2 Oct: "turbo on"). Wind-down Fri 9 Oct 18:00 Toronto. Local: the Lead, 2 queue workers (decision 0018), one Chrome walker, helpers.
- **Cloud workers:** fire the routine trig_01MWQ7hW5yecn8VaiMTq1xbp with RemoteTrigger `run` (decision 0010: one-off runs, never a schedule). Its prompt only points at `.claude/cloud-worker-run.md`: edit that file, not the routine. Runs cannot notify the Lead: poll `list_runs` and `node tools/claim.mjs list` (ScheduleWakeup about 30 min). Keep at most 3 runs until F00 lands through a train and a cold sign-off covers the repairs and the rehearsal.
- **Zo:** reads only the to-do; no small questions (decision 0014). No open to-do questions (decision 0016: 1 done, 2 yes, browser not QB Desktop). Day 4 (Auto-fill, Zo) set for Sat 3 Oct, told in the to-do.
- **Phases:** 0 and 1 carded and reviewed. Phase 2 carded 1 Oct (10 cards incl. new T12; ambers A203 to A227; reports/cards-phase2.md); all wait on S03, which waits for FINDINGS.md "final" (about 16 Oct).

## In flight

| Card | Role | Where | Started | Branch |
|---|---|---|---|---|
| Taxprep day 5 exports retry 2 (Zo signed in to iFirm, Z18-3) | Sonnet walker, Chrome 8f110f0a | local | 2 Oct 02:20Z | notes in reference/taxprep/2026-10-05-day5/, uncommitted |
| 2 local queue workers (decision 0018), up to 3 jobs each | worker | local worktrees | 2 Oct 02:20Z | claude/<card> |
| Findings review W14 round 2 (prior-year tax not derived; GIFI 2680 twice) | Opus findings reviewer | local | 2 Oct 02:05Z | text report |
| Cloud queue (3 runs, 01:30Z): builds A05, W14; specs TH (refit, A287), F03, E03 (round 2), F09 (round 3: checks 17, 18; amount grammar split to new card F09A, A296, A297); new DG, F05M, F09A | up to 3 cloud runs | cloud | 2 Oct 01:30Z | claude/<card> |
| Design fix round 2: source viewer (uses design/parts/cite-or-reason/) | designer | local worktree | 2 Oct 06:30Z | claude/design-source-viewer-2 |
| Queue repair 3: check found one gap (item 3 tested the label only); builder adds the test and worker.md --validated (A306), then local train | builder | local worktree | 2 Oct 02:45Z | claude/queue-repair-3 |

Design round 2 done: queues-record 4acc091, workbench 637215d (A286), cpa-review V1 fc3515f. Landed: F00, F05, F08. Findings reports: findings-W14-D01, findings-F01-F09, findings-E03-F03, A05-security.

## Next, in order

1. Queue repair 2 LANDED (ed9435b, A247: vitest RPC timeout noise to fix in the next queue repair; dispatch skill line 40 should name `update <card> spec reopened --worker lead`; add a test that a check on a card with a parked dep still flows; a reopened build must reset its check, today the Lead releases the check by hand).
2. Landed: F00 (5a70f12), F05 and F08 (affce00, train green, 2 Oct). A05: security CLEAN with 3 lows, fix round 2 (spec reopened; A267); gitleaks 13 hits are E03 catalogue lines on another branch, TH fixes the scan scope and allowlist. F01 and F09: build-side findings (reports/findings-F01-F09.md): hold their re-checks until both spec and build rounds 2 are done; order F09 then F01. Sign-off conditions: queue repair 3 still in flight, then widen to 6 runs.
3. Refit specs reported (validated on main 2cb2159): F09, A05, W14 (5 KNOWN R8 fails on 03,04,07,08,10: card W16 to write), F03, TH. F01 spec waits on F09 build (dep). After TH lands: D01 re-check, W00, D00, F04 refits; W15 re-spec on the W14 spec.
4. Phase 2: reviewed and fixed (reports/review-phase2.md, A234 to A246; red 1 settled as amber A245, RT-25 changed, CPA check item 33). Specs wait on S03 (FINDINGS final). Next design: D05 brief with Ready and the clear.
5. Chrome order tonight: .GFI walker (running), then day 5 exports retry (window in front, Z17-2): 5A steps 3 to 5 for 01 to 07, create and import 08 to 10 (script staging, Z16-3), diagnostics 06, 07, then 5D. Then the "After day 5" helper. Day 4 (Zo) Sat 3 Oct.
6. .GFI DONE 2 Oct (decision 0017, all undone): reference/qbo/gfi-file.md; B01 follows it (A305) and can be specced when its deps allow.
7. Designs: round 2 DONE for queues-record (4acc091), workbench (637215d; A286), cpa-review V1 (fc3515f; panel body may scroll inside while an error summary shows). Earlier: queues-record round 2 DONE (4acc091; 118 of 118 V checks; Q8 open for Zo; note: V2 must click by mouse, Playwright auto-scroll hides page moves: fix design/verify/rules.mjs on claude/design-verify before the sitting). Fix round 2 running for workbench and cpa-review; the source viewer round starts when workbench pushes its shared cite-or-reason part (its fixes 1 to 3 per reports/findings-designs-2.md). Then re-walk and V1 to V8 on all four, then the sitting page for Zo (Artifact, private) about 3 Oct. Then D00, D01, D05. claude/design-verify is merged into each design branch (design/ cannot go straight to main).

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
