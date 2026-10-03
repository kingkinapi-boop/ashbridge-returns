# JH0 spec report

Worker cloud-7e015b. Branch claude/JH0 (origin/main plus W00c). Spec tests only.

## Tests
- testworld/harness/: load (db), journey (db), expect, kinds, package-and-fixtures (unit).
- e2e/_harness/smoke.acceptance.spec.ts: Playwright smoke page, axe, production mode, pinned tz and locale (cloud only).
- Postgres 16 load test runs only when HARNESS_PG_URL is set (cloud only).
- Validated on current main: typecheck and lint green; npm test fails only JH0's own tests (20 unit failures at import, as designed).

## Lead action
- The tests live in testworld/harness/ so a vitest project runs them. That is outside the card Paths: add testworld/harness/ to Paths.
- Harness contract types: testworld/harness/_api.ts; the builder creates e2e/_harness/{load,pipeline,expect,kinds,fixtures}.ts.

## Facts for the builder (found with a throwaway stub, since removed)
- Against the stub, 18 db and unit tests passed, so the tests are satisfiable.
- 493 of 1502 C01 transactions have a blank glAccount (uncategorised) and some have no postings. facts needs a non-blank QBO pointer (facts_qbo_pointer, facts_source_qbo_account_id_nonblank): the loader must fall back (posting account, then accountKey) or the load fails.

## Amber
- Mapping of test-world rows to returns.* tables chosen by the spec (returns, accounts, facts, adjusting_entries, entry_lines), all is_test true.
- 6b stub sweep: ran the whole suite with the stub; no existing test contradicted.

## Permission gaps
None.

## Model
Sonnet 5.5
