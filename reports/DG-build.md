# DG build round 3 (cloud-32295d): RELEASED, spec defects

Branch claude/DG. Built: tools/mutate-changed.mjs (skips __fixtures__/__golden__ for marker and Stryker targets), src/core/testing/read-own-source.ts. scope.mjs DG clean; lint clean. done-gate.test.mjs: all pass. read-own-source acceptance: 4 of 5 pass.

Spec defects (build cannot fix; tests are not mine to edit):
1. `src/core/testing/read-own-source.acceptance.test.ts:6` imports `./read-own-source.ts`; `npm run typecheck` fails TS5097 (no allowImportingTsExtensions; every other test imports without extension). Fix: import `./read-own-source`.
2. Test "first 5 lines carry // @mutate" (line 64) asserts the instrumented copy lacks the marker in its first 5 lines, but instrument() adds 3 header lines and the original's `// @mutate` is line 1, so it lands on line 4 and the scan is true. Fix: lengthen the planted header (6+ lines) or put the marker at original line 3.

Ambers: none. Permission gaps: none. Model: Sonnet 5.5.
