# SC11 build: reported (cloud-4507da)

Branch claude/SC11, main (dadad605) merged. Code commit 741b8f03; files: src/core/db/index.ts, vitest-setup.ts, global-setup.ts (harness, no product code).
- Acceptance: rules.acceptance.db.test.ts 39 of 39 (pg16: 37 pass, 2 PGlite-only skipped); R107 R108 unit tests (sql-rules.acceptance.test.ts) 12 of 12 untouched by the build (they scan db/ and the allow lists; passing).
- Whole suite on Node 24.21, Postgres 16.14: typecheck, lint, deps:check clean; unit 2819 pass; db project pg16 664 pass (2 skipped); db project PGlite 643 pass (1 expected fail, 22 skipped as gated). test:flake (TEST_DB=pg16) 5 of 5 ok.
- `node tools/scope.mjs SC11` lists plan/cards/DB16.md: that is the Lead's directive edit already on the spec branch, not the build.

## What the build does
- R90: `idleConnectionProblems`, `assertCleanClones`; `close()` inspects idle connections before roles drop; afterEach checks before closing (try/finally so clones still close). A dirty connection is destroyed.
- R91: roles tracked by name from the statement text (also DO blocks, create group/user), recorded only if absent before and present after; close ends an open or aborted block first, skips roles already gone, quotes identifiers. Global setup lists roles, mints a fresh run id, teardown drops run databases then fails naming leftover roles.
- Edge cases: tx refuses use after commit/rollback/error; custom settings recognised with `set_config (`, quoted and `$` names; begin carries read-only, isolation and deferrable defaults; DB16_RUN_ID must match ^[0-9a-z_]+$.

## Ambers
- Role ownership is read from the SQL text, not a cluster diff, so a role made by dynamic SQL (`format('create role %I')`) is not tracked; the R91 teardown still names it. Reverse: use the diff again.
- The open-transaction probe is `now() <> statement_timestamp()`; an aborted block is told by error 25P02.

## Permission gaps
None. Model: Sonnet 5.5 (non-core card).
