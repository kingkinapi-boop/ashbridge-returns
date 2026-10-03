# DB16 spec review (core, security)

Reviewer: Opus 5.5, cold. Spec d6f3a1b1 on claude/DB16 (pg16.acceptance.test.ts, 29 unit; pg16.acceptance.db.test.ts, 5 db). Clauses ARC-4, ARC-16, SEC-7; testing.md.

## Verdict: GAPS (9 tests to add; build held until the spec round adds them)

Strong already: `testDbTarget(env)` is pure and fixed by class (off, on, port, local and non-local PGHOST/PGHOSTADDR, wrong switch values, DATABASE_URL and SUPABASE refusals that name the variable and never print the planted value); the global setup refusals read env at call time (the three-case `test.each` forces it); the planted race pins READ COMMITTED and needs two backends (`pg_backend_pid`), so a single-session adapter cannot pass; the identity test needs TCP on 127.0.0.1, server_version_num 160000 to 169999 and a non-default database.

Not proven by class:
- Fail closed is tested only for env refusals. Nothing fails if the switch is on and the cluster is down, or if the worker path (`vitest-setup.ts` calling `createTemplate()`) still boots PGlite. Two files (`src/contracts/records.acceptance.db.test.ts`, `records-repairs.acceptance.db.test.ts`) call `createTemplate(dir)` directly: under the switch they would run on PGlite silently.
- SEC-7 checks only the three state_events triggers; the schema has about 40 guards (events, facts, versions, version_cells, approvals, entry_lines, judgment_inputs, gifi_mappings, client_refs, bridge_ops_items, client_handoff, sign_in_events, jobs).
- "No secret printed" covers refusal messages only, not the pg16 url, connection errors or setup logging.
- Nothing pins session settings or row types across backends (ARC-16): PGlite is PostgreSQL 18.3 with its own TimeZone, collation and type parsers; a pg16 cluster with en_US collation or string int8/numeric would change results, and the builder cannot touch acceptance tests to adapt.
- The docs test asks only for the text `TEST_DB=pg16`.

## Tests to add (spec job; each fails first on main for the stated reason)
1. ARC-4 fail closed, cluster down (unit): TEST_DB=pg16, PGPORT = a loopback port just closed (listen(0), close): the global setup rejects and `createTemplate()` rejects; neither resolves nor returns a PGlite template. Today both resolve on PGlite.
2. ARC-4 every path honours the switch (db, runIf ON): `createTemplate(DEFAULT_SCHEMA_DIR)` then `.clone()` is Postgres 16 on 127.0.0.1, not PGlite.
3. ARC-4 rule scan, every db test and module (unit): no file under the db include of `tools/test-homes.json` nor any non-test file under src/ outside src/core/db/ constructs a database (`new PGlite(`, `PGlite.create(`, a value import of PGlite); planted bad text flagged; asserts at least 9 db files read (via `readOwnSource` rules where applicable).
4. SEC-7 every guard, by class (db, both backends): from the catalog, every `returns` table with a BEFORE TRUNCATE trigger refuses `truncate` (behavioural; statement triggers fire on empty tables), and each has a BEFORE row UPDATE or DELETE guard (jobs: DELETE); the set of non-internal trigger names loaded equals the set of `create trigger` names parsed from db/schema/*.sql, so a partial load on pg16 fails. Planted: a parsed name missing from the catalog is reported.
5. ARC-16 pinned session (db, both backends): `show timezone`, `datestyle`, `intervalstyle`, `default_transaction_isolation` ('read committed') and the test database's `datcollate`/`datctype` equal fixed values the spec-writer reads from PGlite.
6. ARC-16 row-type parity (db, both backends): one row of int4, int8, numeric(12,2), text, boolean, date, timestamptz, jsonb, null gives the same JS types and values as PGlite (fixed expectations). Money values must not change type on pg16.
7. SEC-10 no secret on the pg16 path (unit): TEST_DB=pg16, PGPASSWORD=PLANTED-db16-pass, closed port: the target url carries no password, and the setup rejection plus every console.log/warn/error spied during setup contain no PLANTED value.
8. ARC-4 refuses before connecting (unit): add a spy on `net.Socket.prototype.connect` to the existing global-setup refusal cases: zero calls. And switch off with DATABASE_URL and a SUPABASE variable set: setup resolves on PGlite with zero socket connects (laptop path unblocked, connects nowhere).
9. ARC-4 cloud orders (unit, tighten the docs test): each of checker.md and cloud-worker-run.md has one line holding `TEST_DB=pg16` and the db project command, names the cluster start command, the trigger (every train; any card touching db/ or a `*.db.test.ts`), and the identity test that must show passed, not skipped.
Optional: a lower-case `supabase_url` is refused too (names are case-sensitive on Linux; a flag beats a silent pass).

## What the cloud checker must prove (the pg16 path has never run)
- Cluster is 16.x on 127.0.0.1; `TEST_DB=pg16` db project green: every db file ran, test count equals the PGlite run's except the two runIf tests; the identity test passed (not skipped); the race passed as a plain test; A06's auth.acceptance.db.test.ts passed, including the 8-way lock-out and code races (security review L1 inference now proven).
- Same run with the switch off green (race expected-fail). Unit project green.
- pg16 db project run twice, both green, no retry used (ARC-16).
- After the runs, `pg_database` holds no test database (created and dropped by setup).
- Planted live checks: cluster stopped with the switch on makes the run fail at setup; `DATABASE_URL=PLANTED-x` makes it refuse naming it; the output contains no PLANTED value.
- Opus read: the driver's host comes only from the built url (no PGHOST, PGSERVICE or ssl path to elsewhere); the network guard is not widened past loopback.

## Risks for the build
- Acceptance tests and four modules (auth, bridge, jobs, lifecycle) type `db` as `PGlite`; builders cannot edit the tests. A pg-backed handle cast to `PGlite` hides PGlite-only calls (`clone`, `closed`) until pg16 runs. Lead amber: a structural `TestDb` type through a spec refit, or the cast plus test 6 and the checker's full pg16 run.
- Pool size and `max_connections` under cloud `maxWorkers 50%`; CREATE DATABASE from a template needs the template idle. Hook and test timeouts were measured on PGlite: re-measure on pg16 before changing them.
