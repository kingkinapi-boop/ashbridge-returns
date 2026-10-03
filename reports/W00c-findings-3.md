# W00c findings review 3 (round 2 check FAIL at 82bc4ca0; round 3 is the last)

Inputs: reports/W00c-check.md, W00c-build.md, W00c-findings.md, plan/cards/W00c.md (main), load.ts:1-430, json-keys.ts, stryker.config.mjs, vitest.mutate.config.ts, tools/mutate-changed.mjs, SC2 and SC5 cards, and a read-only probe of all 15 sample folders (numbers below). All 6 findings reproduce in load.ts. Findings 7 and 8 go to SC2 as the landing rule says. The check confirms that RC1 to RC5 from round 2 hold.
**Verdict:** one more small round. All 6 failures come from one habit: the loader reads a list of fields it chose, not the whole file. That gives 3 root causes, and each fix is one walk or one strict schema, not a list of fields. The probe shows all 15 folders already pass every new rule, so no sample data or generator change is needed. The one exception is the model's `exportRows` (RC-A).

## Root causes
**RC-A. The parse layer drops written facts without a word** (findings 1, 2, 3, 4). Zod objects that are not strict strip any unknown key, so a misspelled `dup_of`, `prior_year`, `accountNo` or `post` falls back to its default. `z.record` (zod 4.6.5) drops a `__proto__` key (load.ts:57). Written derived values are thrown away and recomputed (TB totals at :26 and :257-263, `rolls` and `exportActivity` at :57 and :315). The probe adds a seventh case: `rowsInExport` is never read, and the model's `exportRows` counts CSV lines (:182-188). That count is wrong for every layout B account (+2: 02, 06 CHQ and USD, 14, 15) and every layout C account (-1: 03, 07, 10, 13), so 9 accounts in 9 folders carry a false row count. The written `rowsInExport` equals the count of the key's transactions with `missingFromExport` false in all accounts. In the 15 folders every written total, `rolls`, `exportActivity`, `rowsMissingFromExport`, `fiscalYear.days` and adjusting-entry `amount` (28 of 28 equal the sum of line debits) already agrees with its computed twin.
*Where else:* src/contracts/records.ts:37 (`stampRecord` = z.record keyed by NonBlank: a `__proto__` member is dropped), src/contracts/bridge.ts:115 (safe only while HANDOFF_ID_PATTERN refuses it), src/modules/gaps/bank/index.ts:111 (JSON.parse, no repeated or reserved key scan), testworld/model/guard.ts:108 (W00b), SC2's R75 (if it compares `rowsInExport` with the CSV line count, 9 accounts fail), and B04 and JH0 if they read `exportRows` as a transaction count.
**RC-B. The calendar check is applied field by field, not by type** (finding 5). The probe finds 80 date paths across both JSON files (OHIP months, loan and mortgage schedules, payroll remittances, t2Inputs dates, `prior_year.fiscalYear`, `instalments.unmatchedPayment`, and more). The loader checks 8 of them. All 80 hold valid dates in the 15 folders. *Where else:* the kind catalogue dates in faults.ts (already pinned by RC1), verify.mjs (generator side), and W00b's guard (reads text only).
**RC-C. Only references that someone listed get resolved** (finding 6). The probe finds 14 id-reference paths: flags evidence transactions (169), pair (332), postedVia (166), dupOf, t2Inputs schedules 1, 3, 6 and 8, ohip depositTransaction, nonOhipIncome, `prior_year.balanceOwing.paidBy`, plus 23 `flags[].evidence.adjustingEntries` and 82 onboarding evidence paths. Only adjusting-entry sources are resolved today. All references resolve in the 15 folders, and all 9792 ids match the idRule (folder number, account tag, month of the date). *Trap:* C14 and C15 flags cite dotted onboarding paths (`corporation.financial_year_end`, `corporation.outstanding_years`: 8 references), which today's `resolves()` refuses. It must learn to walk dotted paths, or C14 and C15 stop loading.

## Fix list for round 3 (spec job first, then the build in this order; keep `repeatedKeys`' signature, because W00b imports it)
1. **json-keys.ts:** a new export, `reservedKeys(text)`, that uses the same walk to find `__proto__`, `constructor` or `prototype` as a key of any object. In readClientJson it raises a 'file' issue, in the same place as the repeat check.
2. **Strict raw schemas (RC-A):** every object that RawKey and RawOnboarding describe becomes strict at every depth. A key that is written but not read by W00c is declared `z.unknown()` in one commented "carried" block per object, naming the card that will own it (for example t2Inputs parts, hst, ohip, `netIncomeLossBeforeTax`). There are no other exceptions.
3. **Written twins (RC-A):** each of these is compared with the value the loader computes, and a mismatch raises a 'trial-balance', 'roll' or 'schema' issue naming the record:
   - each TB `totalDebit` and `totalCredit`
   - each month's `rolls` and `exportActivity`
   - `rowsInExport` against the account's transactions with `missingFromExport` false (never the CSV line count)
   - `rowsMissingFromExport`
   - `fiscalYear.days`
   - each adjusting entry's `amount`
   After the check, the model's `exportRows` takes the written `rowsInExport`. load.test.ts:229 changes in the spec job, not the build.
4. **Dates (RC-B):** one walk over every string leaf of both parsed trees, carried subtrees included. Any value shaped `^\d{1,4}[-/.]\d{1,2}([-/.]\d{1,4})?$`, and the date part of a timestamp, must be a strict YYYY-MM-DD calendar date or a YYYY-MM month. Otherwise it is a 'schema' issue naming the JSON path. The existing twin checks stay.
5. **Ids (RC-C):** one walk over every string leaf of the answer key. Any value starting `^\d\d-[A-Z]{2,4}-` must be a whole id, agree with the idRule, and resolve to a transaction of this client (outside `transactions[].id`). The same applies to `^\d\d-AJE-` for adjusting entries. Every onboarding evidence path, whether in a flag, an add-back or an adjusting entry, goes through one `resolves()` that walks dotted paths key by own key.
6. Run the mutation step (below), `test:flake` 5 of 5, regenerate.acceptance and the guard walk. Stop only the process ids you started. guardFiles stays byte-identical.

## Tests the spec job adds (each test walks the 15 folders; the spec job first reruns this probe and quotes its counts)
- **RC-A:**
  - For every object path the schemas describe, in the first folder that has it, rename one written key by one character (seeded pick) and add one unknown key. Each must be refused, with the issue naming the path.
  - A `__proto__` or `constructor` key, placed in turn in statementBalances, in one transaction and at the top of onboarding. Each must be refused.
  - Each derived value from fix 3 moved by one unit. Each must be refused.
  - On the clean folders, `exportRows` equals `rowsInExport`.
  - A pinned-seed property: change one read leaf per path per folder. The load is refused or the model changes.
- **RC-B:** for each of the 80 date paths the walk finds, write 2025-02-30, 2025-13, 2025-2-3 and 03/02/2025. Each must be refused, naming the path. C14's 29 Feb still loads.
- **RC-C:** for each of the 14 reference paths, write an unknown id of the right shape, another client's id, and a broken id. Each must be refused. A dotted evidence path to a missing key is refused, and the 8 dotted paths in C14 and C15 load.

## Rule tests (each first fails on a planted copy of C10, C12 or C14)
- **SC2:**
  - **R98:** every loader schema in testworld/** is strict at every depth, and every JSON leaf is either read or declared carried. This extends R73 to testworld; plant `dup_of` in C10.
  - **R99:** every date-shaped leaf of every folder is a calendar date or month; plant 2023-02-29 in C14.
  - **R100:** every id-shaped leaf resolves within its client and agrees with the idRule.
  - **R102:** priorYear money is in integer cents (finding 7, ARC-13).
  - **R103:** each account keeps one GIFI code across the three TBs and the adjusting lines (finding 8, TB-3).
  - **R75 reworded:** `rowsInExport` is compared with the count of transactions, not with CSV lines.
- **SC5:** **R101:** every `z.record` in src/** and testworld/** has keys that refuse prototype names, and every JSON read from disk is scanned for repeated and reserved keys. Expected KNOWN entries: records.ts:37 and gaps/bank (the Lead names the owners).

## Mutation step (the bar stays 100 per @mutate file, for all 11 files mutate:changed lists against origin/main)
- **Why it is slow:** the dry run runs the whole unit project (6858 tests), and none of W00, W00a or W00c is on main, so all 11 files and 2845 mutants are in play.
- **How to run it on a cloud box, in the background, polled every 15 to 20 min:** `node node_modules/@stryker-mutator/core/bin/stryker.js run --incremental --mutate <the 11 files> --dryRunTimeoutMinutes 45 --concurrency <cores>`.
- **Scoring:** use the same per-file rule as mutate-changed.mjs (Survived plus NoCoverage equals 0 per target), read from reports/mutation/mutation.json. Rerun with `--force` before writing up survivors on lines that did not change (A418).
- **If the box's time cannot fit one run:** split it into three runs (load.ts, json-keys.ts and schema.ts; checks.ts and faults.ts; the 6 carried files) on the same box, sharing the incremental file.
- **Who runs it:** the builder runs it first and puts the per-file table in its report; the checker runs it again.
- **Tooling fix:** a small CQ card adds `dryRunTimeoutMinutes` to stryker.config.mjs and passes extra arguments through mutate-changed.mjs.

## Landing rule for round 3
- **PASS:** it lands. Merge it into claude/W00b and re-run W00b's 242 tests.
- **New findings outside RC-A to RC-C:** they go to SC2 or SC5 as rules and do not fail the card.
- **Mutation survivors alone:** one in-round fix (a spec test patch, then a builder rewrite or a reasoned disable). It does not count as a fourth round. A survivor in guard.ts or kinds.ts goes to the Lead, because W00b rebuilds those files.
- **A failure inside RC-A, RC-B or RC-C:** there is no round 4. The Lead splits that class into W00d (Deps W00c), and W00c lands without that class's new tests. Those tests never passed, so nothing on main gets weaker. SC2's matching rule carries a KNOWN entry naming W00d.
- **A regression in RC1 to RC5:** it parks W00c and goes to the Lead.

## Risks and what to re-test
- **Strict schemas and W00b's tests:** W00b's 242 tests plant names into JSON fields. A planted key outside the schema now stops the load with a 'schema' issue before the guard runs. The spec job merges W00c into a scratch copy of claude/W00b (no push) and runs W00b's tests before handing over. Any test that breaks goes on W00b's card.
- **Folders the walks could break:** C12 has no accounts, C09 has an empty opening TB, and C14 and C15 have dotted evidence. clients.acceptance, regenerate.acceptance and the per-folder walks re-run. JH0 and B04 must read `exportRows` with its new meaning (B04's card gets one line).
- **Speed:** the walks add one pass per leaf, about 10k transactions in C04 and C10, so the slowest boot must stay within the flake bar.
