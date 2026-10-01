# 05 Checks, AI, exceptions and tiers

Code checks what must tie. AI checks what needs judgment. A person judges flags. Every tax rule cites its source (`reference/sources.md`); a rule with no source is built as a flag.

## How checks work

- **CK-1** Each check is a record: id, kind (tie, reconciliation, flag, AI), when it applies, inputs, rule, source link, and what it raises.
- **CK-2** A check with no evidence shows "not checked: no evidence", never a pass.
- **CK-3** A tie must agree to the dollar.
- **CK-4** A reconciliation shows both amounts, the difference, and a list of reconciling items. Each item has a type from a fixed list and a source. Only an unexplained remainder raises an exception. AI may propose items; code checks that they add up.
- **CK-5** A flag always goes to a person. Code never passes or fails it.
- **CK-6** Each exception carries its dollar amount and an estimated tax effect.

## Ties (code)

- **CK-10** Balance sheet: assets equal liabilities plus equity, in the Taxprep export.
- **CK-11** Retained earnings: GIFI 3849 equals 3660 plus 3680, 3700, 3720 and 3740, with Schedule 100's signs; 3660 equals last year's 3849.
- **CK-12** Opening balances equal last year's closing as assessed: UCC by class, loss pools, RDTOH (eligible and non-eligible), GRIP, capital dividend account, donations carried forward.
- **CK-13** Instalments claimed equal what CRA credited.
- **CK-14** Schedule 50 holdings add to 100% by class and list every holder of 10% or more.
- **CK-15** Schedule 1: the amortization add-back equals GIFI 8670; CCA claimed equals Schedule 8's total; half of GIFI 8523 (meals and entertainment) is added back; tax penalties and interest are added back.
- **CK-18** Every figure recomputed from its sources equals its Taxprep cell.
- **CK-19** Associated group: the Schedule 23 shares are identical on every return in the group and total no more than $500,000; a tax year under 51 weeks prorates the limit.
- **CK-43** Shareholder-loan continuity: for each shareholder, last year's closing loan balance plus this year's advances less repayments (from QBO) equals the year-end balance of that shareholder's loan accounts in the trial balance. Source: Folio S3-F1-C1.

## Reconciliations (code; the explained remainder must be zero)

- **CK-20** Revenue and GST/HST line 101 for the same periods. Regular method: line 101 includes zero-rated and exempt supplies and other revenue, without the tax. Quick method: line 101 includes the tax and excludes zero-rated and exempt supplies. Telefile filers have no line 101.
- **CK-21** Physician revenue and OHIP remittance advice, allowing for payment lag.
- **CK-22** Cash, loans and cards against year-end statements, with outstanding items and statement-date differences as reconciling items.
- **CK-23** Wages against the T4 Summaries for the calendar years the fiscal year spans.
- **CK-24** Dividends paid against T5 slips for the calendar years covered.
- **CK-25** HST balance against net tax for periods up to year end not yet remitted, plus any CRA balance.
- **CK-26** Dividends declared (GIFI 3700) against taxable dividends paid on Schedule 3 plus capital dividends, with declared-but-unpaid as a reconciling item.
- **CK-44** CCA additions: Schedule 8 additions by class against the year's debits to capital asset accounts in QBO, with input tax credits, items not yet available for use, disposals and expensed items as reconciling items. Source: T2 Schedule 8.
- **CK-45** Income tax provision: current income taxes (GIFI 9990) against the total tax payable in the lock export's review lines (RT-10), and taxes payable (GIFI 2680) against that tax less instalments paid. Source: RC4088.

## Flags (code raises; a person judges)

- **CK-30** A shareholder loan not repaid within one year after the end of the lender's tax year in which it was made. Repayments apply to the oldest loan first.
- **CK-31** A repayment followed by a new advance, or paid from a new loan (a series of loans and repayments).
- **CK-32** A shareholder loan with no interest charged (possible interest benefit).
- **CK-33** (removed in v1.1 alignment, amber A39)
- **CK-34** Property income (rent, interest) with five or fewer full-time employees: a specified investment business, with no small business deduction.
- **CK-35** Personal services business signs: one main client, the owner does the work, few employees.
- **CK-36** Group investment income over $50,000 in the tax years ending in the preceding calendar year: the federal business limit is cut by $5 for each $1 over (the greater of this cut and the taxable-capital cut applies). Ontario's limit is not cut for passive income but is cut for taxable capital.
- **CK-37** Foreign reporting signs: foreign property (T1135), non-arm's-length foreign transactions (T106), foreign affiliates (T1134).
- **CK-38** Slips the return implies: dividends paid need T5s; accrued bonuses need T4s. Flag when CRA data shows none filed.
- **CK-39** A line that moved 25% or more from last year with no preparer note. Every line's change also shows inline in the review.
- **CK-41** Eligible dividends designated above GRIP (Part III.1 exposure); a capital dividend with no election on file.
- **CK-42** Personal-looking expenses, meals, vehicles and home office items raised by the tax checklist (AI-2), each with its facts.
- **CK-46** Next year's instalments are worked out in code and shown in the brief: none when tax payable is $3,000 or less for this year or last year; otherwise quarterly only for a CCPC that claimed the small business deduction this year or last, with associated-group taxable income of $500,000 or less, taxable capital of $10 million or less and a perfect compliance history, and monthly in every other case, with any condition code cannot settle (such as compliance history) raised as a flag. Source: CRA instalment requirements and instalment dates.
- **CK-47** Salary, wages, a bonus or other remuneration accrued at year end and still unpaid on the 180th day after year end (paid on day 180 or later, or not at all) is flagged as not deductible this year, with its amount. Source: ITA 78(4).

## Tier colour (approved; the tier never reduces the review below the full return)

- **CK-40** Each return gets one tier, set by these approved rules. Every term gets a testable meaning in the check library, logged as amber when first defined.

| Tier | A return lands here when |
|---|---|
| Green | Returning client we filed last year; every hard tie passes; no open exceptions; revenue and cash corroborated; tax payable within 25% of last year or explained; no special items |
| Amber | First year with us but a clean prior T2; any amber exception; many dollars sourced only to the client; unexplained prior-year swings; a preparer with fewer than 50 reviewed files |
| Red | First-year corporation; catch-up or unfiled years; no CRA access; shareholder loan past its 15(2) deadline; associated group or passive income over $50,000; share issues, redemptions, rollovers, wind-ups or amalgamations; capital gains or capital dividend elections; foreign property or affiliates; personal services business signs; specified corporate income; short tax year; change of control; losses carried back; open CRA audit; a red-team item with a tax effect |

## AI (judgment only)

- **AI-1** Every AI output is JSON against a schema, with citations. A citation is a ledger record, a document box, or a return cell.
- **AI-2** Tax checklist: owner-manager issues run against the facts (personal expenses, meals, vehicles, home office, salary and dividends against slips, CCPC status, association, personal services business signs, capital dividend account, dividend refunds). Each finding cites its facts. Next year's instalments are code (CK-46).
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
