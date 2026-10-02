# 13 Sharma Medicine Professional Corporation (Test)

All made up. Company and person names end in "(Test)" (in bank text a person carries the word TEST). The business number and every SIN fail their check digit on purpose. Nothing here is real.

**Fiscal year:** 1 Jan 2025 to 31 Dec 2025 (year end 31 Dec 2025).

## Who they are

Anika Sharma (Test) is a physician and owns Sharma Medicine Professional Corporation (Test). OHIP pays the practice once a month for the services of two months before; the remittance advice says which. She charges a few insurance and legal form fees outside OHIP. An office assistant is on payroll. The corporation is not registered for HST: insured services are exempt supplies.

## Accounts and files

| Key | Institution and layout | Currency | File (accounts and qbo) | Rows | Opening | Closing |
| --- | --- | --- | --- | --- | --- | --- |
| CHQ | C: Harbourline Credit Union (Test) chequing | CAD | harbourline-chequing-6620.csv | 93 | 15584.42 | 257702.50 |
| BCD | Aurora Card (Test) | CAD | aurora-business-card-7714.csv | 73 | 1861.83 | 630.90 |

Opening and closing are what the statements show (for a card, the amount owing). Layout B files start with two header lines (account type, masked account number) and then the column line. Card and brokerage dates are YYYY-MM-DD. The QBO files carry the same rows in the same order.

## Planted issues (exact amounts and dates)

- OHIP pays into chequing on the 14th, bank text MOH OHIP PAYMENT TEST, twelve deposits in 2025: Jan $31,240.50, Feb $27,915.80, Mar $32,410.25, Apr $30,880.60, May $33,105.40, Jun $30,579.75, Jul $32,945.70, Aug $29,830.35, Sep $28,415.90, Oct $30,807.85, Nov $32,670.80, Dec $33,892.80. The 14 Jan 2026 ($31,905.65) and 14 Feb 2026 ($26,740.30) payments are after year end and not in the file.
- The opening OHIP receivable for Nov and Dec 2024 services is $59,156.30; the accrued receivable for Nov and Dec 2025 services is $58,645.95; OHIP revenue for 2025 services, net of the reduction, is $374,185.35.
- The June 2025 remittance advice recovers $1,180.40 paid for March 2025 services (the one reduction). A claim of $412.60 for August 2025 is rejected on the October advice and paid on the December one.
- Non-OHIP fees: NORTHGATE LIFE INSURANCE TEST $650.00 on 21 Mar and $480.00 on 26 Nov; Brantley and Cole LLP (Test) $2,400.00 on 11 Jun and $1,850.00 on 17 Sep (bank text in capitals with TEST): $5,380.00 in all, under the $30,000 small supplier limit.
- Exam-room equipment of $6,850.00 at MERIDIAN MEDICAL SUPPLY TEST on the business card on 20 May 2025 (class 8). An office assistant paid every two weeks (26 pays) with 12 CRA payroll remittances. No HST anywhere.

## What each check should find

- **OHIP accrual after year end** (13-F01): Services for November and December 2025 ($58,645.95) are paid on 14 Jan and 14 Feb 2026, after year end and not in the bank file. They are accrued as OHIP receivable in one adjusting entry. The window (three months of claim submission plus one monthly payment cycle) closes 30 Apr 2026. The opening receivable of $59,156.30 for 2024 services was collected by the January and February 2025 deposits. A person confirms the accrual against the 2026 remittance advice.
- **RA reduction (recovery of a prior payment)** (13-F02, a person decides): The June 2025 remittance advice recovers $1,180.40 paid for March 2025 services, so the June deposit is $30,579.75 and March revenue is $31,925.00. A person confirms the recovery is a reduction of revenue for the service month it belongs to.
- **rejected and resubmitted claim** (13-F03): One August 2025 claim of $412.60 was rejected on the October remittance advice and paid on the December one with October services ($33,892.80). The resubmitted claim belongs to August 2025 services ($31,220.45 for the month).
- **non-OHIP taxable supplies against the small supplier limit** (13-F04, a person decides): Insurance form fees and medical-legal reports ($5,380.00 in four deposits) are taxable supplies, kept apart from the exempt OHIP income. They are well under the $30,000 small supplier limit, so there is no registration and no HST. A person confirms the limit was not passed in this or the four previous quarters.
- **no HST return expected** (13-F05): Insured medical services are exempt supplies and the small supplier limit is not passed: no HST account, no HST program on the CRA account list and no HST return. The exam-room equipment carries its HST in the cost.
- **payroll against T4 agrees** (13-F06): One employee, 26 pays in 2025. The T4 summary in onboarding agrees with the payroll deposits and the twelve CRA remittances in the year (the December 2024 deductions were paid on 15 Jan 2025).
- **CCA addition: exam-room equipment in class 8** (13-F07): Exam-room equipment of $6,850.00 on the business card on 20 May 2025: class 8 on Schedule 8, HST included in the cost because the corporation is not registered. Book amortization is added back on Schedule 1.

## Statement balances by month (from the statements, not from the export)

| Account | Month | Opening | Closing | Export activity | Rolls |
| --- | --- | --- | --- | --- | --- |
| CHQ | 2025-01 | 15584.42 | 29709.50 | 14125.08 | yes |
| CHQ | 2025-02 | 29709.50 | 48180.70 | 18471.20 | yes |
| CHQ | 2025-03 | 48180.70 | 70151.88 | 21971.18 | yes |
| CHQ | 2025-04 | 70151.88 | 89691.03 | 19539.15 | yes |
| CHQ | 2025-05 | 89691.03 | 111541.09 | 21850.06 | yes |
| CHQ | 2025-06 | 111541.09 | 127105.58 | 15564.49 | yes |
| CHQ | 2025-07 | 127105.58 | 150324.34 | 23218.76 | yes |
| CHQ | 2025-08 | 150324.34 | 170443.46 | 20119.12 | yes |
| CHQ | 2025-09 | 170443.46 | 191143.17 | 20699.71 | yes |
| CHQ | 2025-10 | 191143.17 | 210687.39 | 19544.22 | yes |
| CHQ | 2025-11 | 210687.39 | 233568.93 | 22881.54 | yes |
| CHQ | 2025-12 | 233568.93 | 257702.50 | 24133.57 | yes |
| BCD | 2025-01 | 1861.83 | 593.09 | 1268.74 | yes |
| BCD | 2025-02 | 593.09 | 737.56 | -144.47 | yes |
| BCD | 2025-03 | 737.56 | 739.94 | -2.38 | yes |
| BCD | 2025-04 | 739.94 | 795.47 | -55.53 | yes |
| BCD | 2025-05 | 795.47 | 7852.83 | -7057.36 | yes |
| BCD | 2025-06 | 7852.83 | 875.43 | 6977.40 | yes |
| BCD | 2025-07 | 875.43 | 859.72 | 15.71 | yes |
| BCD | 2025-08 | 859.72 | 714.68 | 145.04 | yes |
| BCD | 2025-09 | 714.68 | 803.76 | -89.08 | yes |
| BCD | 2025-10 | 803.76 | 706.83 | 96.93 | yes |
| BCD | 2025-11 | 706.83 | 907.72 | -200.89 | yes |
| BCD | 2025-12 | 907.72 | 630.90 | 276.82 | yes |

## Answer key and ids

id = <client>-<TAG>-<YYYY>-<MM>-<seq>. TAG names the account (CHQ chequing, USD US-dollar chequing, BCD business card, PCD personal card, BRK brokerage). YYYY-MM is the month of the row date. seq is the 1-based position of the row among that account and month, in file order (header lines do not count). Rows missing from an export get the next numbers of their month.

answer-key.json holds the account for every row, the adjusting entries, the trial balance by GIFI code (unadjusted and adjusted), the T2 inputs and the flags. Tax payable is not in it; Taxprep computes that.
