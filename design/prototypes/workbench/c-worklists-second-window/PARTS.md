# Version C: worklists across returns, a small return page, the source in a second window

Open `queue.html` (all pages and states: `states.html`). Main return: Maple Ridge Consulting Inc. (Test); the worklists also hold rows from Halton Haulage, Bluewater Renovations, Eglinton Holdings and Danforth Cleaning.

Shape: grid-first. A top-level Worklists area holds one table per kind of work across every return (accounts to map, facts to verify, cells to source, exceptions to answer), with saved views, filters, an editable code cell, bulk confirm and a count. Every row names its return (RV-50). The return page keeps only the checklist, the gap review, the judgment inputs, the round trip, the CPA comments and the hand-off. Every Source link opens `source.html` in a named second window (`target="ashbridge-source"`), so on two monitors the document follows each click without moving the return window. Books and Judgment: Books is a worklist, Judgment is on the return page (brief question 1). AI drafted state is a tag on the row plus an inset at the top (question 3). The next step is a list of links (question 2).

## Task scripts and where they live
P1 queue.html; P2 r-gaps.html; P3 wl-accounts.html; P4 wl-facts.html; P5 r-roundtrip.html; P6 r-judgment.html; P7 wl-cells.html; P8 wl-exceptions.html; P9 r-comments.html; P10 r-handoff.html. Every state is listed in `states.html`.

## GOV.UK Frontend 6 parts used
Skip link, Generic header (text mark in place of the logo), service navigation, tag, task list (return checklist), summary card, summary list, table, checkboxes, radios (none preselected), text input, textarea, select (filters), file upload, button, inset text, error summary and message, details, footer.

## MOJ Frontend 11 parts used
Identity bar (return screens), sub navigation (worklist kinds; return sections), notification badge, sortable table (queue), search, alert.

## Composed outside GOV.UK and MOJ (`app-` classes in `../assets/app.css`)
- Editable grid cells (`app-dense`, `app-numeric`, `app-scroll`): dense rows with a sticky header, an inline code box and tabular figures. No pattern for an inline-editable table; MoJ Forms has inline editing but no component.
- `app-bulk-bar`: sticky bulk confirm with a count; flagged rows are never confirmed in bulk.
- `app-window-bar`, `app-source-pane`, `app-source`, `app-source-doc`, `app-highlight`: the second window page. Opens by name so it follows the clicks; sections switch with `:target`. No pattern exists.
- `app-wide`, `app-search-bar`, `app-return-bar`, `app-next-step`, `app-row-flag`, `app-keys`, `app-count`, `app-req`, `app-stack`, `app-actions`, `app-slot-row`, `app-filter-row`, `app-hold`, `app-logo`: as in version A, with the same reasons.
- `app-proto`: prototype-only note. Not built.

## Prototype shortcuts (not in the build)
Cell-by-cell keyboard movement, saved filters that really filter, and the second window following by keyboard are not simulated. Other returns are shown as names only. Worklist rows come from the sample clients' answer keys (accounts marked "confirm").
