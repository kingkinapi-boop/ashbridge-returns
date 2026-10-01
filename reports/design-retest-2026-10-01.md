# Design re-test after the fix round, 1 Oct 2026

Usability panel, re-test only. Branches walked: `claude/design-queues-record-2` (version A), `claude/design-workbench-2` (version B), `claude/design-cpa-review-2` (V1), `claude/design-source-viewer-2` (A, B, C). Fix lists: `reports/findings-designs.md` section (a). Headless Chromium (Playwright 1.63) over http on local ports, at 1366 x 650 and 1093 x 525, keyboard first, typing key by key in fields. Made-up data only. A page load is a full document navigation (counted with the browser `load` event, so hash and client routes count 0). The prototypes were not changed.

Read this first: all 32 fixes in the four lists (8 queues, 7 workbench, 8 CPA review, 9 source viewer) are in place and work as described. The faults that remain are few and mostly small. The two that matter most: the Queues ops form and bulk bar show an error before anyone has done anything (Q1), and the Workbench puts the source and the Cite button below the fold on both sizes (W1).

## 1. Queues and record (version A)

| Task | Budget | Measured (1366 / 1093) | Result |
|---|---|---|---|
| Preparer: pick the next return (My work) | 1 click, 1 load, under 1 s | 1 click, 1 load, 158 ms / 140 ms; lands on Workbench; first row whole in view at 1366 (top 428, bottom 541), not at 1093 (453 to 566) | Pass; whole row at 1093 still not met (known) |
| Find a return | at most 3 actions; results page when more than one | "eglinton": type, Enter = 2 actions, 1 load, 2 matches listed, open = 3rd action; "halton" (one match) opens the record, 2 document loads through `search.html`; "zzz" no match page; "bakery" 28 matches, fillers reachable | Pass; see Q4 |
| See what changed since I left | first thing under the identity bar | "Since you last opened this return (4 Jun 2026, 16:40)" is the first heading (top 253) on Halton | Pass |
| CPA: next return to review | 1 click | 1 click, 1 load, lands on Review; `n` goes to the next return in the list; Back to the list keeps filter and rows | Pass |
| CPA: check rework | 1 click | "Rework" view tab, 33 rows, chips 10+8+15 = 33 | Pass; see Q5 |
| Ops: next step on a return | row to Ops tab, form 3 actions | 1 click to the Ops tab (Scarborough, Riverdale, Queen West all per RV-30, no "gate 1"); file, submit: 0 loads; check export then confirmation number then Filed, all in place; typed "CRA-123456" key by key, Enter works | Pass, with Q1 |
| Ops: bulk assign | Space or click, one action, 0 reloads, scroll kept | 51 of 63 rows have a box, 12 flagged rows have none; sticky bar; Assign 0 loads; scroll 600 to 591; result announced; focus on the next row | Pass, with Q1, Q2 |
| Ops: chase waiting on client | dated flag, days waiting, last contact | `queue-ops-waiting`: waiting since, days waiting, last contact, longest first; nudge button 1 click, 0 loads, banner takes focus (scroll 404) | Pass |
| Owner: pipeline by state and due week | counts in lifecycle order, filtered list in view | strip in lifecycle order with oldest age, week chips; clicking Rework: 0 loads, 447 ms, list scrolls to the 33 rows | Pass, with Q6 |
| Understand one return at a glance | at most 10 facts | 8 facts plus state and tier; tabs 7 | Pass |
| Open a source from Documents | 1 click, under 1 s | 1 click, 158 ms / 185 ms, 0 history entries, focus on the viewer heading, `Esc` returns to the figure; second window opens and follows a pick and a tab change | Pass, with Q7 |
| Record tab change | 1 click, 0 loads | 7 tab changes, 0 loads, own hash URL | Pass |

Fixes confirmed in place: 1 (Ops tab per RV-30), 2 (Back, n, p, o and Enter follow the list; Back kept filter "eglinton" and 5 rows), 3 (search results), 4 for the lists that were checked (ops chips 20+27+16 = 63 = rows; CPA chips 8+15+28 = 51; "days in this state" and "days waiting" columns), 5, 6 (board strip, week chips), 7 (sticky bar, flagged rows without a box, focus to the next row), 8 (real buttons, nudge focus, viewer beside the list with Send to second window).

Findings, new unless marked remaining:

- **Q1 (new, ops list and Ops tab; breaks "errors in place", fix 7).** The bulk bar shows a red "Choose a preparer to assign the selected returns to" as soon as one box is ticked, before Assign is pressed. The Ops tab form shows "Error: Choose the file to upload" on first load (Queen West and Scarborough at y 790, above the file input at 830). Cause: the error element has the `hidden` attribute but the GOV.UK error-message class sets `display:block`, so `hidden` loses. Should: no error until the button is pressed. A rule test "no visible error text on load or before submit" would catch it on every page.
- **Q2 (new, bulk bar).** Assign with nothing chosen moves the page from scroll 600 to 161 (the error summary is at the top), so the list jumps away from the rows being worked. The bar is 134 px high, 26% of the screen at 1093 x 525. Should: error beside the bar, scroll kept (rule 4, "no action returns the page to its top").
- **Q3 (new, search).** The header says "Find a return by name, number or year end", but "2025-12" finds nothing. Should: match year end in the formats on the page (for example "10 Dec 2025") or change the label.
- **Q4 (new, minor).** A single-match search opens through `search.html` (2 document loads). Fine for a prototype; the build should open the record in one load.
- **Q5 (new, names and counts).** "Rework" is 5 returns on the preparer lists and 33 on the CPA list and the board, with no word saying which set (mine, all, with the CPA). One measure, one name (rule 7). The 5 is probably "mine"; it is not labelled.
- **Q6 (new, board).** After clicking a state the visible caption still reads "All 300 returns, Filing due, earliest first"; "Showing 33 of 300" is only in the hidden live region; the strip scrolls out of view so the active filter is not visible. Should: visible count and the active filter next to the list.
- **Q7 (new, Documents).** Opening a source scrolls the page by 662 px (667 at 1093): the identity bar and tabs leave the screen and the viewer heading is cut off (top at -117). The viewer is beside the list but the page moved. Should: viewer pane pinned in view without moving the page.
- **Q8 (remaining, known).** At 1093 x 525 no row of any list is whole above the fold (My work 566, Ready to review 541, Next ops step 641 against 525). Rows are about 137 px tall at 1366 (name, year end and BN wrap), so about 3 rows per screen. Cutting the filter line or the view tabs is Zo's call.
- **Q9 (new, minor).** After browser Back from a record the focus is on the page body, not the row you came from (rule 19).

## 2. Workbench (version B, split pane)

Only Maple Ridge opens a full record; the other nine names in the queue open a stub with the Workbench tab ("shell-other"). That limits what a clerk can click through but is stated in the design notes.

| Task | Budget | Measured (1366 / 1093) | Result |
|---|---|---|---|
| P1 open the next return | 1 load, 1 click | 1 load, 1 click, 539 ms; keys `n` move the pane | Pass |
| Change step in a return | 0 loads, 1 click | 10 step changes, 0 loads, own `#/` URL | Pass |
| P3 accept one change from last year | 0 loads, 1 click, 1 field | row, then Accept = 2 clicks (1 key plus 1 click if the row is already selected), 1 field, 0 loads; empty reason shows the error summary with focus; focus moves to the next row; badge 4 to 3 | Pass on loads and field, 1 click over |
| Open any source from a figure | 0 loads, 1 click, no history | 0 loads, 1 click, 0 history entries, focus into the pane | Pass, with W1 |
| P5 start the import-file download from the queue | 1 load, 2 clicks | queue, name, Download: 2 clicks, 1 load, `01_2025-12-31_v1.csv` downloads; button at y 334 | Pass |
| P6 source one orphan | 0 loads, 2 clicks, 1 to 2 fields | source radio plus Cite = 2 clicks for a row already selected; from a cold row 3; Trace 6 to 5; focus to the next orphan; "cite with nothing chosen" shows the error pattern | Pass, with W1, W2 |
| P7 give a Warning its reason | 0 loads, 2 clicks, 1 field | row, type, Save = 2 clicks, 1 field, 0 loads; badge 6 to 5; "Saved under your name" shown | Pass |
| P9 approve a drafted fix | 0 loads, 2 clicks | row, Approve = 2 clicks, 0 loads, "Draft approved. It goes through the round trip." | Pass |
| Find any return, account or fact | 1 results page | `/` focuses search; "meals" gives 1 account and 1 fact, 1 load; "Halton" 1 return; "zzz" empty page | Pass, with W3 |
| Fold (first row whole, action in view) | both sizes | first row whole: queue 5 / 2 rows, books 4 / 1, trace 4 / 1, Evidence first row ends at 527 at 1093 (2 px under); Cite button at y 916 / 966 | See W1 |

Fixes confirmed: 1 (no Judgment step; tax choices in Trace beside the orphans, 4 of 6; Round trip is RV-21's six steps with one "Upload both files"; Books flags only with no confirm; classes include dropped; Diagnostics by category with a named reason), 2 (row pick leaves scroll at 0; pane beside the list at both sizes; no blank open row), 3, 4 ("Resolve at the number" opened S3.DIV.PAID[1].AMT for the dividend comment and S4.LOAN.INT for the loan comment), 5 (results across returns, accounts, facts), 6 (no SIN digits, "SIN on file"; second window opens, follows a row, a step, and survives a reload of the work page), 7 (one record shell, flagged rows keep no bulk box).

Findings:

- **W1 (remaining from B-3 and RC2, now a trade-off).** The row pick no longer scrolls the page, but the source excerpt and the action sit below the fold in the pane: Trace excerpt top 1013 / 1088, Cite button bottom 916 / 966; Books excerpt 767 / 917; Comments 850 / 833; Gaps Keep 738 / 763 (viewport 650 / 525). The pane is not sticky and does not scroll by itself, so to check a source and cite it the preparer scrolls the whole page (the list leaves with it) or opens the second window. "The source beside it" holds in x but not in y. Breaks P6 and "open any source: visible, 1 click" (rule 20). Should: pane pinned and scrolling inside, evidence above the form, button always in view.
- **W2 (new).** Typing a reason in the Trace pane without ticking the "A written reason" radio gives "Choose a source or write a reason" although a reason is typed (the hint says "Only needed if you chose a written reason above"). Should: typing in the box selects the radio. P6 by reason costs 3 clicks against 2.
- **W3 (new, minor).** Search does not reach trace cells or values: "S8.RENT" and "5040" find nothing. Brief says "any return, account or fact", so it passes the letter; a preparer looking for a cell will try it.
- **W4 (known).** Nine of ten queue names open the stub, so "open the next return" is only testable on Maple Ridge.

## 3. CPA review (V1)

| Task | Budget | Measured (1366 / 1093) | Result |
|---|---|---|---|
| 1 open a return from the queue | 1 load, 1 click, under 2 s | 1 load, 1 click, 828 ms / 812 ms (includes the CDN styles) | Pass |
| 2 read the brief | 1366: six numbers, tier and first flags on the first screen; 1093: six numbers and tier, flags just below | 1366: six numbers end 297, tier line in view, first flag row whole (screenshot); 1093: numbers end 333, tier in view, flags start below the fold | Pass |
| 3 step through the flags | 0 loads, decision 2 clicks, 1 field | Start review, choose "Accept the risk", Record decision = 2 clicks, 0 loads, 454 ms / 530 ms; focus to the next flag; list shows "Accepted by CPA" apart from "Left for you"; `f` next flag, `j` next number | Pass |
| 4 walk the return by section | 0 loads, 1 click or key | 6 rail clicks 0 loads; `r` Reviewed, next 1 key 0 loads; on a section already reviewed `r` leaves the count at 3 of 11 (never unmarks) | Pass |
| 5 check one number | 0 loads, 1 click, boxed figure in view, 0 history | 248 ms / 264 ms, figure boxed and in view, focus on the source, history +0; second window follows number, `j`, a section change and a tab change | Pass |
| 6 comment on a number | 0 loads, `c`, 3 fields, one submit | `c`, type, severity, text typed key by key, submit: 0 loads; Comments 3 to 4; the trace lists the text; empty submit shows an error summary and a message per field | Pass, with C2 |
| 7 approve | 1 load, 1 click | green-ready: 11 of 11, "Approve return" is a link to the approval page, 1 load; the red return shows "Approve: 8 sections left" as a link, never a disabled button; approval record lists who, when, time per section, sources opened (34), total 22 min 22 s | Pass |
| 8 re-review after rework | only changed cells; marks that came off with a reason | "Changes 2 changed numbers" tab; Statements and GIFI "Mark came off" with the reason; 5 of 11 marked; queue shows "Back from rework (1)" | Pass |
| Queue: search, tier, state, order | filters with counts, stated order | search "eglinton" 2 rows, tier Red 3 rows, caption states "overdue first, then tier, then due date", Back to the queue keeps tier and search | Pass |

All eight fixes in the V1 list are in place. Findings:

- **C1 (new, minor).** The `a` key does nothing visible on a return with sections left (focus stays on the body; the Approve link in the bar is not focused). With every section marked it focuses "Approve return" as it should. Should: focus the "Approve: N sections left" link and say why.
- **C2 (new, at 1093).** The comment panel opens inside the 270 px trace pane: only the first of four type options shows, severity, text and the Send button need scrolling inside a pane about 290 px high. It works, but it is the slowest step at that size. Should: more height for the panel (it can cover the trace while open) or a wider pane.
- **C3 (limit).** Next return and Previous return follow the queue but are hidden when the neighbour has no page (only Maple Ridge and Queen West open), so that part could not be walked.

## 4. Source viewer (D03, versions A, B, C)

| Check | Budget | A / B / C at 1366 x 650 and 1093 x 525 | Result |
|---|---|---|---|
| Open a source | 0 loads, 1 click, under 1 s, no history | 181 ms, 0 loads, history +0 (A); B cite 361 ms; same viewer in all three | Pass |
| Opening zoom readable and box whole | smallest text 12 px, box whole or left edge in view | Lakeview page 149%, T5 164%, smallest text 13 px, box whole, at both sizes; other kinds 16 to 19 px | Pass |
| Page area | at least 60% of height | pane stage 69% / 62%, window stage 544 of 650; no page scroll (650 and 525), no sideways scroll | Pass |
| Rows beside the pane | at least 3 | 8 / 6 / 5 at 1366; 3 / 3 / 3 at 1093 | Pass, at the floor |
| Mark with keys (A) | 3 sources, 3 keys, 0 clicks; second press never unmarks | 3 `m` presses checked the figure and moved to the next; a 4th `m` moved on, never unmarked | Pass |
| Decision slot, next | 1 Tab from the box; next unhandled row; "All items checked" | B cite 1 click 0 loads, announced "Next to cite"; B reason typed key by key with `j k o ]` inside the box fired nothing; C Complete moved focus to the next unhandled row; last decision (Chase on Aurora) focused "All items checked. Every item has a decision." | Pass, with D2, D3 |
| Window link both ways | reload shows "open, following" within 2 s | 253 to 271 ms on the work page reload; window follows a row pick, a step, and a tab change (B) | Pass |
| Sign-out from the window | signs out the work page | 63 to 73 ms in all three | Pass |
| Selection in the URL | reload and Back keep item and source; no new history | `?item=f1&src=2` kept on reload, history +0; B tab change 0 loads, own URL, Back works | Pass |
| Pane hides while the window follows | pane returns when it does not | pane hidden, "The list uses the full width" in all three | Pass |
| Failed image, masked slip, 320 px | retry; "SIN on file"; no sideways scroll | f8 "Try again"; f5 "SIN on file and date of birth on file" in the box; 320 px scrollWidth 320 on all three | Pass |

All nine fixes are in place. Findings:

- **D1 (remaining, shell).** The three versions carry their own tab sets ("CPA review"; "Cite figures" and "Verify values"; "Check items") instead of the one record tabs of the Queues and CPA review shells. R13 says a family fills a tab and never adds its own set. Fine for a viewer prototype, but D01 must absorb it.
- **D2 (new, B).** After Cite or Record the reason, focus stays in the viewer box (or on the recorded text); the next figure is only announced ("Next to cite: Home office"). Rule 19 wants focus on the next row. A takes the next row and C moves focus to the next row, so B is the odd one.
- **D3 (new, C, minor).** A completed row keeps live "Complete" and "Chase" buttons (clicking Complete again does nothing visible); there is no state or way back. Should: show "Complete" as a state with an undo that asks for a reason.
- **D4 (new, B, minor).** "Record the reason" and its text box sit inside a closed "Write a reason instead" fold and lie 239 px below the fold when opened at both sizes; reason path costs fold, type, record = 3 actions.

## 5. Prototype note (all families)

The GOV.UK font paths (`/assets/fonts/...`) return 404 when the prototypes are served from the repository root; the pages fall back to Arial. No page is broken by it. The CPA review pages need the network for GOV.UK and MOJ styles from the CDN.

## 6. What Zo should see at his sitting

1. **Queues (version A).** Open `queue-ops.html`, tick a row and look at the red error under the bar before anything is pressed (Q1); then open Documents on a return and notice the page moving (Q7). The designer should fix Q1 and Q7 before the sitting; Zo only needs to answer the sitting question (list shape and bulk assign).
2. **Workbench (version B).** Open the Trace step and try to cite a source on a laptop: the evidence and the Cite button are below the screen (W1). This is the one design decision he should feel: keep the pane pinned beside the list, or keep the page scrolling.
3. **CPA review (V1).** Open Maple Ridge: the six numbers, the tier and the first red flag are all on the first screen at 1366. Accept a flag, press `c` to comment, press `j` through a section. The comment panel is cramped at 1093 (C2).
4. **Source viewer.** The three versions now behave the same where it matters (window link, sign-out, zoom, URL). Pick on feel: A (keys and a "Supports, next" slot), B (cite or write a reason), C (Complete and Chase for ops). The panel suggests no tie-break from these numbers.
5. **Questions in `reports/findings-designs.md` (d)** are unchanged; this re-test adds none for him. Q5 (the word "Rework" meaning two sets) is a naming call the Lead can settle as amber.

Findings count: 7 new or remaining in Queues (Q1 to Q7) plus 2 minor (Q8, Q9) = 9; Workbench 4 (W1 to W4); CPA review 3 (C1 to C3); Source viewer 4 (D1 to D4). Total 20.
