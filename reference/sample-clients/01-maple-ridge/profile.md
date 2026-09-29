# 01 Maple Ridge Consulting Inc. (Test)

All made up. Company and person names end in "(Test)" (in bank text a person carries the word TEST). The business number and every SIN fail their check digit on purpose. Nothing here is real.

**Fiscal year:** 1 Jan 2025 to 31 Dec 2025 (year end 31 Dec 2025).

## Who they are

Priya Nair (Test) owns Maple Ridge Consulting Inc. (Test) alone. It is a one-person IT consulting company. Nearly all revenue is one monthly invoice to Northwind Logistics Inc. (Test); three small clients paid once each. She takes money out as needed, pays some business costs on her own card and works partly from home.

## Accounts and files

| Key | Institution and layout | Currency | File (accounts and qbo) | Rows | Opening | Closing |
| --- | --- | --- | --- | --- | --- | --- |
| CHQ | A: Lakeview Bank (Test) chequing | CAD | lakeview-chequing-4821.csv | 561 | 8011.69 | 131184.97 |
| BCD | Aurora Card (Test) | CAD | aurora-business-card-7712.csv | 446 | 1835.43 | 856.13 |
| PCD | Aurora Card (Test), owner's personal card | CAD | aurora-personal-card-3309.csv | 495 | 1163.58 | 2148.25 |

Opening and closing are what the statements show (for a card, the amount owing). Layout B files start with two header lines (account type, masked account number) and then the column line. Card and brokerage dates are YYYY-MM-DD. The QBO files carry the same rows in the same order.

## Planted issues (exact amounts and dates)

- Northwind invoice $14,000.00 plus HST every month ($15,820.00 deposited, about the 24th to 29th); other clients: 19 Mar $6,200.00 + HST, 16 Jul $5,900.00 + HST, 22 Oct $6,600.00 + HST.
- Owner e-transfers to herself: 12 Feb $4,000.00, 3 Apr $6,500.00, 20 Jun $5,000.00, 15 Aug $7,500.00, 10 Oct $4,000.00. She repays $12,000.00 on 18 Dec. Her note says about $10,000 again in January. No interest.
- Non-eligible dividend of $20,000.00 on 20 Dec (a Saturday e-transfer).
- Personal card business items: Adobe $659.88, client lunches $86.40 and $124.15, monitor $379.99, train ticket $88.00, conference $450.00.
- Meals on the business card: $1,850.00 in total over the year.
- Home office: 15% of $2,800.00 monthly rent she pays personally.
- HST regular, quarterly. Q4 2024 owing at the start ($5,113.28) is paid 31 Jan 2025; Q4 2025 is paid 30 Jan 2026, so it is payable at year end.

## What each check should find

- **personal services business signs** (01-F01, a person decides): One client (Northwind Logistics Inc. (Test), $168,000.00 of about $186,700.00) is about 90% of revenue; the owner does all the work herself, has no employees, works in Northwind's office on its laptop 9 to 5 (client note) and Northwind calls her a contractor. She claims the small business deduction. Expect a flag for the CPA; nothing decided here.
- **shareholder loan unpaid at year end, repayment deadline 31 Dec 2026** (01-F02): Amount due from the owner at year end is $13,211.58: advances $27,000.00 (12 Feb, 3 Apr, 20 Jun, 15 Aug, 10 Oct) less $12,000.00 repaid 18 Dec less $1,788.42 of her business items reimbursed. Repayment deadline: 31 Dec 2026 (end of the fiscal year after the year the loan was made). No interest is charged.
- **repay then reborrow: series of loans and repayments** (01-F03, a person decides): She repaid $12,000.00 on 18 Dec 2025 and her onboarding note says she will take about $10,000 again in January. The repayment may be part of a series of loans and repayments and may not count as a repayment. A person decides.
- **no interest charged on shareholder loan** (01-F04, a person decides): No interest is charged on the loan. A deemed interest benefit may apply if it stays unpaid; the prescribed rate and the treatment are for the CPA to confirm.
- **business items on the owner personal card** (01-F05): Six items totalling $1,788.42 (Adobe $659.88, lunches $86.40 and $124.15, monitor $379.99, train $88.00, conference $450.00) are on her personal card but are business costs by her list. Expect an adjusting entry reducing the shareholder balance, with receipts asked for. The monitor is a small item (expense or class 50 is a person's choice).
- **meals: 50% limit on the deduction and on the HST claim** (01-F06): About $1,850.00 of meals on the business card plus $210.55 of client lunches on the personal card. Only half is deductible (Schedule 1 add-back, see t2Inputs) and only half of the HST on meals is claimed.
- **home office: rent paid personally, needs a person's decision** (01-F07, a person decides): 15% of $2,800.00 monthly rent is $420.00 a month, $5,040.00 a year, paid by the owner personally. Not booked. A person decides whether the company may claim it (needs an arrangement to reimburse her; personal services business status may limit deductions).
- **dividend needs a resolution and a T5** (01-F08): Non-eligible dividend of $20,000.00 paid 20 Dec 2025 by e-transfer to the owner. Schedule 3 dividends paid, a T5 for the owner (actual amount 20,000.00) and the directors' resolution.
- **HST payable at year end (Q4 paid 30 Jan 2026)** (01-F09): The Q4 2025 return is paid on 30 Jan 2026, after year end, so $5,486.94 of HST is a current liability in the adjusted trial balance (account 2050).

## Statement balances by month (from the statements, not from the export)

| Account | Month | Opening | Closing | Export activity | Rolls |
| --- | --- | --- | --- | --- | --- |
| CHQ | 2025-01 | 8011.69 | 15384.78 | 7373.09 | yes |
| CHQ | 2025-02 | 15384.78 | 24490.02 | 9105.24 | yes |
| CHQ | 2025-03 | 24490.02 | 44955.18 | 20465.16 | yes |
| CHQ | 2025-04 | 44955.18 | 46055.60 | 1100.42 | yes |
| CHQ | 2025-05 | 46055.60 | 59553.14 | 13497.54 | yes |
| CHQ | 2025-06 | 59553.14 | 67867.47 | 8314.33 | yes |
| CHQ | 2025-07 | 67867.47 | 82717.96 | 14850.49 | yes |
| CHQ | 2025-08 | 82717.96 | 88242.54 | 5524.58 | yes |
| CHQ | 2025-09 | 88242.54 | 101545.17 | 13302.63 | yes |
| CHQ | 2025-10 | 101545.17 | 112591.27 | 11046.10 | yes |
| CHQ | 2025-11 | 112591.27 | 125806.72 | 13215.45 | yes |
| CHQ | 2025-12 | 125806.72 | 131184.97 | 5378.25 | yes |
| BCD | 2025-01 | 1835.43 | 910.67 | 924.76 | yes |
| BCD | 2025-02 | 910.67 | 803.83 | 106.84 | yes |
| BCD | 2025-03 | 803.83 | 865.26 | -61.43 | yes |
| BCD | 2025-04 | 865.26 | 823.93 | 41.33 | yes |
| BCD | 2025-05 | 823.93 | 911.82 | -87.89 | yes |
| BCD | 2025-06 | 911.82 | 906.62 | 5.20 | yes |
| BCD | 2025-07 | 906.62 | 1192.37 | -285.75 | yes |
| BCD | 2025-08 | 1192.37 | 878.12 | 314.25 | yes |
| BCD | 2025-09 | 878.12 | 868.89 | 9.23 | yes |
| BCD | 2025-10 | 868.89 | 779.18 | 89.71 | yes |
| BCD | 2025-11 | 779.18 | 815.85 | -36.67 | yes |
| BCD | 2025-12 | 815.85 | 856.13 | -40.28 | yes |
| PCD | 2025-01 | 1163.58 | 1910.48 | -746.90 | yes |
| PCD | 2025-02 | 1910.48 | 3103.40 | -1192.92 | yes |
| PCD | 2025-03 | 3103.40 | 2643.67 | 459.73 | yes |
| PCD | 2025-04 | 2643.67 | 2533.21 | 110.46 | yes |
| PCD | 2025-05 | 2533.21 | 2650.02 | -116.81 | yes |
| PCD | 2025-06 | 2650.02 | 2366.17 | 283.85 | yes |
| PCD | 2025-07 | 2366.17 | 2779.09 | -412.92 | yes |
| PCD | 2025-08 | 2779.09 | 2239.01 | 540.08 | yes |
| PCD | 2025-09 | 2239.01 | 1741.10 | 497.91 | yes |
| PCD | 2025-10 | 1741.10 | 2585.64 | -844.54 | yes |
| PCD | 2025-11 | 2585.64 | 2361.26 | 224.38 | yes |
| PCD | 2025-12 | 2361.26 | 2148.25 | 213.01 | yes |

## Answer key and ids

id = <client>-<TAG>-<YYYY>-<MM>-<seq>. TAG names the account (CHQ chequing, USD US-dollar chequing, BCD business card, PCD personal card, BRK brokerage). YYYY-MM is the month of the row date. seq is the 1-based position of the row among that account and month, in file order (header lines do not count). Rows missing from an export get the next numbers of their month.

answer-key.json holds the account for every row, the adjusting entries, the trial balance by GIFI code (unadjusted and adjusted), the T2 inputs and the flags. Tax payable is not in it; Taxprep computes that.

## Notes

- Payments to the owner use the same words (E-TRANSFER SENT and her name) for loan advances and for the dividend; only amount, date and the onboarding list tell them apart.
- Volumes are modest on purpose: a one-person company.
