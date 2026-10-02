# G11 build (cloud-47706f)
Branch claude/G11. Files: data/question-bank/expenses.json (Q-EXP-001 to 008), src/modules/gaps/bank/expenses.test.ts.
Acceptance: all expenses acceptance tests pass; bank folder 86 tests pass; full suite green. Typecheck, lint, deps:check clean; scope.mjs G11 OK.
Amber: the percent fact has a number answer shape (no percent shape exists; the slot is percent). Reverse: add a shape in the schema.
Permission gaps: none. Model: Sonnet 5.5.
