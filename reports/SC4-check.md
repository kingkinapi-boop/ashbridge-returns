# SC4 check

PASS. Checker local-3 (Opus 5.5, laptop, did neither the spec nor the build), 3 Oct 2026, branch claude/SC4 at 04971520 (main has no src or tools change since).

- typecheck, lint, deps:check clean.
- `npx vitest run --project unit tools/test` (through heavy.mjs): 12 files, 214 pass. `tools/test/reading-rules.test.mjs`: 17 of 17 pass, each rule's planted test included (R67, R68, R69 number text and SUM snap, R70, R74, R56).
- Spec untouched: `git diff aa5b46ad HEAD -- tools/` is empty; the builder added only reports/SC4-build.md. Scope OK (16 files).
- Mutation: no `@mutate` file changed. No screens, not a security card.
- Opus adversarial read against EV-14, EV-5, ARC-10 and the card: every card line has a test (R67 items 4 and 5, R68 cycles joined and non-SUM, R69 1e13 totals, R70 `<x:c r='A1'>`, R74 A1:XFD1048576, R56 EPS and GEOMETRY_EPSILON). Landing list covers E01, B01, T01, L01 (their paths already include the test file). No client sentence, real-looking data, key or paid service.
- R74 KNOWN outcomes measured on main without a budget: whole-sheet-range still running at 60 s; whole-sheet-merge runs out of heap at 10.0 s; running-balance-20k runs out of heap at 224 s (budget 30 s). Real defects, wide margins, so the KNOWN entries are not timing-flaky.

## Notes for the Lead (not failures)

1. FX4 and FX6 must delete their KNOWN entries (stale entries fail), but neither card's Paths holds `tools/test/reading-rules.test.mjs`, so the fixing build would go red on SC4's rule or be outside scope. Add the file to both cards' Paths (the KNOWN deletion via their spec job).
2. The R74 KNOWN pattern `(did not finish|failed)` would also absorb an adapter fault until FX4 removes it; checked here that the adapter loads and the failures are the reader's.
3. One test name adds EV-6 (not among the card's clauses); harmless for the matrix.
