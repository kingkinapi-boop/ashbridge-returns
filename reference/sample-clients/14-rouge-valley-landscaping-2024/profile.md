# 14 Rouge Valley Landscaping Inc. (Test)

All made up. Company and person names end in "(Test)" (in bank text a person carries the word TEST). The business number and every SIN fail their check digit on purpose. Nothing here is real.

**Fiscal year:** 1 Jan 2024 to 31 Dec 2024 (year end 31 Dec 2024).

## Who they are

Declan Murphy (Test) owns Rouge Valley Landscaping Inc. (Test), a seasonal residential and commercial landscaping business (April to November). The firm was asked to prepare two years at once: this is the first, 2024. Nothing has been filed for 2024 or 2025. In April he lent the company money and bought a mower and a trailer; the year ends in a loss.

## Accounts and files

| Key | Institution and layout | Currency | File (accounts and qbo) | Rows | Opening | Closing |
| --- | --- | --- | --- | --- | --- | --- |
| CHQ | B: Maplestone Bank (Test) chequing | CAD | maplestone-chequing-4417.csv | 108 | 4563.31 | 4254.06 |
| BCD | Aurora Card (Test) | CAD | aurora-business-card-9031.csv | 95 | 1190.87 | 119.39 |

Opening and closing are what the statements show (for a card, the amount owing). Layout B files start with two header lines (account type, masked account number) and then the column line. Card and brokerage dates are YYYY-MM-DD. The QBO files carry the same rows in the same order.

## Planted issues (exact amounts and dates)

- The owner lends the company $25,000.00 on 10 Apr 2024 (DECLAN MURPHY TEST, his only row).
- A zero-turn mower from GREENLINE TURF EQUIPMENT TEST on 12 Apr 2024: $14,200.00 plus HST ($16,046.00; class 8). A trailer from NORTHBAY TRAILER SALES TEST on 26 Apr 2024: $6,800.00 plus HST ($7,684.00; class 10).
- Seasonal work from April to November; the year ends in a loss. Nothing is paid to CRA in the year and no penalty is in the books.
- Onboarding says not all prior years are filed, holds "2024 and 2025" only as text, marks the year end unconfirmed, and lists the same 2025 year as two T2 engagements.

## What each check should find

- **catch-up years filed in order** (14-F01, a person decides): Onboarding says not all prior years are filed and holds the unfiled years only as text ("2024 and 2025"). Catch-up years are filed in order, oldest first: red tier (CK-40's list), a person decides. This folder is 2024.
- **second return waits for the first** (14-F02, a person decides): The 2025 return opens from the 2024 closing balances, retained earnings, UCC and non-capital loss, so it waits until the 2024 return is final. Any change to 2024 changes 2025.
- **year end to be confirmed by ops** (14-F03, a person decides): The client app stored 31 December as a guess from the quote month; no question confirms it (contract U4). Ops confirms the year end from CRA capture, the articles or the prior return before either year is filed.
- **2025 bought twice** (14-F04, a person decides): Onboarding lists two T2 engagements for tax year 2025 (created 10 Feb and 18 Mar 2025) and none for 2024: the second quote reused the year (contract U3). Ops confirms which is real and that 2024 is covered.
- **late-filing exposure** (14-F05, a person decides): Neither the T2 nor the annual HST return is filed for 2024 or 2025: CRA late-filing penalty and interest may apply. No penalty is in the books (no row says CRA or penalty); a person estimates the exposure and tells the client.
- **non-capital loss for 2024** (14-F06, a person decides): The 2024 year ends in a loss: $6,108.05 per books, a non-capital loss of $7,838.05 for tax after the book amortization add-back and the CCA claimed. It is carried to 2025 (folder 15), which applies it against that year's income.
- **CCA additions: mower in class 8 and trailer in class 10** (14-F07): A zero-turn mower of $14,200.00 plus HST ($16,046.00) on 12 Apr 2024 (class 8) and a trailer of $6,800.00 plus HST ($7,684.00) on 26 Apr 2024 (class 10), both from chequing. HST is claimed, so capital cost is before HST. CCA is claimed in full (class 8 at 20%, class 10 at 30%, the accelerated investment incentive factor 1.0 for 2024).
- **shareholder loan from the owner** (14-F08, a person decides): Declan Murphy (Test) lent the company $25,000.00 on 10 Apr 2024 (account 2080). No interest, no written terms. A person confirms the terms and whether the loan is current or long term. It is still owed at year end and carries into 2025.

## Statement balances by month (from the statements, not from the export)

| Account | Month | Opening | Closing | Export activity | Rolls |
| --- | --- | --- | --- | --- | --- |
| CHQ | 2024-01 | 4563.31 | 3142.49 | -1420.82 | yes |
| CHQ | 2024-02 | 3142.49 | 2797.48 | -345.01 | yes |
| CHQ | 2024-03 | 2797.48 | 2448.28 | -349.20 | yes |
| CHQ | 2024-04 | 2448.28 | 5367.03 | 2918.75 | yes |
| CHQ | 2024-05 | 5367.03 | 7842.97 | 2475.94 | yes |
| CHQ | 2024-06 | 7842.97 | 6866.76 | -976.21 | yes |
| CHQ | 2024-07 | 6866.76 | 6397.76 | -469.00 | yes |
| CHQ | 2024-08 | 6397.76 | 4808.60 | -1589.16 | yes |
| CHQ | 2024-09 | 4808.60 | 3180.21 | -1628.39 | yes |
| CHQ | 2024-10 | 3180.21 | 4344.75 | 1164.54 | yes |
| CHQ | 2024-11 | 4344.75 | 5657.27 | 1312.52 | yes |
| CHQ | 2024-12 | 5657.27 | 4254.06 | -1403.21 | yes |
| BCD | 2024-01 | 1190.87 | 115.06 | 1075.81 | yes |
| BCD | 2024-02 | 115.06 | 119.25 | -4.19 | yes |
| BCD | 2024-03 | 119.25 | 172.93 | -53.68 | yes |
| BCD | 2024-04 | 172.93 | 828.75 | -655.82 | yes |
| BCD | 2024-05 | 828.75 | 1042.32 | -213.57 | yes |
| BCD | 2024-06 | 1042.32 | 962.37 | 79.95 | yes |
| BCD | 2024-07 | 962.37 | 1193.75 | -231.38 | yes |
| BCD | 2024-08 | 1193.75 | 790.65 | 403.10 | yes |
| BCD | 2024-09 | 790.65 | 689.07 | 101.58 | yes |
| BCD | 2024-10 | 689.07 | 867.23 | -178.16 | yes |
| BCD | 2024-11 | 867.23 | 1173.26 | -306.03 | yes |
| BCD | 2024-12 | 1173.26 | 119.39 | 1053.87 | yes |

## Answer key and ids

id = <client>-<TAG>-<YYYY>-<MM>-<seq>. TAG names the account (CHQ chequing, USD US-dollar chequing, BCD business card, PCD personal card, BRK brokerage). YYYY-MM is the month of the row date. seq is the 1-based position of the row among that account and month, in file order (header lines do not count). Rows missing from an export get the next numbers of their month.

answer-key.json holds the account for every row, the adjusting entries, the trial balance by GIFI code (unadjusted and adjusted), the T2 inputs and the flags. Tax payable is not in it; Taxprep computes that.
