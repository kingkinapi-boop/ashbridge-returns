# W00c check (cloud-3014c0, 3 Oct) on claude/W00c ddcccdd
Result: FAIL. Steps 1 to 6 as in the earlier partial check (cloud-a416a1: typecheck, lint, deps:check clean; scope OK; unit 6858, db 545; test:flake 5 of 5), not rerun.
Mutation (step 7): not verified. Stryker dry run needs more than 5 min (2845 mutants, 11 files); a second run with --dryRunTimeoutMinutes 40 was started and stopped when the adversarial read failed the card. Tool fault, see earlier report.

Opus adversarial read of RC1 to RC4: RC1 markers and dupOf, RC3 empty lists and the RC4 link refusal hold. Failures (all testworld/clients/load.ts unless noted):
1. :57,331 zod 4.6.5 z.record drops a statementBalances key "__proto__", so "balances for no declared account" never sees it (RC2: prototype-name key lost, not refused).
2. :26,257-263 raw trialBalance reads only `rows`; written totalDebit/totalCredit dropped, model totals (schema.ts:25-29) are summed from the same rows, so a wrong written total loads (RC1 pattern).
3. :57,315 each month's `rolls` parsed then discarded; `exportActivity` never read. Written facts unchecked.
4. :28-95 raw schemas not strict: a misspelled optional field (dup_of, prior_year, severity, accountNo, post) is stripped and defaults silently (RC4 missing-field fix covers required keys only).
5. :243-248 calendar dates checked only on fiscalYear, row, adjusting-entry and 4 onboarding dates; about 30 others unchecked (shares.issued_on, shareholder_loans[].received_on, loan/mortgage schedule dates, assets[].availableForUse, t2Inputs.taxationYear, prior_year.fiscalYear).
6. :358-365 only adjusting-entry sources resolved; transaction ids in flags[].evidence.transactions, transactions[].pair, postedVia and t2Inputs transaction fields can point at nothing and load (RC2).
Outside RC1 to RC4, to SC2 per the landing rule (not failures here):
7. schema.ts:96 and load.ts:402 model.priorYear keeps raw float dollars (ARC-13).
8. checks.ts:207-216 no check that an account keeps one GIFI code across the three trial balances and adjusting lines (TB-3).
Rule candidates: every written fact in the JSON is either read and checked or the schema is strict; every date-typed field walks through one calendar check; every id reference resolves.
Note: the findings asked for totalCents on each marker; faults.ts:28 has none, covered by per-row amount pins (not counted).
Permission gaps: none. Model: Sonnet 5.5 (adversarial read Opus).
