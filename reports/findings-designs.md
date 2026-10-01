# Findings review: three design families after the usability panels

1 Oct 2026, decision 0009 (Z9-6). Opus findings reviewer; committed by the Lead (the harness blocked the helper's report write). Sources: the three panel reports on `claude/panel-<family>`, the briefs on `claude/brief-<family>`, the designer reports on `claude/design-<family>`, blueprint v1.1, staff-screens rules, internal forensics.

Labels: Q queues-record, W workbench, C cpa-review, then the panel's fault number. Version picks kept: Q version A (borrow B's n/p and open key, C's state strip); W version B, split pane (Worklists tab optional, not drawn); C V1, record tabs.

## Root causes (9)

- **RC1 Briefs written from pre-v1.1 clauses** (briefs 13:00, clauses aligned 13:08 and 13:16). Explains W X-1 and the W panel's four "end state questions" (Judgment tab, export 1/2 round trip, AI-proposed GIFI confirm, cite owner), W B-2, W budgets P3/P5/P6, Q F-X2 (gate 1), C's Flags order, the old RV-5 wording. All settled by TB-3, TB-12, RV-21, RV-22, TB-6, RT-16, RT-14, RT-17, RV-5: not questions for Zo. Also bites D03, D05, D08, D12, D09 (RV-30 without gate 1), D10 (RV-40 lessons and LL-9 measures), spec-writer.md (names RT-6). Re-walk W P3, P5, P7 after the rewrite.
- **RC2 No shared source viewer.** Three second-window mechanisms and three in-page panes (W C-1 new window per click; W A-1/2/4 source docked far below; W B-3 stacks under 1100 px; C F3 fixed 342 px panes, box not scrolled into view; C F4 V3 no in-page source; C F5 second window stale on section change; C F12 flag shows the number's source not its evidence; Q T11; W X-4 "SIN ending 456" against SEC-4). Fix: design D03 next as the one viewer every family embeds (R5). Risks: popup blockers (open on a gesture), close on sign-out, a Follow control, SEC-4 masking on page images.
- **RC3 Budgets with no pinned screen size or meaning of "page load".** Designers measured 1440 x 900; panels 1366 x 650 and 1093 wide (125% zoom). C F1, C F2, Q F-X6, Q F-A3, Q F-C5, W heights 1,130 to 2,177 px, C uses `zoom: 0.85`. Impossible budgets: C brief on one screen, C comment in 2 fields, W P5 in 2 clicks with a separate Round trip tab. Fix: R2, R3, reworded budgets.
- **RC4 Static prototypes break the after-action rule** (Q F-A1, F-A2, F-X9; W A-3, A-2; C F6): every action posts to a new page, repeating /internal's cause 2. Fix: R4 with one shared prototype script.
- **RC5 Nothing checks for dead controls, filler or disagreeing counts** (Q F-X1, F-X2, filler rows; W A-5, C-6, A-7, C-4, X-3, X-5, A-6; Q F-A6). Breaks RV-50 and rule 16. Fix: R6.
- **RC6 Search drawn as a box with no results page** (Q F-X5, W X-6, C F9, Q F-C3). Fix: R8 and one shared results page in D01.
- **RC7 Default order and column wording not set per list** (rule 6 vs RV-8; Q F-C1, F-A5, F-X4, F-X10, F-X8, F-B2, F-X3, F-B5, F-X7). Fix: R9, R10.
- **RC8 Shortcuts as toggles and irreversible single keys** (C F7 `r` toggles, `a` approves with no confirm, Q F-B1 no open key, C no skip link). Fix: R11.
- **RC9 Three record shells, no shared basis (D00) or map (D01).** Tab sets differ; `design/basis/` does not exist; CDN versions, fonts and `zoom` differ; Q F-A4 aria-pressed links, Q F-B6 contrast, C F12 16.5 px chips, about 75 axe contrast "incomplete"; 320 px reflow fails everywhere; the family template and designer.md disagree on paths; no designer self-check. Fix: R7, R13, R14.

## (a) Fixes for the designers now

**Queues-record (A)**
1. Ops tab per RV-30 and RT-19: CRA capture checklist; T183CORP sent and signed with certificate upload; check export upload; confirmation number in place; notice of assessment. No gate 1. Real next-ops-step values.
2. Back and n/p follow the list you came from (filter, sort, scroll). Enter or `o` opens the row. CPA lands on Review, preparer on Workbench.
3. A results page when more than one return matches; filler returns reachable.
4. "Days in this state", "Days waiting on client"; one date format per column; chip and view counts agree.
5. "Since you last opened" first, under the identity bar.
6. Board: filtered list in view, due week (RV-40), C's state strip on top.
7. Sticky bulk bar, errors in place, focus to the next row, result announced; Filed hidden by default on the ops list.
8. Real buttons, not aria-pressed links; labelled scroll regions at 320 px; focus to the nudge banner; sources through the shared viewer.

**Workbench (B)**
1. Rebuild to v1.1: no Judgment tab; "Tax choices" read from the lock export, each with the cite button, beside the orphans (RV-22, TB-6, RT-16). Round trip shows RV-21's six steps with one upload (lock export plus printed return). Books shows QBO's mapping from the uploaded .GFI, flags only (unmapped, mapped twice, changed from last year, total code: TB-3, TB-12); no AI codes, no confirm. Trace uses RT-14 classes including dropped. Diagnostics by iFirm category (RT-17) with a named reason per Warning.
2. Fix B-1 (`:target` clash blanks the open row) and B-3 (no page scroll on row pick; pane beside the list at 1093 px).
3. Round trip opens on the current step; Download works; Overview strip offers "Download the import file" (P5 in 2 clicks).
4. Comments: "Resolve at the number" goes to the cell; the preparer's view to approve an AI-drafted fix (RV-12); counts agree.
5. Search results across returns, accounts, facts; saved views and filters work or are removed.
6. SIN shows no digits ("SIN on file", SEC-4); focus into the opened pane; 320 px reflow; sources through the shared viewer with "Send to second window".
7. Inside the one record shell (RC9). Worklists only if Zo asks; never bulk-act on a flagged row.

**CPA review (V1)**
1. Sections per RV-1 with Flags first: about ten sections in a vertical rail; a printed-pages section (RV-9); Flags shows "accepted by CPA" apart from "answered by preparer".
2. Brief: RV-2's six tax numbers (made-up values, labelled), to the revised budget at 1366 x 650.
3. Section changes client-side (0 loads); `j` runs across sections; `r` is "Reviewed, next" and never unmarks (unmark is a separate control with a reason); `a` moves focus to Approve, never approves.
4. Comment in an in-place panel (type, severity, text; 0 loads); the trace pane lists the number's comments (RV-4).
5. Source pane full height, box scrolled into view; the second window follows tab changes; a flag shows its own cited evidence.
6. Queue: search, tier and state filters, a "Back from rework" view, the order Zo picks (question 4).
7. Approval record shows time per section and sources opened (RV-11).
8. Flag chips at least 24 px with the GOV.UK focus style; 320 px reflow; no `zoom`; resolve axe contrast "incomplete".

**For the Lead:** D06 to removed in slices.json; fix the RT-6 example in spec-writer.md; settle the template paths ((c) 10).

## (b) Rule tests (each first shown failing on a planted bad page)

- **R1 (template):** a brief names the blueprint commit it was written from; a lint fails any brief or prototype naming a removed clause or retired term (export 1, export 2, review-lines export, receipt export, gate 1, judgment input sheet, AI-proposed GIFI); a brief older than the last commit touching its clauses is re-checked before design starts.
- **R2 (rules):** budgets and the fold are measured at 1366 x 650 and 1093 x 525; panes never stack at either size.
- **R3 (rules):** a page load is a full document navigation; a tab or section change is a client-side route with its own URL (0 loads); opening a source adds no history entry.
- **R4 (rules):** every action runs in place (no separate page for a form of 3 fields or fewer), keeps scroll, moves focus to the result or next row, announces it; bulk bars are sticky.
- **R5 (rules):** every source opens through the one D03 viewer: beside the work, never below a table; full height, box scrolled into view, focus moved in; plus a second window opened by script (`window.open(url, name)`, no `noopener`) that follows every selection and tab change.
- **R6 (template):** a prototype lint finds no self-link, no `#` link that changes nothing, no control drawn as plain text, no filler in a data column, no two counts that disagree.
- **R7 (template, designer.md):** before pushing, the designer runs axe (contrast "incomplete" fails until checked), a keyboard Tab walk, 320 px reflow and the budget counter, and reports the numbers.
- **R8 (rules):** header search shows a results page when more than one thing matches; every list over 5 rows has search or a filter.
- **R9 (rules 6, 7):** each list's brief states its default order; one measure, one name everywhere; one date format per column.
- **R10 (rules):** Back returns to the list you came from with filter, sort and scroll; next and previous follow that list.
- **R11 (rule 10):** a single key never unmarks, approves, sends or deletes; such keys only move focus to the control.
- **R12 (rules):** a bulk action never includes a row flagged for a person.
- **R13 (template, D01):** one return record shell (identity bar plus record tabs) for every family; a family fills a tab, never adds its own tab set.
- **R14 (template, D00):** families build on `design/basis/`: listed `app-` parts only, no `zoom`, no third-party fonts; a new part goes into the basis with its reason.

## (c) Clause drift (all amber, none red)

1. RV-1: amend to "the brief, then the flags (in EX-4 order), then ..." (end state item 6: flags first).
2. RV-5 unchanged (already explicit "Reviewed, next"); drop the C brief's red question.
3. RV-2 stands; add a card so the sample clients carry RV-2's six lines (RT-10 review lines need them too); designs use labelled made-up values meanwhile.
4. Rule 6 reworded: each queue states its default order from its clause (preparer by due date, RV-20; CPA by tier, RV-8); overdue first is Zo's call (question 4).
5. RV-4, RV-9, RV-11, RV-12 not drawn yet: design gaps covered in (a).
6. RV-30: no gate 1 (A30). D10 must add the weekly lesson list and measures (RV-40).
7. TB-3, TB-6, RV-21, RV-22 settled (A29, A30, A32): not questions for Zo.
8. SEC-4: show no SIN digits ("SIN on file").
9. Budgets: C brief (six numbers, tier, first flags on the first screen at 1366 x 650); C comment (3 fields, 0 loads); W P5 (2 clicks via the next-step strip).
10. Template paths: prototypes in `design/prototypes/<family>/`; the approved version copied to `design/screens/<screen>/`.

## (d) Questions for Zo at the sitting

1. Queues and the record: version A with bulk assign on the list. Recommended yes.
2. Workbench: B (steps left, source beside the row) or A (plain tabs). Recommended B with fixes, no Worklists tab unless wanted.
3. CPA review: V1, the second window opened on demand and remembered per person. Recommended.
4. CPA queue order: overdue first, then tier, then due date, plus a "Back from rework" view. Recommended.
5. The brief on one screen: six numbers, tier and first flags on top, the rest just below. Alternative: a denser three-column brief.
6. One record for every role: same record tabs for everyone; preparer lands on Workbench, CPA on Review. Recommended.

## Re-test after the fix round

The panel re-walks only the changed tasks (W P3, P5, P7 and the cite; C tasks 2, 3, 6; Q T6b, T7, T11) at both R2 sizes, runs R2 to R14 on every page, and confirms axe "incomplete" is zero. Then D03 (the source viewer) is designed and panelled before D07, D08, D09, D10 and D12.
