# SC3 build report (cloud-a98eee, 3 Oct)

Branch claude/SC3. BLOCKED: build done, but 4 of 22 acceptance tests fail because the spec is stale, not the code.
Files changed: src/modules/auth/testusers/engine.ts (three JSDoc tags: `@standin createTestUsersAuth`, `@limit 5 startSignIn`, `@once finishSignIn`; no behaviour change).
Passing: 18 of 22 (the 3 tag-equals-registry tests now pass). typecheck, lint, deps:check clean; scope.mjs SC3 OK.
Failing (all in tools/test/security-rules.test.mjs, the R62 KNOWN list): FX2 landed on main (758d0b06), so OCR_ENGINE, STORAGE_DRIVE_ENGINE and STORAGE_FILES_ENGINE are now declared and refuse silence in production. The tests still list them as KNOWN with owner FX2 (done): "declared" (3 stale), "production" (3 stale), "KNOWN owners must be open" (FX2 done), and "every setting read has a factory entry" (the factory list expects the old OCR index shape).
Needs: a spec patch that drops the six FX2 KNOWN entries and fits the factory list to the landed FX2 code. I did not edit the tests.
Ambers: tags placed as JSDoc on the methods of the returned adapter object (name line form, per the spec report).
Permission gaps: none. Model: Sonnet 5.5.

Re-confirmed cloud-a416a1 (3 Oct): Node 24.21, npm ci, vitest on tools/test/security-rules.test.mjs: 4 failed, 4 passed. All 4 are the R62 KNOWN list (FX2 landed). Released: needs a spec patch (drop the FX2 KNOWN entries, fit the factory list), then build again; the 3 JSDoc tags on engine.ts are already in.
