# Design brief: the CPA review and its source viewer

Family: CPA review (RV-1 to RV-12) with the source viewer it opens (RV-4, EV-5, EV-11). Date 1 Oct 2026, revised after the findings review. Made-up data only.

**Written from blueprint commit `b9c5003`** (blueprint/06-screens.md as of "Design findings review applied: rules 18 to 23, template checks, RV-1 flags first, D06 parked"). A brief older than the last commit touching its clauses is re-checked before design starts (design card check 6).

Research base: `reference/research/2026-09-29-staff-ux-patterns.md` (sections 5A, 5E, 4) and `2026-09-29-internal-forensics.md`; product names are from that research (vendor pages, so claims not tests). Findings: `reports/findings-designs.md` section (a) "CPA review (V1)" and (c) items 1 to 5 and 9.

## Decision kept
One structure survives the usability panel and the findings review: **the return record page with record tabs, a vertical rail of sections, the source beside the work, and a second window opened on demand and remembered per person** (version 1). Versions 2 (list and detail) and 3 (two monitors) stay in their folders for the record and are not designed further.

## Who and how often
- **The CPA (Zo)**: reviews every return in full, several a day in season, on a laptop plus a second monitor. Not a first-visit user: speed and keys beat guidance.
- **The preparer**: sees the CPA's comments, fixes, sends back (RV-7, RV-25). A small part of this family.
- Zo's taste: Excel and Salesforce feel (record page, tabs, related lists, grids), a logical top-to-bottom order, separate tabs for separate things. /internal failed by putting everything on one page with no order.

## The order of the screen (RV-1, end state item 6)
Brief, then the flags (EX-4 order: red first, then dollar effect), then the full return in this fixed order, each section with its own explicit "Reviewed" mark (RV-5): 1 statements and GIFI (balance sheet, income statement, retained earnings; Schedules 100, 125, 141), 2 Schedule 1, 3 capital (Schedules 8 and 6), 4 losses and reserves (Schedules 4 and 13), 5 rate (Schedules 7 and 23, small business deduction, personal services business signs), 6 dividend accounts (GRIP, RDTOH, Part IV, capital dividend account; Schedule 3 sits here), 7 shareholders and related parties (Schedules 50, 9, 11, slips), 8 Ontario (Schedule 500 or 5), 9 disclosures (T1135, T1134, T106), 10 payment and filing. A schedule not drawn as a structured view shows the printed return's pages and still needs a mark (RV-9). The marks are on Flags and the ten sections: 11 in all.

## Task scripts (CPA)
| # | Task | Per | Sees together | Decides | Next |
|---|---|---|---|---|---|
| 1 | Pick the next return | day | the queue with search, tier and state filters and a "Back from rework" view; order set by Zo (question 4: overdue first, then tier, then due date is the recommendation); state, what blocks | which to open | open the return |
| 2 | Read the brief | return | RV-2: the return in six numbers against last year (net income, taxable income, federal tax, Ontario tax, instalments, balance or refund); the tier and why; pinned flags, red first, each with its dollar effect and the preparer's answer; what changed since last year; assumptions and client decisions; attestations (zero orphans, diagnostics cleared, preparer signed) | go, or send back at once | the flags |
| 3 | Step through the flags | return | each flag, red first then dollar effect (EX-4), what the preparer did ("answered" or "left for you") apart from what the CPA did ("accepted by CPA", "sent back"), and the evidence the preparer cited (not the number's own source) | accept the risk, or send back | next flag, then "Reviewed, next" |
| 4 | Walk the return, section by section | return | the section in the vertical rail, each line with last year and change, dots, flag chips; printed pages for sections not drawn as structured views | "Reviewed, next", or comment | next section |
| 5 | Check one number | 20 to 60 a return | RV-4: three panes. The return (left); the trace (middle: how it is built, each source and its status, what agrees with it, last year, notes, this number's comments); the source (right: the document at the right page with the figure boxed, next and previous source, kept at full height). Optionally the same source in a second window that follows every pick and every tab change | trust, query, or comment | next number or flag |
| 6 | Comment | 0 to 10 a return | RV-7: type (error, question, missing evidence, presentation), severity and text, in a panel in place; the trace lists the number's comments; for a presentation comment or an error on one number AI drafts the fix with citations and the preparer approves it (RV-12) | what goes to the preparer | back to the walk |
| 7 | Approve | return | RV-10: sections left as links until all 11 marks are on, then Approve (never a disabled button); RV-11: the approval record keeps each mark, the time on each section and every source opened | approve | the next return in the queue |
| 8 | Re-review after rework | rework | RV-7: only the changed cells, before and after; the sections whose marks came off, with the reason | re-mark | approve |

## Budgets (the tester counts these)
Measured at **1366 x 650 and 1093 x 525** (125% zoom); the panes never stack at either size. A **page load is a full document navigation**. A tab or section change is a client-side route with its own URL: **0 loads**. Opening a source adds no history entry (staff-screens rule 18).

| Task | Page loads | Actions | Fields | Time |
|---|---|---|---|---|
| Open a return from the queue | 1 | 1 click | 0 | under 2 s |
| Open any number's source (all three panes) | 0 | 1 click or Enter on the number | 0 | under 1 s to the boxed figure in view; next and previous source under 0.3 s |
| Change section or tab | 0 | 1 click or 1 key | 0 | under 0.2 s, own URL |
| Next flag, next number (across sections), next section | 0 | 1 key | 0 | under 0.2 s |
| "Reviewed, next" | 0 | 1 key | 0 | under 0.2 s |
| Comment on a number | 0 | 2 (key c to open, one submit) | 3 (type, severity, text; text optional for presentation) | under 10 s |
| Record a flag decision | 0 | 2 (choose, record) | 1 | under 5 s |
| Approve, with every section marked | 1 | 1 | 0 | under 2 s |
| Read the brief | 0 | 0 | 0 | at 1366 x 650 the six numbers, the tier and the first flags are on the first screen and the rest is just below; at 1093 x 525 the six numbers and the tier are on the first screen and the flags start just below |
| Whole return, about 60 numbers opened | 1 return load | under 150 | 0 | a full review in minutes, not hours |

## Pattern, as built
**Return record page with record tabs and a vertical section rail.** The shell is the one every role uses (rule 23): the identity bar (corporation, year end, tier, state, Reviewed count, Back to the queue with previous and next return following the list), then the record tabs Review, Comments, Changes (after rework) and History. Under Review: a vertical rail (Brief, Flags, the ten sections, each with a Reviewed mark in words and a shape, a progress count, "Find a number"); one bar above the work (section name, mark state, "Reviewed, next", Approve when it shows); then return, trace and source side by side.
- Copy: TaxCycle with DoxCycle (jump key, document and form following each other, counts on every filter, who and when on each mark, a History log) and Taxprep Review Mode; GitHub "Viewed" (progress, the mark resets if the file changes, which is RV-5); Salesforce record page tabs and related lists; Linear peek; Superhuman preload of the next sources.
- Avoid: sign-offs that survive a changed number; thousands of messages; a modal over the return; a full page load per source; one flat alert list; box state shown by colour alone; a single key that unmarks or approves (rule 22).
- GOV.UK and MOJ parts: page frame, tokens, tags, summary list, inset text, warning text, error summary pattern, radios, textarea, buttons; MOJ sub navigation (record tabs), identity bar, timeline, sortable table (queue), badge. Composed by us (RV-52): the rail, the three panes, the keys, the source viewer. The reason for each goes in the design notes.

## Details the designs must show (both sides of each)
- A number: value, last year, change, dot (green, grey, amber, purple, with a text label; EV-11), a separate red flag chip if an exception is open (EV-12), at least 24 px with the GOV.UK focus style. Highlighting follows the tier (RV-8) and never hides the full return. Values the sample clients do not carry yet (RV-2's tax lines) are labelled made up.
- Source pane: caption "Bank statement, Mar 2025, page 3 (source 2 of 4)", the figure boxed with an outline plus a text label and scrolled into view, next and previous source, spreadsheets as sheet, row, column (EV-14), non-document sources (client answer, CRA capture, entry, result) as a small card, not a blank pane. A flag shows the evidence it cites. No SIN digits anywhere: "SIN on file" (SEC-4).
- Reviewed state: a mark per section with who and when; it comes off, with the reason shown, when a number in it changes (RV-5). "Reviewed, next" marks and moves on and never unmarks; taking a mark off is a separate control that asks for a reason. Sections left as links; Approve absent, not disabled, until all are marked (RV-10).
- Empty, loading, failed-source, no-evidence ("not checked: no evidence", CK-2), error and approved states shown, never a blank.
- Key legend opened in place from the bar: next flag, next number, next and previous source, open the second window, comment, next section, "Reviewed, next", move to Approve (RV-6). A single key never unmarks, approves, sends or deletes; the key a only moves focus to Approve. Never override browser keys; single keys can be turned off.

## For the designer
One version, the record tabs, on sample client data from `reference/sample-clients/`: one red tier return (first review, and back from rework with a mark that came off) and one green (first review, and every section marked). The usability panel re-walks tasks 2, 3 and 6 at both sizes.
