# Brief: work queues and the return record page

Family: sign-in, the one record shell for every role, the preparer queue and the return overview (cards D13, D04). The CPA queue, ops queues and board (D09, D10) wait for their round. Re-checked 3 Oct 2026 against blueprint v1.2 (main fd9a875b). Sources: blueprint README, 06-screens (RV-20, 24, 30, 40, 50-55), 02-lifecycle (FLOW-1, 3, 5, 7, 8, 9, 10, 11, 12), 08-security (SEC-1, SEC-2), LL-6 to LL-9 (later rounds), the research files staff-ux-patterns and internal-forensics. Decisions Z20-1 (version A, bulk assign on the list), Z20-6 (one record, same tabs for everyone); ambers A252, A387, A421, A433, A444, A485. Designs use made-up test-world data only.

## Why this family matters
/internal failed by stacking 5 counts, a 15-column table, 36 boxes and two forms on one page with no search, no filter, no sequence. Fix: one job per screen. A list answers "what is next for me"; a record answers "where does this return stand".

## Task scripts
| Role | Task | How often | Must see together | Decides | Next |
|---|---|---|---|---|---|
| All | Sign in (QR2, SEC-1) | daily, after a timeout | the form only | nothing | Two-step code |
| All | Two-step code (QR3) | same | the code field only | nothing | the asked-for page, else my list (QR5) |
| Preparer | Pick the next return | 10+/day | state, tier, due dates, blocker, holder | which to open | record, Workbench tab |
| Preparer | Find a return by name, BN, year | 20+/day | match among my returns (SEC-2) | nothing | record |
| Preparer | See what changed since I left | daily | history, new comments, new documents | resume or wait | Workbench |
| CPA | Take the next return to review | 5-10/day | tier, due date, preparer, flag count, days waiting | review order | Review tab |
| CPA | Check rework | daily | returned returns, changed-cell count | open or not | Review tab |
| Ops | New returns, gates, filing steps | 20+/day | state, next ops step, missing item, due dates | send, upload, enter number | record, Ops tab |
| Ops | Chase "waiting on client" | daily | dated flag, days waiting, last chase | record a chase | record, History tab |
| Owner/ops | Pipeline by state and due week | daily/weekly | counts per state in lifecycle order, oldest age | where it jams | filtered list |
| Anyone | Understand one return at a glance | constant | corporation, year end, state, people, both due dates, blocker, hold | nothing | any tab |
| All | Sign out (QR4) | daily | the last service navigation item | nothing | Sign in |

## Budgets (laptop, made-up data, 300 returns)
- List open: 1 page load, under 1 s. Filter, sort, search: 0 page loads, under 200 ms (whole list in the browser, no pagination).
- Sign in: 1 load, 2 fields, 1 submit, autofill works, Enter submits. Two-step code: 1 load, 1 field, 1 submit, paste works. After a timeout: 0 extra clicks, the selection restored from the URL. Sign out: 1 click, 1 load, the second window closes.
- Find a return: type in the header search, Enter opens the top match. Max 3 actions. Next return to work: 1 click (my default list, sorted by filing due date).
- List to record: 1 click or Enter, 1 page load, under 1 s. Tab switch: 1 click, 0 loads, header stays. Open a source from Documents: 1 click, under 1 s.
- Columns per list row at most 8; facts in the record header at most 10. No action ever returns the page to its top. First list row and the record's first block whole inside the first screen at 1366 x 650 and 1093 x 525 (v3 measures the preparer lists, both Q8 drawings, and the record inside at both sizes).

## Facts the screens must show (blueprint)
- Corporation and year end on every row and header (RV-50). Filing due (6 months) and balance-due date (2 or 3 months) on every queue (FLOW-7, FLOW-12). One state, lifecycle order (FLOW-1). "Waiting on client" is a dated flag, not a state (FLOW-3). Tier sets order (RV-8). Group link (FLOW-11).
- Hold on every return (FLOW-10): not held, held by you, held by another (read-only, expiry), expired. Approved and void (FLOW-5, RT-19, TB-11) show on Overview with why and who acts. A closed return is read-only (FLOW-9).
- Preparer list: state, tier, what blocks (RV-20). Ops list: next ops step (RV-30). Owner: pipeline by state and due date (RV-40). A preparer sees only assigned returns; any other address answers "not found" (SEC-2).

## Sign-in and session (QR2 to QR4, SEC-1, A06)
- Sign in: user ID and GOV.UK password input, paste and password managers allowed. One failure message for every refusal ("sign-in failed"), the same for a wrong password, a wrong code and a locked user; no "locked" state is drawn. Error summary only after submit, focused. States: empty, error.
- Two-step code: numeric input, `autocomplete="one-time-code"`, paste allowed, a code is used once, same single error, Back link to Sign in. The code is time based: no "send a new code" control. States: empty, error.
- A session ends after 30 minutes idle or 12 hours: the next request shows Sign in with the asked-for address kept, and after the code the person lands there with the selection restored from the URL (rule 21). Sign out is the last service navigation item on every screen: ends the session at once and closes the second window.
- No Today page (A485, no clause names it): after sign-in the kept address if any, else the role's list: preparer My returns, CPA the review queue, ops the Ops queue, owner the Board.

## Record and lists (QR6 to QR8, QR20)
- One shell for every role: identity bar, then the same record tabs (Overview, Workbench, Review, Documents, Exceptions, History, Ops). Landing tab: preparer Workbench, CPA Review, ops Overview (A387), owner Overview (A485). Workbench, CPA review and the source viewer sit inside it (rule 23, retest D1); a tab a role may not act on states what that role can see.
- Preparer queue columns: corporation and year end, state, tier ("not set" is a real value), filing due, balance due, held by, blocked by with the "waiting on the client since <date>" flag. Default order filing due date then corporation name, stated in the caption (RV-20).
- Names carry scope (A252): "My rework" (the preparer's) and "All rework" (CPA and owner); every count says what it counts.
- Documents and exceptions on a record keep the order they arrived in, oldest first; above five rows each is a sortable table with that order as its start.

## Pattern (chosen, Z20-1): list views plus a record page with tabs
- Lists: one list per role; view tabs; header search; filter line; sortable columns. Record: identity strip (corporation, year end, state tag, tier tag, hold, filing due, balance due, blocker), then tabs one job each. Owner gets Option C's count strip above the list. Dropped: B (split pane cramps the second monitor), C as the main view (an extra click for the daily pick), page-layout builders, kanban.
- GOV.UK and MOJ fit: MOJ case list (search, sortable table, meaningful first column, never "View"), sub navigation for tabs and views, identity bar, alert, timeline, tags, summary list. Gap to note (RV-52): MOJ filter reloads and its sortable table sorts one page, so inline filter and whole-list sort are composed from their parts.

## Open points
- Sitting question (QR21): Q8 was "no whole row at 1093 x 525". v3's denser header and rows put the first row inside at both sizes with either drawing, so what is left is Zo's call on which to keep: view tabs, counts always in sight, or a Show menu with a filter line (both drawn).
- Carried to D10: the Board's first row is below the 1093 x 525 fold (row at 549 to 628 of 525) with the state strip above it; D10 redraws the Board and must bring the first row inside.
- Amber: column sets per role; saved views per staff account. Review marks and Approve belong to the CPA review brief. QR9 to QR19 (bulk assign, ops forms, lessons, measures) wait for D09 and D10.
