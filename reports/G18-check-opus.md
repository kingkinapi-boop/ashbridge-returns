# G18 check (Opus): tax content and owner picks

Checker: Opus 5.5, local, read only. Map: `data/question-coverage.json` at 5e8f0643 on claude/G18 (identical on claude/G18-check at 7abea6a2: `git diff --stat 5e8f0643 HEAD -- data/question-coverage.json data/question-bank` is empty). Read: the `detail` of all 105 flags in the sample answer keys (`reference/sample-clients/NN-name/answer-key.json`), the 38 bank items, the catalogue labels of the facts they resolve, blueprint 05 (CK clauses, AI-2), END-1, and the Goal and Clauses lines of Q00, X00, X01, G00, B03, B07, I01, V05, V10 and F07. No tests run here: the Sonnet check ran them (reports/G18-check.md, PASS).

## Verdict: FAIL

26 of 105 mappings are wrong on the facts (17 of the 41 question mappings, 9 of the 64 owner picks), and one more question mapping is incomplete. The card Goal is not met: 01-F02 and 01-F04, the two flags G18 was carded for, map to questions whose facts are the opposite balance (money the company owes the owner).

Timing and thresholds in the details hold where checked (09-F01 proration, 11-F05 instalments, 08-F09 annual HST dates, 02-F06 due date, 13-F04 small supplier test, 14-F07 CCA factor), except the four items under Outside G18.

## Wrong mappings

### A. The question resolves a different fact (direction or subject)

| Flag | What is wrong | Right target |
|---|---|---|
| 01-F02 | Q-SHL-001 resolves `onboarding.shareholder_loan.balance` (cites the lender list `shareholder_loans`); Q-SHL-002 resolves `qa.shareholder.loan_balance`, labelled "Due to shareholders at year end, as stated" (FL:104). Both are amounts the company owes the owner. The flag is $13,211.58 the owner owes the company (account 1300 in the books), to be repaid by 31 Dec 2026 (ITA 15(2), 15(2.6)). | check, owner Q00 (CK-30: the balance and the advance dates are in the books, account 1300). A client question as well (Reviewer finding 7) needs a due-from fact in `data/facts/catalogue.json`, outside the G18 Paths: a card change. |
| 01-F04 | Q-SHL-002 is the due-to balance and holds nothing about interest. The flag is the ITA 80.4(2) benefit on the due-from loan, less interest paid in the year or within 30 days after. | check, owner Q00 (CK-32). An interest-paid question would need a new fact, as above. |
| 02-F02 | Q-EXP-001 is business items on a personal card. The flag is the reverse: personal items (groceries, a family flight) on the business card, coded to 1300 until a person picks loan, benefit or pay. | check, owner I01 (AI-2 names personal spending booked to the shareholder loan; CK-42 personal-looking expenses). The loan, benefit or pay choice stays with the CPA. |
| 10-F07 | Q-CRA-002 (HST filing frequency) resolves nothing about the $286.55 and $143.10 of CRA penalties and interest or their Schedule 1 add-back. | check, owner Q00 (CK-15: lines 103 and 128 from the accounts tagged for penalties and interest), as 02-F04 already is. |
| 06-F02 | Q-REV-002 (sales channels) gives neither the destination nor the export evidence for the zero-rated US sales. | check, owner Q00 (CK-20: zero-rated supplies inside regular-method line 101). |
| 04-F02, 06-F06 | Q-REV-002 gives no fees, tips, HST or gross amounts; both flags are processor deposits net of fees, to be grossed up. | check, owner Q00 (CK-20, with an EV-13 written rule for deposits net of fees, tips and HST). |

### B. A yes/no that only opens the topic

| Flag | What is wrong | Right target |
|---|---|---|
| 03-F03, 04-F03, 08-F04, 11-F02, 13-F06 | Q-PAY-001 (Business runs payroll) says only that payroll exists. Each flag is wages against T4 box 14 by calendar year (03 and 08 span two calendar years; 04 adds tips paid through payroll). | check, owner Q00 (CK-23). |
| 06-F03, 08-F05 | Q-REV-003 (foreign currency: yes) says only that US dollars exist. The flags are the year-end revaluation at the 1.3900 test rate and the bank spread (both) and zero-rated services to US clients (08). | check, owner Q00 (revaluation and spread from the books; CK-20 for the zero-rating). |
| 02-F03 | Q-CRA-006 (CRA record available) says only that the record exists. The flag is four instalments in the bank against three credited by CRA. | check, owner Q00 (CK-13, reconciling item R23). |
| 10-F06 (incomplete) | Q-EXP-003 and Q-VHO-001 leave out the business-use share, the one fact the flag says is unknown. | keep both and add Q-EXP-006 and Q-EXP-007 (business and total km), as 12-F04 does. |

### C. A decision for a person mapped to a question

| Flag | What is wrong | Right target |
|---|---|---|
| 10-F05 | Q-PAY-001 cannot say whether the spouse is an employee (payroll, CPP, EI and tax owed) or whether $52,000.00 is reasonable for the work (ITA 67). | cpa-judgment, owner X00. |
| 09-F05 | Q-CRA-001 (registered: yes) misses the 1 Jul 2025 effective date and the choice on credits for property on hand at registration (ETA 171), which the flag leaves to a person. | cpa-judgment, owner X00. |

### D. An owner whose clauses do not cover the flag

| Flag | What is wrong | Right target |
|---|---|---|
| 10-F04 | B07 matches bank and card lines to statement lines (TB-4, EV-13); personal spending is not a matching fault. | check, owner I01 (AI-2, CK-42), as 02-F02. |
| 14-F04, 15-F04 | The Q00 reason "Double purchase read from the books" is false: the two 2025 engagements are in onboarding (contract U3), not the books, and no CK clause covers them. END-1 makes a year bought twice an ops confirmation; F07 (done) raises the item and V05 shows it as a blocker. | owner V10 (the ops New returns page, RV-30). V10 lists no ops-confirms action yet: the Lead adds END-1 to V10 or cards it. |
| 14-F01, 15-F01 | B03 (TB-8, CK-12, TB-5, EV-11: prior-year returns as sources) covers neither the catch-up order nor the tier. | check, owner X01 (CK-40 puts catch-up or unfiled years in red; check 2 of X01 lands K13 red). |
| 14-F05, 15-F05 | B03 does not estimate late-filing penalties; the flag says a person estimates the exposure and tells the client. | cpa-judgment, owner X00. |
| 06-F01 | cpa-judgment X00, while its mirror 05-F04 (the same two agreements adding to $600,000.00) is check Q00: one fact pattern, two kinds. CK-19 makes it a code check (code-1 percentages at most 100%, line A at most $500,000). | check, owner Q00 (CK-19), as 05-F04. |
| 02-F06 | G00 (the gap pass) does not own it: the 31 Mar year end is not in doubt; the flag is its effects (calendar-year T4 and T5 figures across two fiscal years, the instalment dates, the due date). | check, owner Q00 (CK-23, CK-24, CK-46; due dates from F02). |

## Ambers in the build report

1. Owners by subject: holds for the Q00 books checks, the X00 judgments, B07 for 10-F01 to 10-F03, G00 for 12-F01, 12-F02, 14-F03 and 15-F03, and B03 for 11-F03, 11-F05, 14-F02, 15-F02, 15-F06 and 15-F07. Fails for every owner pick in D.
2. 01-F03 as cpa-judgment: the kind holds (whether repaying and reborrowing is a series is for a person to decide: ITA 15(2.6), Folio S3-F1-C1). The stated reason does not: Q-SHL-002 is the due-to balance; the series facts are the 18 Dec repayment in the books and the onboarding note on the January advance.
3. 04-F01 to Q-CRA-003: holds in part. The method is the one client input the flag needs; the rate (8.8% or 4.4%, set by the goods-for-resale test) and line 101 are CK-20 and a person.

## Weak, for the findings reviewer (not counted as failures)

- 03-F01 to Q-PAY-002 (yes/no) gives not paid in the year, but not the payment date the day-179 test needs (CK-47; the date is in payroll and the T4).
- 12-F03, 12-F04 and 12-F05 re-ask what the client already said; the flags are about missing proof, which 12-F01 and 12-F02 send to G00. G00 would be consistent. 12-F03 also leaves out Q-EXP-005 (business share).
- 15-F08 maps only Q-SHL-001 (balance at onboarding); 14-F08 also has Q-SHL-002, the year-end balance.
- 07-F05 (whether $975.00 of rent arrears can be collected) and 04-F06 (operating or capital lease) are judgment flags mapped as Q00 checks; cpa-judgment X00 fits the detail better.
- 05-F05 (connected dividends) as cpa-judgment: Part IV on a connected dividend is the holder portion of the dividend refund the payer gets (ITA 186(1)(b)), mechanical with the return of 06; check Q00, or I01 (AI-2 names dividend refunds), fits better.
- 14-F03 and 15-F03: G00 is acceptable; V10 (ops confirms the year end, END-1) is the alternative.

## Outside G18 (sample facts and clauses, for the Lead)

- 05-F01 detail: adjusted aggregate investment income includes portfolio dividends (ITA 125(7)), so with the $11,800.00 of listed-share dividends (05-F03) the 2025 figure is $64,800.00, not $53,000.00; and by CK-36 (ITA 125(5.1)) the 2025 business limit is cut by the investment income of tax years ending in 2024, so this figure cuts 2026.
- 04-F01 detail: quick-method line 101 includes the tax (CK-20), so it is about $415,310 (sales of $367,531.19 plus 13%), not $367,531.19; and the $11,231.72 gain appears to leave out the 1% credit on the first $30,000.00 of eligible supplies.
- 03-F01 detail says payment by day 179 (26 Dec 2025); CK-47 says payment on day 180 is in time (27 Dec 2025 here). The 28 Dec payment is day 181 and late either way; the Q47 spec should settle the day count against ITA 78(4).
- 09-F07: the $1,850.00 is under the $3,000 that ITA 20(1)(b) lets the company deduct; only an excess goes to class 14.1. The cpa-judgment mapping holds.

## Rule candidates

- Rule candidate: a question mapping covers a flag only when the fact the question resolves (its catalogue label) is a fact the flag detail names, in the same direction and subject; a yes/no that only opens a topic is not coverage. Where the catalogue states a direction (due to, due from), the rule test compares it with the account the flag names.
- Rule candidate: every check or cpa-judgment entry names the clause that covers it, and the rule test checks that the owner card lists that clause (Q00 stands in for CK-10 to CK-47 until the Q cards are carded); one fact pattern seen from two returns of a group (05-F04 and 06-F01) maps the same way.

## How to see each finding

- The entry: `data/question-coverage.json` at the flag id. The facts: the same id in the sample answer key (field `detail`). What a question resolves: its bank item in `data/question-bank/` and that key in `data/facts/catalogue.json` (for example `qa.shareholder.loan_balance`, labelled "Due to shareholders at year end, as stated").
- Counts over the map (node): 41 question entries; check Q00 32, cpa-judgment X00 13, check B03 10, check G00 5, check B07 4.
- Every owner named as a right target (Q00, X00, X01, I01, V10) is carded in plan/slices.json and has a card file, so the A467 rule holds for each.
