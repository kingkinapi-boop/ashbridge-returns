# W14 build report, round 2 (cloud-85862e, Sonnet 5.5)

Branch `claude/W14`. Files (all inside the card's paths): `clients/c11_12.mjs`, `lib/chart.mjs` (account 2085 Income tax payable, GIFI 2680), `lib/emit.mjs` (opening trial balance sources from `c.openSource`; key `assets` register), README, folders 11 and 12 regenerated.
Acceptance: `node reference/sample-clients/verify.mjs` 375 passed, 5 known (R8 on 03, 04, 07, 08, 10: card W16), 0 failed; spec entries untouched. `make-csv.mjs --check` 1025 passes. Double regenerate byte-identical; 01 to 10 byte-identical to main (their import.csv CRLF rewrites reverted). `tools/scope.mjs W14` OK.
Round 2 content: 11 `prior_year` derived from typed inputs (2023 retained earnings, 2024 income, tax, dividends, asset cost/date/method; opening bank solved to them); incomeStatement, retainedEarnings, balanceOwing (paid 31 Mar 2025); asset register; four instalments of 3,611.81 plus an info flag. 12: ids only from contract-ids.json, fact-keyed conversation answers, 31 Dec 2024 balances as answers, opening and adjusted trial balance traced.

Ambers:
- 12's six expense groups, the bank balances at both year ends, the shareholder loan and share capital arrive as fact-keyed conversation answers on FL:107, 205, 206, 209, 213, 214 (groups), FL:96, FL:97 (bank 2025, 2024), FL:104, FL:98; which row is which is invented from section 2's GIFI rows; W05 maps to the live fact list. Reverse: change the ids in `ANSWERS`.
- 12's opening retained earnings are 0.00 (the planted money unchanged), so no balancing row appears; the loan and shares answers serve both year ends.
- 11 tax inputs: 2024 income 118,420.00, tax 14,447.24, instalments 12,000.00, 2023 retained earnings 14,250.00, balance owing paid 31 Mar 2025 (made up). 11's UCC at 31 Dec 2024 is 354.37 (was 1,480.00, a typed figure).
- Account 2085 added to the chart (no effect on 01 to 10).
Not run: typecheck, lint, deps:check, mutate (no TypeScript or core module changed; sample-client generator only).

## Permission gaps
None.
## Model
Sonnet 5.5 (core card; the adversarial check is the check job's).
