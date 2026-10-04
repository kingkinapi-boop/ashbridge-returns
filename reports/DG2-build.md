# DG2 build report (cloud-7e91dc, Sonnet)
Branch claude/DG2; merged main (one conflict: title-count guard, kept the spec's 32).
Files: tools/mutate-changed.mjs, vitest.mutate.config.ts (stryker.config.mjs unchanged, targets come from the marker).
Acceptance: done-gate.test.mjs 41 of 41; npm test 916 of 916; test:flake 5 of 5; typecheck, lint, deps:check clean; scope OK; mutate:canary 100.
F05M score: no diff against main on this branch, so the gate (rightly) reports no marked target; not re-scored here, left for the checker.
Amber: a core card whose diff holds only fixtures/goldens under src or testworld exits 0 "no mutation targets" (spec data, kept by the DG round 3 test that conflicts with spec item 2 read literally). Reverse: drop `specDataOnly` in mutate-changed.mjs.
Permission gaps: none (nvm install 24 needed a retry).
Model: Sonnet 5.5.
