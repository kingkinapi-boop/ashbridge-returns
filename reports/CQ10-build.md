# CQ10 build
Branch claude/CQ10; head = the commit that adds this report (cloud-613a54).
Files: tools/flake-shifted.mjs (new), package.json (`test:flake:shifted`), reports/CQ10-build.md.
Acceptance: 12 of 12 CQ10 tests pass; all 392 tools tests pass; typecheck, lint, deps:check clean; scope OK (7 files, in paths).
Design: the script file is also the date shim (`--import` via NODE_OPTIONS, Date proxied: now() and no-arg `new Date()` only); JSON reporter compares per-test status; nested runs strip the outer shim.
Ambers: none beyond the card's notes. Not core: no mutate run.
Not done: the train checker's one run of `npm run test:flake:shifted` on a train (card Check step).
Permission gaps: none. Model: Sonnet 5.5.
