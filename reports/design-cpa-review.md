# Design: the CPA review, fix rounds 1 and 2 (version 1 only)

Branch `claude/design-cpa-review-2`, from `claude/design-cpa-review` with `origin/main` merged twice (the second time for the source viewer findings review: rule 3 adds the `region` and `landmark-unique` rules, rule 18 adds readable text, rule 21 puts the selection in the URL, check 8 serves over http). Brief: `design/briefs/cpa-review.md`, rewritten from **blueprint commit `b9c5003`**. Front page: `design/prototypes/cpa-review/index.html`; start at `design/prototypes/cpa-review/v1-record-tabs/queue.html` (works offline: local copies of GOV.UK Frontend 6.5.1 and MOJ Frontend 11 in `assets/vendor/`). Made-up data only: Maple Ridge Consulting Inc. (Test), red tier, and Queen West Design Studio Inc. (Test), green tier, from `reference/sample-clients/`. Prototype date pinned at 10 Mar 2026.

Only version 1 (record tabs, the second window opened on demand) is kept in the index. `v2-list-and-detail/` and `v3-two-monitors/` stay in their folders as first drafted; they fail the new rules and are not part of the sitting. Their generators (`_build/split.mjs`, `tabs.mjs`, `notes.mjs`) are marked frozen.

Rebuild: `node design/prototypes/cpa-review/_build/build.mjs`. Checks: `node design/prototypes/cpa-review/_build/lint.mjs` (checks 6, 7, 9) and `_build/verify.mjs [axe|walk|reflow|budgets|rules|v|tasks|all]` (checks 7 and 8; needs `AUDIT_MODULES` pointing at a folder with playwright-core and axe-core installed outside the repo; it serves the pages over http on a free local port and drives the installed Edge).

## What changed: the eight fixes ((a) CPA review V1)

| # | Fix | Where it is now |
|---|---|---|
| 1 | Sections per RV-1 with Flags first, about ten in a vertical rail; a printed-pages section (RV-9); Flags shows "accepted by CPA" apart from "answered by preparer" | One record page per return. Rail: Brief, Flags, then the ten RV-1 sections (statements and GIFI, Schedule 1, capital, losses and reserves, rate, dividend accounts, shareholders and related parties, Ontario, disclosures, payment and filing). Eleven marks (Flags and ten sections). Sections without a structured view show printed-return pages and still need a mark. Flags list: "Answered by preparer" or "Left for you", then "Accepted by CPA", "Sent back to the preparer" or "Open" |
| 2 | Brief: RV-2's six tax numbers (labelled made-up values), to the revised budget | Net income, taxable income, federal tax, Ontario tax, instalments, balance owing as six tiles with last year and change; taxable income and the tax lines carry a dashed "Made up" label because the sample clients do not carry them yet. At 1366 x 650 the six numbers, the tier and the first flag fit on the first screen |
| 3 | Section changes client-side; `j` across sections; `r` is "Reviewed, next" and never unmarks; `a` moves focus only | Section and tab changes are `#/section/number` routes (0 loads). `j` and `k` run on across sections. `r` marks and moves on. Taking a mark off is a separate warning button that asks for a reason. `a` focuses Approve and never approves |
| 4 | Comment in an in-place panel; the trace lists the number's comments (RV-4) | `c` opens a panel at the top of the trace pane: type, severity, text (3 fields), error summary in place, no page load; the trace shows "Comments on this number"; the Comments tab and its badge update. Error or presentation comments say AI drafts the fix for the preparer to approve (RV-12) |
| 5 | Source pane full height, box scrolled into view; the second window follows tab changes; a flag shows its own cited evidence | The source pane is as tall as the work and the boxed figure is scrolled to the middle with focus moved in (Escape returns to the number). "Open in a second window" runs `window.open(url, name)` from the click (no `noopener`), follows every number, flag, section and tab change, and its own Previous and Next move the main window too; its position is remembered. A flag's source pane shows the evidence it cites ("Cited evidence: ...") |
| 6 | Queue: search, tier and state filters, a "Back from rework" view, the order Zo picks | `queue.html`: search by name, tier, view (All, Ready for review, Back from rework with counts), clear filters, sortable MOJ table, default order stated (overdue first, then tier, then due date: the recommendation, Zo's pick is question 4). `queue-later.html` shows Maple Ridge back from rework; `queue-empty.html` the empty state. Back, previous and next return follow the list you came from, with its filters, sort and scroll |
| 7 | Approval record shows time per section and sources opened (RV-11) | `approved-green.html` and `approved-red.html`: one row per section with who and when, time on the section and sources opened, and a total (the figures are made up for the design) |
| 8 | Flag chips at least 24 px with the GOV.UK focus style; 320 px reflow; no `zoom`; resolve axe contrast "incomplete" | Chips are 24 px links with the GOV.UK focus style. No `zoom` and no loaded font anywhere in `ashbridge-v1.css`. 320 px reflow and axe: see check 8 below |

(c) items: 1 flags right after the brief (done); 2 RV-5 is explicit, the brief's red question is removed; 3 RV-2 lines drawn as labelled made-up values; 4 each queue states its default order; 5 RV-4, RV-9, RV-11 and RV-12 are drawn; 9 the budgets use the reworded wording at 1366 x 650 and 1093 x 525.

Also from the new rules: SIN shows "SIN on file" (no digits, rule 23); body text is 16 px or larger in the panes, labels and buttons are 14 px, source page text 13 px (rule 18); the trace's sources and "agrees with" are short lists, not three-column tables, so a 270 px pane holds them at 16 px; below 1200 px wide the rail gives way to a Section select in the tab row so the three panes keep their width at 125% zoom (the panes never stack at either size).

## Round 2: the fix list for CPA review (V1), fixes 1 to 3 (reports/findings-designs-2.md)

| # | Fix | Where it is now |
|---|---|---|
| 1 (C1) | `a` with sections left focuses "Approve: N sections left" and says why | The key moves focus to that link and announces "Approve is not ready: N of 11 sections left to mark Reviewed. The brief lists them." With every section marked it focuses "Approve return" (never approves). Clicking that link while already on the brief says so and focuses the list of sections left. |
| 2 (C2) | At 1093 the comment panel opens over the trace and source panes, keeping the boxed figure's caption in its header; 3 fields and the button in view, no scrolling inside | `c` opens one panel laid over the trace and source panes (grid cells 2 to 3, so it works at every width above 900 px; at 1093 x 525 it is 575 x 335 px, at 1366 x 650 it is 657 x 460). Header: "Comment on <number>" and "Source: <the boxed figure's caption>". Type and Severity are inline small radios, the Comment textarea is 2 rows, the RV-12 sentence sits beside the buttons. Add comment and Cancel are pinned at the foot. Only the body can scroll, and only when an error summary adds its lines. |
| 3 | Local copies of the GOV.UK and MOJ files so the sitting works offline | `assets/vendor/` holds GOV.UK Frontend 6.5.1 and MOJ Frontend 11 (CSS, the classic-script bundles, the icons), unchanged except that `url(/assets/` became `url(assets/`. The pages load them by relative paths and call `GOVUKFrontend.initAll()` and `MOJFrontend.initAll()`; no request leaves the laptop. The GDS Transport fonts are not copied (the Ashbridge stack never loads them). |

Rule-check hooks added (design/verify/README.md): `data-identity-bar` on both identity bars; `data-evidence` on the boxed figure of every source page (or on the whole card when there is no box, and on the printed-return table); `data-primary` on Comment on this number, Reviewed, next, Record decision and Add comment; `data-count` and `data-scope` on the reviewed count, the Comments and Changes tabs, the pinned flags caption, "N flags need a decision", "N large changes", the sections-left heading and the queue count. `verify.mjs v` runs V1 to V8 at both sizes; `verify.mjs tasks` re-walks tasks 5, 6 and 7.

What the new checks found and this round also fixed (all would have been real faults at the desk):
- V6: the find box says "by name or account number" but account numbers found nothing. The index now holds the account number.
- V4: `]`, `[` and `o` left focus on the page body. They now leave it on the source and on the "Open in a second window" button.
- V7: the skip link replaced the route with the brief (it was read as a route); it now keeps the route and focuses the heading. A click on the link to where you already are (current tab, current section, "Approve: N sections left" on the brief, the logo and "Review queue" on the queue, an already selected flag) now says so and moves focus instead of doing nothing.
- Cards in the source pane: the fields are in a two-column list so the Taxprep card fits the 1093 x 525 pane (V3 found it 28 px below the pane).
- Axe: the comment panel covers the panes beneath it, so axe reported their contrast as "incomplete" (overlap). The contrast pass now lays the panes out in flow, as it already did for scrolling.
- V8 does not apply: no text field on these pages is tied to an option (a check confirms none is a conditional of a radio or checkbox). The comment text is not an option.

Re-walk of tasks 5, 6 and 7 at both sizes (`verify.mjs tasks`, 16 of 16 pass):
- Task 5, check one number: pick a number 1 click, 0 loads, boxed figure inside the source pane, focus moved into the source, trace beside it, page scroll 0; `j` 1 key, 0 loads, source and trace follow, focus on the row; `]` and `[` change the source; Escape returns focus to the number.
- Task 6, comment: 1 key opens the panel over the trace and source with the caption in its header, 3 fields, no scrolling inside, Add comment in view (at 1366 x 650 and 1093 x 525); submit 0 loads, comments 3 to 4, the trace lists it, focus back on the row.
- Task 7, approve: `a` with sections left focuses "Approve: 9 sections left" and says why; after all 11 marks `a` focuses Approve return and Enter loads the approval record once (12 rows) with a link to the next return.

## Check numbers (design card checks 6 to 9), round 2

**Check 6, retired terms and the commit.** `lint.mjs`: the brief, 13 pages, the CSS, the script, the builders: 0 hits for export 1, export 2, review-lines export, receipt export, gate 1, judgment input sheet, AI-proposed GIFI and the em dash. Blueprint commit `b9c5003`.

**Check 7, prototype lint.** `lint.mjs`: 13 pages, 104 `app-` classes each listed with a reason in `notes.html`, 0 issues. In the browser `verify.mjs rules`: 25 of 25 pass.

**Check 8, axe, keyboard walk, 320 px, budgets, V1 to V8** (served over http, Edge headless; 1366 x 650, 1093 x 525 and 320 x 640 for axe).
- axe (wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, `region`, `landmark-unique`): **246 page states, 0 violations**. The first full run found 6 "incomplete" states, all the open comment panel hiding the panes below it from axe's contrast check; after the harness fix the 72 red-return states (all three sizes) re-ran with 0 violations and 0 incomplete, and the other 174 states of the full run had 0 incomplete. Another 231 incomplete results on the MOJ timeline and badge pseudo elements are checked by hand and counted apart, as before.
- Keyboard walk, 12 views at both sizes: 447 tab stops, 0 controls not reached, 0 covered, 0 without a focus style.
- 320 px reflow: 38 views, 0 overflow.
- V1 to V8 (`design/verify/rules.mjs`, both sizes): **144 checks, 0 failing**. By rule: V1 28 (12 page states, comment panel typing, unmark form), V2 22 (11 in-place actions), V3 22 (9 pane states and the open comment panel), V4 26 (9 actions, 10 shortcuts, `a` three ways), V5 24 (five red pages, three green pages, the queue, a filter caption), V6 4 (Find a number: name and account number; queue: name), V7 16 (seven pages with every visible control, plus the skip link), V8 2 (not applicable: checked that no text field is tied to an option). The comment panel at 1093 x 525 is 575 x 335 px with 3 groups, Add comment inside and no inner scroll; at 1366 x 650 it is 657 x 460.
- Budgets (`verify.mjs budgets`; times include the browser tool's overhead except the key timings, which are measured in the page):

| Task | 1366 x 650 | 1093 x 525 |
|---|---|---|
| open a return | loads 1, clicks 1, 401 ms | loads 1, clicks 1, 379 ms |
| brief on the first screen | six numbers end 409 px, tier line 246, flag rows fully visible 1, pane ends 638, page 745 | six numbers end 447 px, tier line 265, flag rows fully visible 0, pane ends 513, page 620 |
| open a number's source | loads 0, clicks 1, 103 ms, figure in view, focus in the source | loads 0, clicks 1, 93 ms, figure in view, focus in the source |
| history entries added by opening sources | 0 | 0 |
| key to result in the page (ms) | j 11, k 15, f 18, n 21, ] 11, [ 18 | j 12, k 16, f 31, n 22, ] 9, [ 8 |
| Reviewed, next | 1 key, 0 loads, now #/capital | 1 key, 0 loads, now #/capital |
| comment | 0 loads, 1 key + 3 fields + 1 submit, 296 ms, comments 3 to 4, trace lists it | 0 loads, 1 key + 3 fields + 1 submit, 312 ms, comments 3 to 4, trace lists it |
| walk every number by j | 53 rows, 58 keys | 53 rows, 58 keys |
| approve | loads 1, clicks 1, 219 ms | loads 1, clicks 1, 261 ms |
| three panes side by side | [[132,179,557,460],[697,179,309,460],[1014,179,340,460]] stacked false | [[12,179,486,335],[506,179,270,335],[784,179,297,335]] stacked false |
| readable text and rows beside a pane | body text 16 px over 81 nodes, source text 12 px, 6 rows in a 386 px list pane | body text 16 px over 81 nodes, source text 12 px, 4 rows in a 261 px list pane |
| record page height | page 745 px for 650; list 386 px, source 348 px | page 620 px for 525; list 261 px, source 223 px |

**Check 9, the basis.** `design/basis/` does not exist yet (D00 is not built), so the listed parts are in `notes.html` and below; `lint.mjs` fails any `app-` class that is used but not listed with its reason. No CSS `zoom`, no `@font-face` or hosted font in the CSS (Roboto is named in the stack and falls back to Arial). The same CSS custom properties stand in for `design/basis/settings.scss`.

## Parts used

Both libraries are loaded from local copies in `assets/vendor/` (GOV.UK Frontend 6.5.1, MOJ Frontend 11), not from a CDN.

### GOV.UK Frontend
| Part | Used for, or the reason it is composed |
|---|---|
| Skip link, Header (Generic variant with the Ashbridge Tax wordmark), Service navigation | Page frame (rule 4). Brand comes only through the settings and the logo; no crown, logotype or GOV.UK colours (RV-55). The return page drops the service navigation to leave room; the identity bar and a Back to the queue link replace it. |
| Tag | Tier, flag tier, Reviewed state, queue states. Always words. |
| Summary list | The trace (status, built from, last year, flags) and the flag detail (preparer and CPA kept apart). |
| Table (caption, scoped headers) | The return grid, sources, "Agrees with", comments, changes, search results, the approval record. |
| Inset text | Empty states and the prototype note on the queue; "Why the mark came off". |
| Warning text | A source page that failed to load. |
| Error summary and Error message | The comment panel, the flag decision, taking a mark off and send back (rule 9). The summary takes focus. |
| Radios (small), Textarea, Fieldset, Hint, Label, Button (secondary and warning), Input, Select, Checkboxes (small) | Comment panel (3 fields), flag decision, reason for taking a mark off, send back, find a number, queue filters, "Follow the review window", "Turn single-key shortcuts off". No radio is preselected. |
| Details | The prototype "jump to a state" strip only. |
| Notification banner | Send back succeeded. |
| Panel (confirmation) | Return approved. |

### MOJ Frontend
| Part | Used for, or the reason it is composed |
|---|---|
| Identity bar (adapted to the wide container) | Corporation, year end, tier, state and the Reviewed count, on every return screen (RV-50); Back, previous and next return follow the queue list you came from. |
| Sub navigation | The record tabs: Review, Comments, Changes (after rework), History. The same shell for every role (rule 23). |
| Timeline | History tab; new marks and decisions are added to it as you work. |
| Sortable table | The review queue (more than five rows, aria-sort, default order stated in the caption). |
| Badge | Counts on the Comments and Changes tabs. |

### Composed outside GOV.UK and MOJ, with the reason
| Part | Used for, or the reason it is composed |
|---|---|
| app-wordmark | Stands in for the Ashbridge Tax logo file in the Generic header. The build uses the logo copy kept in design/basis/ (not yet made: D00). |
| app-wide, app-main, app-main--record, app-footer, app-narrow, app-scroll, app-scroll-x, app-winbody | A wider page container (GOV.UK's is 960px; the return grid, trace and source need the laptop and a second monitor), a record page that fills the window so each pane scrolls on its own, and labelled scrollable regions. |
| app-money, app-num | Right-aligned tabular figures (rule 5). GOV.UK has the numeric cell only for plain tables. |
| app-dot, app-dot--green, app-dot--grey, app-dot--amber, app-dot--purple | Status dot with a different shape per status, plus words (EV-11). A tag suits one record, not a column of 60. |
| app-flagmark | The red flag chip on a number (EV-12): a link, at least 24 px, with the GOV.UK focus style. |
| app-madeup, app-madeup-note | A dashed "Made up" label on the values the sample clients do not carry yet (taxable income, tax, instalments, balance). |
| app-return, app-row--flag, app-row--changed, app-row--sub, app-row--group, app-rowbtn, app-meta, app-change, app-change--big | The return as a three-column grid with a selectable row and left bars for flags and changes (RV-8). No GOV.UK or MOJ part selects a table row. Three columns so three panes fit at 1093 px wide. |
| app-review, app-rail, app-rail__list, app-rail__link, app-rail__num, app-rail__title, app-rail__mark, app-rail__mark--on, app-rail__mark--off, app-rail__word, app-find, app-find__label, app-find__input, app-tabsrow, app-tools, app-pick, app-pick__select | The vertical rail of sections (RV-1), each with a Reviewed mark as a shape and words, and "Find a number" beside the record tabs. Neither GOV.UK nor MOJ has a vertical section list with state. Where the window is under 1200 px wide the rail gives way to a Section select in the same row, so the three panes keep their width at 125% zoom. |
| app-tabs | Tightens the MOJ sub navigation so the record tabs take one slim row. |
| app-toolbar, app-toolbar__body, app-h1, app-sectionof, app-approvehint, app-unmark, app-offwhy, app-btn-sm | The one bar above the work: section name, mark state, "Reviewed, next", Approve (only when every section is Reviewed, RV-10), taking a mark off with a reason. Built from GOV.UK buttons and tags; the bar and the small button size are composed. |
| app-work, app-panes, app-pane, app-pane--list, app-pane--trace, app-pane--source, app-pane__title, app-pane__sub, app-pane__body, app-pane__foot | The three panes of RV-4: the return, the trace, the source at full height. No GOV.UK or MOJ split view exists (searched 28 Sep). They stay side by side at 1093 px and 1366 px and stack only on a narrow screen. |
| app-decide, app-sendback | The flag decision and the send-back form: ordinary GOV.UK form parts in a bordered box so they sit inside the trace pane and the Comments tab. |
| app-cpanel, app-cp, app-cp__head, app-cp__body, app-cp__foot, app-cp__note | The in-place comment panel (round 2): one box laid over the trace and source panes so the 3 fields and Add comment are in view with no scrolling inside, even at 1093 px. Its header keeps the boxed figure caption; only the body scrolls (an error summary), the buttons stay pinned. Ordinary GOV.UK radios (small, inline), textarea, hint, error summary and button inside. No GOV.UK or MOJ part lays a form over a split view. |
| app-brief, app-brief3, app-tiles, app-tile, app-tile__value, app-tile__small, app-h2, app-ref, app-lines, app-left, app-inline-list, app-strip, app-required | The brief: six numbers as tiles (RV-2), three short lists, the sections still to mark as links (RV-10), and the red asterisk on required fields (amber A20). |
| app-source, app-source__hit, app-source__faded, app-source__label, app-caption, app-card, app-sheet, app-hit, app-entry, app-skeleton | The source viewer: a statement page with the figure boxed (thick outline plus the words "Boxed figure"), cards for entries, client answers, captures and results, a sheet grid for spreadsheets (EV-14), a loading skeleton. The build draws these from the prepared page image and PDF.js text layer. The same viewer fills the second window. |
| app-sources | The sources in the trace as a short list of buttons with their status: a three-column table does not fit a 240 px pane at 16 px text. |
| app-printed, app-printed__table, app-page, app-pagebtns | Printed-return pages for schedules not drawn as structured views (RV-9). |
| app-keys, app-keys__summary, app-keys__pop, app-keys__list | The keyboard shortcut list, opened in place from the toolbar (RV-6, rule 10). |
| app-qfilter, app-idlinks | Queue filter row and the Back, previous, next links in the identity bar. |

## For the Lead and Zo

1. **Queue order (question 4)** is drawn as the recommendation (overdue first, then tier, then due date) and says so on the page. The tier column holds the composite sort value, so the default `aria-sort` sits on Tier. Zo's pick may change the caption and the sort value only.
2. **The brief on one screen (question 5)**: at 1366 x 650 the six numbers, the tier and the first flag are on the first screen; at 1093 x 525 (125% zoom) the six numbers and the tier are, and the flags start just below (the brief says so). The denser three-column alternative was not drawn.
3. **Second window remembered per person (question 3)**: the window's size and position are kept in the browser and reused; a browser will not open a pop-up without a click, so the window is opened by the button or the key o, never on page load.
4. **Made-up values**: taxable income, federal tax, Ontario tax, instalments and balance (RV-2) and the approval record's times are made up and labelled. A card should add RV-2's six lines to the sample clients (findings (c) 3).
5. **Rule 18's 16 px body text** costs rows: 6 return rows are fully visible beside the trace and source panes at 1366 x 650 and 4 at 1093 x 525. Below 1200 px wide the vertical rail becomes a Section select in the tab row (the rail is back from 1201 px up). If Zo prefers the rail at every width, the answer is a smaller body size in the rule, not a layout change.
6. **Axe notes**: pane content that scrolls out of view is reported by axe as "incomplete" for contrast, so the contrast pass runs once more with the panes expanded in a tall, wide window (colour does not depend on scroll position). The MOJ timeline and badge components draw a pseudo element that axe cannot see through; those incomplete results are counted apart ("checked by hand": text #15283b on white is 14.6 to 1, the badge pairs are the MOJ ones) and are not hidden.
7. **D00 and D01 are not built**, so there is no `design/basis/` to build on and no shared source viewer (D03) yet: this version has its own viewer, written to the rule 20 shape so D03 can take it over.
8. **A mistake to know about**: while clearing a hung browser test I ran `taskkill /IM msedge.exe`, which ended every Edge process on the laptop for a moment (headless test browsers and possibly any Edge window Zo had open). Nothing else was touched.
9. Left alone: `_build/check.mjs` and `_build/shot.mjs` (first-round helpers, superseded by `lint.mjs`, `verify.mjs` and `smoke.mjs`); the version 2 and 3 pages.
