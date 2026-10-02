# 15 Rouge Valley Landscaping Inc. (Test)

All made up. Company and person names end in "(Test)" (in bank text a person carries the word TEST). The business number and every SIN fail their check digit on purpose. Nothing here is real.

**Fiscal year:** 1 Jan 2025 to 31 Dec 2025 (year end 31 Dec 2025).

## Who they are

The same company as folder 14: Declan Murphy (Test) owns Rouge Valley Landscaping Inc. (Test), a seasonal landscaping business. This is the second of two unfiled years, 2025, and opens from the 2024 closing balance sheet. No new capital purchases. The year returns to a profit.

## Accounts and files

| Key | Institution and layout | Currency | File (accounts and qbo) | Rows | Opening | Closing |
| --- | --- | --- | --- | --- | --- | --- |
| CHQ | B: Maplestone Bank (Test) chequing | CAD | maplestone-chequing-4417.csv | 126 | 4254.06 | 25221.57 |
| BCD | Aurora Card (Test) | CAD | aurora-business-card-9031.csv | 99 | 119.39 | 119.03 |

Opening and closing are what the statements show (for a card, the amount owing). Layout B files start with two header lines (account type, masked account number) and then the column line. Card and brokerage dates are YYYY-MM-DD. The QBO files carry the same rows in the same order.

## Planted issues (exact amounts and dates)

- Opens from 14: every balance sheet line equals 14's adjusted closing line; retained earnings is 14's opening plus its net income; each account opens at 14's statement closing balance; opening UCC for classes 8 and 10 is 14's closing UCC.
- The owner's $25,000.00 loan carries untouched: no rows with his name. Nothing is paid to CRA and no penalty is in the books.
- 14's non-capital loss is brought forward and applied against this year's income; the year returns to a profit.
- The same business number, owner and engagements as 14 (the same 2025 year bought twice, "2024 and 2025" as text, an unconfirmed year end).

## What each check should find

- **catch-up years filed in order** (15-F01, a person decides): Onboarding says not all prior years are filed and holds the unfiled years only as text ("2024 and 2025"). Catch-up years are filed in order, oldest first: red tier (CK-40's list), a person decides. This folder is 2025.
- **second return waits for the first** (15-F02, a person decides): The 2025 return opens from the 2024 closing balances, retained earnings, UCC and non-capital loss, so it waits until the 2024 return is final. Any change to 2024 changes 2025.
- **year end to be confirmed by ops** (15-F03, a person decides): The client app stored 31 December as a guess from the quote month; no question confirms it (contract U4). Ops confirms the year end from CRA capture, the articles or the prior return before either year is filed.
- **2025 bought twice** (15-F04, a person decides): Onboarding lists two T2 engagements for tax year 2025 (created 10 Feb and 18 Mar 2025) and none for 2024: the second quote reused the year (contract U3). Ops confirms which is real and that 2024 is covered.
- **late-filing exposure** (15-F05, a person decides): Neither the T2 nor the annual HST return is filed for 2024 or 2025: CRA late-filing penalty and interest may apply. No penalty is in the books (no row says CRA or penalty); a person estimates the exposure and tells the client.
- **opening balances from the 2024 return** (15-F06, a person decides): Every opening balance equals the closing balance sheet of the 2024 books (folder 14), retained earnings is 2024's opening plus its net income, opening UCC is 2024's closing UCC by class (8 and 10), and each account opens at the 2024 statement closing balance. If the 2024 return changes, this year's opening changes with it.
- **non-capital loss applied from 2024** (15-F07, a person decides): The 2024 non-capital loss of $7,838.05 is available. This year's income for tax is $11,737.80 (profit per books plus book amortization less the CCA claimed), so $7,838.05 is applied and $0.00 is carried on. A person confirms the application once the 2024 return is final.
- **shareholder loan carried from 2024** (15-F08, a person decides): The $25,000.00 loan from the owner carries untouched (no repayment, no new loan, no rows with his name). Still no interest and no written terms: a person confirms the terms.

## Statement balances by month (from the statements, not from the export)

| Account | Month | Opening | Closing | Export activity | Rolls |
| --- | --- | --- | --- | --- | --- |
| CHQ | 2025-01 | 4254.06 | 3904.72 | -349.34 | yes |
| CHQ | 2025-02 | 3904.72 | 3555.96 | -348.76 | yes |
| CHQ | 2025-03 | 3555.96 | 4574.16 | 1018.20 | yes |
| CHQ | 2025-04 | 4574.16 | 7126.11 | 2551.95 | yes |
| CHQ | 2025-05 | 7126.11 | 10623.44 | 3497.33 | yes |
| CHQ | 2025-06 | 10623.44 | 14802.22 | 4178.78 | yes |
| CHQ | 2025-07 | 14802.22 | 17603.30 | 2801.08 | yes |
| CHQ | 2025-08 | 17603.30 | 18049.54 | 446.24 | yes |
| CHQ | 2025-09 | 18049.54 | 21979.41 | 3929.87 | yes |
| CHQ | 2025-10 | 21979.41 | 25569.67 | 3590.26 | yes |
| CHQ | 2025-11 | 25569.67 | 26403.69 | 834.02 | yes |
| CHQ | 2025-12 | 26403.69 | 25221.57 | -1182.12 | yes |
| BCD | 2025-01 | 119.39 | 118.81 | 0.58 | yes |
| BCD | 2025-02 | 118.81 | 118.52 | 0.29 | yes |
| BCD | 2025-03 | 118.52 | 159.66 | -41.14 | yes |
| BCD | 2025-04 | 159.66 | 662.61 | -502.95 | yes |
| BCD | 2025-05 | 662.61 | 1165.16 | -502.55 | yes |
| BCD | 2025-06 | 1165.16 | 1196.97 | -31.81 | yes |
| BCD | 2025-07 | 1196.97 | 926.53 | 270.44 | yes |
| BCD | 2025-08 | 926.53 | 919.39 | 7.14 | yes |
| BCD | 2025-09 | 919.39 | 1044.52 | -125.13 | yes |
| BCD | 2025-10 | 1044.52 | 791.35 | 253.17 | yes |
| BCD | 2025-11 | 791.35 | 952.17 | -160.82 | yes |
| BCD | 2025-12 | 952.17 | 119.03 | 833.14 | yes |

## Answer key and ids

id = <client>-<TAG>-<YYYY>-<MM>-<seq>. TAG names the account (CHQ chequing, USD US-dollar chequing, BCD business card, PCD personal card, BRK brokerage). YYYY-MM is the month of the row date. seq is the 1-based position of the row among that account and month, in file order (header lines do not count). Rows missing from an export get the next numbers of their month.

answer-key.json holds the account for every row, the adjusting entries, the trial balance by GIFI code (unadjusted and adjusted), the T2 inputs and the flags. Tax payable is not in it; Taxprep computes that.
