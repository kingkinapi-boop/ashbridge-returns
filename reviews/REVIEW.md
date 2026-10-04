# Review, 3 Oct 2026 13:15Z

Verdict: SLOW

1. 33 cards landed since yesterday (54 on main); tested clauses 45 to 71 of 198. Main green; blueprint, data and secrets clean.
2. I lowered turbo to normal: the queue is starving (2 cards ready to build, 10 wanted; most wait on the test-world card W00c) and AI runner tests passed only on one date. Today is past normal's cap, so no new worker starts before midnight UTC (8 pm Toronto).
3. Waiting costs little (the allowance, not the clock, binds). Type `turbo on` in the Lead chat once the Lead says findings 1, 2, 5 and 8 are done (file edits only).

## Needs Zo

Nothing.

## Findings

1. [verified] `next.mjs 12`: 2 spec'd startable (FX8, SC11). Held though their wait is met: SC6, FX3 specs (SC landed 10:49Z), SC8 build. FX5 passed but missed the 12:35Z train. Lead: reopen, board.
2. [verified] Third-round rule bent: A04 is in "round 5c" (A469, A474): 6 builds, 4 failed checks, a red train since my last review. DB16 landed after 5 builds (A441). Lead: split A04 now; lettered rounds count.
3. [verified] Flaky: 7 A04 tests passed its check, failed on train 25ea2736 when the date rolled (A468).
4. [verified] Local workers reuse names local-1 to 3: local-3 spec'd and checked CQ3; local-2 spec'd and built FX2 (likely different sessions [inferred]). Lead: a fresh name per dispatch; claim.mjs refuses a check to any earlier spec or build name.
5. [verified] Red train reports 20261003-1103 and -1221 are on no branch. Lead: copy red reports to main before rebuilding.
6. [verified] Main red about 28 min (10:49Z to 11:17Z): card edits (A449, A452) broke SC's R18; the landing guard skips plan/. Lead: run `tools/test` after bringing in main.
7. [verified] Sampled G15, F07, DB16 pass B1, C1 and scope. Weaker: G15 never reads the test world (Maple Ridge 01-F02, 01-F04 get no question); F07's extra `tax_year_missing` (inside END-1) is untested; DB16 checked by Sonnet, not Opus. 3 of 5 random tests weak (expenses:114 passes on zero items; blank-rule:407, jobs:52 read code text). Lead: `expect.hasAssertions()` in setup; a G-family rule over sample findings.
8. [verified] NOW.md stale: SC6 twice; CQ6, FX5 "build open"; Next lists landed FX2, DB16. Lead.
9. [verified] For the Critic's CQ card: 33 of 33 metrics lines lack tokens and minutes, train_fails always 0; next.mjs offers FX15 a spec though it rides the train.

Biggest waste: 191 of 241 releases were empty pickups (deps not landed, wrong offers, local workers skipping cloud-only jobs); about 30 cloud runs produced nothing. Fix: never offer held or cloud-only jobs wrongly.

Proposed (on "apply"): REVIEWER.md C2 says two parts (0022); the hook counts the day's cap from a SLOW, so SLOW slows, not stops.

## Numbers

Since 14:28Z yesterday: 33 merged; 5 cards at 3+ builds; 29 failed-check lines; trains 14 (2 red); dispatches 252 (2 Oct), 195 (3 Oct to 12:50Z); about 110 ambers; open reds 0.

## Applied (Zo said "apply all", 3 Oct 13:22Z)

- Budget hook and modes skill: mode.json `cap_from` (now 13:15Z); the day's cap counts from a lowering, so normal has its 40 from the SLOW.
- REVIEWER.md: TODO-ZO has two parts; a SLOW sets `cap_from`.
- Dispatch skill, worker.md: a new local worker name per dispatch; lettered and "final" rounds count as rounds.
- Merge skill: run `tools/test` on the train after bringing in main (the Lead added the red-report copy, A477).
- testing.md: a loop asserts its list is not empty; a source-scan test needs a behaviour twin.

Lead, still open: claim.mjs refuses a check to an earlier spec or build name, metrics fields, next.mjs offers (the Critic's CQ card); `expect.hasAssertions()` in the vitest setup and a G-family rule over sample findings (cards); NOW.md true. Findings 1, 2 and 5 are in hand (A477).
