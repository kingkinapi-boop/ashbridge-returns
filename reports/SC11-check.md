# SC11 check (cloud-b1e6bc, 3 Oct 2026, branch claude/SC11 at 87066e3)

FAIL: test:flake 4 of 5 (a flaky test is a failure, testing.md).

## Failures
1. `TEST_DB=pg16 npm run test:flake`, run 3 of 5 (seed 20261001) failed with an unhandled error: `terminating connection due to administrator command` (57P01) on a pooled client of database `ashbridge_t_..._db342_...`, "originated in" `src/modules/jobs/lease.acceptance.db.test.ts` (latest test: "ARC-5 over random claim, expire, complete and fail orders on two workers..."). Runs 1, 2, 4 and 5 passed. The builder's 5 of 5 did not show it.
   Likely cause (not proven): `drop database ... with (force)` (src/core/db/index.ts:349 and :363) kills a connection the pool still holds, and the pool has no `error` listener (no `.on('error'` in src/core/db/index.ts), so the kill surfaces as an uncaught exception. SC11's new `inspectIdle` and teardown touch the same pool; whether DB16 had the same race before SC11 was not checked.
   Rule candidate: every pg Pool and checked-out client in the harness has an error listener that records, never throws, and a database is dropped only after its pool has ended.

## Passed
- typecheck, lint, deps:check clean (Node 24.21.0).
- `TEST_DB=pg16 vitest --project db`: 13 files, 664 passed, 2 skipped (the PGlite-only identity case skips by design; the pg16 identity test ran and passed, Postgres 16.14). PGlite db project: 643 passed, 1 expected fail, 22 skipped. Unit project: 2819 passed.
- Spec files unchanged since 7fd5141 / 817cdde (rules.acceptance.db.test.ts, sql-rules fixtures).
- mutate:changed: no mutation targets (all three changed files are harness).
- Diff read (index.ts, global-setup.ts, vitest-setup.ts): no product code, no client text, no key. No security finding of medium or higher.

## Notes
- `node tools/scope.mjs SC11` FAILs on (a) plan/cards/DB16.md, a Lead directive the build report already names; (b) "spec file edited by hand in a merge" for tools/test-homes.json in merge 53c6a01: the merge only combined main's `harness` list with the spec's `dbCatchAllow`/`dbGrantAllow`/`definerAllow` entries, no hand edit. Both look like tool false positives; the Lead should confirm.
- Low: R91 compares roles of the whole cluster at setup and end (listRoles), so a second worker making a role on the same cluster during the run would fail this run's teardown. Fine on a one-run-per-box cloud, worth a thought for local workers.

Permission gaps: none.
Model: Sonnet 5.5 (security-tagged, not core; no Opus read).
