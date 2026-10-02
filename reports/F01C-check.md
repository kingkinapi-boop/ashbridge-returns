# F01C check (cloud-e592ae, Node 24, full)

FAIL (last round: goes to the Lead to park or split).

Passed: typecheck, lint, deps:check; npm test (unit 1532, db 295); test:flake 5 of 5; mutate:canary 100; mutate:changed F01C 100 (records.ts 91, text.ts 21); spec files records-repairs.acceptance*.test.ts unchanged since 3c54b09. e2e not run (no screens, no app change).

## Failures
1. Scope (`node tools/scope.mjs F01C`): `plan/ledger.jsonl` rows on the branch (build commit 2866afe added 5 rows; revert before boarding); `src/contracts/value-columns.db.test.ts` is a builder-written test outside the card's paths (a new test file not in the spec commit; the Lead decides keep or move through a spec job); `plan/cards/F01.md` came in with the F01 history (Lead file, likely a false alarm).
2. Opus read, item 1: `db/schema/30_books.sql:27-29` gifi_mappings still allows DELETE and TRUNCATE (every other version table refuses both). Delete v1 row then insert v1 with another code is accepted, so a version's GIFI code is rewritten in place (TB-3). `update gifi_mappings set id='g9'` is accepted: the primary key is not in the guard's column list.
3. Item 3: `src/contracts/records.ts:34` `fromOne = z.number().int().min(1)` has no upper bound; SQL `integer` refuses 2147483648 (22003), zod accepts it, for version_no, mapping_version, source_page, source_row.
4. Item 2 (narrow): zod version stamp mirror `records.ts:37` disagrees with SQL `is_version_stamp` (`00_schema.sql:23`): `{"__proto__":"v1"}` SQL true, zod refuses; `{"__proto__":"v1","b":"v"}` zod accepts but drops the key; `{"a":1e400}` SQL true, zod refuses (Infinity).

Rule candidates: every table with a version column gets the full immutability set (update, delete, truncate) from the one shared guard, catalog-tested; every zod numeric mirror of an SQL integer column carries the int4 upper bound; zod/SQL parity tests run over a shared hostile sample set (`__proto__`, huge numbers).

Item 4 and blank-key classes (tab, NBSP, U+200B, U+0085, U+00AD, U+180E, U+FEFF, U+E0001): no defects.

## Permission gaps
None.

## Model
Sonnet 5.5 checker; Opus subagent for the adversarial read.
