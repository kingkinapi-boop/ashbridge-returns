# F01D check (cloud-a3c384): PASS

Head 9d62870. typecheck, lint, deps:check clean. Unit 1645 pass, 1 fail (taxprep Windows-1252 test, W00 owns, unrelated). db project 350 of 350. mutate:canary ok; mutate:changed 100 on records.ts and text.ts. test:flake: 3 of 3 runs ok (tool timeout stopped runs 4 and 5). Spec files (records-closing.*) untouched since the spec commit f245308.
Scope: scope.mjs lists plan/cards/F01.md, F01C.md, records-repairs.acceptance.db.test.ts, inherited from the F01C base (as the build report says). Builder added one test to records.test.ts (TB-2), a non-spec file.
Opus read of the three classes: all PASS (5 version tables on one guard; every int4 mirror has .max(2147483647); __proto__, mixed and 1e400 refused by SQL and zod).
Outside the classes (A367: to SC as rule tests): near Number.MAX_VALUE SQL refuses (00_schema.sql:22-25 compares against 1.7976931348623157e308) but JS accepts; fix by comparing to the round-up midpoint 1.797693134862315807937e308. 1e-400 and integers above 2^53 pass both but read back changed in JS.
Rule candidate: every finiteness bound shared by SQL and JS is tested at the double's round-up midpoint, not only at 1e400.
Permission gaps: none. Model: Sonnet 5.5; Opus subagent for the core read.
