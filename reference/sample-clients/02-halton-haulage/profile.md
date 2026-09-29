# 02 Halton Haulage Ltd. (Test)

All made up. Company and person names end in "(Test)" (in bank text a person carries the word TEST). The business number and every SIN fail their check digit on purpose. Nothing here is real.

**Fiscal year:** 1 Apr 2025 to 31 Mar 2026 (year end 31 Mar 2026).

## Who they are

Marco Bellini (Test) owns Halton Haulage Ltd. (Test) alone and drives one tractor for one carrier, Transcan Freight Ltd. (Test), which pays a weekly settlement. He bought a used tractor in June 2025, mostly financed, and uses the business card for fuel and small costs, and sometimes for family costs. He also pays CRA instalments.

## Accounts and files

| Key | Institution and layout | Currency | File (accounts and qbo) | Rows | Opening | Closing |
| --- | --- | --- | --- | --- | --- | --- |
| CHQ | B: Maplestone Bank (Test) chequing | CAD | maplestone-chequing-5530.csv | 417 | 17135.42 | 53900.86 |
| BCD | Aurora Card (Test) | CAD | aurora-business-card-4408.csv | 473 | 1825.31 | 15825.75 |

Opening and closing are what the statements show (for a card, the amount owing). Layout B files start with two header lines (account type, masked account number) and then the column line. Card and brokerage dates are YYYY-MM-DD. The QBO files carry the same rows in the same order.

## Planted issues (exact amounts and dates)

- Weekly settlements from TRANSCAN FREIGHT TEST LTD of $5,200.00 to $6,800.00 plus HST (every Friday, 4 Apr 2025 to 27 Mar 2026); the only customer.
- Used tractor bought 2 Jun 2025 for $118,000.00 plus $15,340.00 HST: $33,340.00 from chequing (that day), $100,000.00 financed by Lakeview Equipment Finance (Test) at 8.5% over 5 years, monthly payments of $2,051.65 from July (table in onboarding). Class 16.
- Business card: nine grocery charges (about $1,140.00 in all) and a family flight of $1,642.00 (5 Dec 2025).
- CRA instalments of $3,500.00 on 30 Jun, 30 Sep, 31 Dec 2025 and 31 Mar 2026; CRA's record in onboarding credits only three.
- HST late-filing penalty and interest of $412.37 on 19 Aug 2025.
- HST regular, monthly; June 2025 is a refund month (tractor tax credit). Year end 31 Mar 2026.

## What each check should find

- **financed tractor: class 16 addition with interest and principal** (02-F01): Used tractor bought 2 Jun 2025 for $118,000.00 plus $15,340.00 HST. Only $33,340.00 left the chequing account; $100,000.00 was financed by Lakeview Equipment Finance (Test) at 8.5% over 60 months with no bank row. Class 16 addition $118,000.00; HST claimed as an input tax credit (June is a refund month). Nine payments from July: split each into interest and principal using the onboarding table; do not expense the whole payment.
- **personal costs on the business card: groceries and a family flight** (02-F02, a person decides): Nine grocery charges (about $1,140.00) and a family flight ($1,642.00) are on the business card. Coded to amounts due from the shareholder (1300) until a person decides between shareholder loan, taxable benefit or pay. Not business expenses; no input tax credit.
- **CRA instalments do not agree: bank shows four, CRA credits three** (02-F03): The bank shows four instalments of $3,500.00 (30 Jun, 30 Sep, 31 Dec 2025 and 31 Mar 2026), $14,000.00 in all. CRA's record (onboarding) credits three; the 31 Dec 2025 payment is not credited. A person asks the client and CRA to move the credit before instalments are entered on the return.
- **non-deductible penalty on a late HST return** (02-F04, a person decides): CRA charged $412.37 in August 2025 as penalty and interest on a late HST return. Penalty is not deductible: added back on Schedule 1 (the interest part on the same payment: a person confirms). Not an ordinary expense.
- **one customer only: worker status and personal services business signs** (02-F05, a person decides): All revenue is weekly settlements from Transcan Freight Ltd. (Test), one carrier. The owner drives the tractor. A person looks at whether the arrangement looks like employment (personal services business signs) and whether the company has its own equipment, insurance and risk. The tractor and insurance point to a real business.
- **non-calendar fiscal year end (31 Mar 2026)** (02-F06): The year runs 1 Apr 2025 to 31 Mar 2026. The T2 is due six months after year end (30 Sep 2026); the calendar-year figures a client quotes (T-slips, CRA letters) straddle two fiscal years; instalments fall on 30 Jun, 30 Sep, 31 Dec and 31 Mar.
- **HST payable at year end: March 2026 return (monthly filer)** (02-F07): The March 2026 return is due 30 Apr 2026, after year end; the adjusted trial balance shows $265.46 owing (account 2050).

## Statement balances by month (from the statements, not from the export)

| Account | Month | Opening | Closing | Export activity | Rolls |
| --- | --- | --- | --- | --- | --- |
| CHQ | 2025-04 | 17135.42 | 32108.60 | 14973.18 | yes |
| CHQ | 2025-05 | 32108.60 | 46442.33 | 14333.73 | yes |
| CHQ | 2025-06 | 46442.33 | 13780.31 | -32662.02 | yes |
| CHQ | 2025-07 | 13780.31 | 15639.53 | 1859.22 | yes |
| CHQ | 2025-08 | 15639.53 | 39705.67 | 24066.14 | yes |
| CHQ | 2025-09 | 39705.67 | 39274.08 | -431.59 | yes |
| CHQ | 2025-10 | 39274.08 | 47953.09 | 8679.01 | yes |
| CHQ | 2025-11 | 47953.09 | 50908.73 | 2955.64 | yes |
| CHQ | 2025-12 | 50908.73 | 48882.28 | -2026.45 | yes |
| CHQ | 2026-01 | 48882.28 | 57367.15 | 8484.87 | yes |
| CHQ | 2026-02 | 57367.15 | 57756.07 | 388.92 | yes |
| CHQ | 2026-03 | 57756.07 | 53900.86 | -3855.21 | yes |
| BCD | 2025-04 | 1825.31 | 14473.21 | -12647.90 | yes |
| BCD | 2025-05 | 14473.21 | 12750.88 | 1722.33 | yes |
| BCD | 2025-06 | 12750.88 | 14770.51 | -2019.63 | yes |
| BCD | 2025-07 | 14770.51 | 17045.35 | -2274.84 | yes |
| BCD | 2025-08 | 17045.35 | 14841.14 | 2204.21 | yes |
| BCD | 2025-09 | 14841.14 | 18514.55 | -3673.41 | yes |
| BCD | 2025-10 | 18514.55 | 14881.04 | 3633.51 | yes |
| BCD | 2025-11 | 14881.04 | 14519.26 | 361.78 | yes |
| BCD | 2025-12 | 14519.26 | 16655.87 | -2136.61 | yes |
| BCD | 2026-01 | 16655.87 | 16781.06 | -125.19 | yes |
| BCD | 2026-02 | 16781.06 | 14267.63 | 2513.43 | yes |
| BCD | 2026-03 | 14267.63 | 15825.75 | -1558.12 | yes |

## Answer key and ids

id = <client>-<TAG>-<YYYY>-<MM>-<seq>. TAG names the account (CHQ chequing, USD US-dollar chequing, BCD business card, PCD personal card, BRK brokerage). YYYY-MM is the month of the row date. seq is the 1-based position of the row among that account and month, in file order (header lines do not count). Rows missing from an export get the next numbers of their month.

answer-key.json holds the account for every row, the adjusting entries, the trial balance by GIFI code (unadjusted and adjusted), the T2 inputs and the flags. Tax payable is not in it; Taxprep computes that.

## Notes

- No owner pay, salary or dividend is visible in the year: a person may ask. (Not one of the planted issues.)
- Accrued loan interest for the last days of March is not booked (small); a person may add it.
