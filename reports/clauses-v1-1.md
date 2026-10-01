# Clauses brought into line with the plain end state v1.1

1 Oct 2026. Helper for the Lead, branch `claude/clauses-v1-1`. Sources: blueprint/README.md v1.1, decisions 0008 and 0009, reference/research/2026-10-01-qbo-reconciled.md (the Lead's note on the GIFI .GFI file and QBO API), reference/research/2026-09-29-t2-practice-and-tools.md. No clause renumbered. The "Clauses still to bring into line" list is deleted from README.md; the plain end state section is untouched.

## Per file

### 00-end-state.md
- Changed END-2 (sources: QBO line and "a reason a person wrote", as end state item 3)
- Changed END-9 (built on the ten sample clients)
- Not numbered: the preparer's day (tax choices in Taxprep, cite, no receipt export); the kinds table gains "Starts from sample client"; K4 (books in QBO); K9 (day 179, CK-47)

### 02-lifecycle.md
- Changed FLOW-4 (one lock export, review lines inside it)
- Changed FLOW-7 (due date by FLOW-12)
- Added FLOW-12 (CRA's last-day due-date rule; tax rule)
- Not numbered: state table rows prepare, trace, approved, ready_to_file (no receipt export, no gate 1, check export before transmit)

### 03-evidence.md
- Changed EV-5 (QBO line; "a reason a person wrote" replaces adjusting entry and judgment input)
- Changed EV-10 (QBO books are client prepared)
- Changed TB-1, TB-2, TB-3, TB-4, TB-5, TB-6, TB-7
- Unchanged TB-8, TB-9 (checked; still true)
- Added TB-10 (dated, fingerprinted QBO snapshots; the pointer)
- Added TB-11 (books changed in QBO after approval are detected by re-reading and comparing)
- Added TB-12 (never map to a GIFI total code; tax rule)
- Not numbered: records table rows Account, Adjusting entry, Judgment input; section heading

### 04-roundtrip.md
- Changed RT-1, RT-2, RT-10, RT-11, RT-14, RT-16, RT-17, RT-18, RT-19, RT-20, RT-23
- Removed RT-6 (receipt check)
- Added RT-24 (the roll-forward map)
- Unchanged RT-3, RT-4, RT-5, RT-7, RT-8, RT-9, RT-12, RT-13, RT-15, RT-21, RT-22
- Not numbered: exports table is now two rows (lock export, check export)

### 05-checks.md
- Changed AI-2 (next year's instalments moved to code)
- Removed CK-33 (replaced by CK-47)
- Added CK-43 (shareholder-loan continuity, tie)
- Added CK-44 (CCA additions, reconciliation)
- Added CK-45 (income tax provision, reconciliation)
- Added CK-46 (next year's instalments in code)
- Added CK-47 (remuneration unpaid on day 180; pay by day 179)

### 06-screens.md
- Changed RV-5 (explicit "Reviewed, next"; the mark comes off when a number changes)
- Changed RV-6, RV-7, RV-9, RV-21, RV-22 (the cite button), RV-30
- Added RV-10 (Approve only when every section is marked)
- Added RV-11 (approval record)
- Added RV-12 (AI drafts fixes for simple comments; the preparer approves)

### 07-learning.md
- Changed LL-1 (lock and check exports)

### 09-architecture.md
- Changed ARC-6 (AI row: Claude Code project on the subscription; new QBO row)
- Changed ARC-8 (starts from the ten sample clients)
- Added ARC-22 (how the AI project runs jobs)

### 10-go-live.md
- Changed LIVE-1 (wording only: lock and check exports; token first settled on the trial). LIVE items stay red at go-live; this is text alignment.

### 11-not-building.md
- Added OUT-7 (no bookkeeping module), OUT-8 (no statements or CSRS 4200), OUT-9 (no slip preparation), OUT-10 (no time-saved measuring, no shadow-pilot planning), OUT-11 (Ontario only)
- Not numbered: future idea "live connections to accounting software" now "other than QBO"

### README.md (outside the plain end state)
- Deleted the "Clauses still to bring into line with v1.1" list
- Files table rows 03 and 04; Words: adjusting entry, judgment input, exports, orphan, test world

### reference/sources.md
- Added T4012 due date, instalment requirements, instalment dates, ITA 78(4), T2 Schedule 8 (all opened 1 Oct 2026); RC4088 line extended (9990, 2680, total codes)
- Removed from "Not yet checked": 78(4) and the last-day due-date rule (now checked)

## Amber rows (for plan/AMBER.md; not added there)

| # | Date | Card | Decision | Why | How to reverse | Status |
|---|---|---|---|---|---|---|
| A28 | 1 Oct | blueprint | The books come from QBO: TB-1, TB-2, TB-4, TB-5, TB-7 rewritten, TB-10 and TB-11 added (QBO API snapshots; books changed after approval detected by re-read and compare), EV-5, EV-10 and END-2 name a QBO line as a source | End state v1.1 items 2 and 3; decision 0008 Z8-3, F11; QBO research 1 Oct (CDC looks back 30 days only, so re-read and compare) | Restore the working trial balance clauses from git | open |
| A29 | 1 Oct | blueprint | GIFI mapping: QBO makes it; Returns reads the .GFI the preparer uploads and keeps it as its own mapping record (TB-3); a mapping to a CRA total code is refused (TB-12) | QBO research 1 Oct: the mapping lives only in QBOA Workpapers with no API; the Lead's note | Make the mapping our own table with AI proposals, the .GFI as cross-check only | open |
| A30 | 1 Oct | blueprint | One lock export (review lines inside it, RT-10) plus one check export just before transmit (RT-19); baseline and receipt exports dropped, RT-6 removed, gate 1 dropped; RT-1, RT-2, RT-11, RT-17, RT-18, RT-20, RT-23, FLOW-4, the state table, RV-21, RV-30, LL-1, LIVE-1 follow; a "dropped" cell class catches a partial import | End state v1.1 items 4 and 7; decision 0008 F4 ("more only if the trial shows a need"); token, allowed diagnostics and gate details marked "settled on the Taxprep trial" | Bring back exports 0 and 1 and gate 1 if the trial shows a need | open |
| A31 | 1 Oct | blueprint | Rolled-forward and orphan cells are told apart against last year's return facts through a roll-forward map in the mapping table (RT-14, RT-24); with no prior-year facts nothing counts as rolled forward | Export 0 is gone; TB-8 already gives last year's facts | Bring back the baseline export | open |
| A32 | 1 Oct | blueprint | Tax choices are typed in Taxprep and sourced with the cite button (TB-6, RT-16, RV-22); a judgment input is now that typed value with its source or reason; loss and donation claims added to the list | End state item 4; decision 0008 F3, Z8-10 | Bring back the judgment input sheet in our app | open |
| A33 | 1 Oct | blueprint | Review marks: explicit "Reviewed, next" that comes off when a number in the section changes (RV-5); Approve rule and approval record split into RV-10 and RV-11; RV-6, RV-9 follow | End state item 6; decision 0008 Z8-13; one sentence per clause | Return to marks on leaving a section | open |
| A34 | 1 Oct | blueprint | AI drafts fixes for simple comments, meaning a presentation comment or an error comment on one number; nothing changes until the preparer approves and it goes through the round trip (RV-7, RV-12) | End state item 6; decision 0008 Z8-11; "simple" needed a testable meaning | Widen or narrow the comment types in RV-12 | open |
| A35 | 1 Oct | blueprint | The AI adapter is a Claude Code project on the firm's subscription, not a paid API (ARC-6, ARC-22); QBO gets an adapter row (stand-in: the sample-client files and sandbox companies); supersedes the live side of A6 | End state items 5 and 10; decision 0008 Z8-11 | Switch the adapter's live side | open |
| A36 | 1 Oct | blueprint | CK-43 shareholder-loan continuity tie | Decision 0008 F8; sample client 01; supports CK-30 | Remove CK-43 | open |
| A37 | 1 Oct | blueprint | CK-44 CCA additions reconciliation (Schedule 8 against QBO capital asset debits) | Decision 0008 F8; sample clients 02, 03, 08, 10 | Remove CK-44 | open |
| A38 | 1 Oct | blueprint | CK-45 income tax provision reconciliation (9990 and 2680) | T2 research 29 Sep, gap A1: without it CK-11 fails or passes only by construction | Remove CK-45 | open |
| A39 | 1 Oct | blueprint | CK-33 removed; CK-47 flags remuneration unpaid on day 180 (pay by day 179, ITA 78(4)); K9 says the same | CK-33 said "within 180 days", one day off (T2 research 29 Sep) | Restore CK-33's wording | open |
| A40 | 1 Oct | blueprint | CK-46 next year's instalments worked out in code ($3,000 test, quarterly or monthly); dropped from the AI checklist (AI-2) | Code before AI (RULE-17); T2 research gap A5 | Move it back to AI-2 | open |
| A41 | 1 Oct | blueprint | FLOW-12 CRA's last-day due-date rule; FLOW-7 points to it (placed in FLOW, not CK, because it is a date rule the queues show, not a check) | FLOW-7 said "six months after year end" (T2 research 29 Sep) | Fold back into FLOW-7 | open |
| A42 | 1 Oct | blueprint | The test world starts from the ten sample clients and never invents a second set (END-9, ARC-8); the kinds table names the sample client each kind starts from (K1, K5, K6, K13 need new ones) | Decision 0008 Z8-8; end state item 11; supersedes A8's wording | Drop the column | open |
| A43 | 1 Oct | blueprint | "Not in this build" as clauses OUT-7 to OUT-11 (bookkeeping, statements and CSRS 4200, slips, time saved and shadow pilot, Ontario only); future idea narrowed to accounting software other than QBO | End state's "Not in this build"; decision 0008 Z8-4, Z8-15 | Remove the clauses | open |

## Tax clauses for the CPA's check (decision 0008, B8)
- CK-43 shareholder-loan continuity (Folio S3-F1-C1)
- CK-44 CCA additions, and its reconciling item types (T2 Schedule 8)
- CK-45 income tax provision: 9990 against total tax payable, 2680 against that tax less instalments (RC4088). Open point: whether the dividend refund and Part IV tax belong in the comparison
- CK-46 instalment tests (CRA instalment requirements and instalment dates)
- CK-47 remuneration unpaid on day 180, pay by day 179 (ITA 78(4)); the CPA should confirm the day-180 reading
- FLOW-12 filing due date, last-day rule (T4012)
- TB-12 never map to a GIFI total code (RC4088; QBO research 1 Oct)

## Left undone or judged red
- Nothing judged red. The QBO research's open point 3 (opening a made-up company in the firm's QBOA Workpapers to get a .GFI) touches the firm's account and stays red for Zo; TB-3 does not depend on it in the build because the stand-in is the sample-client files.
- Not done (Lead work): plan/AMBER.md rows above; cards citing changed clauses (F01, F02, F03, SK0, journey.md, schedule.md cite TB, RT, RV-5/7/22, FLOW-7, ARC-6/8 or END-9) need re-reading when slices.json is re-cut; MATRIX.md regeneration.
- Kept as is, worth a look: CK-15 Schedule 1 add-back and CK-10, CK-11 may duplicate Taxprep diagnostics (T2 research); LIVE-3 and LIVE-7 still speak of an AI vendor and a live model.
