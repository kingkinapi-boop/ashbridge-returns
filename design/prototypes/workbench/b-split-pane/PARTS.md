# Version B: steps down the left, a list in the middle, a detail and source pane at the right

Open `queue.html` (all pages and states: `states.html`). Main return: Maple Ridge Consulting Inc. (Test).

Shape: MOJ side navigation groups the steps (Prepare, Tax work, Round trip and trace, Review). The middle is one table per step; choosing a row opens its detail, its source with the figure highlighted, and the action (verify, confirm, cite, answer) in a non-modal pane at the right, with no page load. The queue works the same way: a name peeks at the return, a button opens it. Books and Judgment sit together under one step, Tax work, as two parts (brief question 1). AI drafted state is an inset on the tab (question 3). The next step is one button on Overview (question 2). Suits two monitors; on the laptop alone the pane drops below the list under 1100px.

## Task scripts and where they live
P1 queue.html; P2 gaps.html; P3 books.html; P4 evidence.html; P5 roundtrip.html; P6 judgment.html; P7 trace.html; P8 exceptions.html; P9 comments.html; P10 handoff.html. Every state is listed in `states.html`.

## GOV.UK Frontend 6 parts used
Skip link, Generic header (text mark in place of the logo), service navigation, tag, task list (Overview), summary list, table, checkboxes, radios (none preselected), text input, textarea, select, file upload, button, inset text, error summary and message, details, footer.

## MOJ Frontend 11 parts used
Side navigation, identity bar, sub navigation (the two parts of Tax work), notification badge, sortable table (queue), search, alert.

## Composed outside GOV.UK and MOJ (`app-` classes in `../assets/app.css`)
- `app-split`, `app-split__pane`, `app-pane`, `app-pane__item`, `app-two-col`: list and detail layout with a sticky right pane; MOJ has a side navigation but no master-detail pattern. Pane content switches with `:target`. Stacks under 1100px and under 640px.
- `app-source-pane`, `app-source-doc`, `app-highlight`, `app-source-caption`: the source with the figure highlighted (no pattern, RV-52).
- `app-wide`, `app-search-bar`, `app-return-bar`, `app-dense`, `app-numeric`, `app-scroll`, `app-row-flag`, `app-bulk-bar`, `app-keys`, `app-count`, `app-req`, `app-stack`, `app-actions`, `app-slot-row`, `app-hold`, `app-logo`: as in version A, with the same reasons.
- `app-proto`: prototype-only note. Not built.

## Prototype shortcuts (not in the build)
Only the first row of each list is open in the pane until you choose another; in the build Space and the arrow keys move the pane from the keyboard (Linear style peek), not simulated here. Only Maple Ridge opens from the queue. Steps after Books show their working state with a prototype note.
