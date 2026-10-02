# G14 check

FAIL (one gap). Typecheck, lint, deps:check clean; scope OK; gaps unit 116/116 (13 G14 acceptance); no sentence text, no real-looking data; spec file untouched.

1. Missing deliverable: the family card and the G14 spec report require `src/modules/gaps/bank/payroll-bonuses.test.ts` (the builder test, as G11 expenses.test.ts, G12, G13 have). It does not exist on claude/G14 (`ls src/modules/gaps/bank | grep payroll`). Also no reports/G14-build.md.

Fix: add the test (mirror expenses.test.ts) and the build report; nothing else.

Not run: e2e, mutation (data-only card, no screens).

Permission gaps: none. Model: Sonnet 5.5.
