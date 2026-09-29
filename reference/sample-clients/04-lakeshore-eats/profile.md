# 04 Lakeshore Eats Inc. (Test)

All made up. Company and person names end in "(Test)" (in bank text a person carries the word TEST). The business number and every SIN fail their check digit on purpose. Nothing here is real.

**Fiscal year:** 1 Jan 2025 to 31 Dec 2025 (year end 31 Dec 2025).

## Who they are

Tom Nguyen (Test) 60% and Lina Haddad (Test) 40% own Lakeshore Eats Inc. (Test), a small restaurant. Card sales settle daily into the chequing account through MONERIS TEST BATCH (net of fees, with tips), with weekly cash deposits. Six part-time staff are paid every two weeks with their tips. The company uses the HST quick method.

## Accounts and files

| Key | Institution and layout | Currency | File (accounts and qbo) | Rows | Opening | Closing |
| --- | --- | --- | --- | --- | --- | --- |
| CHQ | A: Lakeview Bank (Test) chequing | CAD | lakeview-chequing-6640.csv | 906 | 20166.31 | 57186.67 |
| BCD | Aurora Card (Test) | CAD | aurora-business-card-2251.csv | 381 | 1396.41 | 2910.85 |

Opening and closing are what the statements show (for a card, the amount owing). Layout B files start with two header lines (account type, masked account number) and then the column line. Card and brokerage dates are YYYY-MM-DD. The QBO files carry the same rows in the same order.

## Planted issues (exact amounts and dates)

- Daily card batches from MONERIS TEST BATCH net of about 2.6% fees (each batch: sales + HST + tips, less the fee); weekly cash deposits (Tuesdays).
- HST quick method (rate in onboarding, marked confirm against CRA); remitted quarterly on 30 Apr, 31 Jul and 31 Oct 2025, and 31 Jan 2025 for the fourth quarter of 2024.
- Six part-time staff every two weeks, tips paid out with pay.
- Two shareholders, 60% and 40%.
- Rent $6,500.00 monthly; kitchen equipment $14,500.00 plus HST on 8 May 2025 (class 8); equipment lease $612.40 monthly.

## What each check should find

- **HST quick method: rate, line 101 and no input tax credits on costs** (04-F01, a person decides): Quick method rate used: 8.8% (confirm against CRA; whether a restaurant counts as a service supplier or a retailer decides the rate). Remittance = rate x tax-included sales of the quarter, no credits on expenses, credit on the kitchen equipment only. Sales (account 4010) are $367,531.19 before HST; line 101 must agree. The difference between HST collected and remitted ($11,231.72) is other income (adjusting entry 04-AJE-01).
- **card batches are net of fees and include tips and HST** (04-F02): Each MONERIS TEST BATCH deposit is gross sales plus HST plus tips less about 2.6% fees. Gross it up: sales to 4010, HST to 2050, tips to 2070, fees to 6076 (monthly totals of fees are in onboarding). Weekly cash deposits are tax-included sales.
- **payroll with tips: tips paid out through payroll** (04-F03): Card tips are held as tips payable and paid out with each biweekly pay (they are part of box 14, CPP and EI apply). Tips payable at year end: $783.57. Six part-time staff; T4s and the summary are in the answer key and onboarding.
- **two shareholders: Schedule 50** (04-F04): Tom Nguyen (Test) 60% and Lina Haddad (Test) 40% of the common shares; both are 10% or more, so both are listed on Schedule 50. Neither is paid through payroll in this file.
- **kitchen equipment: class 8 addition** (04-F05): Equipment bought 8 May 2025 for $14,500.00 plus $1,885.00 HST: class 8 addition $14,500.00; the HST is claimed as a capital credit under the quick method.
- **equipment lease: operating or capital** (04-F06, a person decides): Monthly equipment lease payments are expensed as rent. A person confirms it is an operating lease (not a purchase in disguise).

## Statement balances by month (from the statements, not from the export)

| Account | Month | Opening | Closing | Export activity | Rolls |
| --- | --- | --- | --- | --- | --- |
| CHQ | 2025-01 | 20166.31 | 16365.49 | -3800.82 | yes |
| CHQ | 2025-02 | 16365.49 | 18985.04 | 2619.55 | yes |
| CHQ | 2025-03 | 18985.04 | 24470.57 | 5485.53 | yes |
| CHQ | 2025-04 | 24470.57 | 22675.60 | -1794.97 | yes |
| CHQ | 2025-05 | 22675.60 | 11076.40 | -11599.20 | yes |
| CHQ | 2025-06 | 11076.40 | 22749.88 | 11673.48 | yes |
| CHQ | 2025-07 | 22749.88 | 27068.53 | 4318.65 | yes |
| CHQ | 2025-08 | 27068.53 | 30566.42 | 3497.89 | yes |
| CHQ | 2025-09 | 30566.42 | 42991.44 | 12425.02 | yes |
| CHQ | 2025-10 | 42991.44 | 40160.95 | -2830.49 | yes |
| CHQ | 2025-11 | 40160.95 | 45762.17 | 5601.22 | yes |
| CHQ | 2025-12 | 45762.17 | 57186.67 | 11424.50 | yes |
| BCD | 2025-01 | 1396.41 | 3213.05 | -1816.64 | yes |
| BCD | 2025-02 | 3213.05 | 3665.81 | -452.76 | yes |
| BCD | 2025-03 | 3665.81 | 3179.76 | 486.05 | yes |
| BCD | 2025-04 | 3179.76 | 2595.96 | 583.80 | yes |
| BCD | 2025-05 | 2595.96 | 2828.73 | -232.77 | yes |
| BCD | 2025-06 | 2828.73 | 3368.38 | -539.65 | yes |
| BCD | 2025-07 | 3368.38 | 3228.18 | 140.20 | yes |
| BCD | 2025-08 | 3228.18 | 2893.14 | 335.04 | yes |
| BCD | 2025-09 | 2893.14 | 2626.72 | 266.42 | yes |
| BCD | 2025-10 | 2626.72 | 2838.23 | -211.51 | yes |
| BCD | 2025-11 | 2838.23 | 2370.30 | 467.93 | yes |
| BCD | 2025-12 | 2370.30 | 2910.85 | -540.55 | yes |

## Answer key and ids

id = <client>-<TAG>-<YYYY>-<MM>-<seq>. TAG names the account (CHQ chequing, USD US-dollar chequing, BCD business card, PCD personal card, BRK brokerage). YYYY-MM is the month of the row date. seq is the 1-based position of the row among that account and month, in file order (header lines do not count). Rows missing from an export get the next numbers of their month.

answer-key.json holds the account for every row, the adjusting entries, the trial balance by GIFI code (unadjusted and adjusted), the T2 inputs and the flags. Tax payable is not in it; Taxprep computes that.

## Notes

- Owners take no pay or dividends in this file (routine detail left out).
