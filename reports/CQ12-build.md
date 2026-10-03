# CQ12 build report
Branch claude/CQ12. Worker cloud-97b8bd. Node 24.21.0.
Files: src/core/test-assertions.ts (new, beforeEach expect.hasAssertions), vitest.config.ts (floor in unit, db, evals setupFiles; groupOrder db 1, evals 2, unit 0), vitest.mutate.config.ts (floor).
Acceptance: test-assertions.acceptance (all), tools/test/vitest-projects.test.mjs (5 of 5), mixed run of one unit, one tools and one db file passes (38 tests).
Floor on: unit 2880 passed, db 656 passed (1 expected fail, 5 skipped, PGlite), evals no files. No test failed only for the missing assertion, so no assertions had to be added.
typecheck, lint, deps:check clean; scope OK (13 files in paths).
Not run: TEST_DB=pg16 db suite (the checker runs it).
Ambers: groupOrder evals 2 (after db), reverse by removing the line.
Permission gaps: none. Model: Sonnet 5.5.
