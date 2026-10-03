# DB16 build report

Branch claude/DB16. Worker cloud-6aa4a3 (Sonnet 5.5).

Files: src/core/db/{target.ts (pure switch), pg16.ts (driver adapter), index.ts, global-setup.ts, vitest-setup.ts, target.test.ts}, vitest.config.ts, package.json and lock (pg, @types/pg dev), .claude/agents/checker.md, .claude/cloud-worker-run.md.

Numbers: acceptance tests pass on both backends. Db project on Postgres 16 (TEST_DB=pg16): 549 pass, 1 skipped, 10 files, planted race passes; no test database or role left on the cluster afterwards. Db project on PGlite, src/core/db: 5 pass, race expected-fail, 1 skipped. Unit src/core + tools/test: 336 pass. typecheck, lint, deps:check clean. Mutation: target.ts 100 (80 of 80 killed, own tests in target.test.ts).

Findings: (1) Roles are cluster-wide, so on Postgres 16 db files run one at a time (fileParallelism off) and test-made roles are dropped when a clone closes. (2) Plain query/exec share one session, as PGlite's single connection does (`set role` must stick); each transaction takes its own connection.

Needs the Lead (scope and mutation gates, both flagged by tools):
- `node tools/scope.mjs DB16` fails: src/core/db/pg16.ts, target.ts, target.test.ts and vitest-setup.ts are outside the card's Paths (the card lists a `pg16.test.ts` that does not exist). Add them to the card.
- `mutate:changed` stops at "core file without @mutate" for index.ts and global-setup.ts (in Paths): their code boots databases and is covered only by the db project, which Stryker does not run (score 27 and 5 if marked). Decide: take them out of Paths or exempt. The pure logic is in target.ts, marked, at 100.

Ambers: (a) role `ashbridge_test` (superuser, planted password, test cluster only) created once per box; its command is in checker.md. Reverse: use any local role via PGUSER/PGPASSWORD. (b) `pg` driver, stock. (c) Template database per run named by DB16_TEMPLATE, dropped with all clones by the global teardown.

Not done: gitleaks (not on box); the planted password is `PLANTED-` prefixed.

Permission gaps: none. Model: Sonnet 5.5; no Opus subagent was started (the card says the check does the Opus read of the host refusal).
