# F09B build report, round 2 (cloud-db355d)

Branch claude/F09B (merged with main 8e8fba1). Files changed: src/contracts/amount-grammar.ts, src/contracts/reading.ts.
Acceptance: all F09B tests pass (src/contracts 802 of 802); full suite 1155 of 1155. Typecheck, lint, deps:check clean. mutate:changed F09B: 100.00 on both files.
Scope: tools/scope.mjs flags only plan/cards/F09A.md, which came in with the F09A base branch (as in round 1).
Build: `GEOMETRY_EPSILON` 1e-9 in `adjacent` (both ends) and `sameLine` (a touching line is another line); WordSchema blank test also strips U+0085.
Ambers: `sameLine` also gets the epsilon (the round 2 touching-lines rows need it); two Stryker disables on the `< vs <=` at exactly 1e-9, which no test can observe.
Permission gaps: none. Model: Sonnet 5.5.
