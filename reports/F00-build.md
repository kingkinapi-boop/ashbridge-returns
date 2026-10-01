# F00 build report (fix round 1)
Branch claude/F00. Worker cloud-fb8d96 (Node 24.21 tarball from nodejs.org, npm 11.19; /opt/nvm had no 24).
Files: package.json (test, test:changed run unit then db; test:flake), vitest.config.ts (db: globalSetup, setupFiles, isolate false, measured timeouts), src/core/db/{index,global-setup,vitest-setup,db.db.test}.ts, tools/test-flake.mjs.
Checks: typecheck, lint, deps:check clean; `npm test` unit 33 pass, db 2 pass; all 11 spec tests (db.acceptance, db-rules) pass; `npm run test:flake` 5 of 5 ok, slowest boot 2.7 s; `npm run e2e` passes; `npm audit --audit-level=high` clean.
Measured (cloud, 10 cold db runs): boot 2.4-2.8 s (p95 2.8 s); slowest test body 1.7 s. hookTimeout 30 s (floor), testTimeout 6 s. Laptop numbers (3 runs via heavy.mjs) not measured here: the Lead or a laptop worker adds them to the comment in vitest.config.ts.
Found: the first clone costs ~2.5 s once per process, and Vitest counted it in the first test; createTemplate now makes and closes one warm clone, so no test body pays it.
Scope: tools/test-flake.mjs and the spec's tools/test/__fixtures__/* are outside the card paths (add them to the card's Paths).
## Not done
- Mutation on money.ts and ids.ts: stryker (10.0.0) with vitest 5.0.1 fails in VitestTestRunner.init (JSON.stringify circular, resolvedProjects.viteConfig), so all 47 mutants survive at 0 percent, also before my changes and also with a flat config. Needs a new card or a stryker/vitest version change (Lead decides).
- Acceptance 7 (CRLF on laptop), Dependabot alerts: Lead.
## Ambers
- Warm clone inside createTemplate (above). Reverse: remove the two lines if PGlite stops paying a first-clone cost.
- node_modules per worker: isolate:false relies on the afterEach reset; test:flake shuffled runs clean.
## Permission gaps
- none new (nvm had no Node 24; fetched the tarball with curl).
## Model
claude-sonnet-5-5
