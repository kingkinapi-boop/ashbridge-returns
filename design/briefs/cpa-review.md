# Design brief: the CPA review and its source viewer

Family: CPA review (RV-1 to RV-12) with the source viewer it opens (RV-4, EV-5, EV-11), the CPA queue (V15) and the brief (V02). Date 3 Oct 2026, round 3 (D02, one version, for the sitting about Tue 6 Oct). Made-up data only.

**Re-checked 3 Oct 2026 against blueprint commit `dfdec2fa`** (blueprint v1.2; the RV clauses are unchanged since `b9c5003`). A brief older than the last commit touching its clauses is re-checked before design starts (design card check 6). Clauses added to this round: RV-7, RV-10, RV-11, RV-12, EX-1, FLOW-5, FLOW-7, TB-11. Decisions: Z20-3 to Z20-6 (decision 0020); ambers A387, A421, A433, A485 (keys come from D01's one list). Research base: `reference/research/2026-09-29-staff-ux-patterns.md` and `reports/findings-designs.md` (a), (c).

## Decision kept
**The return record page with record tabs, a vertical rail of sections, the source beside the work, and a second window on demand that is remembered per person** (Zo chose it, Z20-3). The CPA queue is ordered overdue first, then tier, then due date, with a "Back from rework" view (Z20-4). The brief fits one screen with a short part just below (Z20-5). The record shell is redrawn by the shell designer (D13): this round uses version 1's shell and leaves the fit to the panel.

## Who and how often
- **The CPA (Zo)**: reviews every return in full, several a day in season, on a laptop plus a second monitor. Speed and keys beat guidance. **The assigned preparer** sees the same record tabs read-only (no mark, judge, approve or comment control; the CPA's drafts stay hidden until the return is sent back, V04). Zo's taste: Excel and Salesforce feel, a logical top-to-bottom order, separate tabs for separate things.

## The order of the screen (RV-1)
Brief, then the flags (EX-4: red first, then dollar effect by default; a sortable list on the brief and in the Flags section, and next and previous flag follow it as sorted), then the ten sections in this fixed order, each with its own "Reviewed" mark (RV-5): statements and GIFI, Schedule 1, capital (Schedules 8 and 6), losses and reserves (4 and 13), rate (7, 23, small business deduction, personal services business signs), dividend accounts (Schedule 3 sits here), shareholders and related parties (50, 9, 11, slips), Ontario, disclosures (T1135, T1134, T106), payment and filing. A form the file does not place goes to a section "Forms not yet placed" after the last section and needs a mark ('form not placed: <form>'). A section with nothing in this return says so and still needs a mark. A schedule not drawn as a structured view shows the printed return's pages (RV-9). Marks: Flags plus the sections (11 normally, 12 with an unplaced form).

## Task scripts (CPA)
| # | Task | Sees together | Decides | Next |
|---|---|---|---|---|
| 1 | Pick the next return (V15) | All and Back from rework views, search, tier filter; per row corporation and year end, tier in words with why, filing due, balance due, waiting since, round, preparer who signed; overdue in words | which | open it |
| 2 | Read the brief (RV-2) | six numbers against last year with their states (not confirmed in Taxprep yet, no prior year with the reason); tier and why; pinned flags (dollar effect, tax effect, the preparer's answer; accepted risks tagged "for you to judge"); just below: the ten largest changes since last year, assumptions, three attestations (red with what remains) | go, or send back | the flags |
| 3 | Judge the flags (EX-1) | each flag red first, what the preparer did (fixed, explained, accepted risk) apart from what the CPA did, and the evidence it cites | for an accepted risk: accept with a reason, or comment instead | next flag, then "Reviewed, next" |
| 4 | Walk the return | the section in the rail with last year, change, dots, flag chips; empty and printed sections | "Reviewed, next", or comment | next section |
| 5 | Check one number (RV-4) | three panes: return, trace, source with the figure boxed; optional second window that follows | trust, query, comment | next number |
| 6 | Comment (RV-7) | type (error, question, missing evidence, presentation), severity (must fix, should fix, note), text, in a panel in place | what goes to the preparer | the walk |
| 7 | Approve (RV-10, RV-11) | what remains as links: sections not marked, forms not placed, accepted risks not judged; then Approve; the approval record keeps marks, judgments, time per section, every source opened | approve | next return |
| 8 | Re-review after rework (RV-7) | the fix-round digest, only the changed cells before and after, the marks that came off and why, comments with the preparer's answer, AI fix drafts (read-only "AI draft", citations, approved by the preparer only, RV-12) | resolve each comment, re-mark | approve |
| 9 | Use a second window | one checkbox beside "Open in a second window", state in words, remembered per signed-in person, default off, opens only when asked, closes on sign out | on or off | the walk |
| 10 | Read a voided approval (FLOW-5, TB-11) | why it is void (books changed after approval), what changed before and after, the marks that came off | none | wait for the preparer |

## Budgets (the tester counts these)
Measured at **1366 x 650 and 1093 x 525** (125% zoom); panes never stack at either size. A **page load is a full document navigation**; a tab, view or section change is a client-side route with its own URL (0 loads); opening a source adds no history entry (rule 18).

| Task | Loads | Actions | Fields | Time |
|---|---|---|---|---|
| Open a return from the queue (the next one) | 1 | 1 click | 0 | under 2 s; the first row whole on the first screen |
| Switch All and Back from rework | 0 | 1 click | 0 | under 0.2 s, own URL, filters kept |
| Open any number's source | 0 | 1 click or Enter | 0 | under 1 s to the boxed figure in view; next and previous source under 0.3 s |
| Change section or tab; next flag, previous flag, next number | 0 | 1 click or 1 key | 0 | under 0.2 s |
| "Reviewed, next" | 0 | 1 key | 0 | under 0.2 s |
| Comment on a number | 0 | 2 (key c, submit) | 3 (type, severity, text) | under 10 s |
| Judge an accepted risk: accept | 0 | 2 (the field, Accept) | 1 (reason) | under 10 s |
| Judge by commenting instead | 0 | 2 | 3 | under 15 s |
| Approve, with everything done | 1 | 1 | 0 | under 2 s |
| Read the brief | 0 | 0 | 0 | six numbers and tier on the first screen at both sizes; the first flags on it at 1366 x 650; the ten largest changes and the attestations below it, measured at 1.7 and 2.5 pane heights down at 1366 x 650 and 2.7 and 3.8 at 1093 x 525 (not within one scroll; the Changes link and the end of the page are 0 loads) |
| Resolve a comment after rework | 0 | 1 click | 0 | under 2 s |
| Why voided, and what changed | 0 | 1 click | 0 | under 2 s |
| Turn the second window on once | 0 | 1 click | 0 | remembered |

## Pattern
**Return record page with record tabs (Review, Comments, Changes after rework, History) and a vertical rail** under the shell every role uses (rule 23): identity bar (corporation, year end, tier, state, Reviewed count, Back to the queue with previous and next return following the list), then the work. Copy: TaxCycle and DoxCycle (jump key, counts, who and when on each mark), GitHub "Viewed" (mark resets on change, RV-5), Salesforce record page. Avoid: sign-offs that survive a changed number; a modal over the return; a page load per source; a single key that unmarks or approves; colour alone. GOV.UK and MOJ parts: frame, tags, summary list, inset and warning text, error pattern, radios, checkboxes, textarea, select, buttons, panel, notification banner; MOJ sub navigation, identity bar, timeline, sortable table, badge, alert (approval void). Composed (RV-52): rail, three panes, keys, source viewer, queue filter row. Experimental MOJ parts (Confirm an action, Contextual date) are not used and are listed at the sitting.

## Details the designs must show
- A number: value, last year, change, dot with words (EV-11), a separate red flag chip for an open exception (EV-12), 24 px targets. Tax lines the sample clients lack are labelled made up. No SIN digits: "SIN on file". Source pane: caption, figure boxed with an outline plus words, scrolled into view; spreadsheets as sheet, row, column; non-document sources as a card.
- Reviewed state: mark per section with who and when; it comes off, with the reason, when a number in it changes. "Reviewed, next" marks and moves on and never unmarks; taking a mark off asks for a reason. Judgment is separate from the mark: Approve is absent, not disabled, until every mark is on and every accepted risk is judged; what remains is listed as links.
- Every state, never a blank: normal, flagged, many (5 accepted risks), empty, error, loading, failed source, no evidence (CK-2), approved, void, rework, read-only.
- Keys from D01's one list: n next flag, p previous flag, m next number, o open the number's source (second window when on), r reviewed and next, a focus Approve (never approves), c comment, s search, ] and [ source steps. Listed in place with an off switch; nothing fires in a text field; no key unmarks, approves, sends or resolves. "Mark and step" gets no key.

## For the designer
One version (v3, drawn from version 1) on `reference/sample-clients/`: Maple Ridge (red), Queen West (green), Bluewater (red, filing date passed), Scarborough Robotics Labs (red, many). The panel re-walks tasks 2, 3 and 7 at both sizes.
