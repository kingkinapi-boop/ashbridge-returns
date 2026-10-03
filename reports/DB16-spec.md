# DB16 spec report

Worker local-2 (laptop). Model: Opus 5.5 (local worker; the card is core and security). Branch claude/DB16 from origin/main 73751b0e.

## Files
- `src/core/db/pg16.acceptance.test.ts` (unit, 29 tests): the switch `testDbTarget(env)` (off, on, url on 127.0.0.1, PGPORT, local and non-local PGHOST and PGHOSTADDR, values of TEST_DB that are not the switch, DATABASE_URL and SUPABASE refusals that name the variable and never print the value), the global setup refusing before it connects, and the two cloud docs carrying `TEST_DB=pg16`.
- `src/core/db/pg16.acceptance.db.test.ts` (db, 5 tests; runs in both modes): switch off gives a PGlite clone; switch on gives Postgres 16 (server_version_num 160000 to 169999, not PGlite), on 127.0.0.1, in a non-default database; two test databases are isolated; SEC-7 (truncate of state events refused, the three state-event triggers loaded); the planted race.

## The planted race
Two transactions on one test database each read a counter, wait at a barrier (at most 1 s), then write read+1, under READ COMMITTED. On Postgres 16 both read 0 on two backends (pg_backend_pid differs) and one increment is lost (final 1). PGlite's single connection cannot start the second transaction until the first commits (reads 0 then 1, final 2, one backend). The test is `test.fails` with the switch off and `test` with it on, so it passes on PGlite as an expected failure and must pass on Postgres 16. The backend check stops a single-client adapter (two "transactions" in one session) from passing falsely.

## Fail first (validated on main 73751b0e)
- Unit: 29 of 29 tests that need the build fail: `DB16: src/core/db/index.ts exports no testDbTarget(env)`, the global setup resolving instead of refusing, and the docs lacking `TEST_DB=pg16`.
- Db, switch off: 3 pass (isolation, SEC-7, PGlite clone), 1 expected fail (the race), 1 skipped (the Postgres 16 identity test). Nothing to build on this path; they guard it.
- Db, `TEST_DB=pg16` on the laptop today (the switch is not built, so still PGlite): 2 fail for the right reason: `expected 'PostgreSQL 18.3 (PGlite 0.5.8) ...' not to match /PGlite/` and `the two transactions run on two connections, not one session: expected 1 to be 2`.
- tsc and lint clean on these files; the only repo errors are the known laptop gap (exceljs and pdfjs-dist missing: src/modules/ocr, src/modules/sheets).

## 6b sweep
A throwaway stub (testDbTarget in index.ts, one call in global-setup.ts), never committed, reverted with `git checkout`: unit `src/core` plus `tools/test` 327 of 329 green (the 2 docs tests need the build's doc edits); db `src/core` green (5 passed, 1 expected fail, 1 skipped). Tests retired: none. Not proven here: the Postgres 16 path itself (no cluster on the laptop); the checker runs it on a cloud box.

## Amber
- Surface: `testDbTarget(env)` exported from src/core/db/index.ts, pure, returning `{ kind: 'pglite' } | { kind: 'pg16'; url }`. Reverse: rename in the unit file's `target()` helper.
- TEST_DB: only unset or '' is off and only exactly `pg16` is on; anything else (PG16, true, 1, a URL) is refused rather than read as off, a flag for a person rather than a silent pass.
- The refusals (DATABASE_URL, any name containing SUPABASE, even when empty) apply only with the switch on; with it off PGlite connects nowhere, so the default run is never blocked by a stray variable.
- Local hosts: PGHOST or PGHOSTADDR may be unset, 127.0.0.1 or localhost; other values (a name, a private address) are refused. ::1 and socket paths are left to the builder (no test either way).
- Fresh database per run: tests pin a non-default database name and isolation between test databases; "dropped by the global setup" is not observable from inside a test, so the checker confirms no test database is left on the cluster after a run.
- The race uses a 1 s barrier wait; on Postgres 16 both transactions arrive in milliseconds, so it is not a timing bet (ARC-16), but a box that needs over 1 s to open a second connection would fail it.
- The planted values carry the gitleaks allowlisted `PLANTED-` prefix; gitleaks itself is not on the laptop, so GitHub checks confirm.
- The docs test reads .claude/agents/checker.md and .claude/cloud-worker-run.md; it asks only for the text `TEST_DB=pg16`.

## Permission gaps
None.
