# CQ9 check (cloud, Node 24.21.0)
Result: FAIL (one item unbuilt)
Base: claude/CQ9 afd764f8 with origin/main merged (scratch); CQ6 is landed (train df6f1249), so the base has it.
Failure: card "Also (A465)" (scope.mjs tells `*.build.test.ts` from a spec file) is not built and has no test. tools/scope.mjs is outside the card's Paths and the spec; the builder said so (reports/CQ9-build.md). Fix by the Lead: add tools/scope.mjs to Paths and a spec, or move A465 to its own card. Command: git diff origin/main HEAD -- tools/scope.mjs (empty).
Passed: typecheck, lint, deps:check; tools/test/mutate-args.test.mjs 15 of 15; `vitest run tools` 414 passed; npm test (unit 621 passed, 1 expected fail, 5 skipped); e2e 3 passed; spec files diff d25918cd..HEAD empty; scope.mjs CQ9 clean; mutate:canary ran (score 100 by design, kill all 10); mutate:changed CQ9: no mutation targets (no @mutate file).
Not run: db on Postgres 16 and test:flake (card touches no db/, no *.db.test.ts, not vitest.config.ts). No screens, not security.
Read of diff: matches card items except A465; no extra build, no client sentence, no key. productGlob regex is a hand-written list of test patterns (amber logged by builder).
No Rule candidate.
