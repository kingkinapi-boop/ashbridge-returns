# CK-20 to CK-26 reconciliations: settled (recs-a CRA angle, recs-b practice angle)

Date 1 Oct 2026. Research checker. All numbers made up. [opened] = I opened the page today and it says this. [A] or [B] = found by one report only. [inf] = inference, not stated by a source. Confidence: high, medium, low.

## The answer
Every reconciliation is: book figure = filed or third-party figure + listed reconciling items + unexplained. Code computes it; unexplained must be zero (or within rounding) or a person is flagged; AI never clears it. One fixed list of 22 item types (below) serves all seven checks. Three rules decide most results:
1. GST/HST line 101 under the regular method follows the return instructions (zero-rated, exempt and other revenue IN, tax OUT), not RC4022, which describes the small-supplier and filing-frequency tests, not line 101.
2. T4 box 14 and T5 boxes follow the calendar year of payment, so a non-calendar year end needs a pay-date split, and the later calendar year has no filed slip yet when the T2 is prepared (the payroll or dividend register stands in).
3. Capital dividends are on neither the T5 nor Schedule 3 Part 3; they come from the T2054 and the minutes.

## Fixed reconciling-item types (one list; x = the check may use it)
| Code | Type | 20 | 21 | 22 | 23 | 24 | 25 | 26 |
|---|---|---|---|---|---|---|---|---|
| R01 | period_split: fiscal year vs calendar year or filing periods, stub periods | x | x | | x | x | x | |
| R02 | accrued_unpaid: earned, billed or declared by year end, paid after | x | x | | x | x | | x |
| R03 | prior_accrual_settled: prior-year accrual paid this year | | x | | x | x | | x |
| R04 | in_transit: outstanding cheque, deposit or payment in transit | | | x | | | x | |
| R05 | statement_date_gap: statement not dated at year end (cards, loans) | | | x | | | | |
| R06 | bank_only_item: fee, interest, NSF on the statement, not booked | | | x | | | | |
| R07 | tax_in_amount: GST/HST or PST inside revenue; quick method tax-included | x | | | | | x | |
| R08 | supply_scope: zero-rated, exempt, outside Canada, quick-method ineligible | x | | | | | | |
| R09 | non_supply_income: interest, grants; non-OHIP income | x | x | | | | | |
| R10 | capital_disposal: books show the gain, the return shows proceeds or nothing | x | | | | | | |
| R11 | benefit_no_cash: taxable benefit in box 14, booked outside wages | | | | x | | | |
| R12 | employer_cost: employer CPP, EI, EHT in wages accounts | | | | x | | | |
| R13 | classification: wages in cost of sales, T4A payees in wages, another RP account | | | | x | x | | |
| R14 | shareholder_loan_credit: dividend credited or set off, no cash | | | | | x | | x |
| R15 | deemed_or_stock_dividend: s.84, redemption premium, stock dividend | | | | | x | | x |
| R16 | capital_dividend: s.83(2), no T5, not on Schedule 3 Part 3 | | | | | x | | x |
| R17 | under_50_recipient: no T5 needed | | | | | x | | |
| R18 | adjustment_recovery: credit note, bad debt, OHIP reduction, reject, recovery | x | x | | | | x | |
| R19 | cra_account_item: interest, penalty, instalment, rebate, assessment change | | | | | | x | |
| R20 | prior_return_correction: amount on an earlier or later return, amended slip | x | | | x | x | x | |
| R21 | rounding: within the set tolerance | x | x | x | x | x | x | x |
| R22 | other_explained: free text plus a document reference | x | x | x | x | x | x | x |

Each item carries type, amount, source document and who accepted it. Merged from A (per-check lists) and B (13 codes) [inf].

## Per reconciliation
**CK-20 Revenue vs line 101.** Rule [opened, high]: regular line 101 = "total amount of revenue from supplies of property and services, including zero-rated and exempt supplies, and other revenue"; exclude PST, GST, HST and "any amounts you reported on a previous return". Quick method: revenue from taxable supplies including the GST/HST; exclude zero-rated, supplies outside Canada, relieved Indian Act and government supplies, sales of real property, sales of capital assets. Src: https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/complete-file-instructions.html
Settled: RC4022 [opened] has no line 101 text; its exclusion list (exempt, capital property, goodwill, outside Canada, zero-rated exports, financial services) is for the small-supplier test and filing frequency. A's "conflict" is two different tests; the instructions win. A's item 4 (capital sales out "in both") and B's example (interest and van gain removed) are wrong for the regular method as written: proceeds and interest are in. Practice may differ, so R09 and R10 remain, each shown to a person.
Inputs: P&L income by month; line 101 of each return overlapping the year; method per period.
Worked (regular, calendar year): books 520,000 = taxable fees 480,000 + zero-rated 25,000 + interest 3,000 + gain on equipment 12,000 (proceeds 20,000). Line 101 total 480,000 + 25,000 + 3,000 + 20,000 = 528,000. Difference -8,000 = R10 (gain 12,000 vs proceeds 20,000). Unexplained 0.
Worked (quick): books 105,000 = taxable fees 100,000 + zero-rated 5,000. Line 101 = 100,000 x 1.13 = 113,000. Difference -8,000 = R07 -13,000 + R08 +5,000. Unexplained 0. Confidence: high (rule), medium (capital proceeds in practice). Telefile "no line 101": not verified.

**CK-21 Physician revenue vs OHIP RAs.** Rule [opened, high]: claims within three months of service (services from 1 Apr 2023; stale-dated claims may be refused); received by the 18th "typically" processed the following month; RA "between the 5th and 7th"; "payment should be on or before the 15th of the month". Src: https://www.ontario.ca/document/resources-for-physicians/claims-submission and https://www.ontario.ca/document/education-and-prevention-committee-billing-briefs/rules-regarding-claim-submission-periods
Dropped: A's codes VJ7, 55 and 57 (not on the opened pages). B's Bill Medics pages not reopened: practice only, medium.
Lag [inf]: a December service can be paid as late as about 15 May (three months to submit, one cycle, the 15th). Inputs: the year's RAs, RAs after year end until that window closes, the year-end receivable list.
Worked [B]: RAs 488,000 + R02 71,000 - R03 39,000 = 520,000 = books. If books say 524,000, 4,000 is unexplained and flagged.

**CK-22 Cash, loans, cards vs statements** [B only; A did not cover]. No CRA rule; bookkeeping practice. Src [opened]: https://quickbooks.intuit.com/ca/resources/accounting/what-is-a-bank-reconciliation/ (outstanding cheques, deposits in transit, interest, service charges, NSF; leftovers are entry errors, transpositions, omissions, unauthorised items, bank errors). Inputs per account: statement at or nearest year end, book balance, items. Cards and loans [inf]: mid-month closing (R05), accrued interest (R02). Nothing beyond R21 stays unexplained. Confidence medium.
Worked: bank 48,200 + R04 deposit 3,100 - R04 cheques 5,450 = 45,850; books 45,895 - R06 fee 45 = 45,850. Card: statement 15 Dec 2,300; charges 16 to 31 Dec 640; paid 28 Dec 2,300; books 640 = 2,300 + 640 - 2,300. Loan: lender 50,000 + accrued interest 210 = books 50,210.

**CK-23 Wages vs T4 Summaries.** Rule [opened, high]: "Income is reported on a T4 slip for the year in which it is paid, regardless of when it was earned"; box 14 is total income before deductions; Summary line 14 adds box 14 of all slips, and totals must agree with the slips "for that payroll account". Src: https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/payroll/completing-filing-information-returns/t4-information-employers/t4-slip.html and .../t4-summary.html
A and B agree. Added: sum every RP account; the later calendar year's T4 is due only at the end of February after it, so the register by pay date stands in [inf, high].
Worked (FYE 30 Jun 2026): pay dates Jul to Dec 2025 90,000 (T4 2025 box 14 172,000 less Jan to Jun 2025 82,000); Jan to Jun 2026 95,000 (register); R02 6,000; R03 5,000. Books 186,000 = 90,000 + 95,000 + 6,000 - 5,000. Unexplained 0.

**CK-24 Dividends paid vs T5.** Rule [opened, high]: T5 for dividends "paid by a Canadian corporation" in the calendar year, "including most deemed dividends"; dividends "include all payments in cash or kind (including stock dividends)"; no slip under $50 per recipient; due the last day of February; no T5 for "capital dividends, as described in Income Tax Folio S3-F2-C1". Boxes 10 and 24 actual; 11 and 25 grossed up (15%, 38%) and blank for corporate recipients. Src: https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/t4015/t5-guide-return-investment-income.html and https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/completing-slips-summaries/financial-slips-summaries/return-investment-income-t5/t5-slip/completing-t5-slip.html
Settled: A marked capital dividends on the T5 "not found"; the T5 guide says no T5 (R16). Compare boxes 10 + 24 only (A and B agree). Open: B's "credited to a shareholder loan counts as paid" is not on the opened pages.
Worked (FYE 31 Mar 2026): books 60,000 taxable + 10,000 capital. T5 2025 box 10 55,000 includes 15,000 paid Jan to Mar 2025 (R01); 2026 to date 20,000 (register). 60,000 = 55,000 - 15,000 + 20,000; capital 10,000 = R16.

**CK-25 HST balance vs net tax.** Rule [opened, high]: 103 collected or collectible, 104 additions, 105 auto total; 106 ITCs, 107 deductions, 108 auto total (layout from 13 May 2024); 109 net tax = 105 - 108; 110 instalments; 111 rebates. Src: https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/complete-file-return-business/calculate-net-tax.html and the instructions page above. B's "105 - 108" is right; it is line 109. Balance [inf, high]: net tax of periods ending by year end and unpaid + CRA account balance (R19) - refunds receivable, with R04 for payments in transit.
Worked [A]: Q4 line 103 11,300 - line 106 4,100 = 7,200, + CRA interest 40 = 7,240 expected; books 7,900; 660 unexplained: flag.

**CK-26 GIFI 3700 vs Schedule 3 plus capital dividends.** Rule [opened, high]: 3700 "Dividends declared", including "liquidating dividends, premium paid on redemption of shares, and stock dividends"; 3701 cash and 3702 patronage are its sub-items; dividends credited to an investment account go to 3740. Src: https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/rc4088/general-index-financial-information-gifi.html. Schedule 3 Part 3 lists taxable dividends paid; dividends out of the capital dividend account do not qualify for the refund [opened]: https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/t4012/t2-corporation-income-tax-guide-chapter-6-pages-6-7-t2-return.html
Settled: B's "capital dividends on Schedule 3" is not supported; take them from T2054 and minutes (A). Schedule 3 line numbers NOT verified (form PDF unreadable here).
Worked [A]: 3700 120,000 (taxable 100,000 + capital 20,000); 15,000 declared 20 Dec, paid 5 Jan; 30,000 prior-year declaration paid this year; Schedule 3 taxable paid 115,000. 115,000 + capital 20,000 + R02 15,000 - R03 30,000 = 120,000. Unexplained 0.

## Clause changes proposed (Lead: one amber each)
| Clause | Problem | Proposed wording (added) | Source |
|---|---|---|---|
| CK-20 | silent on prior-return amounts and capital sales | "Line 101 excludes amounts reported on a previous return. Quick method also excludes sales of real property and capital assets and supplies outside Canada." | complete-file-instructions |
| CK-21 | "payment lag" undefined | "RAs up to the close of the three-month submission window plus one monthly cycle after year end." | both ontario.ca pages |
| CK-22 | no tolerance stated | "Per account; the unexplained remainder must be zero." | Intuit (practice) |
| CK-23 | later year not yet filed; several RP accounts | "Box 14 of every payroll account, split by pay date; the payroll register stands in for a calendar year not yet filed." | T4 slip, T4 Summary |
| CK-24 | boxes and capital dividends unstated | "Actual amounts (boxes 10 and 24), never 11 or 25; capital dividends have no T5 and reconcile to the T2054." | T5 guide, T5 slip page |
| CK-26 | 3700 sub-items could be added twice | "GIFI 3700 only (3701 and 3702 are inside it); capital dividends from the T2054." | RC4088 |

## For the CPA's check (decision 0008, B8)
1. Regular-method line 101 includes interest and capital-asset proceeds, as the instructions say? (CK-20 worked example.)
2. Dividends credited to a shareholder loan: on the T5 as paid? (CK-24.)
3. OHIP window to about 15 May for a December year end: right? (CK-21.)
4. The 22 item types: any missing, any you would never accept?

## Open points
Schedule 3 line numbers; Telefile and line 101; GST34 lines 90 and 91; OHIP RA codes; dividends credited to a loan; no CPA Canada or Taxprep source in either report; Welch LLP and Bill Medics pages not reopened.
