# SC Schema and contract rules

Phase 0. Size M. Deps: F01, F09, F05M. Where: local or cloud.
Tags: core (permissions and citations: the rules keep every later table and box honest).
Paths: tools/test/schema-contract-rules.test.mjs, src/contracts/schema-rules.db.test.ts, tools/test/__fixtures__/schema-contract/**
Clauses: SEC-7, EV-1, ARC-10, EV-5, EV-8, EV-10, FLOW-1, ARC-15
Read: `reports/findings-F01-F09.md` (rule tests R12 to R18, risks), `plan/cards/F01.md`, `plan/cards/F09.md`, blueprint 03 (EV-1, EV-5, EV-8, EV-10), 02 (FLOW-1), 08 (SEC-7), 09 (ARC-10, ARC-15), `.claude/rules/testing.md`, `tools/test/db-rules.test.mjs` (the pattern).
Spec commit: (spec-writer fills)

## Goal
The faults the F01 and F09 checks found (RC1 to RC5) can come back in every table and contract later cards add. SC turns each into a rule that runs over every table in schema `returns` and every file under `src/contracts` and `src/modules`, so the next card that forgets a TRUNCATE trigger, a non-blank check or the one Box shape fails on main, not at a check.

## Who does what
- The spec job writes R12 to R18, each first failing on a planted bad example under `tools/test/__fixtures__/schema-contract/`, and validates on main (spec-writer step 6). Database rules (R12 to R15) live in `src/contracts/schema-rules.db.test.ts` (the `db` project) and read the catalog of a template built with `createTemplate` from the real schema folder through the `db` project's clone, never by naming `db/schema` (TH rule R4); planted bad tables are created in the test's own clone. File rules (R15's list side, R16 to R18) live in `tools/test/schema-contract-rules.test.mjs` (the `unit` project).
- This card is rules only. A rule that fails on main as it stands is a defect of the card that owns that file; it is added to that card, never fixed here.

## Acceptance checks
1. SEC-7, EV-1 (R12): every table in schema `returns` with an UPDATE or DELETE refusal also refuses TRUNCATE. Planted: a table with update and delete triggers and no truncate trigger.
2. EV-1, FLOW-1 (R13): every column named actor, author, reason, approved_by, holder or `*_by` refuses '' and '  '. Planted: a reason column with no non-blank check.
3. ARC-10 (R14): every version_stamp column refuses `{}`, `{"x":null}` and `{"x":""}`, and every zod VersionStampSchema refuses the same three. Planted: a stamp check that accepts `{"x":null}`.
4. EV-8, EV-10, FLOW-1 (R15): every column named state, `*_state`, status, origin or entry_type has a CHECK whose list equals the matching list in `src/contracts/records.ts`. Planted: a status CHECK with one value missing.
5. FLOW-1 (R16): no `order by ... created_at` or `order by ... id` in `db/schema` or `src/modules` unless an identity seq comes first. Planted: a view ordering state events by created_at then id.
6. EV-5 (R17): one box shape: no zod object with x0, y0, x1, y1 in `src/contracts`, and every box field uses F09's BoxSchema. Planted: a contract with its own `{x0,y0,x1,y1}` box.
7. ARC-15 (R18): every core file under `src/contracts` and `src/modules` carries `// @mutate` in its first 5 lines. A file is core when a card whose `Tags:` line starts with `core` lists it in its `Paths:` line (globs expanded, test files left out); `plan/slices.json` is not the source. Planted: a core card's file without the marker fails; the same unmarked file under a non-core card passes.
8. On main with F01 and F09 landed: `npm run typecheck`, `npm run lint`, `npm test`, the `db` project and `npm run test:flake` (5 of 5) pass.

## Not in this card
Fixing any schema or contract file (the owning card does it). Seeding helpers that reach later states through events (W00, JH0). Rules for other kinds of record beyond R12 to R18.
