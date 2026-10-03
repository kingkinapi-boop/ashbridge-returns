# CQ12 check: PASS (cloud-c5d3df, 3 Oct 2026, build 4215a727 merged with main)

- typecheck, lint, deps:check green; scope.mjs OK (17 files in paths); spec files unchanged since 244a5daf.
- npm test: unit 127 files / 2880 tests, db (PGlite) 13 files / 656 passed + 1 expected fail; floor on in unit, db, evals and mutate config.
- A495: one run of a unit file and a db file (test-assertions.acceptance + schema-rules.db) passed, 33 tests; groupOrder unit 0, db 1, evals 2.
- Postgres 16 (TEST_DB=pg16): db 661 passed, 1 skipped; "a test database is Postgres 16" run alone: passed, not skipped.
- test:flake: 5 of 5 ok. No @mutate file changed, mutation not applicable.
- Diff read: only setupFiles and groupOrder lines plus test-assertions.ts; nothing extra.
Permission gaps: none. Model: Sonnet 5.5.
