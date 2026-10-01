# Design report: queues and return record (family queues-record), fix round 2 (round 2 of the re-test added below)

Brief: `design/briefs/queues-record.md`. Findings: `reports/findings-designs.md` section (a) "Queues-record (A)". Branch: `claude/design-queues-record-2`. Open `design/prototypes/queues-record/index.html` (works from disk, no network needed).

## What is kept
Only version A (`design/prototypes/queues-record/a-tabs/index.html`), with B's next and previous keys and open key and C's state strip. B (`b-split/`) and C (`c-pipeline/`) are removed from the index and not rebuilt; their folders and build scripts are untouched.

## The eight fixes, where to see each
1. Ops tab per RV-30 and RT-19, no gate 1: `rec-scarborough-robotics.html#ops` (check export, then confirmation number), `rec-riverdale-rentals.html#ops` (T183CORP), `rec-queen-west-design.html#ops` (notice of assessment). Next-ops-step values are real per state (queue-ops.html).
2. Back, n and p follow the list you came from (filter, sort, scroll); Enter or `o` opens a row; the preparer lands on Workbench, the CPA on Review, ops on Ops. Start at `queue-preparer.html`.
3. `search.html?q=eglinton` (two matches, a results list); `?q=halton` opens the return; `?q=zzz` no match; `?q=bakery` reaches filler returns. All 300 returns have a record page.
4. "Days in this state" and "Days waiting on client"; one date format per column; view badges, chips, strip and captions agree with the rows (`build/check.mjs`).
5. "Since you last opened this return" first under the identity bar (Halton, Maple Ridge, Eglinton Holdings, Lakeshore).
6. `board.html`: state strip on top, filing-week chips (RV-40), the filtered list scrolls into view.
7. `queue-ops.html`: sticky bulk bar, error in place, focus to the next row, result announced; rows flagged for a person have no checkbox; Filed is its own view (`queue-ops-filed.html`).
8. Real buttons (no aria-pressed links, no links drawn as buttons); every table region is labelled for 320 px; focus goes to the nudge banner (`rec-danforth-cleaning.html#history`); sources open in a viewer beside the list with "Send to second window" (`rec-halton-haulage.html#documents`).
Also from RC4, RC9: tab changes are client-side routes (`#documents/2`, 0 page loads); in-place actions all run from one shared script, `_shared/proto.js` (there was no shared prototype script in the repo, so this is it); no `zoom`, no third-party font.

## Check numbers, first fix round (superseded by the round 2 numbers below)
Run: `node design/prototypes/queues-record/build/check.mjs` (lint) and, with playwright-core and axe-core installed outside the repo, `node tools/heavy.mjs -- node design/prototypes/queues-record/build/verify.mjs` (browser). Raw output: `design/prototypes/queues-record/build/verify-output.txt`.

| Check | Result |
|---|---|
| 6 retired terms (export 1, export 2, review-lines export, receipt export, gate 1, judgment input sheet, AI-proposed GIFI) | 0 in 318 pages. Data and wording moved to lock export, printed return, tax choices. |
| 7 prototype lint: self-links, `#` links to nothing, links drawn as buttons, filler in data cells, counts that disagree (view badges, chips, strip, captions, intro) | 0 problems in 318 pages. The first run found 3 (self-link on the index, empty-state badge, a stray rule); fixed. |
| 8 axe (wcag2a, 2aa, 21a, 21aa, 22aa) | 116 page states (every non-record page, 13 records x 7 tabs, and the states reached by action: bulk error, ops form error, nudge banner, viewer open, search results, no match, source window): 0 violations, 0 incomplete (the first run had 23 contrast "incomplete" from MOJ's decorative bars; fixed in `a.css`). |
| 8 keyboard Tab walk | 12 pages walked by Tab alone (lists, board, search, records on 5 tabs): 0 stops without a focus style, 0 covered by the sticky bar or another element. The focus-style test uses `:focus-visible`, so it proves focus is not removed, not that the colour is strong enough; axe and the GOV.UK focus colour cover that. |
| 8 reflow at 320 px | 38 page states: 0 sideways scroll outside a labelled table region. First run found 4 (unwrapped related tables); fixed. |
| 8 budgets, 1366 x 650 | First list row wholly inside the first screen on My work (top 428, bottom 541), Ready to review (428, 516) and Next ops step (453, 616); Board state strip inside (231 to 412); record page: tabs end at 487, the tab heading at 525; Documents: viewer beside the list, height 587 of 650. |
| 8 budgets, 1093 x 525 | First list row starts inside the first screen but ends below it (My work 453 to 566, Ready to review 428 to 541, Next ops step 478 to 641): not met for a whole row, one row short; Board strip inside; record tabs end at 487, heading at 525 (at the edge); Documents viewer beside the list at both sizes, never stacked (height 509 of 525). |
| 9 basis | Only govuk-, moj- and app- classes; every `app-` class used or styled is listed in `basis.md` (lint). No `zoom`, no `@import`, no third-party font in `a.css` (Roboto if installed, else Arial). `design/basis/` does not exist yet, so `basis.md` stands in. |
| Tasks (rules 18 to 22) | 34 of 34 pass: tab changes 0 loads; o, j, n, p keys; Back restores filter, count and sort; search 1, 2, 0 matches; no checkbox on flagged rows; bulk error in place with focus on the summary and `Error:` title; result announced, next row focused and in view; ops forms with the error pattern and unlocking steps; nudge banner focused; viewer focus and cited line in view; opening a source adds no history entry; second window opens by script and follows the next selection and a tab change. |

## Round 2 (reports/findings-designs-2.md, "Queues-record (A)" 1 to 7 and checks V1 to V8)
Where to see each fix:
1. One global hidden-attribute guard in `_shared/a.css`; per-class patches removed. No error before Assign or Upload is pressed (Q1): `queue-ops.html` with a row ticked, `rec-scarborough-robotics.html#ops` on load.
2. Bulk error: the summary sits at the top of the bar, focused with no scroll; the page keeps its place (list scrolled to 600: moved 0 px). The quiet bar is one row (60 px at both sizes). The result of an assign shows in a sticky strip at the foot of the window, so the rows do not move. Ops errors: the summary sits at the top of that form, focused, no scroll; the field and its button share a row.
3. Viewer: the heading, source line and "Send to second window" stay put; only the source lines scroll, in their own labelled box, set by that box's `scrollTop` to the cited line (a 40-line sample, cited line 18). No `scrollIntoView` on the viewer; opening a source moves the page 0 px (was 662).
4. Board: visible "Showing 33 of 300 returns, state Rework" with a "Clear filter" button at the head of the list, updated by every filter; Clear moves focus to the caption.
5. Scope words: "My rework" (5, preparer lists) and "All rework" (33, CPA list and the board strip); "Ready to review, due in 14 days or overdue" no longer shares a name with the preparer's "Due in 14 days or overdue".
6. Search matches year end as shown: "31 Mar 2026", "Mar 2026" and "2026-03" all find Halton; lists filter on the same.
7. Back (button or browser) restores filter, sort and scroll and puts focus on the row you came from, also from the search results page.
To make the work fit the first screen (rule 20, found by V3, not in the fix list): the record's facts moved from above the tabs into the Overview tab; the list navigation moved into the identity bar beside the tags; the "since you last opened" strip is one line; the service navigation and tabs lost padding. The tabs now end at 250 px (was 487) and the tab heading at 283 (was 525). Choosing the tab you are already on moves focus to its heading (V7 found it did nothing). An Ops step with a form is listed first; the "left to do" line is now for screen readers only.

Check numbers, round 2 (served over http, 1366 x 650 and 1093 x 525, `build/verify.mjs`, output in `build/verify-output.txt`):
| Check | Result |
|---|---|
| 6 retired terms and 7 prototype lint (`build/check.mjs`) | 0 problems in 318 pages |
| 8 axe, wcag2a to 22aa | 116 page states: 0 violations, 0 incomplete |
| 8 keyboard Tab walk | 12 pages: 0 stops without a focus style, 0 covered |
| 8 reflow 320 px | 38 page states: 0 fail (the first run found the new Ops form 60 px too wide; fixed) |
| 8 budgets 1366 x 650 | first row wholly inside: My work 402 to 515, Ready to review 402 to 490, Next ops step 427 to 590; Board strip 217 to 398; record tabs end 250, heading 283; Documents viewer beside the list, 634 px of 650 |
| 8 budgets 1093 x 525 | Ready to review wholly inside (402 to 515, was 428 to 541); My work 427 to 540 and Next ops step 452 to 615 still end below (Q8: 15 px and 90 px over; the rest is Zo's call on the filter line or the view tabs); Board strip inside; record tabs end 250, heading 283 (was 487 and 525); Documents viewer beside the list, 509 px of 525 |
| Tasks (rules 18 to 22) | 34 of 34 pass |
| V1 to V8 (`design/verify/rules.mjs`), both sizes | 118 of 118 pass (59 per size) |

V1 to V8 detail, per size: V1 no early error on 67 page states (every list page, 7 records on 7 tabs) plus the ops list with rows ticked. V2 page stays put: bulk error (scroll 0 and 600), bulk assign in the middle of the list, Ops error and success, nudge, Documents open source twice, list filter and sort. V3 work in view: Documents with a source open on 3 returns, Ops tab with an open step on 3 returns (4 returns have no open step, so nothing to decide), the Ops error state, the bulk bar. V4 focus lands: 11 actions plus `/` and `j`, browser Back to the same row. V5: 164 counts on 22 pages all carry a scope word or "N of M", same name and scope gives the same number on every page, the board caption follows its filter, the open view tab equals the "of M" of its list. V6: name, number and year end in three formats. V7: every control on 9 pages (list, Ops list, Board, search results, Documents, Ops, History, Overview), skip link by keyboard. V8: not applicable (no option-tied field in this family).
How the checks were fitted: the shared `click` action uses Playwright's `page.click`, which scrolls the control into view first and so hides a page that moves; I used mouse clicks at the control's own position for V2 (a control outside the first screen is then a failure). V2 on lists uses the list's h1 as the identity bar (`data-identity-bar`). V7 skips the skip link (tested by keyboard instead, it is off-screen until focused) and the header Search button on the results page (it repeats the same query). V2 is not applied to a Board state click: it deliberately scrolls the filtered list into view (the caption and Clear sit at the head of it); V5 and V4 cover it.
Found by the new checks and fixed beyond the list: V1 none; V2 the Playwright scroll artefact above, the nudge banner focus scrolled 21 px; V3 the viewer and the Ops form were below the fold at both sizes (layout changes above); V5 chip and badge names clashed across pages and the empty-state page; V7 dead current-tab and "Chase in History" style buttons.

## Not done, or to know
- The 1093 x 525 first-row budget: the row's top is in view, its bottom is 15 to 116 px below. Cutting further means dropping the filter line or the view tabs; left for Zo's sitting.
- The source viewer is a stand-in for D03 (not designed yet): same behaviour as rule 20, replace it when D03 lands. Second window: popup blockers can stop it; the page says so. It cannot be tested for "close on sign-out" in a static prototype.
- Rule 18's "own URL" for a tab is the hash (`#ops`); the build uses real client routes.
- The Workbench and Review tabs still only say where each person stands; their content belongs to the workbench and CPA review families. Review text no longer claims "0 of 9" sections.
- Filler returns (290) have a generic record (two documents, one history line) so they are reachable but not rich.
- Amber candidates: the preparer-name list for bulk assign (Aisha and Ben); "flagged for a person" for bulk is waiting flag, blocker or tier red.
