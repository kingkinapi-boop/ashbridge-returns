# FX17 spec report (3 Oct 2026, cloud-e9d462)

Spec commits on `claude/FX17`: **62567b09** (head) and e5d15a96. Branched from origin/claude/SC3, then merged origin/claude/SC3 e531c40a (its A452 and A458 patches) and origin/main **9fec3666** (validated on main 9fec3666; main has since moved to 9dfb3137 with plan/ files only). Typecheck and lint green. Unit: 2645 pass, 11 fail, all in `src/contracts/actors.acceptance.test.ts`. Db: 588 pass, 51 fail: 50 in `src/contracts/actors.acceptance.db.test.ts` and 1 R66 test in `src/contracts/security-rules.db.test.ts`, which names the six FX17 columns. Every failure is either an unknown actor or free text being accepted, or `returns.system_actors` not existing yet.

## Tests
- `src/contracts/actors.acceptance.db.test.ts` (72 tests):
  - The system actor list is data: at least one row, a reason of more than 10 characters, and no name equal to a test staff id.
  - Each of the five columns accepts every test-world user id, every listed system actor, and a staff user added later.
  - Planted, and each refused with SQLSTATE class 23 naming the table and the column: an unknown id, '' and whitespace, 'system (Test)', another unlisted system name, a staff display name, a padded id, a recased id, and a padded or recased listed system name.
  - A refuse-then-accept control (the id is refused, then accepted once the staff user exists), and a check that a refusal writes no row.
  - A seeded property (seed 20261017, 40 runs).
  - A458: `sign_in_events.reason`. Every path of the stand-in still writes its row (8 distinct sentences, found by driving the engine, not copied from code; A426). Free text, and each sentence padded or recased, is refused naming sign_in_events and reason. A control accepts each sentence.
- `src/contracts/actors.acceptance.test.ts` (11 tests): the unit-project twin (step 4b), on a template it boots itself. There is no TS product file in Paths, so Stryker has nothing to mutate here. The twin keeps the rule.

## Card line "SC3's R66 KNOWN entries owned by FX17 are deleted"
At the first spec commit, SC3's R66 KNOWN list was empty on claude/SC3: its patch had not landed, and the deferred lines sat in FREE_TEXT. Round 1 therefore deleted three FREE_TEXT lines. SC3's A452 and A458 patches then landed on claude/SC3 and moved the list into `tools/test/__fixtures__/security-rules/harness.ts`. After the merge, the spec deleted FX17's five KNOWN entries there (six columns) and the now-unused `ACTOR_FIX`. The pin in `tools/test/security-rules.test.mjs` is "at most", so it stays green. R66 now fails naming the six columns. Card "Also (A457)" is done by the spec, not at landing.

## Step 6b
I ran the whole suite against a stub: an `actors` parent table with foreign keys, plus `system_actors` and a list check on sign_in_events.reason. With the stub, all unit (2656) and db (639) tests pass.

Rewritten, fixture only, no assertion changed. Each file's `cloneTestDb` now seeds the file's made-up actors as staff users:
- `src/contracts/records.acceptance.db.test.ts`: 237 failed on the stub, for example :488 "EV-1 SEC-7 an UPDATE of a row in ${t} is refused and the row is unchanged". Seeded: Preparer, Reviewer, system, Someone else, Someone (Test).
- `src/contracts/records-closing.acceptance.db.test.ts`: 11 failed, for example :335 "FLOW-4 EV-1 ${t} refuses an UPDATE of every column...". Seeded: Preparer (Test).
- `src/contracts/records-repairs.acceptance.db.test.ts`: 5 failed. Seeded: Preparer (Test).
- `src/modules/lifecycle/lifecycle.acceptance.db.test.ts`: 72 failed, for example :321 "FLOW-1 a who or why with one visible character among blanks is not blank, and is kept exactly as given". Seeded as staff ids: Pat Preparer, Robin Second, Ops Desk, and the padded actor (U+00A0 ... U+200B).

These are superseded by the card's "each column refuses a value that is neither a staff_users id nor a name on a reviewed list" and "existing rows in the test world load". Retired: none.

## Amber (spec choices)
1. **The list's shape.** The list is table `returns.system_actors`. Its `id` is the name written in the actor column, and `reason` says why. Like every table it has id, created_at, is_test and RLS (records.acceptance ARC-2 and SEC-6 enforce this). It need not be append-only. If the build makes it append-only, R66 will ask SC3's harness for a FREE_TEXT line for `system_actors.reason`. That is a Paths gap for the Lead.
2. **How a refusal must look.** A refusal is SQLSTATE class 23 and names the table and the column (in the message, the constraint or the detail). A trigger lookup does not satisfy R66. A foreign key to one parent table that holds both staff ids and system names does (the stub did this). How system actors are stored is the builder's choice (A452).
3. `adjusting_entries.author` stays nullable. Null is not tested.
4. ARC-13 is cited, but the card has no money. The property test carries the tag.
5. I read "test world" as the stand-in's test users plus the records and lifecycle worlds. There is no seeded test-world database yet.

## For the Lead
- Where else (not in this card): answers.author (70_checks) and holds.holder are also staff ids with no key.

## Refit 2026-10-03
Toolchain refit by cloud-4b5725: merged origin/main 5ba459c; typecheck and lint clean; unit suite 2824 pass, only the 11 FX17 twins fail; db project on pg16 fails only actors.acceptance.db.test.ts (50) and R66 (KNOWN entries deleted by design). No assertion changed. Old validated sha 9fec3666, new 5ba459c. Retired tests: none. Permission gaps: none. Model: Sonnet 5.5.

## Toolchain refit (3 Oct 2026, cloud-1fcc74)
Old validated sha 5ba459c; new validated on main 6c6d989. Merged origin/main; no assertion changed. Typecheck and lint green. Unit: 2908 pass, 12 fail: the 11 actors twin tests (expected) and tools/test/db-budget.test.mjs ARC-15 (CQ8's rule), which names six multi-world tests in SC3's src/contracts/security-rules.db.test.ts (R62 to R66). Those are SC3's file, not FX17's; SC3 needs a KNOWN entry or a split before it lands. Db on Postgres 16: 703 pass, 51 fail: the 50 actors db tests and the R66 test (expected).
Permission gaps: none. Model: Sonnet 5.5.
