# SC3 spec refit, 3 Oct 2026 (cloud-181f22)

Refit commit f0dde579 on claude/SC3 (main e44251d merged in; validated on main 1146806 era: origin/main e44251d plus train-checking commit).
Flagged by the toolchain: tools/test/db-budget.test.mjs (ARC-15, FX12): six tests in src/contracts/security-rules.db.test.ts built 2 or 3 databases (R62 x2, R63, R64, R65, R66 rule tests).
Fix: each split into one world per test (test.each for R62's unset/blank and development/test; twin tests for R63 to R66). No assertion changed or dropped.
Result: typecheck, lint clean; unit project 126 files, only db-budget failed before, now tools/test 474 of 474 pass.
NOT fixed (not a toolchain flag; build/findings round, A500): pg16 `R65 the serialised twin of the planted check-then-record counter lets exactly 3 through` still fails under TEST_DB=pg16 (1 of 29 db tests). Also open: R62/R63 inventory lacks A04's create* exports.
Permission gaps: none. Model: sonnet (no Opus subagent: mechanical split, no assertion edits).
