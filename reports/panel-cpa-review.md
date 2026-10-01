# Usability panel: CPA review (three versions)

Panel mode, 1 Oct 2026. Family: cpa-review. Brief: `design/briefs/cpa-review.md`. Versions: `v1-record-tabs`, `v2-list-and-detail`, `v3-two-monitors` in `design/prototypes/cpa-review/`. Made-up data only. This narrows the choice; Zo decides.

## How it was walked

- Role: the CPA (task scripts 1 to 8). The preparer's part of this family (comment fixes, send back) was only opened, not timed.
- Playwright Chromium from a scratch folder (nothing installed in the repo or globally), pages served from a local static server. Laptop view 1366 x 650 (a 1366 x 768 screen minus browser chrome); also re-measured at 1366 x 768 and 1920 x 970 where it mattered. Second monitor = a second window opened with key `o` in the same browser context (the prototypes sync through BroadcastChannel).
- Returns: Maple Ridge (red, 38 numbers, 7 flagged rows, 1 number with no evidence) and Queen West (green, 50 numbers, 9 flagged rows). Also the "every section marked" and "back from rework" states.
- Timings include Playwright overhead, so real times are lower. All "under 1 s" and "under 0.2 s" budgets pass in all three (click to source 57 to 71 ms; follow in the second window about 90 to 100 ms). Time is therefore not what separates the versions; page loads, the fold and layout are.
- Limits: these are static pages. Pressing `r` toggles a tag but nothing is saved (a reload loses it), Approve and the "sections left" list never update live, and the mark coming off exists only as separate "back from rework" pages. RV-5 behaviour was judged from those static states, not from a live run.
- axe (wcag2a, 2aa, 21a, 21aa, 22aa) on every one of the 231 HTML files: zero violations in all three versions (checked that axe does catch a planted missing alt and an unnamed button). It also left about 75 colour-contrast checks "incomplete" on a section page, so contrast is unproven, not passed.

## Table: tasks by version

Loads and clicks are counted from the state the task starts in. "Keys" are single key presses (`j k f r n c o a [ ]`). Faults point to the numbered list below.

| Task (budget) | V1 record tabs | V2 list and detail | V3 two monitors |
|---|---|---|---|
| 1 Open a return from the queue (1 load, 1 click, under 2 s) | 1 load, 1 click, 0.15 s. PASS | same. PASS | same. PASS |
| 2 Read the brief (0 loads, whole brief on one laptop screen) | 944 px page at 650 px high; six numbers and first flags in view, changes, assumptions and attestations below. FAIL (F1) | 1134 px. Worst. FAIL (F1) | 960 px. FAIL (F1) |
| 3 Next section (0 loads, 1 key) | `n`: 1 key, 1 page load. FAIL (F2) | `n` or `j` across the edge: 1 key, 0 loads. PASS | `n`: 1 key, 1 load. FAIL (F2) |
| 3 Mark a section Reviewed (1 key, under 0.2 s) | `r`, 0 loads. PASS, but `r` toggles (F7) | `r` marks the section of the selected number, which may be off screen (F7) | `r`. PASS, same toggle (F7) |
| 4 Open a number's source (0 loads, 1 click, under 1 s; next source under 0.3 s) | 0 loads, 1 click or `j`. Boxed figure fully inside the pane for 8 of 17 numbers at 650 px (15 of 17 at 768) (F3) | 0 loads, 1 click. Source pane is below the fold: boxed figure in view for 0 of 22 at 650 px, 8 of 22 at 768, 21 of 22 only at 1920 x 970 (F3) | 0 loads, 1 click, but the page holds no source: it needs the second window open. No window, no source (F4) |
| 4 Source on a second monitor | `o`, follows clicks in 0.09 s, own Next and Previous. PASS. Goes stale on section change (F5) | `o`, same. Never stale inside the Return tab | `o`, same. Goes stale on section change (F5) |
| 5 Next flag (0 loads, 1 key) | `f` steps flagged rows in this section only; Flags tab lists all 9 and steps them with `f`, 0 loads. PASS on the Flags tab | `f` crosses sections in one page, 0 loads. PASS | as V1. PASS on the Flags tab |
| 6 Comment (0 loads, 2 clicks or keys, 2 fields) | `c` loads a form page (1 load), submit loads again (2 loads), 4 actions (`c`, type, severity, Add comment), 3 fields. FAIL (F6) | `c` loads a separate page that drops the return (2 loads), same 4 actions, 3 fields. FAIL (F6) | as V1. FAIL (F6) |
| 7 Approve with every section marked (1 load, 1 click) | 1 click, 1 load; absent, not disabled, until all five are marked; sections left shown as links. PASS | same. PASS | same. PASS |
| 8 Re-review after rework | Changes tab: before and after, "Open the number", sections whose mark came off with the reason. PASS | same, mark-off reason shown inside the return list. PASS | same as V1. PASS |
| Whole green return, every number opened (budget: 1 return load, under 150 keys) | 7 loads after the queue (Brief, Flags, 4 sections, Approve); about 60 keys (49 `j`, 4 `r`, 4 `n`, `a`). Loads FAIL, keys PASS | 3 to 4 loads (Brief, Return, Approve; Flags tab optional); about 57 keys. PASS | as V1: 7 loads, about 60 keys. FAIL on loads |
| Tab presses to the first number from page top (keyboard only) | 20 (no skip link to the return) | 21 | 20 |
| Faults, count of distinct ones | F1 to F7, F9 to F12 | F1, F3, F6, F7, F8 to F12 | F1, F2, F4 to F7, F9 to F12 |

## Faults (one line each; screen, return, what I did, what happened, what should happen, budget broken)

Shared by all three versions:

- F1. Brief tab, any return (red Maple Ridge, green Queen West): opened it at 1366 x 650. Page is 944 px (V1), 1134 px (V2), 960 px (V3) tall; changes, assumptions and attestations sit below the fold. Whole brief (six numbers, tier, flags list scrolling inside) should fit one laptop screen. Breaks "Read the brief: whole brief fits one screen".
- F6. Comment (`c` on a number, any section): `c` loads a form page, Add comment loads another. Should be a panel opening in place on the same page, 0 loads, 2 keys (key, submit), staying where the CPA was. Breaks "Comment on a number: 0 loads, 2 clicks, 2 fields". Also type and severity are both required, so the fields are 3 and the clicks 4.
- F9. Review queue, all three (identical page): looked for search and filters. None (no search box, no filter by tier or state, 0 inputs on the page); six rows, so only column sorting. Zo wants search everywhere. Needs a search box and state and tier filters. Breaks Task 1 (pick the next return) at any real volume.
- F10. Brief on all three: "six numbers against last year" are sales, net income before tax, net income for tax, total assets, due from shareholder and HST payable (this return) or salaries (green). RV-2 says net income, taxable income, federal tax, Ontario tax, instalments, balance or refund. The prototypes lack tax figures, so the card must either supply tax numbers or the clause must change. Breaks RV-2.
- F11. Any return page at 320 px wide: the whole document scrolls sideways (778 px wide on section pages, 671 on the brief, 541 on the queue), only a table should. Breaks rule 13 (WCAG 1.4.10). Not what the CPA uses daily, but it is a rule test.
- F12. Flag chips ("Flag F01" in the grid): 16.5 px tall, 54 px wide, and the focus ring is the browser default thin outline, not the GOV.UK focus style. Breaks rules 11 and 12 (visible focus, 24 px targets). Also the flag decision screen shows the sales bank statement as the source of F01, although the flag "Cites: Client app note, staff list": the source pane should show the cited evidence for the flag, not the number's first source.

Version-specific:

- F2 (V1, V3). Section tabs are page loads. `n` moves to the next section with a page load; `j` stops at the last row of a section (clamped), so a full walk is 7 loads against the "1 return load" budget and "next section: 0 loads". In a build, switch tabs without a reload (client-side) and let `j` continue into the next section tab.
- F3 (V1, V2). Pane heights are fixed at 342 px at every window size. The source pane does not scroll the boxed figure into view: V1 at 650 px shows the boxed figure fully for 8 of 17 documents; V2 stacks the source under the trace, below the fold, so the figure is out of view for all numbers at 650 px and 14 of 22 at 768 px. "Under 1 s to the boxed figure" is met for load time but the figure is not visible. Panes should fill the viewport height and scroll the box into view on open.
- F4 (V3). The source pane in-page is a stub ("Source on monitor 2... follows your clicks"). With the second window closed or on a laptop alone there is no source on screen: the CPA must press `o` first (an extra step and a popup). The page does say so and offers "Open on second monitor", as the brief required, but it is V1 with the source pane taken out; V1 already opens the same second window with `o`.
- F5 (V1, V3). Source window goes stale on a section change: opened the window on Income statement, pressed `n` to Schedule 1; main page selects "Net income before tax from the Income statement" but the window still shows "Bank statement, Jan 2025, page 1". It only follows again after a click. In a build the selection must be pushed on every tab change.
- F7 (all, worst in V2). `r` is a toggle: pressing it on a section already Reviewed takes the mark off with no confirmation and no reason; in V2 it acts on the section of the selected number, which can be several screens away from what the CPA is looking at (I pressed `f` to Balance sheet and `r` removed an existing Balance sheet mark). Make the key mark only, and removal an explicit control.
- F8 (V2). The Return tab is one 2077 px page with four sections (Balance sheet, Income statement, Schedule 1, other schedules) in a 342 px list pane, so there are two scrollbars, and "Sections: Balance sheet, Income statement..." is a jump bar inside the page. Rule 14 and Zo's words say separate tabs for separate things; here the sections are separate bars, not tabs.
- Single key `a` approves with no confirmation (all three, only when Approve shows); one stray key press approves a return. Worth an undo or a confirm. (Not budget-breaking; "Approve: 1 click" is met.)

Mismatches against the blueprint and v1.1 item 6 (for the Lead; not versions' faults):

- RV-1 says brief, then balance sheet, income statement, Schedule 1, then others. Item 6 says flags first. All three put Flags as section 1 of 5. The clause should be aligned.
- RV-5 says a section is marked once "on screen and the CPA moves past it". Item 6 and all three designs use an explicit mark. The clause should be aligned (the brief already flagged this as a red question for the Lead).
- Mark comes off with the reason: shown in all three ("Why the mark came off", Changes tab). Who and when on the mark: shown (V1/V3 on the section page, V2 on each section bar). The approval record's "time on each section and every source opened" (RV-5) is not shown anywhere.
- RV-4 trace should include "comments"; the trace pane only has a "Comment on this number" link and an "All comments" link, no comments on the number. RV-9 (printed pages as sections) is not drawn.
- Approve appears only when all sections are marked in all three (absent, not disabled; 3 sections left shows no Approve on either page type; every "ready" page shows exactly one). PASS.

## The designer's open points

**Queue order (tier first or due date first).** The three queues are identical: tier then due date, stated in the caption. That follows RV-8 (tier sets the CPA's queue order) but contradicts rule 6 in `.claude/rules/staff-screens.md` ("queue: due date first"), which fits the preparer queue of RV-20. Cost of tier first: an overdue green return sits under three red ones with no weight (only a small "Overdue" text under the date, in this data on a red row), and the quick "back from rework, 2 numbers to re-check" return sits fourth. Suggested default for Zo to confirm: overdue first, then tier, then due date, with a one-click filter for "back from rework", and the rule text changed to say the CPA queue differs from the preparer queue. Either choice needs search (F9).

**Does V2's one scrolling page repeat the /internal fault?** Partly. It does not put everything on one page: Brief, Flags, Return, Comments and History are separate tabs, sections keep printed order, each section has its own mark, and the list keeps its place. But the four sections of the return are stacked on one 2077 px page inside a 342 px pane (two scrollbars) and are told apart only by bars, which is exactly what Zo's 1 Oct wording (separate tabs for separate things) and rule 14 reject. V2 is better on loads (the budget winner) but worse on his taste and on laptop visibility (F3). I would not choose it as is.

**Is Flags a markable section?** All three treat Flags as section 1 of 5, with "Not reviewed / Reviewed" derived from the flag decisions (open flags count, mark appears when none is open; red ones need accept or send back, "Record decision"). That is a coherent answer: flags are decided, not just viewed, so the mark should stay derived and not a separate key. Check: in the green return the Flags section shows Reviewed while two flags are tagged "Amber: check"; the page should show how many were accepted by the CPA and how many only "answered by the preparer", otherwise the CPA can hold an unseen section marked.

## Ranked recommendation for Zo's sitting

1. **V1, record tabs** as the base, with these fixes carried into the build brief: tabs switch without a page load and `j` flows across section tabs (F2); source pane height fills the window and scrolls the box into view (F3); the source window follows tab changes (F5); comment opens as an in-place panel (F6); `r` only marks (F7); brief fits one screen (F1). Why: it is the only version that keeps separate tabs for separate things (Zo's rule), shows the source on the laptop alone and sends it to the second monitor with one key, and its faults are mostly about loads, which a built app removes.
2. **V3, two monitors.** It is V1 with the in-page source taken out and a layout drawing; the second-window mechanism is identical in V1. It adds the extra step of opening the window, and the laptop alone has no source. Worth keeping only as an option inside V1 (a "source in its own window" toggle that gives the grid more room).
3. **V2, list and detail.** Wins the page-load budget (3 to 4 loads for a whole return, `j`/`f`/`n` never reload) and its stepping is the best. Loses because sections share one scrolling page (against Zo's tab rule), the source is below the fold on a 1366 x 650 screen, and the `r` key can mark or unmark a section the CPA is not looking at. Its one idea worth borrowing: stepping that crosses section edges.

Failures per version (distinct faults from the list): V1 11, V2 10, V3 11.
