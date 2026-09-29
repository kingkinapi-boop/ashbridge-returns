# 08 Queen West Design Studio Inc. (Test)

All made up. Company and person names end in "(Test)" (in bank text a person carries the word TEST). The business number and every SIN fail their check digit on purpose. Nothing here is real.

**Fiscal year:** 1 Oct 2024 to 30 Sep 2025 (year end 30 Sep 2025).

## Who they are

Amir Rahimi (Test) owns Queen West Design Studio Inc. (Test), a small design studio with one employee. Canadian clients pay with HST; two US clients pay in US dollars. Amir pays himself a monthly salary and puts some software on his personal card. The year ends 30 Sep 2025.

## Accounts and files

| Key | Institution and layout | Currency | File (accounts and qbo) | Rows | Opening | Closing |
| --- | --- | --- | --- | --- | --- | --- |
| CHQ | A: Lakeview Bank (Test) chequing | CAD | lakeview-chequing-8102.csv | 446 | 9325.20 | 144722.88 |
| USD | A: Lakeview Bank (Test) chequing | USD | lakeview-chequing-usd-8119.csv | 60 | 15000.00 | 29628.51 |
| BCD | Aurora Card (Test) | CAD | aurora-business-card-6650.csv | 432 | 758.04 | 1302.07 |
| PCD | Aurora Card (Test), owner's personal card | CAD | aurora-personal-card-1846.csv | 507 | 1256.43 | 2271.86 |

Opening and closing are what the statements show (for a card, the amount owing). Layout B files start with two header lines (account type, masked account number) and then the column line. Card and brokerage dates are YYYY-MM-DD. The QBO files carry the same rows in the same order.

## Planted issues (exact amounts and dates)

- Owner salary $6,000.00 monthly and one designer every two weeks; T4 summaries for 2024 and 2025 in onboarding.
- Two US clients paid in USD (around the 14th and 22nd of each month, USD $4,800.00 and $6,200.00); the USD account is in its own file.
- Laptop $3,299.00 on 19 Nov 2024 (class 50); camera $2,150.00 on 11 Mar 2025 (class 8), both before HST.
- About $2,400.00 of client meals; a US conference: flight $1,250.00 (24 Apr) and hotel $1,850.00 (27 Apr), $3,100.00 in all.
- A $4,520.00 invoice (HST included) from 14 Feb 2025 written off on 22 Sep 2025 (the client went bankrupt).
- Liability insurance $1,800.00 paid 1 Jul 2025 for twelve months.
- Year-end accounting fee of $3,500.00 billed after year end.
- Software on the owner's personal card, listed in onboarding (five subscriptions, monthly).

## What each check should find

- **bad debt: invoice of $4,520.00 written off in September** (08-F01, a person decides): An invoice of $4,520.00 (HST included) from Feb 2025 was never paid and was written off 22 Sep 2025 (the client went bankrupt). It was recorded as sales, then written off to bad debts ($4,000.00) with the HST adjustment ($520.00, confirm). A person checks the write-off is supported.
- **prepaid insurance** (08-F02): The $1,800.00 premium paid 1 Jul 2025 covers twelve months; nine are after year end, so $1,350.00 is prepaid. The $1,320.00 prepaid brought forward is released.
- **accrued year-end accounting fee** (08-F03): The $3,500.00 year-end accounting fee is billed after year end for work on this year: accrued as an expense and a liability.
- **owner salary and one employee: payroll against T4** (08-F04): Owner salary $6,000.00 monthly and one designer every two weeks. Payroll by month and the T4 summaries for 2024 and 2025 are in onboarding; calendar years straddle the fiscal year (1 Oct 2024 to 30 Sep 2025). September 2025 deductions are still owing at year end.
- **US clients paid in USD: zero-rated and exchange** (08-F05): Two US clients pay by wire in US dollars: no HST (zero-rated), recorded at the monthly test rate; the USD account is revalued at 1.3900 at year end (test rate); conversions carry a bank spread.
- **software on the owner personal card** (08-F06): Five subscriptions ($134.14 a month in all, twelve months) are on his personal card but are business costs by his list. Expense them and record what the company owes him; ask for receipts.
- **CCA: laptop class 50 and camera class 8** (08-F07): Laptop $3,299.00 (19 Nov 2024, class 50) and camera $2,150.00 (11 Mar 2025, class 8), both before HST.
- **meals: 50% limit** (08-F08): About $2,400.00 of client meals: half is deductible (Schedule 1 add-back) and half of the HST is claimed. The US conference flight and hotel ($3,100.00) carry no Canadian HST.
- **HST annual filer with instalments** (08-F09): Annual return, instalments of $1,500.00 on 31 Oct 2024 (last year), 31 Jan, 30 Apr and 31 Jul 2025. HST owing at year end: $10,711.88 (return due 31 Dec 2025, with the 31 Oct 2025 instalment to come).

## Statement balances by month (from the statements, not from the export)

| Account | Month | Opening | Closing | Export activity | Rolls |
| --- | --- | --- | --- | --- | --- |
| CHQ | 2024-10 | 9325.20 | 26633.13 | 17307.93 | yes |
| CHQ | 2024-11 | 26633.13 | 33916.79 | 7283.66 | yes |
| CHQ | 2024-12 | 33916.79 | 40745.32 | 6828.53 | yes |
| CHQ | 2025-01 | 40745.32 | 50579.58 | 9834.26 | yes |
| CHQ | 2025-02 | 50579.58 | 63676.96 | 13097.38 | yes |
| CHQ | 2025-03 | 63676.96 | 73345.92 | 9668.96 | yes |
| CHQ | 2025-04 | 73345.92 | 83230.33 | 9884.41 | yes |
| CHQ | 2025-05 | 83230.33 | 96079.04 | 12848.71 | yes |
| CHQ | 2025-06 | 96079.04 | 116089.60 | 20010.56 | yes |
| CHQ | 2025-07 | 116089.60 | 131821.89 | 15732.29 | yes |
| CHQ | 2025-08 | 131821.89 | 136506.81 | 4684.92 | yes |
| CHQ | 2025-09 | 136506.81 | 144722.88 | 8216.07 | yes |
| USD | 2024-10 | 15000.00 | 16857.54 | 1857.54 | yes |
| USD | 2024-11 | 16857.54 | 18780.70 | 1923.16 | yes |
| USD | 2024-12 | 18780.70 | 19586.51 | 805.81 | yes |
| USD | 2025-01 | 19586.51 | 21436.90 | 1850.39 | yes |
| USD | 2025-02 | 21436.90 | 22925.44 | 1488.54 | yes |
| USD | 2025-03 | 22925.44 | 23552.37 | 626.93 | yes |
| USD | 2025-04 | 23552.37 | 24915.80 | 1363.43 | yes |
| USD | 2025-05 | 24915.80 | 24966.96 | 51.16 | yes |
| USD | 2025-06 | 24966.96 | 26621.55 | 1654.59 | yes |
| USD | 2025-07 | 26621.55 | 27481.87 | 860.32 | yes |
| USD | 2025-08 | 27481.87 | 27975.75 | 493.88 | yes |
| USD | 2025-09 | 27975.75 | 29628.51 | 1652.76 | yes |
| BCD | 2024-10 | 758.04 | 2133.56 | -1375.52 | yes |
| BCD | 2024-11 | 2133.56 | 5685.31 | -3551.75 | yes |
| BCD | 2024-12 | 5685.31 | 1557.95 | 4127.36 | yes |
| BCD | 2025-01 | 1557.95 | 1667.83 | -109.88 | yes |
| BCD | 2025-02 | 1667.83 | 1800.06 | -132.23 | yes |
| BCD | 2025-03 | 1800.06 | 4530.21 | -2730.15 | yes |
| BCD | 2025-04 | 4530.21 | 4833.35 | -303.14 | yes |
| BCD | 2025-05 | 4833.35 | 1684.38 | 3148.97 | yes |
| BCD | 2025-06 | 1684.38 | 1575.39 | 108.99 | yes |
| BCD | 2025-07 | 1575.39 | 1784.95 | -209.56 | yes |
| BCD | 2025-08 | 1784.95 | 1735.54 | 49.41 | yes |
| BCD | 2025-09 | 1735.54 | 1302.07 | 433.47 | yes |
| PCD | 2024-10 | 1256.43 | 2742.76 | -1486.33 | yes |
| PCD | 2024-11 | 2742.76 | 1780.52 | 962.24 | yes |
| PCD | 2024-12 | 1780.52 | 2201.90 | -421.38 | yes |
| PCD | 2025-01 | 2201.90 | 1936.79 | 265.11 | yes |
| PCD | 2025-02 | 1936.79 | 1793.90 | 142.89 | yes |
| PCD | 2025-03 | 1793.90 | 1951.67 | -157.77 | yes |
| PCD | 2025-04 | 1951.67 | 2288.32 | -336.65 | yes |
| PCD | 2025-05 | 2288.32 | 2463.22 | -174.90 | yes |
| PCD | 2025-06 | 2463.22 | 2100.88 | 362.34 | yes |
| PCD | 2025-07 | 2100.88 | 2644.77 | -543.89 | yes |
| PCD | 2025-08 | 2644.77 | 2480.21 | 164.56 | yes |
| PCD | 2025-09 | 2480.21 | 2271.86 | 208.35 | yes |

## Answer key and ids

id = <client>-<TAG>-<YYYY>-<MM>-<seq>. TAG names the account (CHQ chequing, USD US-dollar chequing, BCD business card, PCD personal card, BRK brokerage). YYYY-MM is the month of the row date. seq is the 1-based position of the row among that account and month, in file order (header lines do not count). Rows missing from an export get the next numbers of their month.

answer-key.json holds the account for every row, the adjusting entries, the trial balance by GIFI code (unadjusted and adjusted), the T2 inputs and the flags. Tax payable is not in it; Taxprep computes that.

## Notes

- Test rates (CAD per USD): open 1.3500, 2024-10 1.3800, 2024-11 1.4000, 2024-12 1.4300, 2025-01 1.4400, 2025-02 1.4350, 2025-03 1.4300, 2025-04 1.4050, 2025-05 1.3900, 2025-06 1.3700, 2025-07 1.3750, 2025-08 1.3800, 2025-09 1.3900.
