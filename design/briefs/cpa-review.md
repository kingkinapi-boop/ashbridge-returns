# Design brief: the CPA review and its source viewer

Family: CPA review (RV-1 to RV-9) with the source viewer it opens (RV-4, EV-5, EV-11). Date 1 Oct 2026. Made-up data only. Research base: `reference/research/2026-09-29-staff-ux-patterns.md` (section 5A, 5E, 4) and `2026-09-29-internal-forensics.md`; the product names below are from that research (vendor pages, so claims not tests). No new web reading this pass.

## Who and how often
- **The CPA (Zo)**: reviews every return in full, several a day in season, on a laptop plus a second monitor. Not a first-visit user: speed and keys beat guidance.
- **The preparer**: sees the CPA's comments, fixes, sends back (RV-7, RV-25). Small part of this family.
- Zo's taste: Excel and Salesforce feel (record page, tabs, related lists, grids), a logical top-to-bottom order, separate tabs for separate things. /internal failed by putting everything on one page with no order.

## Task scripts (CPA)
| # | Task | Per | Sees together | Decides | Next |
|---|---|---|---|---|---|
| 1 | Pick the next return | day | queue by tier then due date, state, what blocks | which to open | open the return |
| 2 | Read the brief | return | six numbers vs last year, tier and why, pinned flags (red first, dollar effect, preparer's answer), changes, assumptions, attestations | go, or send back at once | start section 1 |
| 3 | Walk the return, section by section | return | the section, each line with last year and change, dots, flag highlights | mark "Reviewed", or comment | next section |
| 4 | Check one number | 20 to 60 a return | the cell, its trace (built from, sources and status, agrees with, last year, notes), the source page with the figure boxed | trust, query, or comment | next number or flag |
| 5 | Step through flags | return | each flag, red first then dollar effect (EX-4), the answer and its source | accept the risk, or send back | next flag |
| 6 | Comment | 0 to 10 a return | the number, a type (error, question, missing evidence, presentation), a severity | what goes to the preparer | back to the walk |
| 7 | Approve | return | sections left as links until all are marked (RV-5), then Approve | approve | the next return in the queue |
| 8 | Re-review after rework | rework | only changed cells, before and after (RV-7); sections whose mark came off | re-mark | approve |

## Budgets (the tester counts these)
| Task | Page loads | Clicks or keys | Fields | Time |
|---|---|---|---|---|
| Open a return from the queue | 1 | 1 | 0 | under 2 s |
| Open any number's source (all three panes) | 0 | 1 (click, or a key with the number focused) | 0 | under 1 s to the boxed figure; the next and previous source under 0.3 s |
| Next flag, next number, next section | 0 | 1 key | 0 | under 0.2 s |
| Mark a section Reviewed | 0 | 1 key | 0 | under 0.2 s |
| Comment on a number | 0 | 2 (key, then submit) | 2 (type, severity; text optional for presentation) | under 10 s |
| Approve, with every section marked | 1 | 1 | 0 | under 2 s |
| Read the brief | 0 | 0 | 0 | whole brief fits one laptop screen without scrolling (6 numbers, flags list scrolls inside) |
| Whole return, 60 numbers opened | 1 return load | under 150 | 0 | the CPA's target: a full review in minutes, not hours |

## Pattern options
**A. Brief tab, then a three-pane review with a section rail (recommended).** One return record page with sub navigation tabs, in order: Brief, Balance sheet, Income statement, Schedule 1, other schedules, Flags, Comments, History. The section tabs open the three-pane review (return left, trace middle, source right); the source pane can be popped to the second monitor and stays synced (follow mode).
- Copy: TaxCycle with DoxCycle (F6 jump, a Link button so document and form follow each other, first and second review marks, counts on every filter, who and when on each mark, a History log) and Taxprep Review Mode (double-click a cell to open its source); GitHub "Viewed" (progress bar, mark resets if the file changes, which is RV-5); a coverage list with markers like GitHub's file tree; Salesforce record page tabs and related lists; Linear peek (Space opens, arrows step); Rossum Enter-to-next-unresolved; Superhuman style preload of the next sources, viewer kept mounted.
- Avoid: sign-offs that survive a changed number (CCH Axcess Engagement); thousands of messages (TaxCycle ships 5000+); a modal over the return; a full page load per source; one flat alert list (AHRQ alert fatigue); box state shown by colour alone.
- GOV.UK and MOJ parts: page frame, tokens, tags, summary list (the brief), inset text, warning text, error summary pattern for refused answers; MOJ sub navigation (section tabs), timeline (History and comments), badge (flag counts), identity bar kept as a quiet strip naming corporation and year end (RV-50; DWP retired a similar bar for banner blindness). Composed by us (RV-52): the three panes, the keys, the coverage rail, the source viewer. Write the reason in the design notes.

**B. One long page per return, sections stacked with a sticky progress rail.** Closest to a printed return and to GitHub's changed-files page. Copy: Viewed collapse, sticky header with progress. Avoid: it is the "everything on one page" /internal failure; a 40-page return makes "next flag" a scroll and makes the second monitor awkward. Fits only for small returns.

**C. Source-first, a document index with extracted fields (DoxCycle, 1040SCAN, Fieldguide).** The CPA walks documents, not the return. Copy: page stack with a strip per document and tick, field list with a tick each. Avoid as the main flow: RV-1 wants the return in fixed order, and the CPA reviews numbers. Keep as the source pane's "Documents" list inside option A, and as a tab "Evidence" for the preparer.

## Details the designs must show (both sides of each)
- A number: value, last year, change, dot (green, grey, amber, purple, with a text label; EV-11), a separate red flag if an exception is open (EV-12). Highlighting follows the tier (RV-8) and never hides the full return.
- Source pane: caption "Bank statement, Mar 2026, page 3 (source 2 of 4)", the figure boxed with an outline plus a text label, next and previous source, spreadsheets as sheet, row, column (EV-14), non-document sources (client answer, CRA capture, entry, judgment input) as a small card, not a blank pane.
- Reviewed state: a mark per section with who and when; comes off, with the reason shown, when a number in it changes. "Sections left" as links (no disabled button). Open question for Zo: RV-5 says "moves past" a section; the research says every comparable tool uses an explicit mark, so the designs show an explicit key (red question for the Lead to ask; not decided here).
- Empty, loading, failed-source and no-evidence states ("not checked: no evidence", CK-2) shown, never a blank.
- Key legend on screen (NNG: accelerators shown, never required): next flag, next number, open source, comment, next section, mark reviewed, approve (RV-6); never override browser keys.

## For the designer
Two or three versions of the brief tab and one section review, on sample client data from `reference/sample-clients/`; include one red tier return and one green; a two-monitor layout drawing. The usability panel counts against the budgets above.
