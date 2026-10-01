# Design: CPA review and its source viewer (second set, 3 versions)

Designer helper, 1 Oct 2026. Brief: `design/briefs/cpa-review.md`. Branch: **`claude/design-cpa-review-enrwao`** (not `claude/design-cpa-review`; see "Two sets exist" below).

Open `design/prototypes/cpa-review/index.html`. It works straight from disk with no internet: GOV.UK Frontend 6.5.1 and MOJ Frontend 11.1.0 are compiled and vendored, with the Ashbridge settings.

## Versions

| Version | Path (start page) | Structure |
|---|---|---|
| A | `design/prototypes/cpa-review/a-record-tabs/` (`index.html`, `queue.html`) | Record page with MOJ sub navigation tabs in printed order (Brief, sections, Flags, Comments, History; "Changes after rework" when it applies). Each section shows return, trace and source side by side. The source pops out to the second monitor with `w` and follows. Brief in three columns. |
| B | `design/prototypes/cpa-review/b-rail-split/` (`index.html`, `queue.html`) | MOJ side navigation rail listing the sections with their marks in words; section in the middle; trace above source on the right. The second monitor stays free for Taxprep or QuickBooks. |
| C | `design/prototypes/cpa-review/c-two-monitors/` (`index.html`, `queue.html`) | Return walked full width, trace opening under the line, GOV.UK pagination between sections. The source window (`viewer.html`) sits on the second monitor and follows; docked on the right with one screen. Brief is a cover sheet with a GOV.UK task list of sections. |

Also: `design/prototypes/cpa-review/layouts.html` (two-monitor drawings of A, B, C); each version's `states.html` and `viewer.html`; the parts and composed parts with reasons are in each version's `README.md`; the family notes are in `design/prototypes/cpa-review/README.md`.

Scenarios in every version: Maple Ridge Consulting Inc. (Test), red tier, first review (`r01`); the same return back from rework (`r01b`: home office booked, 11 changed cells, 3 marks removed with the reason); Queen West Design Studio Inc. (Test), green tier, 4 of 5 marked (`r08`: mark the last and Approve appears).

## RV-5 as drawn
An explicit Reviewed mark per section (`m`), with who and when. When a number in a marked section changes, the mark comes off and the section says why. Approve appears only when every section is marked; before that the sections left show as links. Sections are the return's own (balance sheet, income statement, Schedule 1, other schedules present); flags are a tab, not a section.

## Checked (Chromium, cloud container)
axe with the WCAG 2.2 AA tags: 0 violations on all 110 pages, no script errors. Click-through in all three versions: 35 checks pass (approve gating, comment errors then save, next flag red first across sections, next source, marks removed after rework, second window follows). No sideways scroll at 320 px. All 135 "built from" breakdowns add up to their lines. No em dashes. Not checked: a screen reader walk, the panel's budgets, other browsers.

Brief on one laptop screen (budget): A fits at 1440 x 900 and is about 115 px over at 1366 x 768; B and C do not fit a laptop screen (B about 360 px over at 1440 x 900, C about 430 px). Details in the family README.

## Two sets exist
Another designer session pushed a full set for the same brief to `claude/design-cpa-review` at 13:24 (commit 82404b3: `v1-record-tabs`, `v2-list-and-detail`, `v3-two-monitors`, with its own `reports/design-cpa-review.md`). I did not overwrite it. The two branches clash on `design/prototypes/cpa-review/index.html` and this report, so they cannot both merge as they are. Differences that matter for the choice:
- This set works offline (vendored, compiled GOV.UK and MOJ); that set loads them from a CDN and uses CSS `zoom`.
- This set treats flags as a tab; that set makes Flags the first of five marked sections.
- This set is axe-checked and click-tested; that set reports its own lint (links, h1, classes, em dashes).

## Questions for the Lead
1. Which set goes to the usability panel and Zo's sitting? Panelling both is possible but doubles the sitting.
2. Queue order (the other set raises it too): the brief says tier then due date; staff-screens rule 6 says "queue: due date first". Both sets follow the brief.
3. Last year's income lines, the six tax numbers, Schedule 8 CCA, flag severities and dollar effects are prototype figures (not tax-checked), because the sample clients hold only this year and opening balances. The README lists every made-up value.
