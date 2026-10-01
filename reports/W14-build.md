# W14 build report (cloud-620523)

Branch `claude/W14`. Files: `clients/c11_12.mjs` (new), `lib/emit.mjs`, `lib/engine.mjs`, `generate.mjs`, folders `11-humber-bay-software/`, `12-kensington-market-crafts/` (all under reference/sample-clients), README pass count 236 to 295.
Acceptance: `node reference/sample-clients/verify.mjs` 295 passed, 0 failed (spec's entries untouched); ten old clients byte-identical (git diff on 01 to 10 clean; their import.csv CRLF rewrites reverted, see the spec amber). `tools/scope.mjs W14` OK.

Lib changes (all no-ops for 01 to 10): flag `blocking` passthrough; trial balance row `source` from `c.glSource`; `prior_year` key block from `c.priorYear`; `c.codeEveryRow` codes HST payments to 2050 (client 11 only); no accounts/ or qbo/ folders and an "answers only" profile text when a client has no accounts.

Ambers:
- Client 12 books are one summarized adjusting entry (12-AJE-01), one line per answer, so the opening and unadjusted trial balances are empty and no account is invented. Reverse: add an export:false account.
- Answer ids YE2.* (expense groups), ARB.bal, BQ7.loan, INC3.shares are made up in the contract's id style; only BQ2.earn, YE1.pcost/puse/vehicle/vkm/vbkm exist in the contract. W05 should map to the real ids.
- Client 11 payroll runs start 1 Dec 2024 so the December 2024 deductions exist as an opening liability and the year holds 12 CRA remittances; 26 pays in 2025.
- Client 11 prior_year RV-2 numbers and the 27 May 2025 NOA date are made up.

Permission gaps: none. Model: Sonnet 5.5 (core card; adversarial check is the check job's).
