# DB16 spec report (round 2, A411)

Worker local-2 (laptop). Model: Opus 5.5 (local worker; core and security card). Branch claude/DB16; round 1 was d6f3a1b1, round 2 adds the 9 gaps of reports/DB16-spec-review.md plus its optional lower-case refusal. Validated on main 2288da55.

## Files
- `src/core/db/pg16.acceptance.test.ts` (unit, 47 tests, was 29).
- `src/core/db/pg16.acceptance.db.test.ts` (db, 13 tests, was 5; runs in both modes: 10 plain, the race `test.fails` on PGlite, and 2 `runIf` per mode).

## Round 2 tests, by review item
1. Cluster down (unit): TEST_DB=pg16, PGPORT a loopback port opened then closed: the global setup rejects, and `createTemplate()` rejects (if it resolves, the test names the backend it resolved on).
2. Every path (db, runIf ON): `createTemplate(DEFAULT_SCHEMA_DIR).clone()` is Postgres 16.x on 127.0.0.1, not PGlite.
3. Rule scan (unit): no file in the db include of tools/test-homes.json and no non-test file under src/ outside src/core/db/ has `new PGlite(`, `PGlite.create(`, a value import of PGlite (named, aliased, default, namespace) or a dynamic import of the package; 7 planted texts flagged, 4 clean texts not; at least 9 db files, sentinels auth.acceptance.db.test.ts, pg16.acceptance.db.test.ts and src/modules/auth/index.ts; files read through `readOwnSource`.
4. SEC-7 by class (db, both backends): the trigger names loaded equal the `create trigger` names parsed from db/schema/*.sql (at least 40); every returns table with a BEFORE TRUNCATE trigger (floor: the 15 guarded tables) refuses `truncate ... cascade` with its own guard's message, and has BEFORE row guards on UPDATE and DELETE (jobs: DELETE). Planted: a declared name missing is reported; `jobs_no_delete` dropped is reported; with `state_events_no_truncate` dropped, state_events is no longer refused by its own guard.
5. Session pinned (db, both): TimeZone `Etc/GMT+5`, DateStyle `ISO, MDY`, IntervalStyle `postgres`, default isolation `read committed`, server and client encoding UTF8, standard_conforming_strings on, datcollate `C`, datctype `C.UTF-8` (read from PGlite 0.5.8 under TZ=America/Toronto).
6. Types (db, both): int4, int8 cents (positive, negative) and count(*) are JS numbers, an int8 beyond 2^53 is a BigInt, numeric(12,2) a string, date a Date at UTC midnight, timestamptz a Date, jsonb an object, nulls null, int4[] an array, uuid a string; plus an int8 money parameter round trip.
7. SEC-10 (unit): PGPASSWORD=PLANTED-db16-pass gives a url with no password; with the cluster down, the setup rejection (message, stack, cause) and everything sent to console hold no PLANTED value.
8. Before any socket (unit): the three global-setup refusal cases now also assert zero `net.Socket.prototype.connect` calls; switch off with DATABASE_URL and SUPABASE_URL set: setup resolves on PGlite with zero connects and prints no planted value.
9. Docs (unit): each of checker.md and cloud-worker-run.md has one line with `TEST_DB=pg16` and the db project command (`--project db` or `npm test`), a cluster start command (`pg_ctlcluster 16 <name> start`, `pg_ctl ... start`, `service postgresql start` or `systemctl start postgresql`), "every train", `db/` and `*.db.test.ts`, and one line naming the identity test ("a test database is Postgres 16") with "not skipped".
Optional: `supabase_url` (lower case) with the switch on is refused.

## Fail first (laptop, PGlite)
- Unit: 34 of 47 fail for the right reason: `exports no testDbTarget(env)`, the setup resolving instead of refusing, `createTemplate()` "resolved on PostgreSQL 18.3 (PGlite 0.5.8)", and the docs lacking the steps. 13 pass and guard: the 11 planted and clean scan texts, the repo scan (nothing builds a database outside src/core/db today), and the switch-off setup.
- Db, switch off: 10 pass, 1 expected fail (race), 2 skipped (runIf ON). They guard the PGlite path; on Postgres 16 they are the checker's proof.
- tsc clean (only the known laptop gap: exceljs, pdfjs-dist); eslint clean on both files.

## 6b sweep
Throwaway stub in this worktree (testDbTarget, the switch in createTemplate failing closed on a socket error, one call in global-setup), never committed, reverted with `git checkout`. Whole unit project: only the 2 docs tests of this card fail, plus 3 laptop-only failures unrelated to db (design/basis RV-52 build timing; src/modules/storage/real-parent ARC-6 two symlink tests on Windows). Whole db project: 554 passed, 1 failed once (auth.acceptance.db.test.ts "ARC-6 in production AUTH_ENGINE=testusers set by name works", four worlds in one test under full-run load; its env is passed explicitly and never reads TEST_DB) and passed alone and in a full rerun (555 passed). Tests retired: none.

## Changed in round 1 tests (this card's own)
- The switch-off identity test drops `toBeInstanceOf(PGlite)` (a value import the new rule scan forbids in db test files) and keeps `version()` matching /PGlite/.
- The setup refusal cases stub every switch variable first (TEST_DB, PGHOST, PGHOSTADDR, PGPORT, PGPASSWORD, DATABASE_URL, any SUPABASE name), so a box running the suite with the switch on sees the same thing.

## Amber
- The pinned TimeZone is PGlite's `Etc/GMT+5` (a fixed UTC-5, no daylight time), not America/Toronto: parity with what every db test was written against. Reverse: change both backends together on a later card and edit the fixed value.
- datctype `C.UTF-8`: the builder creates each test database with LC_COLLATE 'C', LC_CTYPE 'C.UTF-8' from template0 (glibc on the cloud box has C.UTF-8).
- The truncate check uses `truncate ... cascade` so a foreign key cannot refuse in the guard's place (on PGlite, adjusting_entries, state_events and versions are refused by the foreign key first without cascade; the round 1 state_events test passed for that reason, now covered by class).
- Docs: the cluster start accepts four command shapes; the identity test is named by the fragment "a test database is Postgres 16".
- The switch-off socket test and the scan pass today: they guard the default path, as the review asked.
- The Postgres 16 path is not proven here (no cluster on the laptop): the cloud checker runs the seven points in the review's last section.

## Permission gaps
- `git reset --hard` and `git log` against origin refs were refused once each by the auto-mode classifier at the start; worked around by checking out the existing branch (no reset needed). Multi-command heredoc edits were refused as "too complex"; edits went through the Edit tool.
