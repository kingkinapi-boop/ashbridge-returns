# 03 Bluewater Renovations Inc. (Test)

All made up. Company and person names end in "(Test)" (in bank text a person carries the word TEST). The business number and every SIN fail their check digit on purpose. Nothing here is real.

**Fiscal year:** 1 Jul 2024 to 30 Jun 2025 (year end 30 Jun 2025).

## Who they are

Sarah Kowalski (Test) owns Bluewater Renovations Inc. (Test) alone. It renovates kitchens and bathrooms for homeowners with two employees, paid every two weeks, and a crew of subcontractors. Sarah is paid a monthly salary and, this year, a bonus. The year runs 1 Jul 2024 to 30 Jun 2025.

## Accounts and files

| Key | Institution and layout | Currency | File (accounts and qbo) | Rows | Opening | Closing |
| --- | --- | --- | --- | --- | --- | --- |
| CHQ | C: Harbourline Credit Union (Test) chequing | CAD | harbourline-chequing-2287.csv | 423 | 8686.05 | 167827.84 |
| BCD | Aurora Card (Test) | CAD | aurora-business-card-9034.csv | 520 | 1475.27 | 3041.29 |

Opening and closing are what the statements show (for a card, the amount owing). Layout B files start with two header lines (account type, masked account number) and then the column line. Card and brokerage dates are YYYY-MM-DD. The QBO files carry the same rows in the same order.

## Planted issues (exact amounts and dates)

- Payroll: owner salary monthly, two employees every two weeks, source deductions remitted monthly; payroll by month and T4 summaries for calendar 2024 and 2025 are in onboarding.
- A $15,000.00 deposit on 10 Jun 2025 for a job starting in August.
- Table saw $2,300.00 (class 8, 14 Feb 2025) and a pickup truck bought 15 Sep 2024 for $58,000.00 plus HST (class 10; the bank row is Monday 16 Sep).
- Owner bonus of $25,000.00 declared at 30 Jun 2025 and paid 28 Dec 2025 (day 181; the rule needs payment by day 179). The payment is after the year and not in the bank file; it is in onboarding.
- WSIB paid quarterly. Subcontractor payments throughout. HST regular, quarterly; the return for the quarter ending 30 Jun 2025 is filed after year end (31 Jul 2025), so that quarter sits in HST payable (receivable) at year end.

## What each check should find

- **bonus paid after day 179** (03-F01): Bonus of $25,000.00 declared at 30 Jun 2025 and paid 28 Dec 2025, which is day 181 after year end; the rule needs payment by day 179 (26 Dec 2025). The accrued expense is not deductible in this year: Schedule 1 add-back $25,000.00; deductible in the year it was paid. It is on the owner's 2025 T4.
- **customer deposit for a job after year end is not revenue** (03-F02): The $15,000.00 received 10 Jun 2025 (HST included) is for a job that starts in August: deferred income (2060) of $13,274.34 and HST of $1,725.66, not sales.
- **payroll against T4 summaries across two calendar years** (03-F03): The fiscal year (1 Jul 2024 to 30 Jun 2025) spans calendar 2024 and 2025. Payroll by month and both T4 summaries are in onboarding; the books hold only the months inside the year, so calendar 2024 includes Jan to Jun 2024 (last year) and calendar 2025 includes Jul to Dec 2025 (next year, and the bonus). Source deductions are remitted on the 15th of the next month; June 2025 deductions are still owing at year end.
- **CCA additions in classes 10 and 8** (03-F04): Pickup truck $58,000.00 (class 10, acquired 15 Sep 2024) and table saw $2,300.00 (class 8, 14 Feb 2025), both before HST.
- **subcontractor payments: slip and status checks** (03-F05, a person decides): Payments to subcontractors (about a third of costs): a person confirms which are individuals (T4A) and whether T5018 statements of contract payments are needed for a construction business, and whether HST numbers and WSIB clearances are held (confirm).
- **WSIB premiums paid quarterly, unpaid quarter not accrued** (03-F06): Four quarterly premiums were paid in the year. The premium for Apr to Jun 2025 (paid after year end) is not accrued; a person may add it.

## Statement balances by month (from the statements, not from the export)

| Account | Month | Opening | Closing | Export activity | Rolls |
| --- | --- | --- | --- | --- | --- |
| CHQ | 2024-07 | 8686.05 | 9833.73 | 1147.68 | yes |
| CHQ | 2024-08 | 9833.73 | 131138.00 | 121304.27 | yes |
| CHQ | 2024-09 | 131138.00 | 127754.26 | -3383.74 | yes |
| CHQ | 2024-10 | 127754.26 | 152214.54 | 24460.28 | yes |
| CHQ | 2024-11 | 152214.54 | 135115.90 | -17098.64 | yes |
| CHQ | 2024-12 | 135115.90 | 207766.61 | 72650.71 | yes |
| CHQ | 2025-01 | 207766.61 | 259651.33 | 51884.72 | yes |
| CHQ | 2025-02 | 259651.33 | 300750.97 | 41099.64 | yes |
| CHQ | 2025-03 | 300750.97 | 324979.28 | 24228.31 | yes |
| CHQ | 2025-04 | 324979.28 | 258620.58 | -66358.70 | yes |
| CHQ | 2025-05 | 258620.58 | 202325.16 | -56295.42 | yes |
| CHQ | 2025-06 | 202325.16 | 167827.84 | -34497.32 | yes |
| BCD | 2024-07 | 1475.27 | 2594.01 | -1118.74 | yes |
| BCD | 2024-08 | 2594.01 | 2941.03 | -347.02 | yes |
| BCD | 2024-09 | 2941.03 | 3880.19 | -939.16 | yes |
| BCD | 2024-10 | 3880.19 | 3906.83 | -26.64 | yes |
| BCD | 2024-11 | 3906.83 | 2291.52 | 1615.31 | yes |
| BCD | 2024-12 | 2291.52 | 2920.09 | -628.57 | yes |
| BCD | 2025-01 | 2920.09 | 2576.06 | 344.03 | yes |
| BCD | 2025-02 | 2576.06 | 3487.86 | -911.80 | yes |
| BCD | 2025-03 | 3487.86 | 2813.64 | 674.22 | yes |
| BCD | 2025-04 | 2813.64 | 3813.27 | -999.63 | yes |
| BCD | 2025-05 | 3813.27 | 2694.25 | 1119.02 | yes |
| BCD | 2025-06 | 2694.25 | 3041.29 | -347.04 | yes |

## Answer key and ids

id = <client>-<TAG>-<YYYY>-<MM>-<seq>. TAG names the account (CHQ chequing, USD US-dollar chequing, BCD business card, PCD personal card, BRK brokerage). YYYY-MM is the month of the row date. seq is the 1-based position of the row among that account and month, in file order (header lines do not count). Rows missing from an export get the next numbers of their month.

answer-key.json holds the account for every row, the adjusting entries, the trial balance by GIFI code (unadjusted and adjusted), the T2 inputs and the flags. Tax payable is not in it; Taxprep computes that.

## Notes

- Employee names in bank text carry TEST; the T4 slips carry SINs that fail the check digit.
