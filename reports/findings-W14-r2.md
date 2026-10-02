# Findings review W14, round 2 (2 Oct, Opus, cold; text returned to the Lead and recorded here)

Inputs: W14 check/build/spec on claude/W14, card W14 (Fix round 1), findings-W14-D01, c11_12.mjs, lib/emit.mjs, verify.mjs, cpa-check CK-11/CK-15, cards W15, B03; all 12 answer keys scanned.

## Root causes
- RC-A. Prior-year tax is a typed input, not an output. The builder typed federalTax 1,065,780 and ontarioTax 378,944 cents (9% and 3.2% of book income) and set `rv2.taxable_income = PY.netIncomeBeforeTax` (c11_12.mjs:112). Amortization (1,500) and CCA (433.13) never reach taxable income; R7 checks only the retained-earnings movement, so a wrong tax passes everything. Correct for 11: taxable 119,486.87; federal 10,753.82; Ontario 3,823.58; tax 14,577.40; balance owing 2,577.40; 2025 instalments 3,644.35 x4; 2024 closing retained earnings 118,092.60.
- RC-B. The prior-year GIFI balance sheet is account rows; verify sums both sides before comparing, so duplicates (2050 HST and 2085 tax payable both as 2680) are hidden and the "line for line" check cannot fail (verify.mjs:143-144).
- Process: the builder edited README planted-issue rows the spec wrote. Ruling (amber): the spec owns the rows, the builder only the counts.

## Where else
Only 11 has `prior_year` today. Account-level lists legitimately share codes (03 8622, 05 two banks on 1002, 06 and 08 8000, 05 in prior_year_closing_balances): a "no code twice" rule applies only to GIFI-keyed statements. W15: 14's non-capital loss is the tax loss (book loss + amortization - CCA); 15 needs the same derivation; its acceptance 5 means after-tax income. W01, W05, B03 read these figures. W16 uses the same amortization and CCA schedule function. 02's instalments have no prior-year basis (gap only).

## Fix list (round 3)
1. Lead (card, amber A307): typed inputs are 2023 retained earnings, 2024 book income before tax, dividends, instalments paid, the asset register, other add-backs (default none) and the 2024 small-business rates as data (federal 9%, Ontario 3.2%, cited). Taxable income, tax, balance owing, retained earnings and next year's instalments are outputs. Acceptance 4: the prior_year GIFI balance sheet has one line per code equal to the closing balances summed by code. Paths add `reference/sample-clients/lib/prior-year.mjs` and `tools/test/sample-prior-year.test.mjs`. Keep cents in prior_year.
2. Spec: `tools/test/sample-prior-year.test.mjs` (fast-check, seed pinned) on pure `priorYear(inputs)` and `gifiStatement(rows)`: amortization by year sums to accumulated; CCA = rate x opening UCC with the first-year factor, UCC never negative; taxable = income + amortization + other add-backs - CCA (CK-15), a loss goes to the non-capital loss; each tax = rate x taxable, half away from zero, cents; closing RE = opening + income - tax - dividends (CK-11); balance owing = tax - instalments paid; four instalments in whole cents summing to the tax, none if tax is $3,000 or less; gifiStatement one row per code, total kept to the cent. Plus 11's worked example.
3. Spec: verify.mjs rules on every folder, each first failing on a planted copy: R12 taxable = net income + amortization - CCA from `prior_year.schedule1 {amortization, otherAddBacks, cca}`, tax = rate x taxable, incomeTax = federal + Ontario, balance owing = tax - instalments (plant taxable = net income); R13 GIFI-keyed statements hold each code once, account lists exempt (plant 11's 2680 split). Line 144: balanceSheet rows (not summed) equal byGifi(pycb.accounts). verify must not import prior-year.mjs. README rows for 11 get the new figures.
4. Build: write lib/prior-year.mjs; in c11_12 drop the typed tax and schedule figures; prior_year from priorYear(), balanceSheet from gifiStatement(), instalments from the cent split; only README counts change.

## Risks and re-test
01 to 10 byte-identical (`git diff --exit-code` after regenerating); R8's one-cent-per-year tolerance; the opening bank and 2085 shift; flag text; README pass count; make-csv `--check`. Re-run verify.mjs (only W16 KNOWN), make-csv --check, a double regenerate, npm test, lint, test:flake. W15 re-specced on top using priorYear().

## Split?
No. If round 3 fails, re-card as "PY0 prior-year engine" ahead of W14 and W15.
