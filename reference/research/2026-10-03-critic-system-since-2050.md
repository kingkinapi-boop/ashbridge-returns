# System numbers since 2 Oct 20:50Z (read 3 Oct 12:40Z)

All [fact] (counted from the file named) unless marked.

## 1. Landed: 15 cards, 7 landings (`git log --first-parent main`, "Landed" commits)
- Product (7): A07C, A03, G17, A07D, A06, W16, FX2: 83 metrics jobs.
- Build-system (8): CQ2, CQ3, CQ4, CQ5, SC, SC4, FX10, DB16: 176 jobs.
- Share 32% vs 68% (W16 as build-system: 27% vs 73%). SC alone 86.
- Caveat: "jobs" counts every "working" claim line, heartbeats too (tools/metrics.mjs:46), over the card's whole life. Counting "reported" lines on the claims branch: product 43, build-system 49 (47% vs 53%).

## 2. Per card (plan/metrics.jsonl)
Rounds/jobs: A07C 12/20, A03 1/13, G17 1/4, A07D 4/8, A06 3/13, W16 2/12, FX2 4/13, CQ2 2/6, CQ3 1/9, CQ4 3/10, CQ5 1/5, SC4 1/15, SC 55/86, FX10 3/14, DB16 11/31. Total 104/259.
- check_fails and train_fails are 0 on all 15. Wrong: the claims branch has 9 "failed ... check" lines on 7 of them. metrics.mjs:44 counts "failed X build", :45 defaults train fails to 0. "Rounds" counts heartbeats too (SC: 55 claims, 2 reported builds).
- SC 86: 53 of 55 build claims released unfinished ("queue re-offers it, Lead must hold it"); no product code (reports/SC-build.md:3).
- DB16 31: two findings reviews: core-tagged harness code Stryker cannot reach, then pooled-session state leaking (reports/DB16-findings.md, -4).
- A07C 20: 2 failed checks; Opus found formula-slide, 1e21 number-text and snap-order defects (reports/A07C-check-r3.md).

## 3. Trains
8 checked: 6 green (2105, 0401, 0548, 0752, 1041, 1145), 2 red. Also 2045 green just before the window; df6f1249 requested now (plan/train.json).
- Red 1103 (DB16, FX15): SC rule R18 failed after Lead card edits; box refused pg_hba and mutate commands (AMBER A461, A462; lessons.md:43).
- Red 25ea2736 (A04, FX15, CQ7): 7 A04 tests fail since the date rolled, two clocks (A468).

## 4. Dispatches (plan/ledger.jsonl, 203 rows)
- 116 cloud RemoteTrigger runs; 87 Agent (51 local, 36 worktree). All allowed:true.
- Types: worker 33, findings-reviewer 29, general-purpose 18, scout 3, spec-writer 2, builder 1, other 1. Models: Opus 78, Sonnet 6, not recorded 119 (cloud).
- 18 rows on 2 Oct, 185 on 3 Oct. No dispatch 21:37Z to 03:21Z (345 min; cause not found; NOW.md:8 says RemoteTrigger works again 03:20Z).

## 5. Cards added (plan/slices.json)
315 at 9e3497fe, 351 now (+36). Not-done: 276 then, 297 now.
- Build-system 21: CQ3 to CQ9, SC5 to SC12, DB16, FX8, FX9, FX10, FX12, FX14.
- Product 15: V15, T13, T14, N19, W16, FX4, FX5, FX6, FX7, FX11, FX13, FX15 to FX18.
- AMBER rows A387 to A468: 82.

## 6. W00c
First spec claim 21:06Z 2 Oct: 15.5 hours. 7 spec reports, 2 build reports (02:27Z, 08:21Z), 2 failed checks (03:35Z, 08:59Z), 5 Opus dispatches. Title "(W00a split)"; W00b "(W00 split)". Now: spec job on A467 rows 2 and 11 since 12:24Z, build round 3 next, unlanded.

## 7. Biggest waste
The queue offers jobs that cannot run. 145 release commits in window: 15 "merged" cleanup, 63 notes start "wait:", 24 name a re-offer, 42 other. About 87 idle claims against 160 reports. CQ6 check was released 10+ times 11:45Z to 12:10Z. 10 of 12 re-offer notes read came after CQ3 landed (06:37Z). Runners-up: A04 (35 claims, 14 reports, 12 reopens, 11 Opus dispatches, unlanded); the 5.7 hour gap (36% of window).

## 8. Tokens and minutes
Keys in 14 of 56 metrics rows, non-zero in 3 (queue-repair-2 36867 tokens 15 min; DG 120 min; queue-repair-3 150 min). None on the 15 landed rows. metrics.mjs writes neither; CLAUDE.md:63 requires both.
