# Usability panel: the source viewer (D03)

Panel run 1 Oct 2026 on branch `claude/panel-source-viewer` (from `claude/design-source-viewer`). Brief: `design/briefs/source-viewer.md`. Rules 18 to 23 of `.claude/rules/staff-screens.md`; RC2 of `reports/findings-designs.md`.

Method: headless Chromium (Playwright) only, served over http so the BroadcastChannel works; viewports 1366 x 650 and 1093 x 525; second window as a real popup in the same browser context; axe-core (wcag2a, 2aa, 21a, 21aa, 22aa, best-practice); keyboard-only pass. Times are from the input to the boxed figure in view and focused, on a local server (an upper bound for this sandbox; the real app adds the network). The three versions share one viewer script (`assets/viewer.js`), one second-window script and one splitter; they differ only in the source navigation (A numbered strip, B tabs, C rail in the window), where the decision sits, and whether the pane hides when the window is open. So most faults are shared and are marked ALL.

Roles walked: CPA on A (list `cpa`), preparer on B (lists `prep`, `verify`), ops on C (list `ops`). I also ran the open, step and second-window scripts on every version, because the viewer is one component.

## 1. Budgets by task and version

Loads = full page navigations. Clicks = pointer clicks; keys are counted separately. Fields = typed fields. Time = input to boxed figure in view with focus in it (no box: card focused).

| Task (brief) | A docked strip | B tabs and decision | C window first |
|---|---|---|---|
| T1 CPA: check a number against its source (open) | 0 loads, 1 click or Enter, 0.20 s first image, then 0.02 to 0.05 s; box in view, focus on box, Esc back to the row; no history entry | same: 0 loads, 1 click, 0.16 to 0.18 s | same: 0 loads, 1 click, 0.19 s |
| T1 then "agrees, marks, next" | 1 click per source ("Supports this figure, next source"), moves on and focuses the next card; 3 sources = 3 clicks; no key for it | no mark control (not a CPA version) | no mark control; Complete is per item in the row |
| T1 next number | `j`, 1 key, 0.02 s | `j`, 1 key | `j`, 1 key |
| T2 step all sources (figure with 5) | 4 keys (`]`), "Source n of 5", kind, name, page, who and when each time; 0.02 to 0.04 s; sheet and page boxes in view; last/first source announced, no wrap | same, tabs; 4 keys | same, via strip in the pane, rail in the window; 1 key per step |
| T3 preparer: cite an orphan (RV-22) | not possible: shows "Not checked: no evidence" and points to the workbench (another tab) | cite the shown candidate: 2 clicks (open, cite) + 1 click to go to the next orphan = 3 clicks, 0 fields, 0 loads. Reason: open, expand "Write a reason instead", type 1 field, record = 3 clicks, 1 field (+1 click for the next). Empty reason: error summary focused, message at the field | not possible |
| T4 preparer: verify extracted value (EV-6) | not possible | 1 click to open the first box, then 1 click (Accept) per value; Accept opens the next box with focus in it; 4 values = 5 clicks, 0 loads; list scroll kept; words found in the box shown | not possible |
| T5 ops: check a document or capture | not possible | not possible | per item with a file: 2 clicks (Show sources, Complete), 3 if a page image fails and needs Try again, 1 more key per extra page; no-file item: Chase 1 click; focus goes to the next row's Show button |
| Second window: open, follow, Follow toggle, closed, blocked | Open by click or `o` (1 gesture, named window, opener kept, 2nd click reuses the window); follows a selection in 0.09 to 0.13 s; follows `]` both ways; Follow off keeps its source and says what the work page shows; turning on catches up; closed shows "Window closed, open again" in under 0.05 s (poll at most 1 s); blocked shows the pop-up message. Pane stays docked while the window is open | same | same, plus the pane hides and the list uses the full width while the window is open; it comes back on close |
| Loads for the whole walk | 0 | 0 on Cite; Cite to Verify is a full page load in the prototype (see fault 9) | 0 |
| Faults found (section 2) | 1, 2, 3, 4, 5, 6, 7, 8, 10 | 1, 2, 3, 4, 5, 6, 7, 8, 9 | 1, 2, 3, 4, 5, 6, 7, 8, 11, 12, 13 |

Sizes: all open, step, mark, cite, verify and Complete results were identical at 1366 x 650 and 1093 x 525 (no stacking at either; at 1093 the pane stays 480 wide and the work list is 589 wide with no sideways scroll, no clipped buttons). The splitter works by keyboard (Left 480 to 504, End 829 leaving 240 of work, Home 360, Enter 480) and by pointer, and the width persists after reload. Under 600 px and at 320 px the viewer becomes a full-width view with a Back control, Esc goes back to the list with focus on the figure's button, and nothing scrolls sideways.

The slow-image setting: the skeleton is on screen at 100 ms (brief: after 300 ms), the box is in view and focused when the image arrives at 1.5 s. The failed first load of the Lakeview page 3 shows an error summary with "Try again" (1 click) and recovers.

## 2. Faults (one line each; screen, what I did, what happened, what should happen, budget broken)

1. ALL, page source at the default "Fit width": the page image renders at 0.71 of its size, so statement text is about 6 px. I needed 2 clicks on "Zoom in" (150%) to read it, and Zoom resets to 100% on every source and every figure. Should open at a readable size (or remember the zoom) and have a key. Breaks T1 budget in practice (1 click becomes 3 for every page source) and rule 18's "readable".
2. ALL, 1093 x 525 with a page source open: the title, steps or tabs, "Source n of N" line, zoom toolbar and OCR words use 245 to 282 px above the page. The page area is 199 px tall in A (38% of the screen), 243 in B, 280 in C (53%). Shows about 7 lines of a statement. Should give the page at least 60% of the height (fold the OCR words, zoom and meta into one row). Breaks rule 20 "full height" at the small size. Screenshot: `reports/shots/panel-source-viewer/A-1093x525-stage-199px.png`.
3. ALL, every work page and the window: the page is 1 px taller than the viewport (`scrollHeight` 651 vs 650, 526 vs 525), so the whole page can scroll by 1 px. Should fit exactly. Rule 18 fold.
4. ALL, zoom 175% or more on a wide box (Lakeview page 2): the box (505 px or more) is wider than the pane (479), so it is centred and clipped on both sides, "Boxed figure" not whole. Should stop zooming at the point the box still fits, or scroll to the box's left edge. T1.
5. ALL, axe (brief wants clean with incomplete zero): every work page has `region` (2 nodes: the identity bar and the splitter sit outside a landmark) and `landmark-unique` (1, the empty viewer is a region and a section both named "Source viewer"); each window has `region` (1); the sheet card in A and B at 1366 gives `color-contrast` incomplete (13 nodes, "partially obscured by another element"). Should be 0 and 0. Test rule.
6. ALL, work page reloaded while the second window is open: the work page says "Second window: not open." and the window says "The work page was closed. This window keeps the last source." until the next selection, then recovers by itself. Should show "open, following" on both after a reload (the new work page announces itself and the window answers). Second-window budget.
7. ALL, "Sign out" clicked in the second window: the window goes to the signed-out page but the work page stays signed in on `index.html`. Work page to window works (window closes). Should end both. Second-window budget, and a security point.
8. ALL, reload mid-way: the open figure and source are lost (the viewer says "No figure selected"; the URL does not change, only `?item=` read once). A's marks survive (session storage); B's cited sources and reasons do not. Should keep the selection in the URL without a history entry (replace) so reload and Back return to the same place (rule 21). Back/reload budget.
9. B, tab change from "Cite figures" to "Verify values" with the window open: it is a full page load in the prototype; the window shows "The work page was closed" and keeps the old figure until a selection on the new page. Brief says the window follows a tab change and rule 18 says a tab change is a route with 0 loads. Prototype limit, but the shell must make it a route and push the new list.
10. A, "Supports this figure, next source" is mouse only (a button at the foot of the pane). Rule 22 allows a key that marks and moves on ("Reviewed, next"). With about 8 figures and 3 to 5 sources each, a return means 20 or more pointer clicks and no key. Should add a key for mark and next that never unmarks. CPA T1 (dozens a return). Also not modelled: the mark coming off when the number changes, and Approve only when every section is marked (the prototype only counts "n of 8 checked").
11. C, Complete or Chase on the last item: focus goes back to the previous row (already done) and the "All items checked" message never shows (`nextRow` returns the previous row; `sv-done` stays hidden). Complete on the first item moves to the next row by position, even if that row is already done. Should move to the next unhandled row and announce the end. Rule 19.
12. C, docked fallback (no second window open): at 1366 x 650 only 1 row is fully visible beside the viewer (2 at 1093 x 525); in A it is 5 and 3, in B 4 and 5. The summary band, filter and shortcut line take the height. Should keep at least 3 rows. T5 budget on a laptop. Screenshot: `reports/shots/panel-source-viewer/C-1093x525-fallback.png`.
13. C, from the boxed figure the decision controls are not in reach: 12 Tab presses wrapped around to the skip link; the route is Esc, then Tab, then Enter (3 keys), against 1 Tab in A (Supports) and B (Cite). T5 keyboard budget.

Observations, not faults: A and B keep the pane docked (480 px) while the window is open, so a two-monitor user sees the source twice; C hides it. The window's second layout differs (A and C a left rail, B tabs). The window takes 336 to 390 px of its 760 px before the page. C's Complete is not tied to having opened the sources; ask whether ops need that. Keys typed in the filter field (j k ] o) fire nothing: pass. Esc returns focus to the figure's button: pass. SINs and bank numbers are blacked out in the images and shown as "SIN on file": pass.

## 3. Recommendation (narrows the choice; Zo decides)

Ranked on the task scripts and budgets:

1. A, docked strip, as the base component. The CPA task is the most frequent (dozens per return) and only A has mark-and-next, numbered steps with a "Checked" state, and a status per figure. It meets the open, step, focus and Esc budgets at both sizes. It needs faults 1, 2, 10 fixed (zoom, chrome height, a mark key).
2. B, tabs and decision. It is the only version that settles T3 and T4 in place with the evidence (3 clicks per orphan, 1 click per extracted value, Accept advances and focuses the next box). Its tabs carry the same steps as A. It should supply the decision slot (`extra`) to the one component, not a second viewer.
3. C, window first. Best for two monitors (the pane hides, the list uses the full width, the window follows), and the only one that shows what ops need, but its docked fallback leaves 1 to 2 rows on a laptop and Complete has focus faults 11 and 13. Take its "hide the pane while the window follows, bring it back when it closes" behaviour, not its page.

Which version each family embeds:
- CPA review (D-CPA): A (strip, mark and next), with the second window offered, pane hiding when the window is open (from C).
- Preparer workbench: B (tabs, candidates, cite or reason, verify list), same component.
- Queues and the return record (ops): C's behaviour (window first, pane as fallback) with A's strip in the pane and the row action ("Complete", "Chase") next to the evidence, not in a list the user has to Tab back to.

Fix before embedding, in order: 1 and 2 (page legibility and chrome height, T1 at the small size), 5 (axe), 6 and 7 (window state and sign-out), 8 (reload), 10 (mark key), 11 and 13 (ops focus). All thirteen are shared or small; none needs a new pattern.
