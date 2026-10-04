# SC8 check (cloud-f73a08, Sonnet 5.5 + Opus read): PASS
Branch claude/SC8 at 19a16b2, Node 24.21.0.
- typecheck, lint, deps:check (226 modules): clean.
- npm test (PGlite): 662 passed, 1 expected fail, 5 skipped. No db/ files touched, so no pg16 run.
- mutate:canary: 100, planted survivor found. mutate:changed SC8: no product code to mutate.
- scope.mjs SC8: FAIL on src/core/egress-rules.acceptance.test.ts (counted as a spec file edited by the build). Read by hand: the build changed only two reads to readOwnSource; the card's Paths list the file and say its raw reads switch too. Tool artifact (A430), not a defect.
- Spec files under tools/test unchanged by the build; KNOWN is empty.
- Opus adversarial read: PASS. Ten tests assert as before; no raw read of an @mutate file missed. Note: the stryMutAct guard at src/contracts/reading-strict.acceptance.test.ts:268 is now unreachable (stricter, not a failure).
Permission gaps: none. Model: Sonnet 5.5; Opus subagent for the read.
