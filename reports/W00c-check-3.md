# W00c mutation-only check (build 75556283, branch claude/W00c) - RELEASED (not finished)

Checker: cloud-6593f9 (Sonnet 5.5). 3 Oct 2026. Node 24.21.0 (tarball; nvm install gave nothing). No result: no mutation score was produced, so nothing is claimed about the 11 files.

## What ran
- Pass 1 overlay (scratch, deleted after): vitest.scratch.mjs = mergeConfig(vitest.mutate.config.ts, { test: { testTimeout: 120000, hookTimeout: 120000, exclude: the 12 heavy files } }); stryker.scratch.mjs = base config with that vitest file, own incrementalFile, own jsonReporter file, dryRunTimeoutMinutes 90.
- Overlay run alone: 132 files, 3737 tests pass in 62 s.
- Stryker pass 1, all 11 files: 3170 mutants; dry run succeeded in 11 min 57 s (1128 tests, perTest coverage).
- Mutation phase then ran 1 h 10 min with no result (the clear-text reporter prints only at the end, and the incremental file is written only at the end). Stryker warned: 1183 static mutants (38% of total) estimated to take 64% of the run time. I killed my own Stryker process (pid 2780) at 21:39Z.

## Why it did not finish
Static mutants rerun the whole included suite (about 100 s plus per mutant): 1183 x ~100 s / 4 workers is roughly 8 h on this 4-core box for them alone. One session cannot finish pass 1.

## Recommendation (Lead)
- Shard pass 1 by mutated file across boxes (3 to 4 boxes, --mutate one or two files each), and run Stryker with a progress reporter ("progress" or "dots") so a stalled run is visible.
- Not used: ignoreStatic (it would exempt mutants; the directive says nothing exempted). Needs your ruling if you want it.
- Planted-survivor merge test and mutate:canary were not reached.

## Permission gaps
None. Model: Sonnet 5.5 (no Opus read needed for a mutation-only check).
