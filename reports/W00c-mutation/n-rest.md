# W00c mutation, pass 1a, the other 9 targets (cloud-ee5eef, 4 Oct)

Method (A538): one Stryker run per target, `--testFiles` = the test files that import the target (git grep; lists in n-<file>.testfiles.txt), related true, 30 s vitest timeout in a scratch overlay, timeoutMS 10000, factor 1.5, own incrementalFile and jsonReporter per run. Scratch overlays deleted. Node 24.21.0. Every run was far under T; no stall, no rate stop.

| File | dry run (tests, net ms, overhead ms) | T ms | killed | timeout | survived | no cov | ignored | score (1a only) |
|---|---|---|---|---|---|---|---|---|
| guard.ts | 35, 28, 510 | 10552 | 227 | 1 | 0 | 0 | 21 | 100 |
| money.ts | 124, 4144, 1345 | 17560 | 112 | 0 | 0 | 0 | 4 | 100 |
| kinds.ts | 28, 144, 715 | 10931 | 50 | 0 | 0 | 0 | 0 | 100 |
| faults.ts | 415, 20271, 1723 | 42135 | 921 | 0 | 0 | 0 | 0 | 100 |
| checks.ts | 109, 554, 1202 | 12033 | 588 | 1 | 74 | 32 | 0 | 84.75 |
| schema.ts | 72, 4901, 865 | 18216 | 49 | 0 | 0 | 0 | 8 | 100 |
| generate.ts | 9, 2478, 611 | 14328 | 45 | 1 | 0 | 0 | 4 | 100 |
| testworld/model/index.ts | 1656 (related pulled in the whole set), 92265, 1669 | n/a | 0 | 0 | 0 | 0 | 0 | n/a: 0 mutants |
| testworld/index.ts | 248, 13862, 1345 | n/a | 0 | 0 | 0 | 0 | 0 | n/a: 0 mutants |

**RC-M2 (for the Lead):** both index.ts files are pure re-exports and produce 0 mutants; they are not a pass. The Lead rules whether `// @mutate` stays on them.
**Ignored mutants:** guard 21, money 4, generate 4, schema 8 are Stryker-ignored (source disable comments or config); they are not scored here. The Lead checks that each carries a reasoned disable (A515); not verified in this pass.
**Honesty check (Timeouts):** guard.ts:15 UpdateOperator (loop update `i++`) and checks.ts:159 UpdateOperator (the for-loop update in yearMonths): loop updates, counted as detected. generate.ts:33 ArrayDeclaration `[]`: NOT on a loop; re-run in 1b, not counted as detected from 1a.
**checks.ts:** 106 survivors and no-coverage lines (74 + 32) are in n-checks-survivors.txt (line, mutator, status) for pass 1b: its lean set here was only 8 files; 1b runs them against the lean set, then A521's heavy pairs.
Only the merged union is the score. Mutation JSON: n-<file>.json.
Not done: pass 1b (load.ts 314 and checks.ts 106 survivors, generate.ts:33), the heavy-pair cascade, merge, planted-survivor proof, mutate:canary, PASS or FAIL.
Permission gaps: none. Model: Sonnet 5.5.
