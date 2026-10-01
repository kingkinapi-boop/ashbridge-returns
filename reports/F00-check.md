# F00 check (cloud-d367f7)

FAIL (stopped at step 3; steps 1-2 pass)

- Step 2 PASS: typecheck, lint, deps:check clean. `npm audit --audit-level=high` exit 0 (2 moderate only). Scope OK (27 files).
- Step 3 FAIL: `npm test` 22 of 23 pass; `src/core/db/db.db.test.ts` "ARC-4 a database is created from the schema folder and cloned per test" times out at the 5000 ms default. Ran `npx vitest run --project db` 3 more times: 2 timeouts, 1 pass. A flaky test is a failure (testing.md). Cause is likely PGlite cold start (WASM boot plus schema load) inside the first test with no testTimeout / hook timeout set in vitest.config.ts.
- Not run (check stops at step 3): e2e, mutation, diff-vs-spec (card has no spec).

Rule candidate: any db-project test or shared DB setup must load PGlite once in a beforeAll with an explicit generous timeout (e.g. 60 s), so no test body pays the cold start; set `testTimeout`/`hookTimeout` for the `db` project.

## Permission gaps
None refused. Default node was 22; installed Node 24 and npm 11 via nvm to satisfy engine-strict.

## Model
claude-sonnet-5-5
