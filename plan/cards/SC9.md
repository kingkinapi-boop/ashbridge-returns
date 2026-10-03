# SC9 Rule walkers: no escape by name, kind or path

Phase 0. Size S. Deps: SC, SC7. Where: cloud.
Tags: core (the rules keep every later table and reader honest).
Paths: tools/test/rule-walker.test.mjs, tools/test/__fixtures__/rule-walker/**, tools/test/lib/walk.mjs
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
