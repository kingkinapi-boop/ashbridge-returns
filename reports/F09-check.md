# F09 check (round 4, local-4e012b, laptop)

Result: PASS

Ran on origin/claude/F09 (2216375) merged with origin/main eda0bda: typecheck, lint, deps:check clean; src/contracts 131 tests pass (full vitest 363 pass); mutate:canary 100; `mutate:changed -- F09` reading.ts 100.00 (460 killed, 1 timeout, 0 survived, 0 no coverage); `// @mutate` on line 1; scope OK (8 files); reading.acceptance.test.ts identical to the last spec commit 981d672 (all four spec(F09) commits touch only it and reports/F09-mutants.md); 4 Stryker disable comments, each names the mutator and a reason (lines 12, 94 float-noise tolerance edges, 200 unreachable fallback, 214 case fold on both sides); checks 17 and 18 have passing tests.
Not run: test:flake (no db/schema change), e2e (cloud only). The 2 failing tests on the laptop are A05's real-parent symlink tests (EPERM, Windows has no symlink right), not F09.
Not done: no Opus adversarial subagent available to this worker; the diff read was by this Sonnet worker. Lead may add one (core card).

Permission gaps: none met.
Model: Sonnet 5.5 (claude-sonnet-5-5).
