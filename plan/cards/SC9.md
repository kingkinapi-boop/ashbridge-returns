# SC9 Rule walkers: no escape by name, kind or path

Phase 0. Size S. Deps: SC, SC7, SC3. Where: cloud.
Tags: core (the rules keep every later table and reader honest).
Paths: tools/test/rule-walker.test.mjs, tools/test/__fixtures__/rule-walker/**, tools/test/lib/walk.mjs, tools/test/rules.test.mjs, src/core/db/db.test.ts, src/contracts/schema-rules.db.test.ts, tools/test/__fixtures__/schema-contract/known.json, data/schema/contract-tables.json (A488, A490), tools/test/__fixtures__/security-rules/harness.ts, tools/test/security-rules.test.mjs (A491)
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

## Also (A491, 3 Oct): SC3's rule gaps N1, N2, N4 and the N3 pin
From reports/SC3-security-2.md (on claude/SC3, on main once SC3 lands); each fix with a plant that fails first.
- N1: formatPattern counts a negated bracket, or one holding \S, \W, \D, [:print:] or [:graph:], as a wildcard when repeated, unless the pattern holds a literal outside brackets. Plants: `^[^\s]+$`, `^[\s\S]+$`, `^[[:print:]]+$`.
- N2: appendOnlyTables counts DELETE and TRUNCATE triggers that raise, BEFORE or AFTER; the unit twin flips (its comment "refuses nothing in time" is wrong). Plant: an AFTER guard without the words "append-only".
- N4: the tag MENTION match ignores case, so STRICT reports `@Once` and `@ONCE`. Plant both.
- N3: tools/test/security-rules.test.mjs pins a sha256 of harness.ts with the KNOWN block blanked, so an owner (L00, B05, T08, FX17) can delete its own KNOWN lines but cannot change a rule function.
Paths gain tools/test/__fixtures__/security-rules/harness.ts and tools/test/security-rules.test.mjs; SC9 starts after SC3 lands (Deps).
