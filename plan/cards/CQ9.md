# CQ9 Mutation gate: long dry runs and extra Stryker arguments

Phase 0. Size S. Deps: CQ6. Where: local or cloud.
Tags: none (queue tooling).
Paths: stryker.config.mjs, tools/mutate-changed.mjs, tools/test/mutate-args.test.mjs
Clauses: ARC-15
Read: `reports/W00c-findings-3.md` on claude/W00c (mutation step), `tools/mutate-changed.mjs`.
Spec commit: (spec-writer fills)

## Goal
W00c's Stryker dry run needs more than 5 minutes on 2845 mutants (11 files, 6858 unit tests), so the mutation step could not run (A450). The bar stays 100 per `@mutate` file.

## Spec
- `stryker.config.mjs` sets `dryRunTimeoutMinutes` from data (45) and `incremental` on.
- `mutate-changed.mjs <card> [base] -- <args>` passes extra arguments through to Stryker; planted: `--concurrency 4` reaches the command line.
- Scoring per file from `reports/mutation/mutation.json` is unchanged (Survived plus NoCoverage equal 0 per target).

## Build
The config and the pass-through; nothing else.

## Check
A checker who did neither: the new tests and every tools test pass; scope clean.

## Also (A460, reports/train-20261003 for 12af2528)
`mutate:changed <card>` for a core card whose Paths hold no product file under src/ (SC: tests, tools and fixtures only) prints "no product code to mutate" and exits 0, instead of exit 1. Planted: SC's Paths.

## Also (A464)
The mutation gate also covers family cards (A430): a card built from `plan/cards/families/<family>.md` is gated by its own Tags like any card. Planted: a family card tagged core with an unmarked src file.
