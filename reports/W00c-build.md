# W00c build, round 3 (cloud-1fcc74)

Branch claude/W00c. Fix list 1 to 6 of reports/W00c-findings-3.md built; tests untouched.

- Files: testworld/clients/json-keys.ts (`reservedKeys`, shared key scan), testworld/clients/load.ts (strict raw schemas with one commented carried block per object; reserved keys as 'file' issues; written twins for TB totals, rolls, exportActivity, rowsInExport, rowsMissingFromExport, fiscalYear.days, adjusting entry amount; `exportRows` is the written rowsInExport; one date walk and one id walk over every string leaf; dotted onboarding evidence through one `resolves()`, also for flags and Schedule 1 add-backs), testworld/model/checks.ts (`modelIssues([])` says "nothing to check", R35), src/core/money.ts (private thousands regex dropped, same reason text, R28).
- Numbers: unit project 7646 of 7646 pass; typecheck, lint, deps:check clean; scope.mjs SCOPE OK (85 files). Db project not run (no db file touched).
- NOT DONE: mutation (bar 100 per @mutate file) and `test:flake` 5 of 5. Stryker's dry run (4 files, 1843 mutants, 4 cores, dryRunTimeoutMinutes 45) failed on "W00 determinism ... the loader reads the sample files in place" timing out at the 5000 ms default test timeout under instrumentation (a spec-owned test; the builder may not edit it). The checker needs that test given a longer timeout (a spec or CQ patch) before mutation can run.
- Amber: id walk skips adjustingEntries[].source.transactions[] (already checked as 'adjusting-entry'); dates and twin issues are not repeated when the same record already has an issue; own transaction ids are not checked against the idRule (references are, by resolving to a transaction).
- Permission gaps: none. Model: Sonnet 5.5.
