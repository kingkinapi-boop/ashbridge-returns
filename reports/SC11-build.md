# SC11 build, round 2 (cloud-7c6fec)

Branch claude/SC11. Files: src/core/db/index.ts, src/core/db/vitest-setup.ts (plan/cards/DB16.md restored from main).
- index.ts: openPool (tracks every client from connect to end; pool, client and session errors recorded), endPool (pool end, then every tracked end, 5 s bound, named failure), takeLateErrors, one withAdmin helper (dropDatabase, dropRunDatabases, listRoles, template, clone); close() and the template use endPool; `with (force)` kept; PgDb.problems reported by close and assertCleanClones; late errors named by assertCleanClones. vitest-setup.ts: afterAll runs assertCleanClones.
- Acceptance: unit src/core/db 98 pass; rules.acceptance.db on pg16 44 pass (1 skipped); full db project on PGlite 678 pass; typecheck, lint, deps:check clean.
- test:flake on pg16: 5 of 5 ok. FLAKE_RUNS=10, full pg16 `npm test`, Opus read and security review: not run by me.
- scope.mjs SC11: only note b (R82, merge 53c6a01), accepted by the Lead's ruling.
- Connection peak vs max_connections not measured; closeClones concurrency unchanged.
- Amber: openPool accepts a bare connectionString and applies connOpts (local password); reverse by passing fields.
- Permission gaps: none. Model: Sonnet 5.5.
