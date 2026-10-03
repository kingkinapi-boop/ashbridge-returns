# G12 build
Branch claude/G12. Files: data/question-bank/assets-cca.json (6 items, Q-ASSETS-001 to 006), src/modules/gaps/bank/assets-cca.test.ts.
Acceptance: all G12 spec tests pass (bank folder 8 files, 123 tests); typecheck, lint, deps:check clean; scope OK. Not core.
Amber: the CCA class questions are choices over class_1, 8, 10, 12, 14_1, 29, 43, 50, 53 and other (common classes only; other covers the rest). Reverse: edit the options list.

## Round 2 (cloud-7c1598)
Restored src/modules/gaps/bank/assets-cca.test.ts to b8ec230 (git diff b8ec230 HEAD on it is empty). Bank folder 123/123, typecheck, lint, deps:check clean.
Scope: tools/scope.mjs still reports "edited" because it checks commits (ae9d809 edit, ec58041 restore), not the net tree. Not fixable without rewriting history; Lead: net diff is empty, accept or squash on the train.
Permission gaps: none. Model: Sonnet 5.5.
