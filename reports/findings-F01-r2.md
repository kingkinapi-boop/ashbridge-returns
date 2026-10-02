# Findings F01 round 2

Recorded by the Lead from the Opus findings reviewer's returned text (2 Oct 2026). Inputs: reports/F01-check.md and F01-build.md (claude/F01), plan/cards/F01.md (Fix rounds 1 and 2), reports/findings-F01-F09.md, .claude/rules/testing.md; claude/F01 db/schema 00 to 90, records.ts, ids.ts, records.acceptance.db.test.ts; F09B reading.ts; main checks.ts; the F02 spec; cards SC, F02, F06, F07, A06, F09B. No code run.

Headline: round 2 fixed the named examples, not the classes. Round 3 can be the last only if every test covers a whole class: every code point, every text column from the catalog, every caller-set order key.

## Root causes
**RC1. "Blank" has four incomplete definitions.** SQL `btrim` strips spaces only (20_ledger:32,50,51,93,94; 30_books:86,103,163,164; 50_returns:29,30,96; 60_versions:27; 70_checks:30; 00_schema:19). In PGlite's C locale `[[:space:]]` is ASCII only. zod's stamp check (records.ts:34) uses JS `trim` (NBSP blank, Cf and NEL not). main `src/contracts/checks.ts:21` `nonBlank` uses `trim`. F09B `reading.ts:29` uses Cf plus NEL plus `trim` (misses Cc, U+034F, U+3164, U+2800, SC R40). Bites: SC R13 tests only `''` and `'  '`; F02 move actor and why; F06 80_jobs kind and idempotency key; F07 05_bridge; A06 15_auth; later actor or reason columns (T12, G00, L00).

**RC2. Non-blank and "points at something real" are opt-in for named columns; zod mirrors none.** All 22 `id text primary key` columns accept `''`; pointer ids (client_answer, cra_capture, prior_return, qbo snapshot, account, txn), links (kind, from/to table and id), events.record_table and record_id, fact_key, figure_key, cell_id (version_cells, judgment_inputs, differences), check_id, gifi_code, qbo ids, fingerprint, file_name, entity_name, answer, summary; nullable text present but blank (source_reason, method, holds.reason, entries.reason and author, figures.cell_id). `return_id` has no foreign key on 12 tables (documents, facts, accounts, gifi_mappings, adjusting_entries, judgment_inputs, figures, versions, approvals, check_results, exceptions, differences). Sources members `{"x":""}` and `{"x":null}` pass `sources_are_real`. zod: every text field is `z.string()`; ids.ts `min(1)` accepts `' '`; check 12 is nominal. exceptions.status and links.kind have no CHECK list (SC R15). Later schema files share the gap: 05_bridge (F07), 15_auth (A06), 35_qbo (B04), 80_jobs (F06).

**RC3. Order and licences trust the caller.** `seq` can be overridden (OVERRIDING SYSTEM VALUE); a state event can be inserted for any from_state; several pending events can pile up and a stale one licenses a later move. Caller-set numbers: version_no on facts, adjusting_entries, judgment_inputs, versions; gifi_mappings.mapping_version. Bites: F02 move and voidApproval, L00 changeFact, B05, T12, N00, G00, F06 job ordering.

**RC4 (process). Each check plants one example in one named column.** Tests must enumerate classes.

## Card decisions (amber)
- Check 17 widens: every text column outside a named value allow-list refuses blank, in SQL and zod, with one definition.
- Blank, defined once: only White_Space, Cc, Cf or Default_Ignorable_Code_Point characters, plus U+2800 (superset of F09B's rule).
- Value allow-list: facts.value, version_cells.value, judgment_inputs.value, figures.value, differences.before_value and after_value.
- Check 16 adds: caller-set seq refused; from_state equals the return's state; to_state differs from from_state; at most one pending event per return.
- New check 20: return_id is a foreign key everywhere and pointer ids are non-blank; version numbers start at 1 and go up by exactly one (five tables).
- Paths gain `src/contracts/text.ts`, `src/contracts/text.test.ts`.
- Last-round rule: if round 3 fails only on S6 or S7, land the rest and move the ordering rules into F02; any other failure parks F01 and SC.
- exceptions.status value list belongs to E03 (SC R15 flags it).

## Consolidated fix list
Spec (a new worker who has not touched F01; every test fails on the head for the right reason; validate on main):
- S1 Blank parity property: `isBlank` (TS) and `returns.is_blank` (SQL) agree on every code point except U+0000 and surrogates (one generate_series query); mixed blank strings are blank; one visible character among blanks, including a lone U+0301, is not.
- S2 Catalog-driven: every text column outside the value list (ids, pointers, nullable when present) refuses `''`, `' '`, tab, newline, NBSP, U+200B, U+3000, U+2800 with SQLSTATE 23514 naming the column; the matching zod field refuses the same.
- S3 Every table with return_id has a foreign key to returns.returns (catalog) and refuses a missing return.
- S4 Explaining an entry is refused with reason tab, sources `["\t"]`, `[" "]`, `[{"x":""}]`, `[{"x":null}]`, and blank pointer ids.
- S5 Stamps `{"x":"\t"}`, `{"x":NBSP}`, `{"x":U+200B}` refused by SQL and zod.
- S6 FLOW-1 refusals: OVERRIDING SYSTEM VALUE seq 999; filed to closed while at evidence; a second pending event; to_state equal to from_state.
- S7 Version numbers: first is 1, next is previous plus 1; 999 or a gap refused on all five tables.
- S8 Refit: the control at line 882 uses the fixture's pending event first, then inserts evidence to gaps; every `expectRefused` in FLOW-1 and check 17 asserts the constraint name or message.

Build:
- B1 `src/contracts/text.ts` (`// @mutate`): frozen `BLANK_RANGES` generated once under Node 24, `isBlank`, `NonBlankSchema`; ids.ts base id is NonBlankSchema; records.ts non-value text fields NonBlankSchema (nullable where the column is); VersionStampSchema uses `isBlank`.
- B2 00_schema `returns.is_blank(text)`: immutable regex from the same ranges (`\u`, `\U`), never `btrim` or `[[:space:]]`; every `btrim` check becomes `not returns.is_blank(...)`; non-blank CHECK on every non-value text column including primary keys; `is_version_stamp`, `sources_are_real`, `facts_one_source`, `check_entry_explained` use it.
- B3 return_id references returns.returns(id) on all 12 tables.
- B4 state_events BEFORE INSERT trigger: refuses a seq not from the identity (`new.seq <> currval(...)` or currval undefined raises 23514); locks the return FOR UPDATE; from_state = state and to_state <> from_state; no pending event; the licence lookup is "the pending event".
- B5 One generic BEFORE INSERT trigger: version_no or mapping_version is previous max plus 1 per key (facts: return, fact_key; entries: return, snapshot, txn; judgment inputs: return, cell; gifi: account; versions: return).
- B6 Mutation 100 per file on text.ts, ids.ts, records.ts.

## Follow-ups on other cards
F05M: checks.ts uses `isBlank`. F09B: WordSchema uses `isBlank` after F01 lands. F02: move, voidApproval and holds check actor, why, holder with `isBlank`, return `{ok:false}` before writing, event plus return update in one transaction. F06, F07, A06, B04: `returns.is_blank`, NonBlankSchema, return_id foreign keys. L00, B05, T12: a new version is previous plus 1.

## Rule tests for SC (each fails first on a planted example under tools/test/__fixtures__/schema-contract/)
- R13 rewrite: catalog-driven non-blank over every text column outside the allow-list (kept in text.ts with reasons); planted `btrim` check accepting tab, and a column with no check.
- R41 one blank definition: no `btrim(`, `trim(`, `[[:space:]]`, `\s` in db/schema checks; no `.trim()` or `min(1)` non-blank rule in src/contracts or src/modules. Absorbs R40.
- R42 SQL and zod parity field by field.
- R43 every return_id, and every `*_id` whose target table exists, is a foreign key; pointer ids to unbuilt tables are non-blank and the allow-list names the future card.
- R44 every identity column refuses OVERRIDING SYSTEM VALUE; every version column refuses a gap or jump.

## Risks and re-tests
- PGlite must support `\U` regex escapes (S1 proves it); U+0000 cannot be stored, zod still refuses it.
- Value allow-list too short breaks F03 and T07 empty-cell round trips; too long lets blanks through; keep it in text.ts.
- Pending-event rule: F02 inserts the event and moves in one transaction; re-run the F02 db acceptance file against round 3; W00, JH0, SK0 seeders move one event at a time.
- return_id foreign keys: check 12 insert order, seeders' order.
- currval guard is session-dependent (fine in PGlite and one statement on Postgres); reversal: overwrite with nextval.
- Version rule affects L00 changeFact, B05, T12, F02 fingerprint `{id, version}`.
- Re-check: typecheck, lint, `npm test`, db project, `test:flake` 5 of 5, mutation 100 per file, an Opus adversarial read attacking classes.
