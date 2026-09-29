# 09 Scarborough Robotics Labs Inc. (Test)

All made up. Company and person names end in "(Test)" (in bank text a person carries the word TEST). The business number and every SIN fail their check digit on purpose. Nothing here is real.

**Fiscal year:** 15 Apr 2025 to 31 Dec 2025 (year end 31 Dec 2025).

## Who they are

Wei Zhang (Test) 70% and Olu Adeyemi (Test) 30% incorporated Scarborough Robotics Labs Inc. (Test) on 15 Apr 2025 to build a robotics prototype. They paid $100.00 for shares and lent the company $55,000.00 between them. The company works from a coworking space, received a $25,000.00 innovation grant, registered for HST on 1 Jul 2025 and billed one pilot contract in November. The year ends in a loss.

## Accounts and files

| Key | Institution and layout | Currency | File (accounts and qbo) | Rows | Opening | Closing |
| --- | --- | --- | --- | --- | --- | --- |
| CHQ | A: Lakeview Bank (Test) chequing | CAD | lakeview-chequing-9273.csv | 186 | 0.00 | 43940.23 |
| BCD | Aurora Card (Test) | CAD | aurora-business-card-3390.csv | 231 | 0.00 | 2382.28 |

Opening and closing are what the statements show (for a card, the amount owing). Layout B files start with two header lines (account type, masked account number) and then the column line. Card and brokerage dates are YYYY-MM-DD. The QBO files carry the same rows in the same order.

## Planted issues (exact amounts and dates)

- Incorporated 15 Apr 2025; common shares $100.00 on 20 Apr (Wei $70.00, Olu $30.00). First year 15 Apr to 31 Dec 2025 (261 days): the business limit is prorated.
- Loans from Wei $40,000.00 (22 Apr) and Olu $15,000.00 (5 May).
- Grant from Ontario Innovation Voucher (Test) of $25,000.00 on 10 Sep.
- Coworking $1,200.00 monthly from May; incorporation legal fees $1,850.00 (24 Apr); 3D printer $4,800.00 plus HST (class 8, 18 Jun); two laptops at $2,400.00 (class 50, 8 Jul).
- HST registration effective 1 Jul 2025. One pilot contract of $18,000.00 plus HST in November (14 Nov). The year ends in a loss.
- Research costs (contract engineering, lab time, components) a person must judge.

## What each check should find

- **short first taxation year: business limit prorated** (09-F01): Incorporated 15 Apr 2025; the first year runs 15 Apr to 31 Dec 2025, 261 days. The business limit is prorated by days over 365: $500,000.00 x 261/365 = $357,534.25 (Taxprep computes). Amortization, CCA and the small business limit use the short year.
- **loss year: non-capital loss** (09-F02): Net loss per books before tax $30,300.52. Schedule 4 carries the taxable loss (after Schedule 1 add-backs and CCA, computed by Taxprep) forward; the grant and research costs below can change it.
- **two shareholders lending money** (09-F03): Wei Zhang lent $40,000.00 on 22 Apr and Olu Adeyemi $15,000.00 on 5 May 2025. Due to shareholders (2080); no interest, no written terms in the file. A person confirms terms and whether the loans are current or long term.
- **grant: treatment needs a person** (09-F04, a person decides): Ontario Innovation Voucher (Test) paid $25,000.00 on 10 Sep 2025. It may be income, a reduction of the costs it funded or a reduction of the research expenditure pool. Held in suspense (1390); a person decides. Nothing is decided here.
- **HST registration part-way through the year** (09-F05, a person decides): HST registration is effective 1 Jul 2025. Costs before that carry HST inside the cost (no credit). The 3D printer bought 18 Jun ($624.00 HST) and other pre-registration costs: whether any credit on property on hand may be claimed is a person's decision. The first return (Jul to Sep) is a refund.
- **research costs: eligibility needs a person** (09-F06, a person decides): Contract engineering, lab time and prototype components are coded to research and development (6200) as bought. Whether they qualify as scientific research and experimental development, and how the grant and the loss interact, is for a person. Nothing is claimed or capitalized here.
- **incorporation legal fees: expense or class 14.1** (09-F07, a person decides): The $1,850.00 of incorporation fees is coded to legal fees; whether they are deducted or added to class 14.1 is for the CPA (confirm).

## Statement balances by month (from the statements, not from the export)

| Account | Month | Opening | Closing | Export activity | Rolls |
| --- | --- | --- | --- | --- | --- |
| CHQ | 2025-04 | 0.00 | 38250.00 | 38250.00 | yes |
| CHQ | 2025-05 | 38250.00 | 50431.02 | 12181.02 | yes |
| CHQ | 2025-06 | 50431.02 | 45300.47 | -5130.55 | yes |
| CHQ | 2025-07 | 45300.47 | 34115.90 | -11184.57 | yes |
| CHQ | 2025-08 | 34115.90 | 17548.19 | -16567.71 | yes |
| CHQ | 2025-09 | 17548.19 | 36327.79 | 18779.60 | yes |
| CHQ | 2025-10 | 36327.79 | 30671.65 | -5656.14 | yes |
| CHQ | 2025-11 | 30671.65 | 49117.10 | 18445.45 | yes |
| CHQ | 2025-12 | 49117.10 | 43940.23 | -5176.87 | yes |
| BCD | 2025-04 | 0.00 | 14.00 | -14.00 | yes |
| BCD | 2025-05 | 14.00 | 2369.02 | -2355.02 | yes |
| BCD | 2025-06 | 2369.02 | 8475.64 | -6106.62 | yes |
| BCD | 2025-07 | 8475.64 | 8112.14 | 363.50 | yes |
| BCD | 2025-08 | 8112.14 | 1817.59 | 6294.55 | yes |
| BCD | 2025-09 | 1817.59 | 2524.84 | -707.25 | yes |
| BCD | 2025-10 | 2524.84 | 1678.25 | 846.59 | yes |
| BCD | 2025-11 | 1678.25 | 2606.66 | -928.41 | yes |
| BCD | 2025-12 | 2606.66 | 2382.28 | 224.38 | yes |

## Answer key and ids

id = <client>-<TAG>-<YYYY>-<MM>-<seq>. TAG names the account (CHQ chequing, USD US-dollar chequing, BCD business card, PCD personal card, BRK brokerage). YYYY-MM is the month of the row date. seq is the 1-based position of the row among that account and month, in file order (header lines do not count). Rows missing from an export get the next numbers of their month.

answer-key.json holds the account for every row, the adjusting entries, the trial balance by GIFI code (unadjusted and adjusted), the T2 inputs and the flags. Tax payable is not in it; Taxprep computes that.

## Notes

- There is no prior year: the opening trial balance is empty and the bank starts at zero on 15 Apr 2025.
