# FX1 Cold-tool tests get a load-proof timeout

Phase 0. Size S. Deps: none. Where: cloud.
Tags: none (test timing only).
Paths: src/core/egress-rules.acceptance.test.ts, tools/test/toolchain-rules.test.mjs
Clauses: SEC-5, ARC-15
Read: `reports/train-20261002-1359.md` on `claude/train` history (the G01 train), `.claude/rules/testing.md` ("a flaky test is a failure").
Spec commit: (spec-writer fills)

## Goal
The G01 train went red on a timing flake: the SEC-5 test in `src/core/egress-rules.acceptance.test.ts` builds a cold ESLint instance and took 5032 ms against vitest's 5000 ms default in the full parallel run (it passes alone). A flaky test is a failure, so the fix is a test that cannot fail under load, and a rule that stops the next one.

## Spec (the whole card is a spec job; the build only confirms no product change)
1. The SEC-5 test sets an explicit timeout of 60 s in the test itself; every assertion kept.
2. Rule test in `tools/test/toolchain-rules.test.mjs`: any test file that constructs `new ESLint(`, launches a browser, spawns `npx` or `node` child processes, or runs Stryker sets an explicit per-test or per-file timeout of at least 30 s; planted: a fixture test that builds ESLint with no timeout fails the rule.

## Build
None beyond the spec: the builder runs the full suite three times under `npm test` and reports.

## Check
A checker who did neither: the rule test fails on its planted fixture and passes on the repo; `npm test` 3 runs green.
