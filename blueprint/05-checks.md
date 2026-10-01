# 05 Checks, AI, exceptions and tiers

Code checks what must tie. AI checks what needs judgment. A person judges flags. Every tax rule cites its source (`reference/sources.md`); a rule with no source is built as a flag. A firm parameter (a percentage, a day count or a dollar floor the firm chose, not the law) is kept as data, named as the firm's own on screen, and changed only by an amber row.

## How checks work

- **CK-1** Each check is a record: id, kind (tie, reconciliation, flag, AI), when it applies, inputs, rule, source link, and what it raises.
- **CK-2** A check with no evidence shows "not checked: no evidence", never a pass.
- **CK-3** A tie must agree to the dollar.
- **CK-4** A reconciliation shows both amounts, the difference, and a list of reconciling items. Each item has a type from a fixed list and a source. Only an unexplained remainder raises an exception. AI may propose items; code checks that they add up.
- **CK-48** Every reconciling item carries one type code from the table below, an amount, a source document and the person who accepted it, and code refuses an item whose type the check does not allow.
- **CK-49** The reconciling-item types are data with stable codes that are never renumbered; a new type takes the next free code and needs an amber row.
- **CK-50** A rounding item (R21) is at most $1 per reconciliation (firm parameter); anything larger is unexplained.

Reconciling-item types (x: the check may use it). Sources: `reference/research/2026-10-01-recs-reconciled.md` for R01 to R22; CK-13 and CK-44 for R23 to R29.

| Code | Type | 13 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 44 | 45 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| R01 | period_split: fiscal year against calendar year or filing periods, stub periods | | x | x | | x | x | x | | | |
| R02 | accrued_unpaid: earned, billed or declared by year end, paid after | | x | x | | x | x | | x | | |
| R03 | prior_accrual_settled: a prior-year accrual paid this year | | | x | | x | x | | x | | |
| R04 | in_transit: outstanding cheque, deposit or payment in transit | | | | x | | | x | | | |
| R05 | statement_date_gap: statement not dated at year end (cards, loans) | | | | x | | | | | | |
| R06 | bank_only_item: fee, interest or NSF on the statement, not booked | | | | x | | | | | | |
| R07 | tax_in_amount: GST/HST or PST inside revenue; quick method tax-included | | x | | | | | x | | | |
| R08 | supply_scope: zero-rated, exempt, outside Canada, quick-method ineligible | | x | | | | | | | | |
| R09 | non_supply_income: interest, grants; non-OHIP income | | x | x | | | | | | | |
| R10 | capital_disposal: the books show the gain, the return shows proceeds or nothing | | x | | | | | | | | |
| R11 | benefit_no_cash: taxable benefit in box 14, booked outside wages | | | | | x | | | | | |
| R12 | employer_cost: employer CPP, EI and EHT in wages accounts | | | | | x | | | | | |
| R13 | classification: wages in cost of sales, T4A payees in wages, another payroll account | | | | | x | x | | | | |
| R14 | shareholder_loan_credit: a dividend credited or set off, no cash | | | | | | x | | x | | |
| R15 | deemed_or_stock_dividend: s.84, redemption premium, stock dividend | | | | | | x | | x | | |
| R16 | capital_dividend: s.83(2), no T5, not on Schedule 3 Part 3 | | | | | | x | | x | | |
| R17 | under_50_recipient: no T5 needed | | | | | | x | | | | |
| R18 | adjustment_recovery: credit note, bad debt, OHIP reduction, reject, recovery | | x | x | | | | x | | | |
| R19 | cra_account_item: interest, penalty, instalment, rebate, assessment change | | | | | | | x | | | |
| R20 | prior_return_correction: an amount on an earlier or later return, an amended slip | | x | | | x | x | x | | | x |
| R21 | rounding: at most $1 (CK-50) | x | x | x | x | x | x | x | x | x | x |
| R22 | other_explained: free text plus a document reference | x | x | x | x | x | x | x | x | x | x |
| R23 | not_yet_applied: a payment CRA has received but not yet applied to the year | x | | | | | | | | | |
| R24 | applied_to_other_year: a payment CRA applied to another tax year | x | | | | | | | | | |
| R25 | transferred_from_other_account: an amount moved from another CRA program account | x | | | | | | | | | |
| R26 | input_tax_credit: GST/HST recovered on a capital purchase | | | | | | | | | x | |
| R27 | not_available_for_use: an asset bought but not yet available for use | | | | | | | | | x | |
| R28 | disposal: an asset sold or written off in the year | | | | | | | | | x | |
| R29 | expensed_item: a capital-account debit expensed, or an expense capitalized | | | | | | | | | x | |

- **CK-5** A flag always goes to a person. Code never passes or fails it.
- **CK-6** Each exception carries its dollar amount and an estimated tax effect.

## Ties (code)

- **CK-10** Balance sheet in the Taxprep export: GIFI 2599 equals 3499 plus 3620, and 3640 equals 2599, with contra-asset lines (such as accumulated amortization) negative. Source: RC4088.
- **CK-11** Retained earnings: GIFI 3849 equals 3660 plus 3680, 3700, 3720 and 3740, each with the sign set in the field rules (the sign of 3700 settled on the Taxprep trial); 3680 equals 9999; 3849 equals 3600; 3660 equals last year's filed 3849, with any restatement in 3720; with no prior year, the 3660 test is "not checked: no evidence". Source: RC4088.
- **CK-12** Opening balances: losses, RDTOH (eligible and non-eligible), GRIP and the capital dividend account equal the latest CRA assessed figure from Auto-fill, stored with its pull date; UCC by class and donations carried forward equal last year's filed closing, flagged when a reassessment of that year is on file; with neither source, "not checked: no evidence", and an amalgamation or wind-up is a flag. Source: T4012 chapter 3; About T2 Auto-fill.
- **CK-14** Schedule 50 lists every holder of 10% or more (exactly 10% included) of the common or preferred shares in the share register, at most ten, each at the register's percentage, and each percentage column totals at most 100%; with no register, only the at-most-100% test runs and the rest is "not checked: no evidence". Source: T2 Schedule 50; T4012 chapter 2.
- **CK-15** Schedule 1: lines 104, 105 and 106 equal their GIFI code sets (data from the Taxprep GIFI transfer list, the 2026 sets settled on the Taxprep trial); lines 403, 107 and 404 equal Schedule 8; line 121 equals half of GIFI 8523 less excepted amounts, each excepted amount flagged with its ITA 67.1(2) paragraph; lines 103 and 128 equal the ledger accounts tagged for tax interest, penalties and fines, and with no tagged account they are a flag. Source: T2 Schedule 1; ITA 67.1, 18(1)(t); Taxprep GIFI transfer list.
- **CK-18** Every figure recomputed from its sources equals its Taxprep cell.
- **CK-19** Associated group: for each calendar year, the Schedule 23 names, association codes and percentages are identical on every return in the group; code-1 percentages total at most 100% and line A at most $500,000; line 410 equals column 6, prorated by days over 365 for a tax year under 51 weeks, with the lesser limit for a second tax year ending in the same calendar year; a missing agreement or a sister return not in the system is a flag. Source: T2 Schedule 23; ITA 125(2) to (5).
- **CK-43** Shareholder-loan continuity: for each shareholder, last year's closing loan balance plus this year's advances less repayments (from QBO) equals the year-end balance of that shareholder's loan accounts in the trial balance. Source: Folio S3-F1-C1.

## Reconciliations (code; the explained remainder must be zero)

- **CK-13** Instalments claimed (line 840) against what CRA's account credits to the year, as a reconciliation (CK-4) with items not yet applied (R23), applied to another year (R24) and transferred from another account (R25); the evidence is a CRA account statement the preparer uploads.
- **CK-20** Revenue against GST/HST line 101 for the same periods: regular-method line 101 includes zero-rated and exempt supplies and other revenue and excludes the tax and amounts reported on a previous return; quick-method line 101 includes the tax and excludes zero-rated and exempt supplies, supplies outside Canada and sales of real property and capital assets; a Telefile filer has no line 101. Source: GST/HST return instructions; RC4058.
- **CK-21** Physician revenue against OHIP remittance advice, counting RAs up to the close of the three-month claim submission window plus one monthly payment cycle after year end. Source: Ontario claims submission pages.
- **CK-22** Cash, loans and cards against year-end statements, per account, with outstanding items and statement-date differences as reconciling items; the unexplained remainder must be zero.
- **CK-23** Wages against box 14 of the T4 Summaries of every payroll account, split by pay date for the calendar years the fiscal year spans; the payroll register stands in for a calendar year not yet filed. Source: T4 slip and T4 Summary pages.
- **CK-24** Dividends paid, by payment date for the calendar years covered, against the actual amounts on T5 slips (boxes 10 and 24, never 11 or 25); capital dividends have no T5 and reconcile to the T2054. Source: T5 guide; completing the T5 slip.
- **CK-25** HST balance against net tax for periods up to year end not yet remitted, plus any CRA balance.
- **CK-26** Dividends declared (GIFI 3700 only; 3701 and 3702 are inside it) against taxable dividends paid on Schedule 3 plus capital dividends from the T2054, with declared-but-unpaid as a reconciling item. Source: RC4088; T4012 chapter 6.
- **CK-44** CCA additions: Schedule 8 additions by class against the year's debits to capital asset accounts in QBO, with input tax credits, items not yet available for use, disposals and expensed items as reconciling items. Source: T2 Schedule 8.
- **CK-45** Income tax provision: current income taxes (GIFI 9990) against the total tax payable in the lock export's review lines (RT-10), and taxes payable (GIFI 2680) against that tax less instalments paid. Source: RC4088.

## Flags (code raises; a person judges)

- **CK-30** A shareholder loan not repaid within one year after the end of the lender's tax year in which it was made, with repayments applied to the oldest loan first, shown as a notice when the deadline is under 90 days away (firm parameter). Source: ITA 15(2), 15(2.6); Folio S3-F1-C1.
- **CK-31** A series of loans and repayments: a cash repayment followed within 180 days by new advances to the same borrower totalling at least 50% of it (both firm parameters), or a repayment funded by a new loan, flagged once per pair; repayments made by applying dividends, salary or bonus owed to the borrower are not a series. Source: Folio S3-F1-C1 1.84 to 1.86.
- **CK-32** A shareholder loan whose possible interest benefit (prescribed-rate interest for the period less interest paid in the year or within 30 days after) is over $250 (firm parameter), not raised when CK-30 includes the same loan in income. Source: ITA 80.4(2), 80.4(3)(b); Folio S3-F1-C2.
- **CK-33** (removed in v1.1 alignment, amber A39)
- **CK-34** A specified investment business: property income (interest, dividends, rent, royalties) of at least 50% of gross revenue (firm proxy for "principal purpose") and no more than five full-time employees throughout the year, unless an associated corporation provides the services, means no small business deduction; the flag shows the count and a person decides what counts as full-time. Source: ITA 125(7).
- **CK-35** Personal services business signs: the person doing the work (or a related person) holds 10% or more, one client gives at least 80% of revenue (firm parameter), no more than five full-time employees throughout the year and the payer is not an associated corporation; the flag names the effects (no small business deduction, 5% added tax, deductions limited) and needs a note on client count, who controls the work and staff. Source: ITA 125(7), 123.5, 18(1)(p).
- **CK-36** Group investment income over $50,000 in the tax years ending in the preceding calendar year, or prior-year taxable capital over $10 million: the federal business limit is cut by the greater of the passive cut ($5 for each $1 over $50,000) and the taxable-capital cut (running from $10 million to $50 million), Ontario's limit takes the taxable-capital cut only, and a missing associated-corporation figure is its own flag. Source: ITA 125(5.1); CRA Ontario small business deduction page.
- **CK-37** Foreign reporting: T1135 when the cost of specified foreign property exceeds $100,000 at any time in the year; T106 when transactions with non-arm's-length non-residents exceed $1,000,000; T1134 for any foreign affiliate (1% equity, 10% with related persons). Source: ITA 233.3, 233.1(4), 233.4(4), 95(1); CRA T1135 questions and answers.
- **CK-38** Slips the return implies, by calendar year of payment: dividends of $50 or more paid to a recipient need T5s (capital dividends excluded); salary, wages or bonuses paid over $500, or with CPP, EI or tax withheld, need T4s (an accrued bonus needs a T4 only for the year it is paid); flag when CRA data shows none filed. Source: RC4120; CRA T5 slip pages.
- **CK-39** A line that moved 25% or more from last year and by more than the greater of $2,000 and 5% of revenue (all firm parameters), with no preparer note, skipping lines already flagged by another check; every line's change also shows inline in the review.
- **CK-41** Eligible dividends paid in the year above GRIP at year end (Part III.1 exposure); a capital dividend with no election dated on or before the earlier of the day payable and the day paid, or above the capital dividend account just before payment. Source: ITA 89(1), 185.1, 83(2), 184(2).
- **CK-42** Personal-looking expenses, meals, vehicles and home office items raised by the tax checklist (AI-2), each with its facts.
- **CK-46** Next year's instalments are worked out in code and shown in the brief: none when tax payable is $3,000 or less for this year or last year; otherwise quarterly only for a CCPC that claimed the small business deduction this year or last, with associated-group taxable income of $500,000 or less, taxable capital of $10 million or less and a perfect compliance history, and monthly in every other case, with any condition code cannot settle (such as compliance history) raised as a flag. Source: CRA instalment requirements and instalment dates.
- **CK-47** Salary, wages, a bonus or other remuneration accrued at year end and not paid by the end of the 180th day after year end (payment on day 180 is in time; reasonable vacation pay and salary deferral amounts are excluded; a promissory note is not payment) is flagged as not deductible this year, with its amount. Source: ITA 78(4); IT-109R2 paras 10 and 15.

## Tier colour (approved; the tier never reduces the review below the full return)

- **CK-40** Each return gets one tier, set by these approved rules. Every term gets a testable meaning in the check library, logged as amber when first defined.

| Tier | A return lands here when |
|---|---|
| Green | Returning client we filed last year; every hard tie passes; no open exceptions; revenue and cash corroborated; tax payable within 25% of last year or explained; no special items |
| Amber | First year with us but a clean prior T2; any amber exception; many dollars sourced only to the client; unexplained prior-year swings; a preparer with fewer than 50 reviewed files |
| Red | First-year corporation; catch-up or unfiled years; no CRA access; shareholder loan past its 15(2) deadline; associated group or passive income over $50,000; share issues, redemptions, rollovers, wind-ups or amalgamations; capital gains or capital dividend elections; foreign property or affiliates; personal services business signs; specified corporate income; short tax year; change of control; losses carried back; open CRA audit; a red-team item with a tax effect |

## AI (judgment only)

- **AI-1** Every AI output is JSON against a schema, with citations. A citation is a ledger record, a document box, or a return cell.
- **AI-2** Tax checklist: owner-manager issues run against the facts (personal expenses, meals, vehicles, home office, a large GIFI 9270 Other expenses balance, shareholder-loan signs code does not catch such as a year-end journal clearing the account or personal spending booked to it, CCPC status, association, dividend refunds), each finding citing its facts; what code already flags is not repeated (shareholder-loan continuity CK-43 and the 15(2.6) one-year date CK-30, slips CK-38, personal services business signs CK-35, the capital dividend account CK-41, next year's instalments CK-46).
- **AI-3** Red team: a different model, with no access to preparer notes or our extracted facts, reads the printed return and the raw documents and lists what CRA would most likely adjust, with the dollar effect.
- **AI-4** Code checks every citation: the record exists, and any quoted number or words appear in the OCR words inside the cited box. A failed citation drops the item and counts against that AI step.
- **AI-5** A finding about something missing cites where it should be (a document, a page or a return cell), and is kept.
- **AI-6** "I can't tell" is a valid answer and goes to a person.
- **AI-7** AI never clears, closes or approves. No AI output changes a fact's status without the code checks.
- **AI-8** Document text is data, never instructions. AI steps have no tools that write.
- **AI-9** SINs, dates of birth and account numbers are masked in text and blacked out on page images before any AI call.
- **AI-10** Every AI output records the model, prompt version, OCR engine and mapping release that produced it.
- **AI-11** A fixed test set from the test world runs before any model or prompt change; a drop in its scores blocks the change.
- **AI-12** The gap pass: code decides found, missing, conflicting or weak for each required fact. AI only fills slot values for questions from the approved question bank and writes observations with citations.

## Exceptions

- **EX-1** Each exception gets one answer: fixed, explained (with a source or reason), or accepted risk (for the CPA to judge).
- **EX-2** An answer with no source or reason, or one that only says "per client" or the like, is refused by a code rule.
- **EX-3** If last year had the same exception with an accepted explanation, that explanation is proposed, never applied by itself.
- **EX-4** Flags and exceptions sort red first, then by dollar effect.
