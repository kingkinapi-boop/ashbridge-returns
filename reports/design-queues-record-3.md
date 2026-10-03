# Design report: queues and return record (family queues-record), version 3, cards D13 and D04

Branch `claude/design-queues-record-3`, from `claude/design-base` plus main fd9a875b. One version, as ordered: Zo chose the structure at design sitting 1 (decisions/0020: Z20-1 queues and record as version A, tabs, bulk assign on the list; Z20-6 one record shell, the same tabs for every role), so this round polishes version A for the sitting about Tue 6 Oct. Brief: `design/briefs/queues-record.md` (QR1 to QR8, QR20 and QR21 applied; QR9 to QR19 wait for D09 and D10). Open `design/prototypes/queues-record/v3/index.html`: the guide lists every page by state and who to sign in as (made-up users, password `ashbridge-test`, code `482913`). Parts and deviations: `design/prototypes/queues-record/v3/basis.md`.

318 pages: 18 screens (guide, Sign in and its error and session-ended states, Two-step code and its error, Signed out, Not found, Search results, the source window, the preparer queue drawn two ways with their empty pages, the CPA queue, the Ops queue, New returns, the Board) and 300 return records (the 15 sample clients of `reference/sample-clients/` and 285 filler returns, so every row of every list opens). Every name ends "(Test)". The clock is fixed at Monday 8 Jun 2026, 11:20.

## What I drew, by brief item
| Item | What is drawn and where |
|---|---|
| QR1 header | The brief names blueprint v1.2 (main fd9a875b), the clause list (SEC-1, SEC-2, FLOW-1 to FLOW-12, RV-20 to RV-50), decisions Z20-1 and Z20-6, ambers A252, A387, A421, A433, A444, A485. |
| QR2 Sign in | `sign-in.html` (empty), `sign-in-error.html` (error), `sign-in-ended.html?next=queue-a.html` (after a timeout). User ID and the GOV.UK password input (show and hide; paste and password managers allowed), one Continue button. One message for every refusal, "Sign-in failed. Check what you entered, then try again.", also after six wrong passwords in a row; no locked state is drawn. The error summary shows only after the submit, takes focus, and the title starts "Error: ". |
| QR3 Two-step code | `code.html` (empty), `code-error.html` (error). One numeric field with `autocomplete="one-time-code"`, paste allowed (spaces are accepted), a Back link to Sign in, the same single error. No resend control and no "sent to" text: the code is time based (A06). |
| QR4 Session end and Sign out | After 30 minutes idle or 12 hours the next request opens Sign in with a banner saying why and the asked-for address kept; after the code the person lands on that address with tab, view, filter and sort restored from it. Sign out is the last service navigation item on every screen: one click, one load, the session ends at once and a second window closes (`signed-out.html`). |
| QR5 Today per role | Not drawn: A485 rules that there is no Today page. After sign-in the kept address wins, else the role's own list: preparer My returns, CPA the Review queue, ops the Ops queue, owner the Board. The D01 map is updated to match (`design/map/screens.md`, `navigation.md`; map tests 19 of 19). |
| QR6 Return overview states | One record per return. Normal: Maple Ridge Consulting (in Review), Eglinton Retail (hold ended, in a group). Flagged: Danforth Cleaning (waiting on the client, a chase to record; Aisha's) and Lakeshore Eats (a chase to record; Ben Ortiz's, so Dana, Priti or Owen). Approved: Riverdale Rentals (MOJ alert, who acts next). Void, with an alert that says why and who acts: Willow Landscaping 012 (a document changed), Rouge Foods 083 (the books changed) and Summit Studio 047 (the check export did not match; Ben Ortiz's). Closed and read-only: Bluewater Renovations. Hold in the identity bar in words: not held; held by you, ends at a time if idle; held by another, read-only, with the time it ends; ended, when and why (A11). |
| QR7 One shell | Every `rec-*.html` has the same identity bar and the same seven tabs (Overview, Workbench, Review, Documents, Exceptions, History, Ops) for all five users; tabs are client-side routes with their own address (`#documents/2`), 0 page loads. Landing tab: preparer Workbench, CPA Review, ops Overview (A387), owner Overview (A485). A tab a role cannot act on says what that role can see. Workbench, Review and Documents are stand-ins for D07, D02 and D03. |
| QR8 D04 columns | `queue-a.html` and `queue-b.html` (Aisha, 36 returns), `queue-a-empty.html` and `queue-b-empty.html` (Casey, nothing to do). Columns: corporation and year end, state, tier ("Tier not set" is a real value), filing due, balance due, held by, blocked by with "Waiting on client since <date>, N days". Seven columns for the preparer, eight when the CPA or owner sees everyone's work (a Preparer column is added). The caption states the default order: filing due date, earliest first, then corporation name (RV-20). |
| QR20 Names and counts | "My rework" (preparer lists) and "All rework" (CPA, owner, Board) throughout; every count says what it counts ("Showing 18 of 18 returns in To do now"); My returns and the Preparer queue never share a count name (K4). |
| QR21 Q8 | Drawn both ways: `queue-a.html` has view tabs; `queue-b.html` has a Show menu and a filter line. See "For Zo". |

Rulings applied (A485): keys only from D01's one list (only `s`, to the search box, is bound on these pages; the others belong to pages that have a row or a section to act on); the owner's record tab lands on Overview; the D01 map rows my pages change are updated in this branch.

## Task budgets, measured against the brief
Measured over http in Chromium at 1366 x 650 with the 300-return list (`build/verify-output/tasks.txt`: 72 of 72 pass).

| Brief budget | Measured |
|---|---|
| Sign in: 1 load, 2 fields, 1 submit | 1 load, 2 fields, 1 submit, 121 ms; Enter submits (62 ms) |
| Two-step code: 1 field | 1 field, numeric, one-time-code; paste with spaces accepted; 1 load (158 ms) |
| Session timeout: no extra clicks, selection back | 30 minutes idle and 12 hours both land on Sign in with the address kept; after the code the view, filter and sort are restored; 2 submits as at any sign-in |
| Sign out: 1 click | 1 click, 1 load, a second window closes |
| Find a return: 3 actions | `s`, type, Enter: 3 actions, opens a single match on Workbench |
| Next return to work: 1 click | 1 click from the landing list opens the first row, 1 load, 150 ms |
| List to record, under 1 s | dana 265 ms, priti 279 ms, owen 338 ms; 1 click, 1 load each |
| Tab switch: 0 loads | 0 loads, slowest 60 ms, own URL |
| Open a source under 1 s | 68 ms, no page load, no history entry |
| List opens in 1 load under 1 s | six lists, 166 to 296 ms, every row in the page, no pagination |
| Filter, view, sort: 0 loads, under 200 ms | filter 1 ms, view 2 ms, sort 19 ms |
| Columns at most 8; facts at most 10 | 7 columns (preparer), 8 (CPA, ops, owner); 7 or 8 facts |
| No page jump on an in-place action (V2) | chase, hold, Ops step and bulk assign: scroll unchanged; rules V2 passes at both sizes |

## Checks run, with numbers
| Check | Result |
|---|---|
| Retired-term and prototype lint (`build/check.mjs`) | 0 problems on 318 pages, 8210 links, 966 tables, 1919 fields, 1541 list rows; basis list vs live classes: 0 unlisted, 51 `app-` classes |
| axe (incomplete counted as failure), 1366 x 650 | 312 page states, 0 violations, 0 incomplete |
| axe, 1093 x 525 | 312 page states, 0 violations, 0 incomplete |
| Keyboard walk (Tab only, 30 pages, five users) | 0 pages with a problem: no focus style missing, nothing hidden or covered, no trap |
| 320 px reflow | 151 page states, 0 fail (the first run found 46: unwrapped tables, a form summary 17 px too wide, 22 px sort buttons, a 20 px back link; all fixed, rerun clean) |
| Budgets at 1366 x 650 and 1093 x 525 | `budget.txt`: every list's first row wholly inside the first screen at both sizes except the Board at 1093 x 525 (see Know before the sitting); every record's first block inside; sign-in forms inside; Documents viewer beside the list, no page scroll |
| Shared rules V1 to V8, 1366 x 650 | 135 of 135 pass |
| Shared rules V1 to V8, 1093 x 525 | 135 of 135 pass |
| Task script | 72 of 72 pass |
| D01 map test | 19 of 19 pass |
| Page errors in any run | 0 |

The walk's focus test was shown failing on a planted page earlier in this round before it was trusted. Outputs: `design/prototypes/queues-record/v3/build/verify-output/`.

## Parts used that `design/basis/parts.md` does not list
- GOV.UK back link (Two-step code, Search results).
- GOV.UK password input (Sign in).
- GOV.UK select (the Show menu in queue variant B; the preparer in the bulk bar).
- GOV.UK checkboxes, small (bulk assign rows; a row flagged for a person has none).
- GOV.UK label, hint, form group and grid rows and columns (parts of every form and of the layout, not components of their own).
- MOJ sub navigation (the record tabs and the list view tabs; parts.md lists "side navigation", which is a different part).
- MOJ badge (the count in a view tab, with "(" and ")" hidden for screen readers).
All of them are official. Asking for them to be added to the basis. I did not edit `design/basis/`.

## Composed outside GOV.UK or MOJ, with the reason
`design/prototypes/queues-record/v3/basis.md` lists all of it, class by class: 51 `app-` classes are in the live pages (49 composed here, each with its reason, plus the two `design/basis/` already defines, `app-width-container--wide` and `app-shortcuts`); `check.mjs` fails a class that is used and not listed, or listed and not used. It also lists 13 deviations from the basis. In short: header search (GOV.UK has no staff search); the signed-in line; the filter line and Show menu (MOJ's filter reloads the page); the bulk bar (sticky, keeps its error and result inside the bar; MOJ multi select reloads); the Board's state strip (a count strip, carried over for D10); the identity bar's facts (a summary list takes twice the height); the "since you last opened" strip; the Documents viewer and the Ops checklist forms (stand-ins for D03 and for D10); the green result frame for an in-place action on a record (GOV.UK's success banner is 100 to 170 px tall and fell below the 1093 x 525 fold); one labelled scrollable region around every table (rule 13). Deviations new in this round: the bar under the current tab and the timeline line are drawn without MOJ's absolutely positioned pseudo-elements (9 and 10), because axe cannot read the contrast behind them and this version counts an incomplete result as a failure, and the look is the same; sort buttons and the Back link are 24 px high (11, rule 12); the in-place forms' error summary stays inside the form at 320 px and reads on one line, and a chase's result sits under its button (12); the page's foot padding for the sticky bulk bar applies to list pages only (13).

## For Zo: one choice
**Q8: view tabs or a Show menu with a filter line, for the preparer's list.** The question was that no whole row fitted at 1093 x 525. The denser header and rows now put the first row inside at both sizes with either drawing, so the fold no longer separates them; what is left is a preference. Open `queue-a.html` and `queue-b.html` (sign in as `aisha`).
- A, view tabs (`queue-a.html`): five views as tabs with their counts in sight (To do now 18, All mine 36, Waiting on client 2, Due in 14 days or overdue 8, My rework 1) and the filter box under them. First row 281 to 360 px; 6 rows whole at 1366 x 650 and 3 at 1093 x 525.
- B, filter line (`queue-b.html`): a "Show" menu with the same five views and the filter box on one line. First row 295 to 374 px, 14 px lower; 5 rows whole at 1366 x 650 and 3 at 1093 x 525.
- My recommendation: A. The five views are the questions a preparer asks every day, and the tabs show all five counts without opening anything. B costs one row at 1366 x 650, shows only the chosen view's count until the menu is opened, and gives a second way to narrow a list. The CPA, Ops, New returns and Board lists already use tabs, so B would change them too. B is the better shape only if a role ever needs more views than fit on one line. The drawing not chosen is dropped.

## Know before the sitting
- Only the `s` key is bound. It repeats the visible search box, is listed under "Keyboard shortcuts", does nothing while focus is in a text field, and can be turned off.
- Record a chase (QR16 is open): it writes a dated staff note on the return and sends nothing. The form (three choices and one button) sits on the History tab beside the dated flag; its error and its result stay inside the first screen at 1093 x 525 and nothing above them moves. With one action the identity bar shows a plain button; with two (Danforth for Aisha: chase and release the hold) the MOJ button menu "Actions" opens first, so a chase costs one more click there.
- Results of in-place actions on a record (a chase, an Ops step) are one or two lines in a green frame under the control, the same frame as the bulk-assign result on a list; GOV.UK's success banner was 100 to 170 px tall and fell below the fold at 1093 x 525 (`basis.md`, `app-result`).
- A preparer sees only her own returns (SEC-2). The pages are static, so the scoping is done in the page's script: another return's address answers "not found" and header search finds nothing for it.
- The session is kept in the browser (local storage) so that a second window closes on Sign out; it is a prototype stand-in, not the real session.
- Lists keep their state in the address (`#view=all&q=halton&sort=3d`), so a reload or a second window restores it, and Back from a record returns to the row you left, with the filter, sort and scroll kept.
- The CPA, ops and New returns lists and the Board are carried over from version A so the roles have somewhere to land; their own rounds (D09, D10) redraw them. The Board's first row is below the 1093 x 525 fold (first row 549 to 628 px at 1093 x 525 against a fold of 525; the state strip, 193 to 350, is inside); that belongs to D10.
- Casey (the second preparer) has two returns and nothing to do now: that is the empty state, reached with a made-up user, not by editing a page.
- The wide container in `basis.css` has no side gutter between 1020 and 1600 px; `app.css` adds one (basis gap to fix in `design/basis/`).
- Two things the checks cannot see and a person should: how the black bar under the focused tab looks beside the yellow focus colour, and the wording of the "session ended" banner.
