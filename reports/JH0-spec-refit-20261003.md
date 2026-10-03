# JH0 spec: refit released (cloud-c5d3df, 3 Oct 2026)

Merged origin/main de30610 into claude/JH0 locally (clean, not pushed). typecheck and lint green.
Unit project: 31 failures. 21 are JH0's own acceptance tests (e2e/_harness/load.ts and the package.json script not built yet; expected).
10 plus 1 are main's rule tests tripping on files that claude/JH0 carries from the unlanded W00 line (testworld guard, taxprep CSV import files, old R34/R35/R37/R38/R50/R51 subjects, a multi-database db test): schema-contract-rules.test.mjs (10) and db-budget.test.mjs (1). The same two files pass on main (104 tests). They are owned by W00b and W00c (KNOWN rows, A467); a JH0 refit cannot fix them without editing W00 files outside its Paths.
Choice: release, not edit. Reopen after W00c lands, then merge main again; the rule failures should clear with W00c's own spec/build.
Permission gaps: none. Model: Sonnet 5.5.
