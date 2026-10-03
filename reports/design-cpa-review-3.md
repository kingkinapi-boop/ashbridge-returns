# Design report: CPA review, designer 3, round 3 (card D02)

Branch `claude/design-cpa-review-3`, from `claude/design-base`. One version, **v3**, in `design/prototypes/cpa-review/v3/` (25 static pages, open `index.html`; the parts list and the sitting choices are in `notes.html`). It is version 1 (record tabs, Zo's choice, decision 0020 Z20-3 to Z20-5) with round 3 added. Brief: `design/briefs/cpa-review.md` (CP1 to CP16 and the new task table applied, 60 lines). Made-up data only: Maple Ridge, Queen West, Bluewater Renovations and Scarborough Robotics Labs, all "(Test)". Prototype date pinned at 10 Mar 2026. Pages are built by `v3/_build/build.mjs` (no packages); CSS, JS and the vendored GOV.UK Frontend 6.5.1 and MOJ Frontend 11.1.0 are in `v3/static/`.

## What I drew, per brief item (CP1 to CP16)

| CP | What is drawn | Where |
|---|---|---|
| 1 | Header: identity bar (corporation, year end, tier, state, Reviewed count, Back to the queue with previous and next return following the list), record tabs Review, Comments, Changes (after rework or void), History | every record page |
| 2, 3 | CPA judgment on every accepted risk before Approve: a reason field, Accept the risk or Comment instead; the judgment is its own column ("Your judgment", sortable) and sits apart from what the preparer did. The mark and the judgment are separate | `red.html#/flags/01-F01`, `bluewater.html#/flags`, `scarborough.html#/flags` (5 accepted risks) |
| 4 | Approve is absent until marks are on and risks judged; what remains is listed as links ("Approve: N left"); key `a` only focuses it | `red-gate.html#/approve`, `red-ready.html#/approve`, `green-ready.html#/approve` |
| 5 | Comment panel in place: type (error, question, missing evidence, presentation), severity (must fix, should fix, note), text; error pattern inside the panel; panel is 643 x 483 at 1366 x 650 and 575 x 358 at 1093 x 525 with no inner scroll | key `c` on any number |
| 6 | Top 10 changes since last year, plus lines new and gone, plus the three attestations (red with what remains) and assumptions, just below the six numbers | `red.html#/brief`, `#/brief/attest` |
| 7 | Six numbers against last year, each with a state in words (not confirmed in Taxprep yet; no prior year, with the reason) | brief of every client |
| 8 | CPA queue: All and Back from rework, search, tier filter, overdue first then tier then due date, sortable; empty, error and "later" states | `queue.html`, `queue-later.html`, `queue-empty.html`, `queue-error.html` |
| 9 | Void approval (what changed, marks that came off), forms not placed (Scarborough, 2 forms), a section with nothing in it | `green-void.html`, `scarborough.html#/forms-not-placed`, `red.html#/shareholders` |
| 10 | Second window only when asked; one checkbox remembers the choice per signed-in person, default off, state in words ("Second window: off") | source pane foot on every record page; `source-*.html` |
| 11 | Approval record: marks, judgments, time per section, every source opened | `approved-red.html`, `approved-green.html`, `approved-blue.html`, `approved-scar.html` |
| 12 | Rework view: changed cells before and after, marks that came off and why, comments with the preparer's answer, resolve each | `red-rework.html` |
| 13 | Preparer read-only: same tabs, no mark, judge, approve or comment control, says why; the CPA's drafts stay hidden | `red-preparer.html` |
| 14 | AI fix drafts as "AI draft" cards with citations, no Approve control (the preparer approves, RV-12) | `red-rework.html#/comments` |
| 15 | Keys from D01's one list: n, p, m, o, r, a, c, s, `]` and `[`. Listed in place with an off switch. No key unmarks, approves, sends or resolves. "Mark and step" has no key. A per-figure "Supports" tick is not drawn (A485: a stored mark would change approval record RV-11) | "Keyboard shortcuts" on every record page |
| 16 | Fix-round digest on the Changes tab | `red-rework.html#/changes` |

States: normal, flagged, many (Scarborough, 5 accepted risks), empty (queue, section with nothing), error (queue error, comment error, flag error, source failed), loading, no evidence, approved, void, rework, read-only. No Today page. Record shell is version 1's; the shell designer (D13) redraws it.

## Task budgets measured against the table (verify.mjs, Edge headless)

| Task | 1366 x 650 | 1093 x 525 | Table |
|---|---|---|---|
| Open a return from the queue | 1 load, 1 click, 288 ms; first row whole, 4 rows whole | 1 load, 1 click, 293 ms; 2 rows whole | 1 load, under 2 s, first row whole: met |
| Switch All and Back from rework | 0 loads, 1 click, 8 and 15 ms, search kept | 14 and 8 ms | met |
| Open a source | 0 loads, 16 ms to the boxed figure, 0 history entries | 14 ms | under 1 s: met |
| Next or previous source | 6 ms | 7 and 13 ms | under 0.3 s: met |
| n, p, m, section, tab | 14 to 30 ms | 14 to 34 ms | under 0.2 s: met |
| Reviewed, next | 1 key, 14 ms | 12 ms | met |
| Comment on a number | 1 key, 3 fields, 1 submit, 343 ms | 324 ms | under 10 s: met |
| Judge: accept | 1 field + Accept, 209 ms | 215 ms | met |
| Judge by commenting instead | 3 fields, 347 ms | 350 ms | under 15 s: met |
| Approve | 1 load, 1 click, 304 ms | 255 ms | met |
| Resolve a comment | 1 click, 150 ms | 183 ms | met |
| Why voided | 1 click, 188 ms | 187 ms | met |
| Panes side by side | yes | yes | met |
| Page height | 646 of 650 | 521 of 525 | met |
| Body text, source text | 16 px, 12 px | 16 px, 12 px | met |
| **Read the brief** | six numbers end 388 px; 2 flag rows whole; tier on the first screen | six numbers end 411 px; 0 flag rows whole | six numbers and tier met at both; flags on the first screen met at 1366 only |
| **Ten changes and attestations "within one scroll"** | **not met**: ten changes start 1.7 and attestations end 2.5 pane heights down | **not met**: 2.7 and 3.8 pane heights | table says one scroll |

The one miss is the brief's length. The six numbers, the tier and the start of the flags are on the first screen as the brief says, but the pinned list keeps all 9 flags (V1 behaviour, kept), so the ten changes start below one pane height. At 1093 x 525 the pane is 356 px high and the ten changes alone need about 330 px, so one scroll is not reachable without hiding something. I compacted the flags table (5 columns, 4 px cell padding) and corrected the brief's budget row to the measured numbers. If the Lead wants "one scroll" kept, the lever is to pin only the red flags on the brief (the full list stays in the Flags section); that changes what V1 showed, so I left it as it was and flag it here rather than choosing it.

## Checks run (design card checks 6 to 9, plus `design/verify/rules.mjs` V1 to V8)

All numbers below are from `v3/_build/verify.mjs`, my script, which drives Edge headless and calls `design/verify/rules.mjs` unchanged. The final run after the last fix is in the last section.

- Lint (`v3/_build/lint.mjs`): retired-term lint, prototype lint and basis: 25 pages, 1454 links, 135 app- classes (137 in the stylesheet), 0 issues.
- Tasks: 164 checks, 0 failing.
- Rules (staff-screens 1 to 23 as far as a prototype can show them): 44 checks, 0 failing.
- axe (wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, region, landmark-unique) at 1366 x 650, 1093 x 525 and 320 x 640: 300 states, 0 violations, 0 incomplete; 348 results (MOJ timeline line and badge, and the keys list floating over the page) are incomplete by nature and were checked by hand.
- 320 px reflow: 47 views, 0 overflow; panes stack in one column below 900 px (I found and fixed a grid-column rule that kept three narrow columns at 320 px; axe and the earlier reflow check had not shown it).
- Keyboard walk: 916 tab stops over 30 views (15 states at 2 sizes), 0 controls not reached, 0 covered, 0 without a focus style.
- V1 to V8 at both sizes: 236 checks, 0 failing (by rule: V1 54, V2 36, V3 30, V4 34, V5 38, V6 4, V7 34, V8 6).

Defects found by these checks and fixed: the flag judgment column and the Flags list were not sortable (rule 6; both are now MOJ sortable tables with stated default and n/p following the sorted order); three links under 24 px (rule 12); a no-op tab stop on the pinned flags region; the rework count lacked its scope word (V5); two flag source cards taller than the 236 px source pane at 1093 x 525 (V3; the card now shows label over value and no repeated rows); the read-only preparer's identity bar wrapped to two lines at 1093 and pushed the page over the window (the tag is now "Read-only: preparer"); the 320 px notes tables had no scroll region.

## Parts used that `design/basis/parts.md` lacks (A485: each named)

GOV.UK 6.x: Textarea (comment text, reasons), Select (tier filter; the Section select that replaces the rail under 1200 px), Checkboxes small (open in a second window, follow the review window, single-key shortcuts off), Label and Hint, Panel confirmation variant (Return approved). MOJ 11.x: Sub navigation (record tabs, queue views), Badge (tab and view counts). The MOJ Sortable table is in parts.md.

Experimental MOJ parts, not used and listed on the sitting index: Confirm an action (Approve is one click), Contextual date (dates are plain text with words such as "Filing overdue").

Composed outside GOV.UK or MOJ, each with its reason, in `notes.html` (RV-52): rail, three panes, source viewer, comment panel, keys list, queue filter row, status dots, flag chip, "Made up" label, brief tiles. Every `app-` class is in the stylesheet and listed.

## Deviations and open items for the Lead

1. Secondary text is #4c5b6b, darker than the basis grey #627283, to pass contrast on the pale panel backgrounds. Not in `design/basis/`; I did not edit it.
2. The prototype footer strip lies below the work area (about 94 px at 1366 x 650); budgets measure the work area (`#main-content` bottom), not the footer.
3. V15 queue keys (next row, open the row) are not in D01's list, so only `s` (search) is drawn on the queue.
4. Unresolved must-fix comments do not stop Approve (a note on the Approve view); see choice 2.
5. `queue-error.html` deliberately shows the GOV.UK error summary and an "Error: " title.
6. `design/verify/rules.mjs` V3 needs a visible primary on every page; the preparer's read-only page has no action, so I passed "Next number" as its primary.
7. Brief length (see budgets).

## Two real choices for Zo (also on the sitting index)

1. **Approve: one click, or a confirm step (MOJ Confirm an action, experimental)?** Drawn: one click, one load. Recommendation: one click; the record, the judgments and the approval record already make it deliberate, and no key can approve.
2. **Do open comments stop Approve?** Drawn: no (RV-10 names three things that stop it); they show as a note. Recommendation: keep the note and decide after the first month of use.

## Final run (after the last fix, 3 Oct 2026)

- `verify.mjs fast,v`: tasks 164 checks, 0 failing; rules 44, 0 failing; budgets at both sizes as in the table; V1 to V8 236 checks, 0 failing; total failures 0.
- `verify.mjs axe,reflow,walk`: axe 300 states, 0 violations, 0 incomplete (348 by hand); reflow 47 views, 0 overflow; walk 916 tab stops over 30 views, 0 unreached, 0 covered, 0 without a focus style; total failures 0.
- `lint.mjs`: 25 pages, 1454 links, 0 issues.
- Not run: the combined `all` group, which stalled on a busy laptop (both heavy slots held by other designers) and was stopped at its time limit; the same checks were run as the two groups above on the same build.
