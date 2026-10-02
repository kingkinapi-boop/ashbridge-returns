# F08 build: reported
Worker cloud-173eff. Branch claude/F08 (merged with main).
Files: tools/matrix.mjs, tools/lib.mjs.
Acceptance: 73 of 73 in tools/test (4 failed before: 3 matrix, 1 status); queue.test.mjs 14 still pass; lint, typecheck, scope clean.
Fixes (each shown by a failing test): matrix.mjs counts a clause only when it opens a test, it or describe name (leading IDs only, so "CK-3 ARC-13 ..." covers both; test code quoted inside a string is ignored) and lists acceptance-file tests whose name opens with no clause ID (console and MATRIX.md; exit code stays 0); lib.mjs loadIndex names plan/slices.json when it does not parse.
Amber for the Lead to log: the stricter matrix rule. On this branch the real matrix reads 8 of 198 testable clauses with tests (4%) with --summary; run node tools/matrix.mjs at merge and expect the number to differ from before. I did not write plan/MATRIX.md.
Permission gaps: none (Node 24 from /opt/nvm). Model: claude-sonnet-5-5.
