# Brief: work queues and the return record page

Family: ops, preparer and CPA queues; one return's record page. Sources: blueprint README, 06-screens (RV-20, 24, 30, 40, 50-55), 02-lifecycle (FLOW-1, 3, 7, 10, 11), and the research files staff-ux-patterns and internal-forensics (not repeated). Vendor pages are claims, not tests. No new web fetch this round; reference products come from those files and Zo's taste (Excel, Salesforce). Designs use made-up test-world data only.

## Why this family matters
/internal failed by stacking 5 counts, a 15-column table, 36 boxes and two forms on one page with no search, no filter, no sequence. Fix: one job per screen. A list answers "what is next for me"; a record answers "where does this return stand".

## Task scripts
| Role | Task | How often | Must see together | Decides | Next |
|---|---|---|---|---|---|
| Preparer | Pick the next return | 10+/day | state, tier, due dates, blocker, owner | which to open | record, workbench tab |
| Preparer | Find a return by name, BN, year | 20+/day | match across all queues | nothing | record |
| Preparer | See what changed since I left | daily | history, new comments, new documents | resume or wait | workbench |
| CPA | Take the next return to review | 5-10/day | tier, due date, preparer, flag count, days waiting | review order | review tab |
| CPA | Check rework | daily | returned returns, changed-cell count | open or not | review tab |
| Ops | New returns, gates, filing steps | 20+/day | state, next ops step, missing item, due dates | send, upload, enter number | record, ops tab |
| Ops | Chase "waiting on client" | daily | dated flag, days waiting, last contact | nudge | record, history tab |
| Owner/ops | Pipeline by state and due week | daily/weekly | counts per state in lifecycle order, oldest age | where it jams | filtered list |
| Anyone | Understand one return at a glance | constant | corporation, year end, state, people, both due dates, blocker | nothing | any tab |

## Budgets (laptop, made-up data, 300 returns)
- List open: 1 page load, under 1 s. Filter, sort, search: 0 page loads, under 200 ms (whole list in the browser, no pagination).
- Find a return: type in the header search, Enter opens the top match. Max 3 actions.
- Next return to work: 1 click (My work is the default view, sorted by due date).
- List to record: 1 click or Enter, 1 page load, under 1 s. Tab switch: 1 click, under 1 s, header stays.
- Open a source from the record's documents list: 1 click, under 1 s.
- Bulk assign or mark: Space selects rows, one action, 0 reloads, scroll position kept.
- Columns per list row at most 8; facts in the record header at most 10. No action ever returns the page to its top.

## Facts the screens must show (blueprint)
- Corporation and year end on every row and header (RV-50). Filing due (6 months) and balance-due date (2 or 3 months) on every queue (FLOW-7). One state, lifecycle order (FLOW-1). "Waiting on client" is a dated flag, not a state (FLOW-3). Holder and idle expiry (FLOW-10). Tier sets order (RV-8). Group link (FLOW-11).
- Preparer list: state, tier, what blocks (RV-20). Ops list: next ops step (RV-30). Owner: pipeline by state and due date (RV-40).

## Pattern options

### Option A: Salesforce-style list views plus record page with tabs (recommended)
- Lists: one list screen per role; view switcher (My work, All, Waiting on client, Due in 14 days, Rework); header search; filter chips with counts; sortable columns; saved views.
- Record: identity strip (corporation, year end, state tag, tier tag, owner, filing due, balance due, blocker), then tabs, one job each: Overview (summary card of people, dates, next step; related lists of documents, exceptions and changes at 5 rows with "view all"; short timeline), Workbench, Review, Documents, Exceptions, History.
- Copy: Salesforce list views and record page with highlights and related lists (Zo's taste); Karbon My Work (assignee filter sorted by due date, Waiting on Client as a list, saved views; vendor claim, https://karbonhq.com/resources/karbon-work-dashboards/); TaxDome and Canopy pipelines only as a count strip.
- Avoid: page-layout builders, per-user layouts, kanban as the main view (research: poor for a small daily queue).
- GOV.UK and MOJ fit: MOJ case list page (search, then sortable table and filter, meaningful first column, never "View"), sub navigation for tabs, summary card and summary list for header facts, timeline for history, tags for state, notification badge for counts. Gap to note in design notes (RV-52): MOJ filter reloads and sortable table sorts one page, so inline filter and whole-list sort are composed from their parts.

### Option B: Zendesk-style views with a split list and detail pane
- Left list, right summary of the selected return; full record for tabs. Good for CPA triage; Zendesk views are saved filters with counts.
- Copy: views with counts, next and previous by keyboard. Avoid: split pane on one screen (cramped; the second monitor is for sources) and tabs inside the pane.
- Fit: scrollable pane, side navigation. More custom parts.

### Option C: Pipeline first (state columns) with lists behind
- Karbon and TaxDome pipeline by state; click a state for its list. Good for the owner, weak for the preparer's daily pick (an extra click). Use only as the owner's count strip above Option A's list.

## Recommendation
Option A with Option C's count strip for the owner. The record is a hub: header always visible, tabs one job each, related lists as the summary, the full list one click away.

## For the designer: versions to draw (made-up returns)
1. Preparer My work list and record Overview. 2. CPA list with the rework view. 3. Ops list with next-step column and the ops tab. 4. Owner pipeline strip over the full list. Show empty, one-row and 300-row states, a search with no match, and a blocked return.

## Open points (amber)
- Column sets per role; saved views stored per staff account (staff-only, no client data). Review marks and Approve belong to the CPA review brief, not here.
