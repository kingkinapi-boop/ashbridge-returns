# W00c check (fresh, build 75556283 + main merged, branch claude/W00c) - FAIL (mutation could not run)

Checker: cloud-f09ae7 (Sonnet 5.5). Date: 3 Oct 2026. Node 24.21.0. Postgres 16.14 (select version()).

## Passed
- typecheck, lint, deps:check clean. Main (train 2b) merged into the branch cleanly, no conflict.
- `npm test`: unit 171 files, 7958 tests pass; db (PGlite) 14 files, 662 pass, 1 expected fail, 5 skipped.
- `TEST_DB=pg16 npx vitest run --project db`: 14 files, 667 pass, 1 skipped (the PGlite-only case); "a test database is Postgres 16" passes, not skipped.
- `TEST_DB=pg16 npm run test:flake`: 5 of 5 ok.
- Spec files of the spec(W00c) commits: `git diff e1215472 HEAD` over them is empty.
- scope.mjs: SCOPE OK (85 files, all inside Paths; one note on faults-catalogue.json, superseded by 1b555ab, read by hand: fine).
- `npm run mutate:canary`: 100, tool works.
- Opus adversarial read (A496, on HEAD, not on the landing form: the Opus reader's copy with W00c done was refused by auto mode and not retried; no KNOWN or PENDING row names W00c as owner so done status changes no owner check): PASS outside items 1 to 5. RC1 to RC5 hold; guard.ts, guard.test.ts, kinds.ts no diff from 3fe3b47; money.ts row 2, checks.ts row 8, owner rule A467, KNOWN changes A491 all as directed. The R34_PLANTED per-file filter (schema-contract-rules.test.mjs ~2160, 2175) is not worded in a directive; accepted as following from row 4.

## Failure
1. Step 7, mutation: `npm run mutate:changed -- W00c -- --incremental --dryRunTimeoutMinutes 45 --concurrency 4` (and again with `--concurrency 1`) stops in Stryker's initial dry run, before any mutant: `W00 determinism (card check 8, first half) ARC-16 the loader reads the sample files in place and leaves them byte-identical: Test timed out in 5000ms` (11 files, 3170 mutants; no mutation.json written). `dryRunTimeoutMinutes` does not help: 5000 ms is the per-test timeout in vitest.mutate.config.ts (default), and the instrumented loader walking 15 folders exceeds it. So the 100 bar on the 11 @mutate files is UNVERIFIED. Same failure the build report saw; CQ9 landing did not fix it.
   Fix is outside the builder's reach (the test is a spec file, config is not on W00c's Paths): a spec job gives that test (and any like it) an explicit longer timeout, or the Lead sets testTimeout in vitest.mutate.config.ts (CQ9 follow-up). Then re-run mutation.

## For W00d (A501, RC-C), found by the Opus read
- testworld/clients/load.ts:395-402 `hasOwnPath` accepts `<array>.length` (e.g. "owners.length") as resolving onboarding evidence, since `Object.hasOwn([], 'length')` is true; a flag or add-back citing a non-existent field loads. Fix: refuse non-index own keys of arrays.
Rule Candidate: an own-key path walk refuses non-index own keys of arrays, tested with a planted `<array>.length` path. Rule candidate: any test that walks all 15 sample folders sets its own timeout (Stryker's instrumented run is slower than the 5 s default).

Items 1 to 5 of the previous check (reports/W00c-check.md, commit 2302357c) are split to W00d (A501) and were not re-judged.

## Permission gaps
The Opus reader's landing-form copy (W00c set to done in slices.json) was refused; read on HEAD instead.
## Model
Checker Sonnet 5.5; adversarial read Opus 5.5.
