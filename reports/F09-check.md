# F09 check, round 3 (cloud-ee27ff, head 90e2c71 plus origin/main merged)

FAIL: mutation score of src/contracts/reading.ts is 76.29, not 100 per file (ARC-15, DG round 2 / Reviewer SLOW finding 2).

Passed: typecheck, lint, deps:check, `npm test` (222 tests, 16 files), `npm run mutate:canary` (100), `node tools/scope.mjs F09 origin/main` (clean), spec files (`reading.acceptance.test.ts`) unchanged since spec commit 6b127d3, `// @mutate` present.

Failures:
1. `node tools/mutate-changed.mjs F09 origin/main` (main's round-1 tool, exit 0 because the overall break is 70): reading.ts 76.29, 381 killed, 2 timeout, 110 survived, 9 no coverage. Under the per-file 100 rule this is a FAIL. Survivors by mutator: ConditionalExpression 22, StringLiteral 26, Regex 21, EqualityOperator 19, ObjectLiteral 6, BooleanLiteral 4, MethodExpression 4, LogicalOperator 4, ArrayDeclaration 3, OptionalChaining 3, ArithmeticOperator 2, AssignmentOperator 2, ArrowFunction 1, BlockStatement 1, CallExpression 1. Lines: 19-20, 43-44, 52, 60-63, 67, 69, 80, 86-95, 149, 167-175, 179, 182, 195-205, 215, 218-226, 231, 234, 240-241, 246, 253, 275-278. Full list: re-run the command; JSON in reports/mutation/mutation.json (not committed).
   Many are in the amount-group regexes (lines 215-226, e.g. WHOLE_TAIL, OPENS_AMOUNT, SPACE_GROUP anchors) and in error-reason strings (StringLiteral): the reasons need exact-text tests or the strings should be constants checked by tests.

Rule candidate: a `// @mutate` card is not done until its file scores 100 and survivors are classed; the spec job should run Stryker on the build and add survivor tests (card fix round, as F00T does).

Permission gaps: none.
Model: Sonnet 5.5.
