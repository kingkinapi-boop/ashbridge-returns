# DB16 check (cloud-a113b9, 3 Oct 2026)

FAIL: one failure (step 7), one tool note (step 6).

Passed: typecheck, lint, deps:check; `npm test` (2565 unit, 563 db on PGlite); `TEST_DB=pg16 npx vitest run --project db` (565 passed, 1 skipped = the switch-off PGlite test, the pg16 identity test ran and passed); test:flake 5 of 5 ok; spec round 3 (d69ac55) is in the branch; `git diff d69ac55 HEAD` over the acceptance test files is empty; mutate:canary green (killed 10 of 10). Host refusal read (testDbTarget: TEST_DB, DATABASE_URL, SUPABASE, non-local PGHOST/PGHOSTADDR, PGPORT shape): sound. Card is not tagged security.

## Failures
1. Step 7: `npm run mutate:changed -- DB16` exits 1: "core file without @mutate (first 5 lines): src/core/db/global-setup.ts, src/core/db/index.ts". DB16 is a `core` card with these two files in its Paths, so both need the `// @mutate` marker and 100 per file, or the Lead must change the card (drop `core` or reword Paths). Not decided here.
2. Tool note (step 6): `node tools/scope.mjs DB16` prints "spec file edited by the build" for pg16.acceptance.*.test.ts (b14182c, a spec wip commit by the spec author) and reports/DB16-spec.md (spec author's commits). The final spec diff is empty, so these are the spec job's own commits, not a build edit. Rule candidate: scope.mjs should read spec commits by the `spec(` and wip(<card>) subjects, or take the card's recorded spec commit.

Also: the branch is behind main (CQ2 and SC4 landed); the build needs a main merge before the train.

## Permission gaps
None.
## Model
Sonnet 5.5 (no Opus read: card read was by hand, host refusal only).
