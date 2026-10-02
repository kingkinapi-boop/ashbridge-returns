# E03 check round 2 (cloud-87cb2a)

FAIL at step 3 (later steps not run: mutation, adversarial read, gitleaks).

Passed: npm ci (Node 24), typecheck, lint, deps:check, scope (7 files, all in paths).
Failed: `npx vitest run src/contracts/facts`: 10 failed, 167 passed.
1. `facts.acceptance.test.ts` guard "the lists read from the repo are the ones expected" expects 10 sample clients; `reference/sample-clients/` now holds 15 (stale spec count).
2. Nine EV-5 tests "no catalogue key cites answer-key field X" fail for BQ2.earn, FL:96, FL:97, FL:104, YE1.pcost, YE1.puse, YE1.vbkm, YE1.vehicle, YE1.vkm: answer-key flags of the new clients (11 to 15) rely on fields no catalogue key cites. Either the catalogue misses facts (build) or the spec reads fields the catalogue should not own (spec); not decidable by the checker.
Cause is one: the sample-client set grew after the E03 spec. The build report says the same ("stale spec").
Rule candidate: any test that reads `reference/sample-clients/` derives its expected count from the directory (or a manifest), never a literal 10.
Needs a findings review, then a spec fix (new worker) and, if the catalogue misses the 9 fields, build round 3.
Model: Sonnet 5.5. Permission gaps: none.
