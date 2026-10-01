# 11 Humber Bay Software Ltd. (Test)

All made up. Company and person names end in "(Test)" (in bank text a person carries the word TEST). The business number and every SIN fail their check digit on purpose. Nothing here is real.

**Fiscal year:** 1 Jan 2025 to 31 Dec 2025 (year end 31 Dec 2025).

## Who they are

Elliot Barrow (Test) owns Humber Bay Software Ltd. (Test), a small software consultancy with one employee and three steady customers. He takes no salary, draws or dividends. The firm filed last year's return. This is the control client: nothing in the books needs a judgement.

## Accounts and files

| Key | Institution and layout | Currency | File (accounts and qbo) | Rows | Opening | Closing |
| --- | --- | --- | --- | --- | --- | --- |
| CHQ | A: Lakeview Bank (Test) chequing | CAD | lakeview-chequing-3306.csv | 209 | 8394.42 | 68800.37 |
| BCD | Aurora Card (Test) | CAD | aurora-business-card-5528.csv | 133 | 1121.79 | 566.27 |

Opening and closing are what the statements show (for a card, the amount owing). Layout B files start with two header lines (account type, masked account number) and then the column line. Card and brokerage dates are YYYY-MM-DD. The QBO files carry the same rows in the same order.

## Planted issues (exact amounts and dates)

- Monthly payments from three customers, twelve each: BAYVIEW ANALYTICS TEST INC $6,780.00, CEDARVALE CLINICS TEST LTD $3,955.00 and PORTLANDS MEDIA TEST INC $2,486.00 (HST included).
- One employee, Nadia Petrov (Test), paid every two weeks (26 pays), with 12 CRA payroll remittances in the year.
- CRA GST/HST payments on 31 Jan, 30 Apr, 31 Jul and 31 Oct 2025.
- A laptop of $3,275.87 (HST included) at Best Buy on the business card on 18 Mar 2025 (class 50, $2,899.00 before HST).
- No owner draws, no personal items, no duplicates, no suspense: every flag is information only.

## What each check should find

- **CCA addition: laptop in class 50** (11-F01): One laptop, $2,899.00 before HST ($3,275.87 with it) on the business card on 18 Mar 2025: class 50 on Schedule 8. HST is claimed. Book amortization is added back on Schedule 1.
- **payroll against T4 agrees** (11-F02): One employee, 26 pays in 2025. The T4 summary in onboarding agrees with the payroll deposits and the twelve CRA remittances in the year (the December 2024 deductions were paid on 15 Jan 2025).
- **last year's return is ours** (11-F03): Last year's return was filed by the firm, CPA-final and assessed as filed. The answer key's prior_year block holds it; the opening balances equal its balance sheet line for line.
- **HST regular, quarterly** (11-F04): Four payments on 31 Jan, 30 Apr, 31 Jul and 31 Oct 2025 (the first is last year's Q4). The Q4 2025 return is paid in January 2026, so HST is payable at year end.

## Statement balances by month (from the statements, not from the export)

| Account | Month | Opening | Closing | Export activity | Rolls |
| --- | --- | --- | --- | --- | --- |
| CHQ | 2025-01 | 8394.42 | 10701.10 | 2306.68 | yes |
| CHQ | 2025-02 | 10701.10 | 17818.78 | 7117.68 | yes |
| CHQ | 2025-03 | 17818.78 | 24937.72 | 7118.94 | yes |
| CHQ | 2025-04 | 24937.72 | 24910.10 | -27.62 | yes |
| CHQ | 2025-05 | 24910.10 | 30368.75 | 5458.65 | yes |
| CHQ | 2025-06 | 30368.75 | 36636.54 | 6267.79 | yes |
| CHQ | 2025-07 | 36636.54 | 39551.46 | 2914.92 | yes |
| CHQ | 2025-08 | 39551.46 | 46661.34 | 7109.88 | yes |
| CHQ | 2025-09 | 46661.34 | 53715.52 | 7054.18 | yes |
| CHQ | 2025-10 | 53715.52 | 55103.01 | 1387.49 | yes |
| CHQ | 2025-11 | 55103.01 | 61511.66 | 6408.65 | yes |
| CHQ | 2025-12 | 61511.66 | 68800.37 | 7288.71 | yes |
| BCD | 2025-01 | 1121.79 | 643.52 | 478.27 | yes |
| BCD | 2025-02 | 643.52 | 699.38 | -55.86 | yes |
| BCD | 2025-03 | 699.38 | 3980.08 | -3280.70 | yes |
| BCD | 2025-04 | 3980.08 | 553.10 | 3426.98 | yes |
| BCD | 2025-05 | 553.10 | 717.94 | -164.84 | yes |
| BCD | 2025-06 | 717.94 | 706.40 | 11.54 | yes |
| BCD | 2025-07 | 706.40 | 698.22 | 8.18 | yes |
| BCD | 2025-08 | 698.22 | 723.76 | -25.54 | yes |
| BCD | 2025-09 | 723.76 | 588.27 | 135.49 | yes |
| BCD | 2025-10 | 588.27 | 537.22 | 51.05 | yes |
| BCD | 2025-11 | 537.22 | 537.72 | -0.50 | yes |
| BCD | 2025-12 | 537.72 | 566.27 | -28.55 | yes |

## Answer key and ids

id = <client>-<TAG>-<YYYY>-<MM>-<seq>. TAG names the account (CHQ chequing, USD US-dollar chequing, BCD business card, PCD personal card, BRK brokerage). YYYY-MM is the month of the row date. seq is the 1-based position of the row among that account and month, in file order (header lines do not count). Rows missing from an export get the next numbers of their month.

answer-key.json holds the account for every row, the adjusting entries, the trial balance by GIFI code (unadjusted and adjusted), the T2 inputs and the flags. Tax payable is not in it; Taxprep computes that.
