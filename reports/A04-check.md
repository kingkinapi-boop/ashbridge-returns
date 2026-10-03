# A04 check, round 5b (cloud-e9d462, 3 Oct): FAIL (scope only: two build-test files; no code failure)

Head e4d9714f on claude/A04 (also checked 5fbe05fe and a6b43706 as the branch moved). Model: Opus 5.5 (adversarial read done here).

## Failures (step 6, scope; both need a Lead ruling or a Paths edit, not a rebuild)
1. src/core/safe-read.test.ts (the build's own test for src/core/safe-read.ts) is outside the card's Paths. `node tools/scope.mjs A04`.
2. "spec file edited by the build": src/modules/ai/runner/engines.build.test.ts (a build-test file; spec e255f795 only retired one test in it) edited by the build in 70db2c0d and 8e752c58: 2 ctx lines (`waiting` Map, `now`, `deadline`) and a new round-5 block; no assertion changed or removed. `git diff 15f44d53 HEAD -- src/modules/ai/runner/engines.build.test.ts`.
Read by hand (discounted): scope's plan/AMBER.md, plan/NOW.md, plan/cards/FX15.md, plan/cards/SC3.md, plan/train.json, reference/lessons.md come from main merges (Lead commits), not the build.

## Passing at e4d9714f
typecheck, lint, deps:check; npm test unit 2951 / 123 files, db 593 / 11 files (SC R41 now green after round 5b). A04 tests 254 plus env 9; acceptance checks 1 to 11 each have a passing test. Spec files: diff from 796cd7ab to HEAD empty. mutate:changed A04: env 100, safe-read 100, engines 100, runner 100, schemas 100 (496 killed, 5 timeout, 0 survived). Mutation canary: strong half 100; the weak test run by hand scores 10 (8 survivors), so the tool works. At 5fbe05fe (same A04 code except the isBlank swap): test:flake 5 of 5 (slowest boot 3105 ms); e2e 3 of 3 on the production build.
Adversarial read: no medium or higher. Stamp compare from versionStampSchema.shape (7 of 7); InboxFileSchema holds every AiJob field; id allowlist, no flags, devices com0 to lpt9; own file through readRegularFile, 4 MiB cap, fd fstat; strangers lstat only, quoted; deadline lease minus 10 min; no SDK, key, client sentence or real-looking data.
Low (SC12 or FX per the landing rule): (a) fs errors thrown from projectRun (vanished outbox, mkdir or rename failure) put the exchange path into the handler error and jobs.last_error; (b) `<waiting id>.<any ext>` is never logged while that job waits; (c) engines.ts:162 disables BlockStatement for all of realFolder, not just the equivalent catch.
Not run: Postgres 16 db run (no driver switch; known); /security-review (no skill tool here; Lead runs it).
Rule candidates: a card adding a src file lists its sibling test in Paths; spec jobs do not edit build-test files (or scope.mjs tells a build-test file from a spec file); spec files bridge not-yet-built options without type assertions; `mutate:canary` also runs the weak test and asserts a survivor; rule tests re-run after every main merge into a card branch.
Permission gaps: none.
