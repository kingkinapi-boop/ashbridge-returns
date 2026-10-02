# NOW

True at every moment. 60 lines max. Last rewritten: 2 Oct 2026 15:50Z by the Lead (loop). Times are UTC from `date -u`.

## State

- **Mode: turbo** (Zo, 15:30Z, to-do #1; after the Reviewer SLOW of 14:40Z). First: FX1 and F01C land, then CQ1, cards ahead, W kinds. Wind-down Fri 9 Oct 18:00 Toronto. Blueprint v1.2 (status.mjs prints v1.1 until CQ1).
- **Workers:** cloud routine trig_01MWQ7hW5yecn8VaiMTq1xbp (RemoteTrigger `run`). Running now: A07 build round 2 (cloud-575f8d). Laptop: none running (2 allowed, 0018; node_modules now installed in the main checkout).
- **Landed (21):** F00, F05, F08, DG rounds, A05, W14, W15, F03, F00T, F05M, F09, TH, F03R, D01, DG, DG2, D00, F09B (with F09A's work), E03, F04, queue repairs.
- **Zo's answers today:** decision 0020 (design sitting 1 accepted, viewer B by the Lead A358, his logo, CRA walks off git with data-free copies in reference/cra/).

## In flight

| Card | Role | Where | Started | Branch |
|---|---|---|---|---|
| Train: FX1, G01, D00L, CQ1 (head 474512d) | train check | cloud | 2 Oct 15:50Z | claude/train |
| F01C check (core); A07B build | cloud runs | cloud | 2 Oct 15:35Z | claude/F01C, claude/A07B |
| Queue: E03A build (gitleaks hit on its branch), W00a build (spec reported, 663 tests), F02, F07, A06 builds wait on F01C | cloud runs | cloud | 2 Oct 15:50Z | claude/<card> |

Splits today: F09A to F09B (landed), F01 to F01C, W00 to W00a and W00b, A07 to A07B. G12 to G17 parked until E03A lands. W00b branches from claude/W00a after W00a's build.

## Ready for the next runs (in this order once dispatch is allowed)

1. FX1 spec, build, check (cold-tool timeouts; every train can flake until it lands).
2. F01C check (core, Opus read; build reported, 1 unrelated fail = the Node-22 Windows-1252 test W00 owns).
3. Train: FX1, G01, D00L, then F01C; land; set mode turbo (Zo's rule) and write the decision.
4. W00 round 3: check failed again (SEC-11 guard holes, roll check gaps, reports/W00-check.md on claude/W00). Findings review first (Opus); a third failure parks or splits. S00, W01 to W13, JH0 wait on W00.
5. E03A check (core; Schedule 8 line refs 203 and 207 from memory: Opus confirms). W02 to W05 builds wait on W00.
6. A01 build round 3 and BL0 build wait on F01C. A03, G10, G11 builds.

## Lead work that needs no dispatch

- At the E03A landing: unpark G12 to G17 (parked so the queue stops offering them). CQ1 card: claim.mjs never re-offers a build after a PASS or a landing (F04), skips cards whose deps cannot start (G12 picked 7 times, U00 6, D02 5), and status.mjs reads the blueprint version.
- Write cards T08, Q00, Q01, I01, I30, I40 (queue depth; Reviewer).
- Design lane: fix cards from reports/design-retest-2026-10-01.md (Q1 to Q8) into the approved versions; D cards then copy them into design/screens/ (A352).
- Metrics lines carry tokens and minutes, and "rounds" means build rounds (merge skill).
- scope.mjs DG flags e480b61, a DG2 commit that reached claude/DG through main: a false alarm.

## Watch out

- Landing: never `rebase --rebase-merges` a train; merge main in; push local main first so the ff works. Pushing a train straight to main is refused.
- After a spec fix reports, reopen the held build (`update <card> build reopened --worker lead`) or the queue stays empty.
- Findings reports: record helpers' text under reports/ yourself. Findings review before every fix round; a single-cause gap may go straight back (A306); a third failure parks or splits (F09A to F09B, F01 to F01C).
- Never weaken redaction, permissions or security checks to pass a test (A329).
- No real client data: Assets/ (Zo's CRA walks) is excluded from git (.git/info/exclude); never commit it.
- Only the "Ashbridge Test" Chrome (browser 8f110f0a), one walker at a time, window visible.
- Always `git add plan/ledger.jsonl` before `git pull --rebase`; never `git stash`, never `git add -A`. Critic and Reviewer sessions commit to main too.
- Push guard: only plan/, reviews/, decisions/, reference/, blueprint/, reports/, CLAUDE.md, README.md, .claude/ straight to main.
- Never kill processes by name. Another Lead works in ashbridge-app: read-only there.
