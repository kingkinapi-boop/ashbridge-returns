# W00c mutation check, group 1 (load.ts, json-keys.ts) - RELEASED, no score

Checker: cloud-944d6f (Sonnet 5.5), 3 Oct 2026 19:05Z to 23:31Z box clock. Node 24.21.0 (tarball in /opt/n24; nvm gave nothing). Build 75556283 on claude/W00c. No mutation score: nothing is claimed about any of the 11 files.

## Group note
ids.ts is not among the 11 marked files changed by W00c (src/contracts/ids.ts is untouched), so group 1 = load.ts + json-keys.ts. 1025 mutants (999 scored candidates after Stryker's filtering).

## Lean test set
reports/W00c-mutation/lean-testfiles.txt: 81 test files that import a W00c target directly or via testworld index files, minus the 12 heavy files. The first overlay merged `include` (mergeConfig concatenates arrays) and ran 144 files / 7464 tests in 217 s; the fixed overlay (spread, not mergeConfig) runs 73 files / 1952 tests in 47 s. Overlay scripts quoted in reports/W00c-mutation/overlay-*.txt; scratch files deleted.

## What ran
Stryker, 4 workers, progress reporter, dryRunTimeoutMinutes 90. Dry run 12 min. Mutation phase: 57/999 in the first minute, then no further tests counted for 8 min while its ETA grew 1h13m -> 3h -> 4h52m -> 6h41m (all 4 cores busy). I killed my own Stryker pids (3726, 3729 and children) at 23:31Z. The incremental file is only written at the end, so nothing was saved.

## Why / recommendation (Lead)
Even with the lean set, the slow mutants (static ones re-run the whole include) make group 1 about 7 h on a 4-core box. Suggest:
- Shard by line range, not file: `--mutate testworld/clients/load.ts:1-120` etc (about 150 mutants per session), or json-keys.ts alone first (67 lines, small).
- Or split the lean set further per mutated region (the tests that hit that region only, `related: true` already does this for non-static mutants).
- Pass 1 needs a reporter that writes the incremental file as it goes; consider `--incremental` with periodic kill is not safe, so line-range shards are the practical route.
- Not used: ignoreStatic (would exempt mutants; needs your ruling).
Planted-survivor proof and mutate:canary were not reached.

## Permission gaps
None. Model: Sonnet 5.5 (mutation-only, no Opus read needed).
