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
