## Failures

1. **Class: a fault marker leaves arithmetic unchecked (dupOf, and priorYear the same way).** The statement roll drops dupOf rows (checks.ts:183). The export roll's "cause explains the gap exactly" test for `duplicate` (checks.ts:197-198) is then always true whenever the statement roll holds, because both sides add up the same marked rows. Nothing checks that `dupOf` points to a real original of the same account, date and amount, or that it does not point to itself (checks.ts:224-234; load.ts:202-213). So a marked row can hold any amount.
   - All ACCEPTED in C10: a new CHQ 2025-03 row with `dupOf: "nope"` and amount 98765.43; the existing dup row 10-CHQ-2025-03-0009 changed to 12345.67; `dupOf` set to itself; `dupOf` set to `""`; `dupOf` pointing to a BCD row.
   - Also ACCEPTED: a priorYear row's amount changed to 99999, and a made-up extra priorYear row in CHQ 2024-12. Any number of rows with any amounts can sit under a catalogued marker.

2. **Class: an account with no months is not checked against its balances or against the fiscal year.** When `months` is empty and the account has no transactions, no issue is raised (checks.ts:169-171). The "first opens / last closes / every fiscal month listed" checks (checks.ts:202-209) only run in the `else` branch.
   - ACCEPTED in C01: a new account SAV with `openingBalance` 100, `closingBalance` 5000, no statementBalances and no transactions. It is missing 12 months and its closing does not equal its opening, and neither is reported.

3. **Class: ids are not unique (relations).**
   - Duplicate account key, ACCEPTED in C01: `accounts.push({...accounts[0]})`. The `declared` set (checks.ts:93) hides the duplicate, and the roll runs twice over the same data.
   - Duplicate transaction id, ACCEPTED in C01: two CHQ rows in the same month share one id. `txIds` (load.ts:261) is a set, so a source id can point at two rows.

4. **Class: a transaction date that is not a date still counts in a month.** `date` is only `z.string()` (schema.ts:443), and the month is matched with `startsWith` (checks.ts:180).
   - ACCEPTED in C01: `2025-03-99`, and `2025-03` with no day.

5. **Class: bad input gives a raw error instead of a LoadIssue.**
   - `file: ""` and `file: "accounts"`: load.ts:224 tests `existsSync` but never `isFile`, so the read fails with a raw `EISDIR`.
   - An account key of `toString` (or any other Object.prototype name): `key.statementBalances[a.key] ?? []` (load.ts:237) returns the inherited function, so the load fails with a raw TypeError. It needs `Object.hasOwn`.

6. **Class: paths are accepted when they should be refused.**
   - `file: "answer-key.json"` is ACCEPTED as an account export, because any file inside the folder passes (load.ts:217-234). Nothing requires a .csv under accounts/ or qbo/.
   - An onboarding source's trailing "(…)" is removed and never checked (load.ts:265): `tenants (anything at all)` is ACCEPTED in C07. The text in brackets, for example `(1200 Prepaid expenses)`, is never matched against the record it names.

Not a failure in this card, but worth noting: guardFiles (load.ts:340-354) skips symlinks and unknown file types without a word. That belongs to W00b (S4).
