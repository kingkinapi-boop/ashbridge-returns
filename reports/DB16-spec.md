# DB16 spec report (round 3, A419; round 2 below)

Worker local-1 (laptop), Opus 5.5. Spec commit d69ac553 on claude/DB16, validated on main 49c44fd5 (merged). Tests now: unit 68 (was 47), db 21 (was 13). Clauses ARC-4, ARC-16 (SEC-7, SEC-10 unchanged).

## The 7 tests of reports/DB16-spec-review-2.md
1. ARC-16 session state (db, both): role `db16_tx` set on the handle, then reset, then setting `app.db16`, then both: each `db.transaction` sees exactly the handle's `current_user` and setting, or is refused with a message naming what is set; with nothing set it must run (so a role left on a pooled connection after reset fails). Plus two overlapping transactions with the role set: each runs as `db16_tx` or is refused naming it.
2. ARC-16 parity on every connection (db, both): settings and same-types row through `tx.query`, in two overlapping transactions (two backend pids under ON), and on a clone of `createTemplate(<tmp dir with one .sql>)` (main session and a transaction; under ON it is Postgres 16).
3. ARC-16 parameters (db, both): a Date at 02:00Z on 31 March (22:00 on 30 March in Toronto) into `::date` and `::timestamptz`, int4[], uuid[], text[] (quote, accents) and an empty text[], jsonb from an object and from a JSON string, `9007199254740993n` into int8, a boolean, a null, quoted accented text; on the handle and in a transaction. Values read from PGlite 0.5.8: the date is 31 March (UTC day), the JSON string comes back as an object.
4. ARC-16 types by class (db, both): `COVERED_TYPES` (12) equals the column types of a temp table built from the same-types row, and covers every `format_type` of schema `returns` (tables, views); planted: interval, numeric[] and timestamp without time zone reported by name. The same-types row gains text[] and uuid[] (the catalog has both).
5. ARC-4 roles (db, both): A and B open, each makes a role, B sets its own; after A closes, B still runs as `db16_role_b`, its role exists, A's is gone; after B closes, a fresh clone sees no `db16_role_%`.
6. ARC-4 scan (unit): also a value, bare, required or dynamic import of `pg`, `pg-pool`, `postgres` (subpaths too), and `new Client(`/`new Pool(` in a file loading one; 13 planted, 6 clean; scans every test file and every non-test code file under src, tools, design, e2e, testworld, src/core/db exempt, `__fixtures__` and `.stryker-tmp` skipped; string literal contents are ignored for the `new X(` checks (a test title naming `new PGlite()` is not code). Floor and sentinels kept, plus at least 100 test files, `tools/test/db-rules.test.mjs`, `src/modules/auth/rules.acceptance.test.ts`, `tools/claim.mjs`.
7. ARC-4 one cast (unit, `readOwnSource`): exactly one `as unknown as PGlite` across src non-test files, in src/core/db/index.ts; planted cases.

## Fail first (laptop, no `pg` module, no cluster)
- Db file on PGlite (main's index.ts and global-setup.ts swapped in as a throwaway stub, then restored): 18 pass, 1 expected fail (race), 2 skipped. Tests 1 to 5 are guards on PGlite and the proof on Postgres 16, where tests 1, 2, 3 and 5 fail on the round 1 build by the review's reasons (a pool connection runs as `postgres`; nothing pinned on pool connections; node-pg sends a Date as Toronto local time; `close()` drops every role).
- Unit file on the branch: tests 6 and 7 pass (7 fails on main: no cast there); the other failures are the laptop's missing `pg` package and the 2 docs tests (identity-test line), as in round 2.
- eslint clean on both files; tsc: only index.ts errors from the missing `pg` package.

## 6b
No other test contradicted: test 6 and 7 pass on the repo, tests 1 to 5 pass on main's PGlite path. Tests retired: none. Full suite not run on the laptop (no `pg`); the cloud build and check run it.

## Amber
- Test 1 accepts a refusal only when it names what is set (the role or `app.db16`) and only while something is set.
- Test 6 scans e2e/ and design/ too (cheap, same risk), and ignores string contents for `new X(`.
- The same-types row grows by text[] and uuid[] (expectations read from PGlite literals).

## Note for the Lead
- The claims list showed `DB16 build working | cloud-555a8d` while this spec round ran: that build started before round 3; it must pick up d69ac553.

---

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

## For the build round (the round 1 build d7a2a06e is merged into this branch)
- Its url carries `postgres:postgres@` (index.ts line 46): item 7 needs no password in the url; pass it to the driver another way (PGPASSWORD, or the client config).
- Its docs lack the identity-test line with "not skipped" (item 9): the only docs assertion failing on it (checked here).
- Not run here: everything else against that build (the laptop has no `pg` module); the cloud build and check run it.

## Permission gaps
- `git reset --hard` and `git log` against origin refs were refused once each by the auto-mode classifier at the start; worked around by checking out the existing branch (no reset needed). Multi-command heredoc edits were refused as "too complex"; edits went through the Edit tool.
