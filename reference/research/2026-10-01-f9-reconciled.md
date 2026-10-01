# F9 reconciled: review checklist, owner-manager issues, TB to GIFI, Taxprep diagnostics

Research checker, 1 Oct 2026. From 2026-10-01-f9-a.md (official angle) and 2026-10-01-f9-b.md (practice angle). Every deciding claim below was re-opened on the cited page today unless marked. Labels: [fact] page re-opened today; [A only] / [B only] one report found it and it was not re-confirmed; [inference]; [open].
Key correction: the firm's trial is **CCH iFirm Taxprep** (plan/taxprep-trial-plan.md), so the diagnostics policy is written in iFirm's five categories; the desktop Taxprep types both reports led with are the secondary mapping.

## The answer in short

1. **CPA review order** (for RV-1): brief and identity, then statements and GIFI, Schedule 1, capital (8, 6), losses (4), rate (7, 23, SBD, PSB), dividend accounts (GRIP, RDTOH, CDA, Part IV), shareholders and related parties (50, 9, 11, slips), Ontario (500/5), disclosures (T1135, 141), payment and filing. The two reports agree on this order in substance; no CRA or CPA body publishes a reviewer order [fact: none found by either].
2. **GIFI codes**: RC4088 on canada.ca confirms 9200 Travel expenses, 9220 Utilities, 9225 Telephone and telecommunications, 9270 Other expenses, 9281 Vehicle expenses. GST/HST payable is **2680** (B right); A's 2630 is "Amounts payable to members of NPOs" and must not be used. Shareholder loans: due **from** 1300/1301 (current), 2180/2181 (long term); due **to** 2780/2781 (current), 3260/3261 (long term). B's "due to 2181" is wrong (2181 is due from); B's "1241" is demand loans receivable, not a shareholder code; B's "telephone 8812" is wrong (8812 is Office utilities).
3. **Diagnostics**: iFirm Error and Filing error block; Warning needs a named person's written reason; Information and Filing warning may be left with a reason; "Hidden" never counts as cleared. Which diagnostics show on the printed return, and whether the category prints, is unknown until the trial.

## 1. T2 review checklist (becomes the RV fixed order)

Sources: CRA T4012 ch. 4 (re-opened: $500,000 business limit, Schedule 23 sharing, passive-income grind via Schedule 7, SBD lines 400 to 428); financial-cents T2 template and bccpa.ca findings [B only, not re-opened]. Order is practice [inference]; both reports converge.
| # | Section | What the CPA checks | Agree |
|---|---|---|---|
| 1 | Brief and identity | BN, name, year end, short or long year, CCPC status, associated (yes/no), opening balances = last year's closing and Auto-fill | both |
| 2 | Statements and GIFI (100, 125, 141) | assets = liabilities + equity; revenue - expenses = net income; retained earnings roll (3660 + 3680 - 3700 = 3849); same line detail as statements, no subtotals | both |
| 3 | Schedule 1 | each add-back and deduction has a source: amortization back, CCA in, meals 50%, penalties, personal items, reserves, tax provision | both |
| 4 | Capital | Schedule 8 by class, additions and disposals tie to ledger, class 10.1 cap, Schedule 6 | both |
| 5 | Losses and reserves | Schedule 4 continuity = Auto-fill and last year; Schedule 13 | both (13: A only) |
| 6 | Rate | ABI vs investment income (Sch 7), business limit and Sch 23 sharing, taxable capital grind, PSB signs | both |
| 7 | Dividend accounts | GRIP (Sch 53), RDTOH eligible and non-eligible, Part IV, CDA rolled from last year | both |
| 8 | Shareholders and related | Sch 50, 9, 11; shareholder-loan continuity; T4 and T5 totals = 9060 and 3700 | both |
| 9 | Ontario | Schedule 500 / 5 allocation, Ontario credits | both |
| 10 | Disclosures | T1135, T1134, T106 questions; Sch 141 who prepared the statements | both (T1134, T106: A only) |
| 11 | Payment and filing | balance-due day, next-year instalments, signed T183CORP before e-file, diagnostics cleared, review marks complete | both |
Practice-review point [B only, bccpa.ca]: unsigned T183 before e-file and bare Y/N checklists are inspection findings, so each section's mark needs a note or a source link.

## 2. Owner-manager issues list (feeds AI-2 and CK-42)

| Issue | Data that signals it | Rule and source |
|---|---|---|
| Shareholder loan | debit balance in 1300/1301/2180/2181 at year end; credit-balance account turned debit; year-end journal clearing it; repaid then re-borrowed | 15(2) inclusion; 15(2.6) exception if repaid within one year after the end of the lender's tax year and not part of a series of loans and repayments; 80.4(2) benefit on low or nil interest even when 15(2) does not apply [fact, folio S3-F1-C1 ¶1.2, 1.71, 1.20] |
| Remuneration mix | T4 total vs 9060; T5 total vs 3700; dividends without resolution; dividends above retained earnings; no salary at all | [inference, both] |
| Personal expenses | owner-named card, groceries, round amounts, large 9270 or 8810, meals at 100% in 8523 | 15(1) benefit or loan [inference, both] |
| Vehicles | 9281 with no logbook; additions to 1742; class 10.1 cap; no standby or operating benefit on T4 | [inference, both] |
| Home office | rent or utilities paid to the owner or at the home address; no GIFI code exists for business-use-of-home [B, not found on RC4088; consistent with today's read] | [inference] |
| CDA | Schedule 6 gain, life insurance proceeds, capital dividend paid; balance vs Auto-fill | election before dividend [inference, both; CRA page not opened] |
| RDTOH and refunds | Schedule 7 investment income, Part IV on portfolio dividends, eligible vs non-eligible dividends paid | refund ordering [A only, from Mondaq snippet; open] |
| Association | owner or spouse holds another company; transactions on Sch 9 or 11; limit not shared | Sch 23 required if associated [fact, T4012 ch. 4] |
| PSB | one payer for most revenue, hourly billing, client's equipment, no staff, former employer | all five conditions: through a corporation; specified shareholder (10%); 5 or fewer full-time employees; payer not associated; would be an employee [fact, CRA factors-psb]. The 5% extra tax (s.123.5) and the 18(1)(p) expense limit are named there without rates; A's "5% [fact]" is not on that page [inference] |
| SIB | rent or interest income, 5 or fewer full-time employees | [inference, both; no page opened] |
| Instalments | prior and current tax; CRA debits coded to expense or the shareholder account instead of 2680 | none required if tax payable is $3,000 or less for **either** the current or the previous year [fact, CRA instalment-requirements]. Both reports misstated it (A: "prior-year over $3,000 triggers"; B: "either of the last two years"). Quarterly for eligible small CCPC: conditions not on that page [open] |

## 3. Trial balance to GIFI (RC4088, canada.ca, re-read today)

All names quoted from RC4088 on canada.ca; codes past 9281 were cut off in the fetch (marked).
| Code | RC4088 name | Common account names | Ambiguity |
|---|---|---|---|
| 1001 / 1002 | Cash / Deposits in Canadian banks and institutions - Canadian currency | chequing, savings, petty cash | either; overdraft is 2600 Bank overdraft, never negative cash |
| 1060 / 1062 | Accounts receivable / Trade accounts receivable | AR | one level, not both; 1061 allowance |
| 1120 | Inventories (1121 goods for sale) | inventory | B wrongly said unconfirmed |
| 1484 | Prepaid expenses | prepaids | |
| 1300 / 1301 | Due from shareholder(s)/director(s) / individual shareholder(s) | shareholder loan receivable | current; long term 2180/2181. Sign, not name, decides |
| 1600, 1680, 1681 | Land, Buildings, Accum. amortization of buildings | | |
| 1740 / 1741 | Machinery, equipment, furniture, and fixtures / accum. | equipment, furniture | computers may go 1774 Computer equipment/software instead |
| 1742 / 1743 | Motor vehicles / accum. | vehicles | |
| 2010 | Intangible assets (2178 total) | goodwill | |
| 2620 | Amounts payable and accrued liabilities | AP, accruals, payroll remittances | payroll could be argued elsewhere [inference] |
| 2680 | Taxes payable ("capital taxes, foreign taxes, GST/HST, current income taxes") | HST payable, income tax payable | net HST refund is an asset: code [open] |
| 2700 | Short-term debt | bank demand loan | |
| 2770 | Deferred income | unearned revenue | |
| 2780 / 2781 | Due to shareholder(s)/director(s) / individual shareholder(s) | shareholder loan payable | long term 3260/3261; a debit balance moves to 1300/1301, never netted |
| 2860 / 3300 | Due to related parties (current / long term) | intercompany | |
| 3140 / 3141 | Long-term debt / Mortgages | term loan, mortgage | |
| 3500 / 3520 | Common / Preferred shares | | |
| 3600, 3660, 3680, 3700, 3849 | Retained earnings/deficit; Start; Net income/loss; Dividends declared; End | | 3700 vs 9060 vs loan for owner draws, by substance |
| 8000 / 8020 | Trade sales of goods and services / to related parties | sales | |
| 8090, 8140, 8230 | Investment revenue, Rental revenue, Other revenue | interest, rent, other | |
| 8239 / 8871 | Management and administration fees (revenue / expense) | management fees | B listed 8239 without saying it is revenue: expense is 8871 |
| 8518 (8300, 8320, 8340, 8500) | Cost of sales (opening inventory, purchases, direct wages, closing inventory) | COGS | |
| 8520 / 8521 | Advertising and promotion / Advertising | advertising | either; A 8520, B 8521 both valid |
| 8523 | Meals and entertainment | meals | 50% add-back on Schedule 1 |
| 8590, 8620, 8690 | Bad debt expense, Employee benefits, Insurance | | |
| 8670 / 8570 | Amortization of tangible / intangible assets | amortization | |
| 8710 (8714, 8715) | Interest and bank charges (Interest on long-term debt, Bank charges) | interest, bank fees | parent or detail, not both |
| 8760 | Business taxes, licences, and memberships | licences, dues | |
| 8810 / 8811 / 8812 | Office expenses / stationery and supplies / Office utilities | office | 8812 is not telephone (B wrong) |
| 8860 (8861, 8862) | Professional fees (Legal, Accounting) | | |
| 8910 / 8911 | Rental / Real estate rental | rent | sample clients use 8911 for premises; both valid |
| 8960 | Repairs and maintenance | | |
| 9060 / 9063 | Salaries and wages / Bonuses | wages, owner salary | |
| 9110, 9131, 9150, 9180 | Sub-contracts, Small tools, Computer-related expenses, Property taxes | | |
| 9200 | Travel expenses | travel, hotels, airfare | settles A's guess |
| 9220 (9222, 9223, 9224) | Utilities (Water, Heat, Fuel costs) | hydro, gas | 8812 if office-only utilities |
| 9225 | Telephone and telecommunications | phone, cell, internet | |
| 9270 | Other expenses | sundry | catch-all; large balance is an issue signal |
| 9275 | Delivery, freight and express | courier | |
| 9281 | Vehicle expenses | fuel, auto repairs, parking | A's "9281 Other expenses" tool note was wrong |
| 9368, 9990, 9999 | Total expenses, Current income taxes, Net income after taxes | | 9999 confirmed; 9368 and 9990 not reached in the fetch [prior file only] |
Rules: GIFI is not a chart of accounts; a mixed account goes to the item covering the larger amount, consistently [B only, ledg.ca]. QBO has no per-account GIFI field; mapping lives in QBOA Workpapers, which flags accounts whose sign opposes their type [A, QB1 and QB2; matches 2026-10-01-qbo-reconciled.md]. Clearing and suspense accounts are cleared, never mapped [B, inference].

## 4. Diagnostics policy (RT-17 allowed list)

Facts re-opened: iFirm categories [CCH1]: Error "Enter or modify data to ensure the return will not be rejected"; Warning "Review the data entered and make corrections where necessary"; Information (optimization tips); Filing errors "modify the data entered in order for the return to be eligible for electronic transmission"; Filing warning "eligible for electronic transmission. However, verify". Status filter Reviewed / Not reviewed / Hidden (this return or all returns). Desktop Taxprep [TP1, TP2, TP3]: ten types; errors that can cause rejection sit under the T2 EFILE tab but "are not all" there, so general diagnostics must be checked too; Take Action holds what is not corrected or annotated Reviewed or Ignored. CRA reject codes [TP4]: 340-346 incorporation and postal data, 355-388 tax year (372 over 378 days, 387 already assessed), 501-513 file format, 534 attachments over 150 MB; accepted attachment types include pdf and xls (A listed them as rejects: wrong).
| Class | iFirm category (desktop equivalent) | Our rule | Confidence |
|---|---|---|---|
| Blocks | Error (Mandatory modification, Missing information), Filing error (T2 EFILE tab), Exclusion | sign-off blocked until gone; no override | high for Error/Filing error [fact]; Exclusion [inference] |
| Must explain | Warning (Error, Possible input error), desktop Filing and Review (overrides) | a named preparer writes a reason; CPA sees it in RV-2; overrides also go to the RT-16 list | medium [inference, both agree] |
| May leave with a reason | Information (Optimization, Tax planning), Filing warning | bulk reason allowed, logged with who and when | medium [inference, both agree] |
| Unknown until the trial | whether the printed return shows open diagnostics and their category; whether Hidden ones print; iFirm's mapping of the desktop types | trial day 1 task | [open] |
Hidden or Ignored is an annotation, not a fix: the system treats it as not cleared unless the rule above allows it.

## Clause changes proposed (amber, one row each)

- **RV-1**: replace "then every other schedule present" with the fixed order in part 1 (sections 4 to 11), any schedule not named placed after its nearest section.
- **RT-17**: name the allowed list as part 4's table, in iFirm categories, with "Hidden is not cleared" and the trial check.
- **AI-2**: add "shareholder-loan continuity and the 15(2.6) one-year date" and "a large 9270"; make the instalment test code (CK) not AI, per the $3,000 rule.
- **Sample clients**: grep shows no 2630 or 8812-as-telephone; nothing to fix. Confirm 9368 and 9990 from a full RC4088 copy before golden files use them.

## For the CPA's check (decision 0008, B8)

1. Shareholder loan: year end 31 Dec 2025; 1301 debit $20,000 on 31 Dec 2025, $5,000 of it lent in 2025. Repaid 15 Nov 2026 (within one year after 31 Dec 2025, no re-borrowing): no 15(2) inclusion; 80.4 benefit on the interest-free period still applies. Not repaid by 31 Dec 2026: the $5,000 lent in 2025 is the shareholder's 2025 income. Expected flag date: 31 Dec 2026.
2. Instalments: tax payable 2024 $2,800, 2025 $9,000: none required for 2025 (2024 is $3,000 or less). 2024 $4,000 and 2025 estimate $3,500: required.
3. Business limit grind: AAII $80,000 in prior year: reduction ($80,000 - $50,000) x 5 = $150,000; limit $350,000; at $150,000 AAII limit is nil [T4012 ch. 4 states the $50,000 to $150,000 band; the $5 factor is arithmetic from it].
4. Meals: 8523 $3,000: Schedule 1 add-back $1,500.
5. Mapping: shareholder account with credit $4,000 in March and debit $2,500 at year end maps to 1301, not 2781.

## Open points

- 9368, 9990 names; GST/HST net refund code; quarterly-instalment conditions for small CCPCs; CDA, SIB, RDTOH refund-order pages; whether iFirm diagnostics print on the return (trial).
- B's practice pages (financial-cents, bccpa, connectcpa, McCay Duff, ledg.ca) had no URLs in the report and were not re-opened; their points are marked [B only].
