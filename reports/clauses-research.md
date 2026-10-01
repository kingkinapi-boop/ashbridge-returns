# Clauses brought into line with the 1 Oct research

1 Oct 2026. Helper for the Lead, branch `claude/clauses-research`. Sources: `reference/research/2026-10-01-ties-reconciled.md`, `2026-10-01-recs-reconciled.md`, `2026-10-01-flags-reconciled.md`, `2026-10-01-f9-reconciled.md`. No clause renumbered; the plain end state is untouched; plan/AMBER.md not edited (rows below, A46 onward).

## Clauses

### 05-checks.md
- Preamble: a firm parameter is data, named as the firm's own on screen, changed only by amber.
- Changed: CK-10, CK-11, CK-12, CK-13 (now a reconciliation; moved to the Reconciliations section, ID kept), CK-14, CK-15, CK-19, CK-20, CK-21, CK-22, CK-23, CK-24, CK-26, CK-30, CK-31, CK-32, CK-34, CK-35, CK-36, CK-37, CK-38, CK-39, CK-41, CK-47, AI-2.
- Added: CK-48 (each reconciling item has a type code, amount, source and who accepted it; disallowed types refused), CK-49 (types are data with stable codes), CK-50 (rounding item at most $1). The reconciling-item table (R01 to R29, per check) sits under CK-4.
- Unchanged: CK-1 to CK-6, CK-18, CK-25, CK-40, CK-42 to CK-46, AI-1, AI-3 to AI-12, EX-1 to EX-4. CK-33 stays removed.
- Left for the Taxprep trial (written as "settled on the Taxprep trial"): the sign of GIFI 3700 (CK-11), the 2026 GIFI code sets for Schedule 1 lines 104 to 106 (CK-15).

### Other files
- 06-screens.md: RV-1 (fixed review order from the F9 research).
- 04-roundtrip.md: RT-17 (diagnostics by iFirm category; Hidden never cleared; print behaviour and final list settled on the Taxprep trial).
- 00-end-state.md: kinds table K9 (bonus paid on day 180 is in time, one on day 181 or later).
- reference/sources.md: about 20 sources added (GST/HST instructions and net tax, OHIP, T4, RC4120, T5, T4012 chapters, Schedules 1, 23, 50, Auto-fill, ITA sections, IT-109R2, T1135 Q&A, Folios, Taxprep transfer list, Schedule 8 REC, iFirm diagnostics); a "practice, not law" section; T1135 moved out of "Not yet checked"; open items added there.
- reference/cpa-check.md: created, 32 items for Zo as CPA, each with clause, rule, source, worked example and question.

## Amber rows (for plan/AMBER.md)

| # | Date | Card | Decision | Why | How to reverse | Status |
|---|---|---|---|---|---|---|
| A46 | 1 Oct | blueprint | CK-10: 2599 = 3499 + 3620 and 3640 = 2599, contra assets negative; no tolerance | Ties research (RC4088); CK-3 whole dollars | Restore the one-line CK-10 | open |
| A47 | 1 Oct | blueprint | CK-11 adds 3680 = 9999 and 3849 = 3600; restatements in 3720; sign of 3700 is field data settled on the Taxprep trial | Ties research (RC4088) | Restore CK-11 | open |
| A48 | 1 Oct | blueprint | CK-12: Auto-fill (with pull date) for losses, RDTOH, GRIP, CDA; last year's filed closing for UCC and donations, flagged if reassessed | Ties research: Auto-fill gives no UCC or donations | Restore "as assessed" | open |
| A49 | 1 Oct | blueprint | CK-13 becomes a reconciliation (line 840 against CRA's account) with item types R23 to R25; moved to the Reconciliations section, ID kept | Ties research: timing differences make a tie fail | Move back to Ties | open |
| A50 | 1 Oct | blueprint | CK-14: every 10%-or-more holder (at most ten) at the register's percentage; each column at most 100% | Ties research: holders under 10% are omitted, so 100% cannot hold | Restore CK-14 | open |
| A51 | 1 Oct | blueprint | CK-15: lines 104 to 106 by GIFI code sets as data (2026 sets settled on the trial); 403, 107, 404 to Schedule 8; 121 less 67.1(2) exceptions; 103 and 128 by tagged ledger accounts, else a flag | Ties research: 8670 alone is wrong; penalties have no GIFI code | Restore CK-15 | open |
| A52 | 1 Oct | blueprint | CK-19 per calendar year: same names, codes and percentages; line 410 prorated; lesser rule for a second year; missing agreement or sister return is a flag | Ties research (Schedule 23, ITA 125) | Restore CK-19 | open |
| A53 | 1 Oct | blueprint | CK-48, CK-49 and the reconciling-item table under CK-4: R01 to R22 from the recs research; R23 to R29 added by the Lead's helper for CK-13 and CK-44 (one list for every reconciliation) | CK-4 needed its fixed list; one list keeps code simple | Drop R23 to R29, or the table | open |
| A54 | 1 Oct | blueprint | CK-50 rounding item at most $1 per reconciliation (firm parameter); preamble: firm parameters are data and named on screen | Recs research leaves "the set tolerance" open; smallest reversible | Change the amount | open |
| A55 | 1 Oct | blueprint | CK-20: line 101 excludes previous-return amounts; quick method also excludes outside Canada, real property and capital assets | Recs research (GST/HST instructions) | Restore CK-20 | open |
| A56 | 1 Oct | blueprint | CK-21 lag = three-month submission window plus one monthly cycle | Recs research (ontario.ca) | Restore "payment lag" | open |
| A57 | 1 Oct | blueprint | CK-22 per account, remainder zero | Recs research | Restore CK-22 | open |
| A58 | 1 Oct | blueprint | CK-23: box 14 of every payroll account, by pay date; the payroll register stands in for an unfiled calendar year | Recs research (T4 pages) | Restore CK-23 | open |
| A59 | 1 Oct | blueprint | CK-24: boxes 10 and 24 only; capital dividends to the T2054 | Recs research (T5 guide) | Restore CK-24 | open |
| A60 | 1 Oct | blueprint | CK-26: GIFI 3700 only (3701, 3702 inside it); capital dividends from the T2054 | Recs research (RC4088) | Restore CK-26 | open |
| A61 | 1 Oct | blueprint | CK-30 shows a notice when the deadline is under 90 days away (firm parameter) | Flags research, noise control | Remove the notice | open |
| A62 | 1 Oct | blueprint | CK-31 pair rule: repayment then new advances of at least 50% within 180 days (firm parameters; CRA gives no period), or repaid from a new loan; dividend, salary or bonus credits are not a series | Flags research (Folio 1.84 to 1.86) | Restore CK-31 | open |
| A63 | 1 Oct | blueprint | CK-32: benefit formula; flagged over $250 (firm floor); not raised when CK-30 includes the loan | Flags research (80.4) | Drop the floor or restore CK-32 | open |
| A64 | 1 Oct | blueprint | CK-34 in 125(7) terms; property income at least 50% of gross revenue as the firm's proxy for "principal purpose"; a person decides full-time | Flags research | Restore CK-34 | open |
| A65 | 1 Oct | blueprint | CK-35 signs: 10% holder, one client at least 80% (firm parameter), five or fewer full-time, payer not associated; effects named; note required | Flags research (125(7), 123.5, 18(1)(p)) | Restore CK-35 | open |
| A66 | 1 Oct | blueprint | CK-36: taxable-capital cut from $10M to $50M; a missing associated-corporation figure is its own flag | Flags research (125(5.1); CRA Budget 2018 page is stale) | Restore CK-36 | open |
| A67 | 1 Oct | blueprint | CK-37 thresholds: T1135 over $100,000 cost at any time; T106 over $1,000,000; T1134 any foreign affiliate | Flags research (ITA 233.x, 95(1)) | Restore CK-37 | open |
| A68 | 1 Oct | blueprint | CK-38 by calendar year of payment; an accrued bonus needs a T4 only for the year paid | Flags research: "accrued bonuses need T4s" was wrong (RC4120) | Restore CK-38 | open |
| A69 | 1 Oct | blueprint | CK-39 adds a firm floor (greater of $2,000 and 5% of revenue) and skips lines flagged elsewhere | Flags research: highest-noise flag; no CRA threshold | Drop the floor | open |
| A70 | 1 Oct | blueprint | CK-41: eligible dividends against GRIP at year end; capital dividend election dated by the earlier of payable and paid, or above CDA | Flags research (89(1), 185.1, 83(2), 184(2)) | Restore CK-41 | open |
| A71 | 1 Oct | blueprint | CK-47: payment on day 180 is in time; vacation pay and salary deferral excluded; a promissory note is not payment; K9 follows (day 180 in time, day 181 late); supersedes A39's "pay by day 179" | Flags research (78(4), IT-109R2 paras 10, 15) | Restore "day 179" wording | open |
| A72 | 1 Oct | blueprint | AI-2 adds a large 9270 and loan signs code cannot see; lists what code already flags (CK-30, CK-35, CK-38, CK-41, CK-43, CK-46) as not repeated. F9 proposed adding loan continuity and the 15(2.6) date to AI-2; they stay code (code before AI) | F9 and flags research; tie-breaker code before AI | Add them back to AI-2 | open |
| A73 | 1 Oct | blueprint | RV-1 fixed review order: brief, statements and GIFI, Schedule 1, capital, losses, rate, dividend accounts, shareholders, Ontario, disclosures, payment and filing | F9 research (both reports converge; practice, no CRA order) | Restore "every other schedule present" | open |
| A74 | 1 Oct | blueprint | RT-17 by iFirm category: Error and Filing error block; Warning needs a named reason; Information and Filing warning may stay with a reason; Hidden never cleared; print behaviour and final list settled on the trial | F9 research (iFirm help) | Restore "settled on the trial" only | open |

## Judged red
- Nothing red. No end-state, design, money, live-data or client-wording change. RV-1 changes order detail only; the end state's "fixed order" stands, and no design is approved yet.

## For the Lead
- Cards citing changed clauses need re-reading: plan/cards/F05.md, plan/cards/families/check.md, plan/cards/families/aicheck.md.
- reference/sample-clients/03-bluewater-renovations/answer-key.json says "the rule needs payment by day 179 (26 Dec 2025)". The result stands (paid on day 181, still flagged), but the wording now clashes with CK-47: fix to "by day 180 (27 Dec 2025)" and re-run its checks.
- Not applied (no proposal): CK-18 (override as exception, Taxprep rounding rule), CK-42 noise control (group by vendor), CK-45 open point (now CPA item 16).
- Open, not guessed: Schedule 3 line numbers, Telefile and line 101, OHIP RA codes, Folio S3-F2-C1 and prescribed-rate URLs, the iFirm diagnostics page URL, GIFI 9368 and 9990 names (all in sources.md "Not yet checked" or marked to record).
