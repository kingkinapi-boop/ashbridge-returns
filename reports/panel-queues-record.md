# Usability panel: queues and the return record (family queues-record)

Branch `claude/panel-queues-record` (from `claude/design-queues-record`). Pinned prototype date Monday 8 Jun 2026. Brief: `design/briefs/queues-record.md`. Versions: A tabs (`a-tabs`), B split (`b-split`), C pipeline first (`c-pipeline`).

How it was walked: Playwright (Chromium) driving the static pages from file://, one real click or key per action, 1366x768 laptop width, each role in turn (preparer Aisha, CPA Dana, ops, owner). Loads are main-frame navigations; actions are clicks plus key presses, a typed field counts once. axe 4.x with wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa on 22 to 25 pages per version; keyboard-only Tab walk on the four main lists of each version; 320 px reflow check. Scripts are in the session scratch folder, not in the repo.

Limits of this walk (so Zo does not over-read it):
- file:// timings (80 to 400 ms per page) show no network or server cost. Treat them as a floor.
- Only the ten sample clients have record pages. In A and C the 290 filler rows are plain text (not links), so on My work the first (most urgent) row cannot be opened; I counted the first row that can. B opens a summary pane for filler rows with a note.
- The header search knows only the ten sample clients; filler returns (for example "Weston Plumbing 173", first on Aisha's list) return "No return matches". That is a prototype limit, not a design fault, so it is not scored.
- No second monitor was available. The two-window behaviour of C was tested with two pages in one browser context.

## 1. Tasks by version (loads, actions, fields, faults)

"Actions" = clicks plus key presses (Space, Enter, /). A load is a full page load. Budget column is from the brief.

| Task (role) | Budget | A tabs | B split | C pipeline |
|---|---|---|---|---|
| T1 Next return, then Workbench tab (preparer) | list 1 click; list to record 1 click, 1 load | nav, row, tab: 3 loads, 3 clicks. First row is the most urgent (filing due first) | nav, select row, "Open the full record", tab: 4 loads, 4 clicks (2 to get from list to record: over budget) | nav, row, tab: 3 loads, 3 clicks. But rows are grouped by state, so the most urgent row (due in 2 days) sits 2,134 px down; first row is "Gaps, tier not set" (over budget: F-C1) |
| T2 Find by name, BN, year end | 3 actions max | `/`, type, Enter: 3 actions, 1 field, 1 load | same | same |
| T3 What changed since I left (preparer) | see on open | 0 clicks to see the "Since you last opened" panel; panel top at y 710 of 768 (barely on screen); 1 click, 1 load to read History | 0 clicks; panel at y 651; same 1 click to History | 0 clicks; panel at y 790, below the first screen (16-step lifecycle stepper pushes it down); same 1 click to History |
| T4 Take next to review (CPA) | list to record 1 click; lands on review tab | nav, row: 2 loads, 2 clicks, lands on Overview, +1 click for the Review tab = 3 | nav, select, open: 3 loads, 3 clicks, Overview, +1 = 4 | nav, row: 2 loads, 2 clicks, Overview, +1 = 3 |
| T5 Check rework (CPA) | 1 click | 1 click, 1 load; changed-cell count in the list ("7 changed cells") | 1 click, 1 load; count in list | 0 clicks, 0 loads, but the Rework heading is 4,464 px down, under the 40 Review rows, no jump link (about 6 screens of scrolling, F-C2) |
| T6 Bulk assign 3 returns (ops) | Space selects, one action, 0 reloads, scroll kept | 3 Space presses, choose person, Assign: 0 loads. But the bar is not sticky (F-A1), focus jumps to the result at the top, and the error path is a full page load (F-A2) | 2 loads: separate "Assign returns" page that lists 3 fixed returns; cannot pick from the list (F-B3) | not possible: no checkboxes, no assign (F-C3) |
| T6b Ops tab, enter confirmation number | 1 page load | open record, Ops tab, "Enter the confirmation number": link points at itself, no form (F-X1) | same dead link | same dead link on the tab; the form exists only as a stray page linked from the prototype index |
| T7 Chase waiting on client (ops) | list 1 click; record; history tab | nav, view, row, History, nudge: 5 loads, 5 clicks. Waiting list shows since, days waiting on client, last contact | nav, view, select, open, History, nudge: 6 loads, 6 clicks. Waiting list shows only state, tier, filing due; days waiting and last contact only after opening (F-B2) | no waiting list at all (F-C4). Flags are a column on the Gaps and Client questions state lists (2 lists to scan); typing "waiting" in the filter matches nothing (0 of 23) |
| T8 Owner: pipeline by state | filtered list, 0 reloads | nav Board, click state: 2 clicks, 1 load, filter 107 ms; the filtered list starts at y 809, below the first screen (F-A3) | same, list at y 750 | nav Pipeline, click state: 2 clicks, 2 loads, 165 ms; the strip stays on every state page so hopping between states is 1 click, 1 load |
| T9 Understand one return at a glance | facts at most 10 | 8 facts plus 3 tags; tabs at y 606 to 655 | same facts; side nav makes a tall block (606 to 906) | same facts; tabs pushed to y 686 to 735 by the stepper |
| T10 Filter, sort, search a 300-row list | 0 loads, under 200 ms | filter 20 ms, sort 110 ms, scroll kept, typing key by key keeps focus and updates | filter 18 ms, sort 81 ms | filter 26 ms, sort 28 ms, but no 300-row list exists (largest is 47 per state): there is no search or filter across all returns except the header search |
| T11 Open a source from Documents | 1 click, under 1 s | 1 click, 1 load (130 ms); leaves the record, a Back click to return | same | 1 click, 0 loads in the main window; opens in the named source window which then follows later clicks (tested: second click changed that window to the next source). The source window must first be opened from the Pipeline page |
| Keyboard-only | every journey by keyboard | Tab presses to first row control: 27 to 41 (skip link goes to main only); `/` focuses search; focus ring on every stop | 25 to 37; `j`/`k` move selection and `n`/`p` change record; no key opens the selected record; from row 1 of 40 it is about 40 Tabs to the pane's link (F-B1) | 19 to 26; no list shortcuts |
| axe (wcag2a to 22aa) | 0 violations | 21 of 22 pages clean; 1 critical (F-A4) | 16 of 23 pages clean; contrast on 7 pages, pane not keyboard focusable on 3, plus the same critical as A | 25 of 25 pages clean |
| 320 px reflow | no sideways scroll outside labelled regions | record Overview and Documents tables overflow (336 vs 320) | side navigation overflows (336 vs 320) | same table overflow as A |

## 2. Faults (one line each: screen, role, action, what happened, what should happen, budget broken)

Faults in all three versions (X)
- F-X1 Ops tab on any record, ops, click "Enter the confirmation number": the link reloads the same page, no form. Should open the number form (C has the form only on a stray page; A and B have none). Breaks "ops: enter number, 1 load" and "no dead button".
- F-X2 Ops list, ops, open "Next ops step": the column prints the words "Next ops step" in every filler row instead of a step (filler data). Should name the step (Run gate 1, Capture CRA data). Breaks the brief's "ops list: next ops step" (RV-30).
- F-X3 Record, any role, "Back to the list": A always goes to the preparer list (also from the CPA and ops flows), C always to My work; B to All returns. Should return to the list you came from, with its filter and scroll. Breaks "no way back".
- F-X4 "Days waiting" is used for days in state in CPA, Board and state lists, while the waiting flag says "waiting on client, 11 days" in the next column (Weston Consulting 183: 28 and 11). Two waiting numbers, one word. Should say "Days in this state" and "Days waiting on client". Breaks T7 (chase).
- F-X5 Search, any role, type "eglinton" and Enter: opens Eglinton Holdings with no sign there is also Eglinton Retail; year end "31 Mar 2026" opens one of several. Should show a short results list when more than one matches. Breaks "find a return, max 3 actions" for the correct return.
- F-X6 Record Overview at 1366x768: the "Since you last opened" panel starts at y 651 to 790, at or below the bottom of the first screen. Should be the first thing under the identity strip. Breaks T3 (see what changed).
- F-X7 CPA, opens a return from the CPA list: lands on Overview, the review tab is another click. Brief says next is the review tab.
- F-X8 Neither the Board (A, B) nor the Pipeline (C) shows due week; only state and a "due in 14 days" chip. Breaks owner task "by state and due week".
- F-X9 Nudge sent (history), ops: success banner shows but focus stays on the body. Should move focus to the banner (rule 9). Minor.
- F-X10 "Waiting since" column mixes "28 days ago" and "21 May 2026" in the same list. Pick one.

Version A only
- F-A1 Ops list, ops, select rows far down the list (row 20+): the bulk bar is a static block above the table (top: -1970 px at scroll 2500). You must scroll up to assign, then the focus moves to the result message at the top. Page ends at scroll 313, not where you were. Should keep the bar in view (sticky) and leave the scroll alone. Breaks "scroll position kept, no action returns to top".
- F-A2 Ops list, assign with no person chosen: full page load to a separate page with 9 rows at scroll 0 and an error summary. Should show the error summary in place on the same list. Breaks "0 reloads, no action returns the page to its top".
- F-A3 Board, owner, click a state chip: filter works in 107 ms with no load, but the filtered list starts at y 809, below the first screen of 768. The click appears to do nothing unless you scroll. Move the list up or scroll to it.
- F-A4 Board, axe: critical aria-allowed-attr, `aria-pressed` on the 15 state links (links cannot be pressed buttons). Use buttons, or `aria-current`.
- F-A5 Ops "Next ops step" default view: the 23 Filed returns come first (sorted by filing due), the first row needing action is row 24, about 2,700 px down. Should hide done returns by default or sort by lifecycle.
- F-A6 My work: the "Waiting on client" chip says 0 while the view switcher says 8. Counts need one meaning (mine vs all).

Version B only
- F-B1 CPA list, keyboard: `j`/`k` select, but nothing opens the record and the "Open the full record" link sits after the last row in tab order; from row 1 of 40 it is about 40 Tab presses. Add Enter or `o` to open. Breaks "list to record, 1 action".
- F-B2 Lists show only 4 columns (name, state or tier, filing due). The CPA brief needs preparer, flag count, days waiting; ops needs missing item; waiting needs days waiting and last contact. All of it is in the pane, one row at a time, so you cannot sort or scan by them. Breaks the "must see together" lists.
- F-B3 Ops, bulk assign: separate "Assign returns" page with three fixed checkboxes, no way to choose rows from the 89 in the list. Should be select in the list. Breaks the bulk budget.
- F-B4 List to record needs two clicks (select, Open the full record). The row link only selects. Breaks "1 click".
- F-B5 `n`/`p` (next and previous return) walk the ten sample clients in fixed order, not the queue you came from (from Maple Ridge, next is Riverdale Rentals, an ops return). The idea is right for a CPA with 5 to 10 returns, the order is wrong.
- F-B6 axe: hint text on the selected row has contrast 4.18 (needs 4.5) on 7 pages; the summary pane scrolls but is not keyboard focusable on 3 pages; at 320 px the side navigation overflows.
- F-B7 The sticky pane is 646 px tall; once you scroll the list its first 27 to 73 px (name, state) are cut off the top.

Version C only
- F-C1 My work: grouped by lifecycle state, so the order is Gaps, Prepare, Trace, Respond, Rework, not due date. The return due in 2 days is 2,134 px down; the first row is "Tier not set". Breaks "next return 1 click, sorted by due date".
- F-C2 CPA review: 40 Review rows come first and Rework starts at y 4,464 with no jump link. Breaks the rework task.
- F-C3 Ops: no checkboxes, no assign, no filter on the ops or CPA or My work pages (filter only on state pages). Breaks the bulk budget and "search everywhere".
- F-C4 Ops, chase: no Waiting on client list; the flag is a column on two state lists and the text filter does not search it. Breaks T7.
- F-C5 Stepper of 16 states (not sorted: ordered list of words) on every record pushes tabs and the "since you left" panel to the edge of the first screen. Keep it, but one line.

## 3. Where people would get lost

- Ops (all): the confirmation number step has nowhere to go (F-X1); a Filed return looks like work (A) or is hidden at the bottom (C).
- Preparer in C: opens My work and sees the least urgent work first, then has to scroll to find what is due.
- CPA in B: the table has no preparer or waiting time, so the pane has to be read row by row; in C the rework queue is below 40 rows and easy to miss.
- Everyone after a record: Back sends you to a list you did not come from (F-X3).
- Owner in A and B: clicks a state, nothing seems to happen (list below the fold).

## 4. Ranking for Zo's sitting

1. **A, tabs.** Best on the budgets it can be measured against: list open 1 load, 1 click to every view (My work, Rework, Waiting on client), full columns for every role (8 or fewer), filter 20 ms and sort 110 ms with scroll kept, in-place bulk assign with Space (the only version that does it), a waiting list with the dated flag, 0 or 1 failures on axe (one critical, on the Board). Its failures are fixable details, not structure: sticky bulk bar and in-place error (F-A1, F-A2), the Board scroll (F-A3), the aria fix (F-A4), the Filed rows (F-A5).
2. **B, split.** The pane is useful for CPA triage and `j`/`k`, `n`/`p` are what a CPA doing 5 to 10 returns a day wants. But it needs two clicks to open a record, hides the columns the tasks need, has no real bulk assign, a keyboard path to the record that is about 40 Tabs, and 7 axe failure pages.
3. **C, pipeline first.** Best for two monitors (the source window that follows clicks) and a persistent strip for the owner. It fails the daily tasks: no due-date order for My work, no bulk, no waiting list, no filter on role lists, rework buried. Use it for the owner's strip and the source window only.

What to borrow:
- From B into A: `n` and `p` on the record, following the list you opened it from (fix F-B5), plus a key (Enter or `o`) that opens the selected row. Skip the split pane; the brief already warned about width and the pane failed axe.
- From C into A: the second-window source viewer (opened from the header, follows clicks), because T11 is 1 click but loses the record in A; and the persistent state strip on the owner's list (keep A's inline filter so there is no reload).
- From all: fix the cross-version faults F-X1 to F-X10 before the sitting, in particular the dead confirmation link, the Back link, the search results list, and the "Days waiting" wording.

Open for Zo (this only narrows the choice): do ops want bulk assign on the list (A) or is a separate page acceptable; is the second-window source viewer part of A's default or a setting.
