# SC11 round 3 check (cloud-086697, 4 Oct 2026): FAIL

Branch claude/SC11 at 71b621d, main 0d631db merged in locally. Postgres 16.14 (select version()). Node 24.21.

## Failures
1. **Unit suite: tools/test/db-budget.test.mjs "every db test in the repo builds at most one database" fails.** Six tests in src/core/db/rules.acceptance.db.test.ts build 2 databases (SEC-1 role tests x4, S7 closeClones undroppable, S12 GUARD 25 clones). The spec file is the spec job's: split each into one test per world, or the Lead lists them in CONCURRENT (max 3 entries). Command: `npx vitest run --project unit tools/test/db-budget.test.mjs`.
2. **Opus read (reports/SC11-opus-read-3.md): FAIL, two fixes.** (a) endPool sets tracker.ended in a finally (index.ts:262-264), so a pool whose 5 s bound fired is marked ended; the forced drop's 57P01 then goes to lateErrors and fails the next test (RC2 still open for pools; template path :608-624 same). Add a pg16 test with a held client. (b) teardown bounds do not add up: global-setup.ts:17 gives dropRunDatabases 8000 ms but its steps take 3000 + 7500 (index.ts:561, :572), plus 3000 for the role check, over the 10 s teardownTimeout; one shared 7500 bound for all drops breaks B8's collect-per-item. Lesser: closeClones bound equals the sum of the close bounds (vitest-setup.ts:28); withAdmin has no late path (:273); openPool's 3 s connect timeout is unasked (amber 1).
3. Security review: no medium or higher findings.

## Passed
typecheck, lint, deps:check; scope.mjs SC11 OK (20 files); spec files unchanged since 7e2f503; db project 721 pass on PGlite, 752 pass 2 skipped on TEST_DB=pg16 (identity test ran); round 2 read items 1-5 and 7 fixed.

## Not done (stopped after the failures were known)
test:flake x10 (run 1 ok in 260 s, run 2 not finished), test:flake:shifted, mutate:canary and mutate:changed on src/core/db/target.ts (the only @mutate file in the dir), e2e.

## Rule candidate
A spec that adds db tests must run db-budget.test.mjs itself (step 6 of spec-writer.md): it did not catch six multi-world tests.

## Permission gaps
None. Model: Sonnet 5.5 checker; Opus subagent for the read.
