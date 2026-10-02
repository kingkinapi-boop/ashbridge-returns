# DG spec round 3 (cloud-df251e)
- 4 R20 fixture/golden cases + 2 R22 config guards in tools/test/done-gate.test.mjs; 5 readOwnSource cases in src/core/testing/read-own-source.acceptance.test.ts. Clauses ARC-15.
- Validated on main 30986dd18e24409e456d9051c3d26125ffe10952. Fail for the right reason: fixtures skipped (4 fail), helper missing (module + sandbox-dir guard).
- Step 6b: reasoned sweep only (new skip rule touches no existing assertion; full unit suite otherwise green, 706 pass). Retired: none.
- Amber: the config-equality test compares the src/ test set, setup files and env, not tools/test (those test tools, not src mutants). The canary score 100 is left to the checker (too heavy for the unit run).
- Permission gaps: none. Model: Sonnet (card not core).
