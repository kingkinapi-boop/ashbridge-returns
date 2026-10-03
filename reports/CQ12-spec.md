# CQ12 spec report (cloud-a2c0b4)

Validated on main 310ffa6 (typecheck and lint clean; the card's own acceptance tests fail by name until the build).

- New: `src/core/test-assertions.acceptance.test.ts` (10 tests, ARC-15) with two fixtures in `src/core/__fixtures__/assertions/`. It reads each project's `setupFiles` from the real `vitest.config.ts` and runs the fixtures under them: no assertion fails, one assertion passes (unit, db, evals; the db boot files are left out of the fixture run).
- Floor on, whole unit project (stub `test-assertions.ts`, never committed): 17 tests had no assertion. Fixed, each with a real outcome check: `facts.acceptance` EV-10 (catalogue holds the key), `bank.acceptance` (`expectBank` asserts items; two fast-check properties now assert inside the property), `auth/rules.acceptance` gitleaks-absent branch (asserts ENOENT). db project: green under the floor.
- Review items: expenses slot-name test asserts a non-empty list first; behaviour twins added for blank-rule (ai.ts and checks.ts refuse a zero-width value, keep a visible one) and jobs (a fake db sees every queue call, none sends DELETE or TRUNCATE); bridge db test for `tax_year_missing` (END-1).
- Retired tests: none.

## Paths gaps for the Lead (A414)
- The build must also add `src/core/test-assertions.ts` to `vitest.mutate.config.ts` setupFiles: `tools/test/done-gate.test.mjs` R22 fails otherwise (it is the only unit failure with the floor on). That file is not in the card's Paths.
- The three fixed files `src/contracts/facts.acceptance.test.ts`, `src/modules/gaps/bank/bank.acceptance.test.ts`, `src/modules/auth/rules.acceptance.test.ts` are outside the card's Paths; the card's own Spec line requires fixing every test that fails only for that reason.

## Amber
- gitleaks-absent test asserts the ENOENT reason rather than skipping, so the floor stays on without a skip.

Model: Sonnet 5.5 (card not core).
Permission gaps: none (one `git stash` I issued by mistake was refused; nothing ran).
