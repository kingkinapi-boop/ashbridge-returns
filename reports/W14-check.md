# W14 check (cloud-c4f1c0, Sonnet; adversarial read by an Opus subagent)

**FAIL** on branch `claude/W14` at 66d4083. Scripted checks pass: `verify.mjs` 295 passed 0 failed, `make-csv --check`, byte-identical regeneration, clients 01 to 10 unchanged, scope OK (19 files), spec files not edited. The failures are in content the checks do not cover.

1. Client-facing wording (RULE-19, END-7): `reference/sample-clients/clients/c11_12.mjs:107-121` writes invented question labels in the client's voice ("Money you lent the company that it still owes you", "Materials for what you make") into `12-*/onboarding.json` `question_asked`.
   Rule candidate: sample-client onboarding answers reuse question ids from `onboarding-contract.md` and carry no label written in this repo.
2. Made-up question ids break the contract shape (END-6): c11_12.mjs:108-112,116,118 use `YE2.*` (no such group in contract lines 53-62), `YE2.phone` (contract has `YE1.phone`), `BQ7.loan` (contract has `BQ7.you`), `ARB.bal`. `what_it_resolves` holds "FL:107" ids; the contract says fact-list wording.
3. `prior_year` does not tie (core, END-2), c11_12.mjs:75: prior net income 118,420 is about double the same customers' 2025 net 61,754.78; after-tax income of about 103,973 with no dividends does not fit closing retained earnings (GIFI 3600) of 3,122.31; the balance owing 2,447.24 is not on the 31 Dec 2024 balance sheet and is never paid in 2025.
4. Control client K01 is not clean: 2024 tax 14,447.24 is over the 3,000 instalment threshold but 2025 has no instalments (c11_12.mjs:75 and the CHQ rows); an instalment check would fire on the "no judgement" client.
5. Opening figures do not tie: c11_12.mjs:53 accumulated amortization 2,600 vs 2,375 (3-year straight line on 4,500 from 1 Jun 2023; 2,250 half-year); line 96 UCC 1,480 for class 50 matches no CCA path (half-year gives 1,468.13).
6. Client 12 contradicts itself: `12-*/onboarding.json:10` says all_prior_years_filed "yes" (incorporated 2023) but line 65 has empty `prior_year_closing_balances`; shares and loan are booked as 2025 activity, so 2025 income is a plug.
7. Minor: `README.md:14` says "23 accounts"; there are 25.

Rule candidate (all of 3 to 5): verify.mjs should check that prior-year closing balances tie to the opening balances and that opening accumulated amortization and UCC follow the stated method.

Permission gaps: none. Model: sonnet (checker), opus (adversarial read).
