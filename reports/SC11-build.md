# SC11 build, round 3 (worker cloud-fbb2e3)

Branch claude/SC11, builds B3 to B13 on spec 7e2f5034 (main merged). Files: src/core/db/index.ts, global-setup.ts, vitest-setup.ts.
- Tests: unit src/core/db 114 of 114; db on PGlite 721 passed (1 expected fail, 32 skipped as pg16-only); db on pg16 752 passed, 2 skipped (the PGlite-only ones; the pg16 identity test ran). typecheck, lint, deps:check clean; scope.mjs SC11 OK (20 files).
- test:flake on pg16 with FLAKE_RUNS=10: 10 of 10 ok (145 to 171 s each, slowest boot 407 ms). That covers the 5 of 5.
- S12 peak 51 of max_connections 100 (0.6 is 60), so B14 (limit closeClones' concurrency) is not needed.
- Built: settleAll, STEP_BOUND_MS 3000, CLOSE_BOUNDS_MS (3000/3000/3000/5000/5000: worst afterEach 22 s of 24 s); PgDb.close, dropOwnedRoles, dropRunDatabases, createPg16Template and createPgliteTemplate through settleAll; withAdmin exported, connect bounded, recorded lines attached on every exit; closeClones and assertCleanClones with allSettled; endPool refuses untracked pools and marks a pool ended only after its end; "no owner" label; makeTeardown; transaction's wipe through settleAll.
- Amber: (1) openPool defaults connectionTimeoutMillis to 3 s so inspectIdle's connect is bounded; reverse: drop that default. (2) A schema file failure message gets "(code X)" after the pg message. (3) Teardown bounds: drop 7.5 s inside 8 s, under vitest's 10 s teardownTimeout. (4) Slowest drop time not recorded separately; the S12 close of 25 clones took about 1.9 s.
- Not done: mutate (SC11 is security, not core; no @mutate files). Opus read and security review are the Lead's next jobs. A "client.query() while executing" deprecation warning shows in the db run; not traced to this card (not seen as a failure).
Permission gaps: none. Model: Sonnet 5.5.
