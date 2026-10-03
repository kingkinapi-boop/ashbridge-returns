# GL2 Live schema migration draft and the public-key test

Phase 4. Size M. Deps: N20, T10, T14, N19. Where: cloud (Postgres 16; core: spec read and check by Opus; security: `/security-review` before boarding).
Tags: security (the public key reads nothing; no row of made-up data reaches the live database; nothing outside schema `returns` is touched), core (permissions: which role can read what at go-live).
Paths: db/live/**, src/modules/golive/schema/**
Clauses: LIVE-4, SEC-6, ARC-3, SEC-11
Read: blueprint 09 (ARC-2, ARC-3, ARC-4), 10 (LIVE-4, LIVE-6, LIVE-9), 08 (SEC-6, SEC-7, SEC-11); `db/schema/` (every file, names and headers only), `src/core/db/` (how the build loads the schema files), `src/contracts/records.acceptance.db.test.ts` (F01's SEC-6 test: a role granted SELECT reads zero rows), `reference/onboarding-contract.md` (section 4: the shared table the client app reads; U9: what is live cannot be seen from files), `plan/cards/GL1.md` (`tools/golive-check.mjs`, the live database pool), `plan/cards/GL3.md` (the bridge views and the client app's grant), `plan/cards/N20.md` (F01's `returns.lessons` left unused), `.claude/rules/code.md`, `reports/phase4-card-review-2026-10-03.md` (C3).
Spec commit: (spec-writer fills)

## Goal
At go-live the schema files in `db/schema/` become one reviewed migration (ARC-3, LIVE-4). This card builds that migration from the files, proves it gives exactly the schema the build tested, proves the client app's public key reads nothing in it (SEC-6), and gives the go-live run an EXPLAIN check for every query that touches a shared table or view. Nothing is applied to any real database here.

## Spec
- Fixtures: a temp copy of `db/schema/`; an empty PGlite and an empty Postgres 16; stand-in roles `anon` and `authenticated` (the client app's public-key roles) and the role names in `db/live/roles.json`; a planted default privilege (select on new tables and execute on new functions in every schema granted to `anon`, as a managed host may set); a made-up client-app query list (one good query on `returns.client_handoff`, one naming a missing column).
- Classes:
  - ARC-3, LIVE-4 one migration: `buildMigration(schemaDir, roles)` returns the SQL and its source list (each file name with its sha256): every `db/schema/*.sql` in name order, each once, inside one transaction. A schema file added to the temp copy appears with no code change; the same input gives byte-identical output. No generated SQL is committed (it would go stale with every schema card); the go-live run builds it with the CLI and reviews that output.
  - Same as tested: applying the built migration to an empty PGlite and an empty Postgres 16 gives the same catalog (tables, columns and types, constraints, indexes, triggers, row-level security flags and policies, functions) as the build's own schema loader on the same files (catalog dumps compared).
  - No half apply: the migration starts with a guard that refuses when schema `returns` already exists; applying it twice fails on the guard and leaves the first result intact.
  - Only `returns`: any statement that creates, alters, drops, grants or revokes on an object outside schema `returns` (other than the revokes from the public-key roles below) is refused naming the file and line; planted `create table public.x` caught.
  - SEC-11 no rows: the migration holds no insert, update, delete, copy or truncate; a planted insert in a schema file is refused naming the file and line.
  - SEC-6 public key (class rule over the catalog, every object in `returns`): with the planted default privilege in place, after the migration `anon`, `authenticated` and PUBLIC have no usage on schema `returns`; select on every table and view is refused; execute on every function is refused (Postgres grants execute to PUBLIC by default, so the migration revokes it); every sequence is unusable; a table and a function the owner creates later in `returns` are still unreadable and not executable (the migration revokes default privileges in the schema). F01's shape stays: even a role granted select reads zero rows (row-level security on, no policies). Planted faults: a migration with the execute revoke removed fails naming a function; one with the default-privilege revoke removed fails naming the later table.
  - Roles: the Returns server role named in `roles.json` gets usage on `returns` and the rights its code uses; the client app's reader gets nothing in this migration (GL3's draft grants it select on `returns.client_handoff` only). Role names are placeholders (`returns_app`, `client_app_reader`); the real names are set at go-live.
  - LIVE-4 EXPLAIN: `explainAll(db, queries, setupSql)` runs `EXPLAIN` (never `ANALYZE`, never the query itself) on each listed query against the migrated database after the given setup (the go-live run passes GL3's drafts); each failure lists the query id and the database error; a query on `bridge.*` with no bridge schema present is reported "not checked" and makes the result not clean (a flag, never a silent pass). This system's queries are listed in `db/live/shared-queries.json` (id, file, SQL); a source scan of `src/**` finds every SQL text naming `client_handoff` or `bridge.` in that list, with a planted unlisted query caught by file and line. The client app's list is supplied at go-live (LIVE-6); tests use the made-up list.
  - Messages: no output of this card prints a setting's value or a connection string (SEC-10 pattern; the CLI takes a database URL only by setting name and never prints it).

## Build
- `src/modules/golive/schema/`: `buildMigration`, `catalogOf(db)`, `explainAll`, `cli.ts` (`build --out <file>` and `explain --queries <file>`; prints file names, hashes, query ids and pass or fail only). `// @mutate` on the statement scan and the build (mutation 100, ARC-15).
- `db/live/roles.json` (strict: the two role names), `db/live/shared-queries.json`, `db/live/README.md`: the review steps for the go-live run (build, read the output, compare the hash list, run explain with both apps' lists, then apply only on Zo's yes), and the tables kept unused for review (F01's `returns.lessons`, N20). The draft keeps build and live identical: no table is dropped here.

## Check
By a third worker (Opus read): acceptance tests unchanged since the spec commit, mutation 100 on the `@mutate` files, the db tests on PGlite and Postgres 16, F01's SEC-6 test unchanged and green, `/security-review` clean, scope clean.

## Not in this card
Applying the migration to any real database, choosing the host, or setting real role names (go-live, LIVE-4: live data, Zo's yes). The bridge views and the client app's grant (GL3). The real-host walk (LIVE-9; GL1's tool is its command). Setting `is_test = false` on live rows (GL1 and the live adapters).
