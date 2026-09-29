# 10 Danforth Cleaning Co. Ltd. (Test)

All made up. Company and person names end in "(Test)" (in bank text a person carries the word TEST). The business number and every SIN fail their check digit on purpose. Nothing here is real.

**Fiscal year:** 1 Jan 2025 to 31 Dec 2025 (year end 31 Dec 2025).

## Who they are

Rosa Ferreira (Test) owns Danforth Cleaning Co. Ltd. (Test), which cleans offices and clinics for twelve customers under monthly contracts (paid by e-transfer) and small cash jobs. Three contract cleaners are paid weekly. The books are a mess: the bank file is incomplete and has extra lines, family costs go through the business account, her husband is paid without payroll and an SUV was bought in March.

## Accounts and files

| Key | Institution and layout | Currency | File (accounts and qbo) | Rows | Opening | Closing |
| --- | --- | --- | --- | --- | --- | --- |
| CHQ | C: Harbourline Credit Union (Test) chequing | CAD | harbourline-chequing-4460.csv | 565 (+56 not in the export) | 39021.82 | 138408.81 |
| BCD | Aurora Card (Test) | CAD | aurora-business-card-8815.csv | 363 | 1087.10 | 1329.52 |

Opening and closing are what the statements show (for a card, the amount owing). Layout B files start with two header lines (account type, masked account number) and then the column line. Card and brokerage dates are YYYY-MM-DD. The QBO files carry the same rows in the same order.

## Planted issues (exact amounts and dates)

- The chequing file has no May rows (the statement balance jumps); the true May activity is listed in the answer key as missing from the export.
- Four March transactions appear twice; eight December 2024 transactions are mixed into the January rows.
- HST regular, quarterly, filed late twice: penalties and interest $286.55 (18 Feb) and $143.10 (21 Oct).
- Twelve commercial customers pay by e-transfer; weekly cash deposits of $300.00 to $900.00.
- Groceries (weekly), a $1,450.00 children's camp on 7 Jul, and a family phone plan ($187.65 monthly) paid from the business account.
- Spouse Carlos Ferreira (Test) paid $2,000.00 every two weeks (from 3 Jan) as pay with no source deductions.
- An SUV bought 12 Mar 2025 for $72,000.00 plus $9,360.00 HST (class 10.1 limit applies).

## What each check should find

- **missing month: the chequing export has no May rows** (10-F01): The statement balance is $26,049.01 at 30 Apr and $42,915.66 at 31 May, but the export has no May rows: 56 real transactions are missing (listed in the answer key with missingFromExport). Ask for the May statement; do not book May from guesswork.
- **duplicate lines in March** (10-F02): Four March transactions appear twice in the export (same date, words and amount). The second copy of each is a duplicate: post nothing. March activity in the export is more than the statement shows.
- **last year's statement mixed in** (10-F03): Eight rows dated December 2024 sit among the January 2025 rows. They belong to last year and are already in the opening balances: post nothing.
- **personal spending paid from the business account** (10-F04, a person decides): Groceries, a $1,450.00 children's camp (7 Jul) and a family phone plan ($187.65 a month) are paid from the business account. Coded to amounts due from the shareholder (1300) until a person decides between loan, benefit or pay. Not business expenses; no input tax credits.
- **spouse paid with no payroll** (10-F05, a person decides): Carlos Ferreira (Test), the owner's spouse, is paid $2,000.00 every two weeks (26 payments, $52,000.00 in the year, two of them in the missing May) as pay with no source deductions and no T4. Held in suspense (1390). A person decides: is he an employee (then payroll, CPP, EI and tax are owed), is the pay reasonable for work done, or is it something else.
- **luxury vehicle: class 10.1 cost limit** (10-F06, a person decides): An SUV was bought 12 Mar 2025 for $72,000.00 plus $9,360.00 HST. Class 10.1 caps the capital cost (and the HST credit) at the prescribed limit; the amount over the limit is not depreciable. Personal use is unknown (onboarding). A person decides the business-use share and confirms the limit for the year.
- **HST returns filed late twice: penalties and interest** (10-F07, a person decides): CRA charged penalties and interest of $286.55 (18 Feb 2025) and $143.10 (21 Oct 2025) on late HST returns. Added back on Schedule 1 (the interest part: a person confirms). Not ordinary expenses.
- **contract cleaners: worker status** (10-F08, a person decides): Three people are paid weekly by e-transfer as sub-contractors. Not a planted issue; a person may still ask whether they are employees.

## Statement balances by month (from the statements, not from the export)

| Account | Month | Opening | Closing | Export activity | Rolls |
| --- | --- | --- | --- | --- | --- |
| CHQ | 2025-01 | 39021.82 | 53088.24 | 14066.42 | yes |
| CHQ | 2025-02 | 53088.24 | 70839.19 | 17750.95 | yes |
| CHQ | 2025-03 | 70839.19 | 7969.08 | -59705.17 | NO: planted: four transactions appear twice in the export |
| CHQ | 2025-04 | 7969.08 | 26049.01 | 18079.93 | yes |
| CHQ | 2025-05 | 26049.01 | 42915.66 | 0.00 | NO: planted: the export has no May rows; the balance jumps |
| CHQ | 2025-06 | 42915.66 | 57432.88 | 14517.22 | yes |
| CHQ | 2025-07 | 57432.88 | 64885.82 | 7452.94 | yes |
| CHQ | 2025-08 | 64885.82 | 79396.93 | 14511.11 | yes |
| CHQ | 2025-09 | 79396.93 | 98382.92 | 18985.99 | yes |
| CHQ | 2025-10 | 98382.92 | 105065.85 | 6682.93 | yes |
| CHQ | 2025-11 | 105065.85 | 122584.06 | 17518.21 | yes |
| CHQ | 2025-12 | 122584.06 | 138408.81 | 15824.75 | yes |
| BCD | 2025-01 | 1087.10 | 1909.38 | -822.28 | yes |
| BCD | 2025-02 | 1909.38 | 1442.01 | 467.37 | yes |
| BCD | 2025-03 | 1442.01 | 1615.80 | -173.79 | yes |
| BCD | 2025-04 | 1615.80 | 1743.46 | -127.66 | yes |
| BCD | 2025-05 | 1743.46 | 1695.31 | 48.15 | yes |
| BCD | 2025-06 | 1695.31 | 1941.90 | -246.59 | yes |
| BCD | 2025-07 | 1941.90 | 2363.09 | -421.19 | yes |
| BCD | 2025-08 | 2363.09 | 1769.75 | 593.34 | yes |
| BCD | 2025-09 | 1769.75 | 1915.05 | -145.30 | yes |
| BCD | 2025-10 | 1915.05 | 1959.43 | -44.38 | yes |
| BCD | 2025-11 | 1959.43 | 2205.03 | -245.60 | yes |
| BCD | 2025-12 | 2205.03 | 1329.52 | 875.51 | yes |

## Answer key and ids

id = <client>-<TAG>-<YYYY>-<MM>-<seq>. TAG names the account (CHQ chequing, USD US-dollar chequing, BCD business card, PCD personal card, BRK brokerage). YYYY-MM is the month of the row date. seq is the 1-based position of the row among that account and month, in file order (header lines do not count). Rows missing from an export get the next numbers of their month.

answer-key.json holds the account for every row, the adjusting entries, the trial balance by GIFI code (unadjusted and adjusted), the T2 inputs and the flags. Tax payable is not in it; Taxprep computes that.

## Notes

- Contract cleaners are paid by e-transfer every Friday; they are not a planted issue.
