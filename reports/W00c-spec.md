# W00c spec report (round 3, A450)

Card: plan/cards/W00c.md. Findings: reports/W00c-findings-3.md (RC-A, RC-B, RC-C). Clauses: ARC-8, ARC-13, ARC-16, END-9, TB-3.
Spec commit: e015bd7f on claude/W00c. Validated on main f980ffd9 (merged as b2868cbf; main moved by plan files only since 46ab96ea).
Earlier rounds: round 2 82b19ae5, review 3 patch d89d7e8b (their commit messages are their reports).

## Probe (read only, all 15 sample folders, rerun for this spec)

- Date paths: 68 with statementBalances account keys literal (64 with account keys merged); 10713 date leaves. 4 leaves on 2 paths match the fix 4 date shape but are not dates: C10 t2Inputs.schedule8.classes[].class "10.1", C12 onboarding answers[].answer_verbatim "960.00" and "100.00". Without those 2 paths: 66 date paths (the tests' floor). The findings' 80 is not reproduced by this probe.
- Id-shaped paths: 17 with 946 leaves. Without adjustingEntries[].id: 16 reference paths (the findings named 14). 13 point at transactions (pair 332, postedVia 232, adjustingEntries source.transactions 89, schedule3 dividendsPaid 5, flags evidence.transactions 169, addBacks transactions 4, schedule8 additions 15, schedule3 received 14, schedule6 1, dupOf 4, prior_year paidBy 1, ohip depositTransaction 12, nonOhip 4); 3 at adjusting entries (flags evidence.adjustingEntries 23, addBacks adjustingEntries 12, ohip accruedReceivable 1). 9792 transaction ids, 0 idRule mismatches.
- Onboarding evidence: 108 leaves, 16 dotted (8 are C12 answer ids; 8 are dotted paths in C14 and C15, all resolve).
- exportRows (CSV lines) differs from rowsInExport in 9 accounts (layouts B and C): 02 CHQ (419 vs 417), 03 CHQ, 06 CHQ, 06 USD, 07 CHQ, 10 CHQ, 13 CHQ, 14 CHQ, 15 CHQ. rowsInExport equals the count of non-missing transactions in every account.

## Tests written (296 new, all walk-driven; seeds pinned at 20261003)

- testworld/clients/strict-read.acceptance.test.ts (186, RC-A): per described object path, a key renamed one character off and an added key, each a 'schema' issue naming the path and the key; the C10 misspellings; __proto__ and constructor written as raw keys (a 'file' issue); per folder, each fix 3 twin moved by one unit (trial-balance totals, rowsInExport, rowsMissingFromExport, rolls, exportActivity, fiscalYear.days, adjusting-entry amount); exportRows = rowsInExport; a property over the read leaves (each change refused or changes the model).
- testworld/clients/date-walk.acceptance.test.ts (69, RC-B): 66 or more date paths, each given 2025-02-30, 2025-13, 2025-2-3 and 03/02/2025, a 'schema' issue naming the path; C14 with 2024-02-29 in every walk-only date path loads; each folder's first walk-only date as 2025-02-29 is refused.
- testworld/clients/id-walk.acceptance.test.ts (23, RC-C): 16 or more reference paths, each given an unknown id, another client's id and a broken id; dotted evidence paths (8 in C14 and C15) walk own key by own key; missing, inherited (toString) and missing-top paths refused.
- testworld/clients/reserved-keys.acceptance.test.ts (18): `reservedKeys(text)` from testworld/clients/json-keys.ts.
- Fixture: testworld/model/__fixtures__/w00c-r3-walk.ts (spec-owned).

On the branch today: 340 unit tests fail, all in the card's files, each for the right reason (unknown keys dropped, no date walk, no id walk, no reservedKeys export, the twins unchecked, exportRows counted from the CSV). typecheck and lint clean; db 545 pass. With a throwaway stub (never committed): unit 7154 of 7154 and db 545 of 545 pass.

## Step 6b: rewritten tests (none retired)

Each superseded by reports/W00c-findings-3.md (A450); the commit message names each.
- testworld/clients/load.test.ts:226 "ARC-8 each account row count is its CSV lines ..." now "exportRows is its written rowsInExport" (fix 3); :95 "ARC-13 a number that only looks like money ..." plants inside the carried hst block (fix 2).
- testworld/model/marker-pins.acceptance.test.ts:253 "the marker field misspelled in lower case ..." (68 cases): a 'schema' issue naming transactions.N and the typo (fix 2).
- testworld/model/empties.acceptance.test.ts:101, 133, 155, 160, 165: plants keep the trial balance keys with zero totals (fixes 2, 3) and drop ids of removed adjusting entries (fix 5).
- testworld/model/ranges.acceptance.test.ts:134, 149, 161, 250, 265 keep fiscalYear.days in step; 237, 243, 250, 265, 279, 377, 383 raise rowsInExport with each planted row (fix 3).
- testworld/clients/clients.acceptance.test.ts:285 (C04 roll) lowers rowsInExport; :521 (16-digit amount) gives the planted entries their amount (fix 3).
- testworld/clients/w00c-survivors.test.ts:83, 87 and testworld/clients/load-files.test.ts:120 use existing onboarding keys, none added (fix 2).

## W00b (scratch merge of claude/W00c into origin/claude/W00b b3e31300, with the stub; not pushed)

No W00b test changes status: 494 W00b tests fail with or without W00c (guard not built), the only changes are the 340 W00c tests passing. One masked break for W00b's card: testworld/model/made-up-data.acceptance.test.ts:230 "SEC-11 S1 loadClient refuses a client whose answer key has an unclassified leaf" adds a top-level "nickname" to the answer key; under W00c's strict read that is a 'schema' refusal, so it holds only if W00b's loadClient runs the guard even when the schema refuses (or the plant moves inside a carried block). Not fixed here.

## Amber choices

1. Described object paths: those the loader reads; cra_program_accounts, related_entities and t2Inputs.schedule50 stay carried (not tested as strict).
2. The property changes READ leaves only, not guard-only names.
3. A refusal names a path as "<file> <dotted zod path>" (load.ts convention).
4. The date walk's shape must not take "10.1", "960.00" or "100.00" for dates (warned in the test header).
5. `reservedKeys` returns `{ key }[]` like `repeatedKeys`.
6. 16 reference paths, not the findings' 14; 66 date paths, not 80 (floors, never exact).
7. A swapped fiscal year keeps days as written (two fiscal-year issues may both speak).

## Round 3 patch: gaps 1 to 4 of reports/W00c-spec-review-4.md (A459)

Spec patch commit: c9322aee (`spec(W00c): round 3 patch, gaps 1 to 4`). Validated on main 78dd0eed (merged as 13faeae5). Every round 3 test is kept; no assertion is weakened.

Tests added (225; 7379 unit tests in all):
- **Gap 1, date-walk (+18):** `2025.02.30` joins BAD_DATES (the 66 per-path tests now plant five values); per folder, seeded (20261003) string leaves holding no date today, outside the READ set and not a made-up name, one per file and one inside a carried block (its holding object is not a described one), each set to `2025-02-30` and `2025.02.30`, a 'schema' issue naming the path; each timestamp path found by the walk (1: onboarding engagements[].created_at, C14) set to `2025-02-30T09:00:00Z`, refused naming the path.
- **Gap 2, id-walk (+15):** per folder with transactions (14), a seeded answer-key string leaf holding no id today and one inside a carried block, each set to `<nn>-<tag of its first transaction>-<its yyyy-mm>-9999` and `<nn>-AJE-99`, refused naming the value or the path.
- **Gap 3, reserved-keys (+91) and strict-read (+90):** reservedKeys finds each of the three names at the first node of every answer-key object path (90 on this probe, statementBalances and trial balance names merged; path depth to 6); `prototype` joins the loader plants at statementBalances, the first transaction and the onboarding top (+44), and each name at the deepest answer-key object of each folder is a 'file' issue (+45, plus one depth fixture test).
- **Gap 4, strict-read (+11):** DESCRIBED gains flags[].evidence, t2Inputs.schedule1, t2Inputs.schedule1.addBacks[] and addBacks[].source (rename and added-key cases follow, +8); the `onboarding` key renamed one character off at flags[].evidence, addBacks[].source and adjustingEntries[].source, each a 'schema' issue naming the path and the new key (+3).
- Shared: DESCRIBED, READ, READ_ONBOARDING, pattern, SEED and pick move into testworld/model/__fixtures__/w00c-r3-walk.ts (strict-read imports them, values unchanged; the new DESCRIBED rows go last so earlier seeded picks keep their index).

On the branch today: 560 unit tests fail, all the card's own (date-walk 75, id-walk 31, reserved-keys 108, strict-read 277, load.test 1, marker-pins 68); each new one fails for the right reason (every gap 1 and 2 plant probed one by one: the load succeeds; no reservedKeys export; unknown keys stripped). typecheck and lint clean; toolchain-rules green (one literal-count hit in a new line was split).

Step 6b: a throwaway stub (reservedKeys and its 'file' issue, a date walk and an id walk over every string leaf, strict evidence objects; never committed) passes all new tests; unit 7220 of 7379 (the 159 left are round 3 behaviours the stub skipped: strict objects, twins, exportRows, dotted evidence), db 545 of 545, and no test that passes today fails on it. **Tests retired or rewritten: none.**

**For the Lead (not fixed here):** origin/main moved to 6ca8b48f (SC landed) during this job. Merging it into claude/W00c makes 11 SC rule tests fail on the branch (tools/test/schema-contract-rules.test.mjs): stale PENDING rows (W00c's R35, R51, R52-catalogue and W00b's R34-guard, R50-guard; A415 says this spec job deletes W00c's rows, but then R35, R51 and R52 run on the subjects), R18, R28, R34 (35 problems), R34-widened and R50 (W00b's guard exports), R37 (17), R38 and R51. Several need product edits or KNOWN rows owned by other cards (W00b, FX9), so per A414 this patch is not merged with 6ca8b48f and is validated on 78dd0eed only.

Amber choices:
1. "Outside READ" uses strict-read's READ set; leaves holding a made-up name ("(Test)") are left out too, since the guard refuses a change there whatever the walks do.
2. "Inside a carried block" means the object holding the leaf is not a DESCRIBED object (hst, t2Inputs parts, prior_year, assets, suggestedPost, prior_year_closing_balances.accounts and so on).
3. The onboarding-rename cases cover adjustingEntries[].source too (the third evidence place fix 5 names).
4. Answer-key object paths are counted with statementBalances account keys and trial balance names merged (90; the review's 88 is the floor).

## A463 merge rows (3 Oct, spec job; reports/W00c-merge-decisions.md rows 1, 2, 4, 6, 7, 8, 9, 11)

- **Tests:** SC rules (tools/test/schema-contract-rules.test.mjs): PENDING R35, R51, R52-catalogue deleted; R34-guard and R50-guard re-keyed to `testworld/model/guard.ts#guardFolder` and `#*luhn*` (owner W00b) through a new `subjectOnMain` (a `file#export` subject is on main once the file exports it), with a plant case in the R35 PENDING plant test (fixtures pending-guard-built.ts.txt and pending-guard-unbuilt.ts.txt); R34_PLANTED gains exact lists for the four W00c files, in scan order with repeats (2, 8, 14 and 55 strings; the merge decisions' 2, 4, 7 and 22 were de-duplicated counts); the R34-guard home tests take only the plants inside tools/test/__fixtures__. known.json: 15 R37 sample-client entries (17 strings) and FX6's R38 entry deleted. sample-copy.ts re-exports util.mjs's `luhnValid` (loaded by file URL: util.mjs has no types) and `luhnPassing` is renamed `checkDigitPassing` (R50 flags any luhn-named function outside the two homes; made-up-data.acceptance.test.ts follows). New testworld/clients/model-issues.acceptance.test.ts: a planted one-cent adjusting entry named by modelIssues (passes today), and `modelIssues([])` returns a "nothing to check" issue (fails: TypeError on c.corporation).
- **Clauses:** ARC-8, SEC-11, RT-9, EV-6. Validated on main 3e9f1c8d (merged as e6d50abb): typecheck and lint clean; tools/test plus testworld 564 fail = round 3's 560 + modelIssues([]) + SC R35 (same cause) + SC R28 (money.ts, build row 2; guard.ts, below) + SC R51 (below).
- **Step 6b:** a throwaway stub (money.ts without the regex; modelIssues returns "nothing to check" on an input with no corporation) passes the new tests; the whole unit project then fails only round 3's 560 and the two rows below. **Tests retired or rewritten: none.**
- **For the Lead (stopped, A329):** the KNOWN rows R51 (testworld/clients/load.ts, testworld/generate.ts) and R28 (testworld/model/guard.ts) owned by W00b are not added: SC's KNOWN owner rule (spec review 3 gap 1, A415; test "ARC-15 KNOWN owner rule (gap 1)" pins FIX_CARDS = FX3 to FX9) refuses them ("KNOWN[107] R51 testworld/clients/load.ts: the owner "W00b" is not a fix card (FX3 to FX9)", checked). Widening FIX_CARDS changes what a rule test asserts, so it needs a Lead decision: W00b joins FIX_CARDS for these rows, an FX card owns them, or W00b lands its guard in the same train. Until then SC R51 and R28 (guard.ts) fail on the branch.
- **Amber:** (1) the Luhn export subject is a name holding "luhn" in any case, the same finder the R50 guard test uses; (2) the empty-input test pins only that some issue's reason says "nothing to check" (check and record are the build's); (3) the luhnPassing rename instead of a re-export trick keeps the R50 name scan honest.

## Lead decision needed (cloud-a244c5, A463 rows 2 and 11)
Spec commit 5c8d8469 (validated on main 3e9f1c8d) does rows 1, 4, 6, 7, 8 (tests), 9. Not done: KNOWN R51 (testworld/clients/load.ts, generate.ts) and KNOWN R28 (testworld/model/guard.ts) with owner W00b. SC's KNOWN owner rule (A415, spec review 3 gap 1) accepts only FX3 to FX9 and a test pins that list; widening it changes an asserted rule (A329). Options: add W00b to the owner list (SC card change), an FX card owns the rows, or W00b's guard lands in the same train. Failing on branch: 564 (round 3's 560 plus modelIssues empty-input, SC R28 money.ts, SC R28 guard.ts, SC R51). Permission gaps: none. Model: Opus 5.5 subagent under Sonnet 5.5 worker.
