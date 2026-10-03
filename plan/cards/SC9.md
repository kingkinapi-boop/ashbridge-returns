# SC9 Rule walkers: no escape by name, kind or path

Phase 0. Size S. Deps: SC, SC7. Where: cloud.
Tags: core (the rules keep every later table and reader honest).
Paths: tools/test/rule-walker.test.mjs, tools/test/__fixtures__/rule-walker/**, tools/test/lib/walk.mjs, tools/test/rules.test.mjs, src/core/db/db.test.ts, src/contracts/schema-rules.db.test.ts, tools/test/__fixtures__/schema-contract/known.json, data/schema/contract-tables.json (A488, A490)
Clauses: ARC-15, ARC-16
Read: `reports/SC-spec-review-3.md` (section 3, escapes), `plan/cards/SC.md`, `.claude/rules/testing.md`.
Spec commit: (spec-writer fills)

## Goal
SC's rules walk files with their own lists and filters, so new code can escape them (reports/SC-spec-review-3.md): the walker skips a `coverage` folder at any depth and reads only .ts and .tsx; reader folders are fixed lists (R47, R48, R54); R18 drops Paths items with notes and misses `core` after another tag; R35 and R51 filter by file name or extension; the db rules miss tables outside schema `returns` and `*_status` columns.

## Spec
One shared walker (`tools/test/lib/walk.mjs`) with a test per escape: a planted file in a nested `coverage` folder inside src, a `.mts` and `.js` source, a reader in a new folder (readers found by export, `create*Reader`), a Paths item with a note, a card tagged `security, core`, a renamed fixture, a table in another schema, a `*_status` column. Each rules file moves to the walker in its owner's next round (as SC7's helper).

## Build
The walker and its test only.

## Check
A checker who did neither: every planted escape is found; the walker's result on main equals the union of what the current rules walk plus the escapes.

## Also (A440, from reports/SC-check.md)
Shape tests the SC check asked for: NO_FILE_HOMES (tools/test/rules.test.mjs), READERS, PENDING rows (rule name and why), FUTURE_POINTERS staleness (src/core/db/db.test.ts); KNOWN_KEYS allows only the keys SC uses. The spec job owns these test lines.

## Also (A452, reports/SC3-findings.md)
Plant the file-walker escapes SC3's review found (copied walkers that skip a folder or extension) and text inside jsonb columns.

## Contract tables in R42 and R43 (A488, 3 Oct)
R42 and R43 learn the shared contract tables from data with a reason per table: `returns.client_handoff` keeps its singular name (the onboarding contract, section 4), so no RecordSchema name maps to it, and its `fact_id` is a catalogue key, not a row pointer. Then the two KNOWN entries FX3 hands to SC9 go. Paths gain src/contracts/schema-rules.db.test.ts, tools/test/__fixtures__/schema-contract/known.json and the data file.
