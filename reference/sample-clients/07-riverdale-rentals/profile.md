# 07 Riverdale Rentals Inc. (Test)

All made up. Company and person names end in "(Test)" (in bank text a person carries the word TEST). The business number and every SIN fail their check digit on purpose. Nothing here is real.

**Fiscal year:** 1 Jan 2025 to 31 Dec 2025 (year end 31 Dec 2025).

## Who they are

Grace Liu (Test) owns Riverdale Rentals Inc. (Test), which holds one duplex. Two tenants pay rent by e-transfer. The company has a mortgage, no employees and is not registered for HST. The second tenant fell behind in the fall and left at year end. The roof was replaced in August with money Grace lent the company.

## Accounts and files

| Key | Institution and layout | Currency | File (accounts and qbo) | Rows | Opening | Closing |
| --- | --- | --- | --- | --- | --- | --- |
| CHQ | C: Harbourline Credit Union (Test) chequing | CAD | harbourline-chequing-7745.csv | 150 | 15876.66 | 7693.02 |

Opening and closing are what the statements show (for a card, the amount owing). Layout B files start with two header lines (account type, masked account number) and then the column line. Card and brokerage dates are YYYY-MM-DD. The QBO files carry the same rows in the same order.

## Planted issues (exact amounts and dates)

- Rents $2,100.00 (unit 1) and $1,950.00 (unit 2) monthly; unit 2 misses October, pays half of it ($975.00) in November (12 Nov), then leaves at year end owing $975.00.
- Mortgage payments of $2,480.00 monthly (interest and principal split in onboarding).
- Property tax in three instalments (3 Mar, 2 Jun, 2 Sep).
- Insurance $2,160.00 paid 1 Oct 2025 for twelve months.
- Plumbing repair $640.00 (14 May). New roof $18,400.00 on 20 Aug 2025, paid with $15,000.00 the owner lent the company on 18 Aug.
- Volumes are low on purpose: two tenants and a mortgage.

## What each check should find

- **specified investment business: no employees** (07-F01, a person decides): The company owns a duplex, has no employees and earns rent. Rental income is investment income in a specified investment business (fewer than six full-time employees): the small business deduction is not available and the passive income rules and refundable taxes apply. A person confirms and Taxprep computes.
- **new roof is capital, not repair** (07-F02): The $18,400.00 roof on 20 Aug 2025 replaces the old one: added to the building (class 1) and amortized, not expensed. The $640.00 plumbing repair on 14 May is an ordinary repair. The company is not registered, so no HST is claimed.
- **prepaid insurance** (07-F03): The $2,160.00 premium paid 1 Oct 2025 covers twelve months; nine are after year end, so $1,620.00 is a prepaid asset. The $1,620.00 prepaid brought forward is released to expense.
- **owner lent the company money** (07-F04): Grace Liu (Test) lent $15,000.00 on 18 Aug 2025, two days before the roof was paid. Due to shareholder (2080), no interest, no written terms. A person confirms terms and whether the loan is current or long term.
- **rent arrears at year end** (07-F05, a person decides): Unit 2 missed October, paid half in November and left at year end owing $975.00. Booked as rent receivable; whether it can be collected, reserved or written off is a person's decision.
- **mortgage payments: interest and principal** (07-F06): Twelve payments of $2,480.00. Only the interest (split in onboarding) is an expense; the rest reduces the mortgage. Mortgage interest is deductible against rent.
- **not registered for HST: residential rent is exempt** (07-F07): Rent from residential units is exempt, so no registration and no input tax credits; HST on costs is part of the cost.

## Statement balances by month (from the statements, not from the export)

| Account | Month | Opening | Closing | Export activity | Rolls |
| --- | --- | --- | --- | --- | --- |
| CHQ | 2025-01 | 15876.66 | 16569.10 | 692.44 | yes |
| CHQ | 2025-02 | 16569.10 | 17130.12 | 561.02 | yes |
| CHQ | 2025-03 | 17130.12 | 14647.47 | -2482.65 | yes |
| CHQ | 2025-04 | 14647.47 | 15346.85 | 699.38 | yes |
| CHQ | 2025-05 | 15346.85 | 15728.09 | 381.24 | yes |
| CHQ | 2025-06 | 15728.09 | 13454.85 | -2273.24 | yes |
| CHQ | 2025-07 | 13454.85 | 14105.75 | 650.90 | yes |
| CHQ | 2025-08 | 14105.75 | 11580.78 | -2524.97 | yes |
| CHQ | 2025-09 | 11580.78 | 9099.33 | -2481.45 | yes |
| CHQ | 2025-10 | 9099.33 | 5726.13 | -3373.20 | yes |
| CHQ | 2025-11 | 5726.13 | 7376.29 | 1650.16 | yes |
| CHQ | 2025-12 | 7376.29 | 7693.02 | 316.73 | yes |

## Answer key and ids

id = <client>-<TAG>-<YYYY>-<MM>-<seq>. TAG names the account (CHQ chequing, USD US-dollar chequing, BCD business card, PCD personal card, BRK brokerage). YYYY-MM is the month of the row date. seq is the 1-based position of the row among that account and month, in file order (header lines do not count). Rows missing from an export get the next numbers of their month.

answer-key.json holds the account for every row, the adjusting entries, the trial balance by GIFI code (unadjusted and adjusted), the T2 inputs and the flags. Tax payable is not in it; Taxprep computes that.
