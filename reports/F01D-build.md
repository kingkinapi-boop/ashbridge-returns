# F01D build (cloud-1d0d85)

Branch claude/F01D. Head: see claim note.
Changed: db/schema/00_schema.sql (version_table_guard replaces version_update_guard; is_finite_number; is_version_stamp refuses __proto__ and non-finite), 20_ledger.sql, 30_books.sql, 60_versions.sql (every version table uses the one guard for UPDATE, DELETE, TRUNCATE), src/contracts/records.ts (fromOne max 2147483647, null-prototype stamp refusing __proto__ and non-finite, sourcesAreReal refuses __proto__ and non-finite), records.test.ts (one added test).
Acceptance: 56 of 56 F01D tests pass; full suite 1996 of 1996; typecheck, lint, deps:check clean; mutate:changed 100 on records.ts and text.ts.
Scope: `scope.mjs F01D` lists plan/cards/F01.md, plan/cards/F01C.md and records-repairs.acceptance.db.test.ts, all inherited from the F01C base (not touched by this build).
Ambers: (1) facts.status and adjusting_entries.explained stay in-place columns, passed as guard arguments; reverse by dropping the argument. (2) One guard function and one error code (23514) for all version tables; the old refuse_change stays for non-version tables.
Permission gaps: none. Model: Sonnet 5.5 (core card: needs the Opus adversarial read in check).
