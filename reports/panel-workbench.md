# Usability panel: the preparer's workbench (3 versions)

Panel run 1 Oct 2026 by the tester in panel mode. Branch `claude/panel-workbench` (from `claude/design-workbench`). Brief: `design/briefs/workbench.md`. Method: Playwright (Chromium) at 1366 x 768, plus 1093 (a 1366 laptop at 125% zoom), 2560 (second monitor) and 320; axe 4.x with tags wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa on every page of every version (77 pages) and on 13 pages with a source, pane or form open; Tab-by-Tab keyboard counts; key-by-key typing in a reason field. Axe was first shown to fail on a planted bad page. All commands ran through the laptop slot, nothing installed globally (Playwright sits in the session scratch folder). Prototype pages need internet (govuk-frontend and moj-frontend from jsdelivr). Only Maple Ridge opens, so every task was walked on that return and counted from `queue.html`.

How I counted: a click is a pointer or key press that acts; a load is a real document navigation (a `#hash` jump to a source or pane is 0 loads but is noted when the page scrolls). "Jump" is how far the page scrolled after the action.

## 1. Tasks by version (clicks / loads, from the queue) against the budget

| Task (budget) | A record tabs | B split pane | C worklists + 2nd window |
|---|---|---|---|
| P1 open next return (1 load, 1 click) | 1 / 1. OK | 1 / 1 via the "Open the return" button. Clicking the NAME (what the brief says) blanks the pane, see B-1. | 1 / 1. OK |
| Change tab inside a return (0 or 1 load, 1 click) | 1 / 1. OK | 1 / 1. OK | 1 / 1 for Gaps, Judgment, Round trip, Comments, Hand-off. Evidence, Books, Trace, Exceptions are not on the return page: 2 clicks / 2 loads via Worklists and its sub tab, and the return is gone (C-3). |
| P2 one gap question (0 loads, 1 key, under 10 s) | 1 key / 0. Page jumps ~1,000 px to the next question; second press on the same question does nothing (prototype). | 1 click to pick the row + 1 key / 0. Pick scrolls the page 454 px. | 1 key / 0. Same jump as A. |
| P3 confirm one mapping (0 loads, 1 click; bulk by checkbox) | 2 clicks (tick, Confirm selected) / 1 load, back to top (A-3). Select-all exists. | 1 click on the row's "Confirm 1002" / 1 load, back to top. Bulk button "Confirm 8 AI proposed codes" includes the flagged account (B-2). | 2 clicks / 1 load, back to top. Best for batch: 14 accounts across 5 returns, select-all, inline code box, flagged rows excluded by rule. |
| P4 verify one fact (open source 0 loads, 1 click, under 1 s) | Source 1 click, 0 loads, ~120 ms, but lands 1,459 px down with the table off screen (A-1). Tick + Verify = 3 clicks / 1 load, back to top. | Fact 1 click, 0 loads, pane in view, list jumps 454 px. Verify 1 click / 1 load. Total 2 clicks. | Source 1 click, 0 loads, but each click opens a NEW window (C-1). Tick + Verify = 3 clicks / 1 load. |
| P5 start the import-file download (1 load, 2 clicks) | 3 clicks / 2 loads (name, Round trip, Download). Over by 1 click and 1 load. Download is a link to `#step1`, nothing downloads (A-5). | 4 clicks / 2 loads (name, Round trip, select step 1 because the pane opens on step 4, Download). Over by 2 clicks and 1 load. | 3 clicks / 2 loads. Over by 1 click and 1 load. |
| P6 one judgment input (0 loads, 1 click, 2 fields, under 30 s) | Whole judgment form on one page: 2 fields per input, one Save (1 load). Key-by-key typing worked. | Pick row (1 click) + value + reason + Save (1 load, back to top). Typed key by key: kept, "k" did nothing while in the field. | Same page as A. |
| P7 source one orphan (2 clicks, 1 to 2 fields, under 30 s) | Cite (1) + choose source (1) + Save (1) = 3 clicks, 1 load; the form opens 1,178 px down, table off screen. | Orphan (1, but the first orphan is the blank-pane case) + choose + Save = 3 clicks, 1 load. | Worklists + Cells to source (2 clicks, 2 loads) then choose + Save = 4 clicks. |
| Open any source from a figure (0 loads, 1 click, under 1 s) | 1 / 0, ~120 ms. Lands away from the table. | 1 / 0, pane beside the list at 1366 and up. Below 1100 px wide (a 1366 laptop at 125% zoom) the pane drops under the list and the page jumps 1,311 px, like A. | 1 / 0 on the figure, but opens a new window each time. Source of figures inside the return (Gaps, Judgment, Round trip) also opens the second window. |
| Find any return, account or fact (1 load, 1 key to focus, 1 field, under 3 s) | `/` focuses search (1 key). Enter returns the same full queue. Only an empty-result page exists; no results page with hits. | Same. | Same. Worklist filters exist but "Apply filters" returns the same rows (prototype). |
| Keyboard: Tabs from page top to first row control on a tab page | 25 to 29 | 22 to 25 | 22 to 25. Skip link goes to `main` in all three. |

Page height at 768 high: A tab pages 1,184 to 2,074 px; B 1,370 to 1,540 px; C 1,130 to 2,177 px. A source or form docked under a table is therefore always below the fold in A and in C's return pages.

## 2. Where people get lost, and faults, in one list

Format: version and screen, what I did, what happened, what should happen, which budget it breaks.

### Version A (record tabs)
- A-1. Evidence, Gaps (any Source link): click Source. The page scrolls 1,425 to 2,546 px to a panel under the table. The row you were on and the next row are off screen; the "table stays where it is" claim is false on a laptop. Source should open beside or over the row without moving the list. Breaks "open any source under 1 s" and the /internal jump fault.
- A-2. Evidence: each Source click adds a history entry; Back moves from source to source (it took 1 Back per source viewed to reach the previous page). Back should leave the tab. Breaks "no way back".
- A-3. Books, Evidence: tick rows, Confirm or Verify selected. The page reloads and returns to the top, the list does not stay where it was (rule: after an action the list stays, focus to next row). The prototype note on Gaps covers only Gaps. Breaks P3 and P4 (lists that jump to the top).
- A-4. Trace: Cite a source opens the form 1,178 px down with the table off screen; the second Cite replaces it. P7 is 3 clicks, not 2.
- A-5. Round trip: "Download the import file again" is a link to `#step1` (dead). Upload fields exist only in the error page (2 file inputs); the normal page and the blocked page show none, so the first download and the two uploads are never shown working. Breaks P5.
- A-6. Overview and every tab: the "Next step" strip is the same text on every tab ("Confirm the GIFI code for 2010"). Useful wayfinding, but on the Round trip tab it says to do Books instead; no button for the step you are on.
- A-7. Saved views on the queue (All, Mine, With the CPA, Blocked on me) all link to `queue.html` unchanged. Dead filters.
- A-8. Exceptions: five answer boxes and one Save for all on one page, Judgment: all inputs on one page. Acceptable at 5, but this is the "everything on one page" shape /internal failed with once a return has 15 exceptions.

### Version B (split pane)
- B-1 (blocking). Every list page, pane open on the first row by default. Click that same row (on the queue: click the name of the only return that opens). The pane goes blank: CSS `.app-pane:has(.app-pane__item:target) .app-pane__item--default` (specificity 0,4,0) hides the default item, which beats `.app-pane__item:target` (0,2,0). Confirmed on queue, evidence, gaps, books, judgment, roundtrip, trace, exceptions and comments. The "Open the return" button vanishes too. Should: clicking the open row keeps it open. Breaks P1 (name is the link), P4, P7.
- B-2. Books: "Confirm 8 AI proposed codes" counts the flagged account 2010 (7 plain AI proposals plus 2010), so one click confirms a code the page says needs a person's choice first. A and C exclude flagged rows. Should: 7, or the flagged row left out. Violates the flag-for-a-person tie-breaker and C's "never bulk" rule.
- B-3. Evidence, Gaps, Judgment: choosing a row scrolls the page 454 to 512 px, so the identity bar and side navigation leave the screen (the return is no longer named, RV-50). Verify this fact, Save and Confirm reload to the top. At 1093 px wide (125% zoom on a 1366 laptop) the pane stacks under the list and the page jumps 1,311 px: B becomes A.
- B-4. Round trip: the pane opens on step 4 (Lock). Step 1's download needs a row click first, so P5 is 4 clicks. Upload for step 2 and step 5 appear only in the error page.
- B-5. Space and arrow keys that move the pane (promised in PARTS.md) are not simulated; Tab count to a row is 22 to 25. The build must supply them (WCAG 2.1.4 off switch present).
- B-6. Side navigation needs 4 groups and 11 links, all on screen at 1366; fine, but Books and Judgment are two links under "Tax work" plus a sub navigation inside, so "Tax work" has two ways to reach the same pages (two levels for two items).

### Version C (worklists and second window)
- C-1 (blocking for the idea). Source links use `target="ashbridge-source" rel="noopener"`. In Chromium, `noopener` makes the name unusable: the second click opened a third window instead of reusing the named one (pages went 2 to 3). On two monitors you would collect a stack of source windows. The first window never follows. Fix: drop `noopener` or use one window opened with `window.open(url, name)` from script. Breaks "source opens in under 1 s on a second monitor" as a repeatable action.
- C-2. Return page has only Checklist, Gaps, Judgment, Round trip, Comments, Hand-off. Evidence, Books, Trace and Exceptions are worklists across returns; to reach one return's Books you must use the link "Open in Accounts to map" (a page named `wl-accounts-maple`) and then you are in a list with no return sub navigation (only a name link back). The brief's "weakest for the one-return story and lifecycle order" is confirmed: the one-return story needs 2 clicks and 2 loads for four of nine tasks.
- C-3. Diagnostics (printed return, "Clear with a reason", D118, D207) are not on any C page. `wl-cells.html` says they are "on the return page, not here"; the return pages (Checklist, Gaps, Judgment, Round trip, Comments, Hand-off) hold none, and Hand-off lists "2 diagnostics not cleared" with nowhere to clear them. Breaks P7 (uncleared diagnostics) and hand-off.
- C-4. Saved views on every worklist ("Everything open, Flagged for a person, Mine, My oldest due dates first") are plain text, not links. Apply filters reloads the same rows. The batch value of C rests on these.
- C-5. Worklist pages hide the return's state: you can confirm an account for Halton Haulage without seeing that return's identity bar or hold (held returns: "read every worklist row but change nothing" is stated only on `return-held`, not shown in a worklist).
- C-6. Round trip and gaps: same dead download link and missing uploads as A.
- C-7. Exceptions and cells worklists can only show Maple Ridge; with five returns mixed in, a single Save (1 button) saves everything ticked across returns: no per-return sign-off cue. One answer box each is kept.

### All three versions
- X-1. The Judgment page and the five-step Round trip with export 1, export 2 and a review-lines export imply the old protocol. See section 4.
- X-2. Reflow at 320 px: document width 367 to 483 (all three overflow); 1366, 1093 and 2560 are clean.
- X-3. "Resolve at the number" links on CPA comments all go to the trace page top, not to a cell.
- X-4. The prototype's Source buttons for Home office, evidence "SIN ending 456" show the last three digits of a SIN in Evidence (A and B); confirm SEC-4 allows it.
- X-5. Tab pages show "5 of 5 judgment inputs complete" on Round trip while Judgment says "4 to do" (storyboard artefact; fix before the sitting or Zo will ask).
- X-6. Search has an empty state only; no design shows results across returns, accounts and facts, so "find any account or fact in under 3 s" is unmeasurable in every version.

## 3. Accessibility

- Axe (wcag2a, 2aa, 21a, 21aa, 22aa): 0 violations on all 77 pages (A 24, B 24, C 29) at 1366 x 768, and 0 on 13 pages with a source, pane, or form open. The planted-bad page failed as expected, so the check runs.
- Keyboard-only: every control reachable; focus outline is 3 px solid and always on screen (checked 15 stops, all visible). Skip link works. Panes and forms are reached by link activation, so a keyboard user can open them; after a hash jump focus stays on the link in B and C but resets to body in A's source panel and A's Trace form (the panel is not focused), so a keyboard user presses Tab 20 or more times from the top of the page to reach what they opened. A should move focus into the opened panel.
- Single-key shortcuts: K, E, M, D do nothing inside a field (checked by typing "k" in a reason box); the off switch exists.
- Not covered by axe but failing the written rules: 320 px reflow (X-2).

## 4. Mismatches with the plain end state v1.1 (`blueprint/README.md`)

All three versions share these. The briefs' task scripts P3, P5, P6 and P7 were written from the old design, so the versions follow the script; the question is for Zo.

1. Judgment inputs (all three: A tab, B "Tax work", C `r-judgment`): CCA, dividend designation, election and business limit share are entered here with reasons. End state item 4: the preparer makes those tax choices in Taxprep. Either the screen becomes a read-only "what you chose in Taxprep" check, or the end state changes. (The "Words" section of the same README still lists judgment inputs as "made in our app", so the file contradicts itself.)
2. Round trip: Step 2 "import report and export 1", Step 5 "export 2, review-lines export and printed return", and "Lock the return" in our app. End state 4 and 7: one lock export and the printed return, plus a check export just before transmit. Two exports plus a review-lines export implies the old protocol. A 5-step page with two upload steps should be one upload step (lock export plus printed return).
3. Books tab / `wl-accounts` (all three): the AI proposes GIFI codes and the preparer confirms them, with a "Last year" column. End state 2: QBO makes the GIFI mapping and Returns only reads it. A screen where Returns maps accounts reads as a bookkeeping task; it should show QBO's mapping with exceptions only (accounts QBO leaves unmapped), or Zo should confirm this is wanted.
4. Trace "Cite a source" and "Clear with a reason": end state 4 has the cite button in Taxprep for typed values. In our trace the preparer cites for orphans and overrides after the lock. This is consistent only if the cite lives in Taxprep and our trace shows the result; confirm which side owns the cite.
5. Not a mismatch: no bookkeeping module appears anywhere; QBO is named as the source of the trial balance; the hold and held states exist; AI-drafted is a tag plus words, never colour alone.

## 5. Ranked recommendation for Zo's sitting

This narrows the choice; Zo decides.

1. **Version B (split pane), after two fixes**, with C's cross-return Worklists kept as one extra top-level tab for batch mapping and verifying. Reasons: it is the only version where a source and the figure stay on the screen with the list at 1366 (A and C-in-return push sources 1,200 to 1,500 px down); it meets the one-click open and 0-load budgets; separate pages per step like Zo's tab taste; each action (verify, confirm, cite, answer) sits next to its evidence. Must fix before building: B-1 (blank pane on the open row), B-2 (bulk includes flagged), and the layout below 1100 px (the pane should stay beside the list at 125% zoom, perhaps narrower). Add B-3 (do not scroll the page when a row is chosen).
2. **Version A (record tabs)**, if Zo prefers the plainest shape: fewest faults to remove, easiest to build, reads like a Salesforce record. It loses on the same task that matters most: every source and every form opens under a long table and the page jumps. Fixing A-1, A-3, A-4 by moving the source into a side or overlay pane makes it B.
3. **Version C (worklists, second window)** as the main structure is third: best for batch work (P3, P4 across five returns, select-all, inline code box) and the only one that uses the second monitor, but its second-window claim fails in Chromium (C-1), diagnostics are unreachable (C-3), and four of nine return tasks need 2 clicks and 2 loads to reach. Keep its Worklists tab and its pop-out source as a "send to second window" button on B's pane.

Before any version goes to Zo: decide the four end-state questions in section 4, since Judgment, the Round trip steps and the Books tab change shape if the end state holds. Fix the dead Download link and show the upload steps in the normal round trip page in whichever version is chosen.

## 6. Findings count

A: 8; B: 6 (1 blocking); C: 7 (1 blocking for the second window, 1 blocking for diagnostics); all versions: 6, plus 4 end-state questions. Axe failures: 0.
