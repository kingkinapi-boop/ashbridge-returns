# W14 check (round 2 build ec6cf19), worker cloud-4a59ee, 2 Oct 2026

FAIL (2 core findings, 1 process note). No security finding at medium or higher.

Passed: typecheck, lint, deps:check, `npm test` (unit and db), `verify.mjs` (375 pass, 5 known R8 for W16, 0 fail), `make-csv.mjs --check` (1025 passes), second generation byte-identical, folders 01 to 10 unchanged (only CRLF/LF noise from make-csv), `scope.mjs W14` clean, verify.mjs and contract-ids.json unchanged since spec a8a100e, names end "(Test)", business numbers and SINs fail the check digit, no secrets. Mutation: no TypeScript changed, not applicable.

## Failures
1. `reference/sample-clients/clients/c11_12.mjs` line 112 (`rv2.taxable_income = PY.netIncomeBeforeTax`, 118,420.00): the prior-year tax ignores the block's own 2024 book amortization 1,500 (add-back) and CCA 433.13 (deduction); taxable income should be about 119,486.87. The typed federal 1,065,780 and Ontario 378,944 cents are 9% and 3.2% of net income, so 2024 tax (14,447.24), 2025 instalments (3,611.81 each) and balance owing (2,447.24) are all off. R7 never ties taxable income to net income plus add-backs less CCA, so it passes unseen.
   Rule candidate: for every client with a prior_year, taxable_income equals net income plus book amortization less CCA (plus other stated adjustments), and the tax equals the rate times that figure, in cents.
2. `11-humber-bay-software/answer-key.json` `prior_year.balanceSheet`: GIFI 2680 appears twice (HST 4,380.00 and income tax 2,447.24). A filed GIFI balance sheet has one amount per code (6,827.24). It matches onboarding line for line, so verify does not see it; B03 reads this block.
   Rule candidate: no GIFI code appears twice in a prior_year balance sheet or in prior_year_closing_balances.

## Process note
`README.md` planted-issues rows for 11 and 12 were changed by the build after the spec commit (balance owing, 2085, solved bank text); the card gives the builder only the counts. Nothing weakened; the Lead may rule.

## Permission gaps
None for the check (a subagent could not restore CRLF noise in the checkout; I did it).

## Model
Checks by Sonnet 5.5; adversarial read of the diff by an Opus subagent.
