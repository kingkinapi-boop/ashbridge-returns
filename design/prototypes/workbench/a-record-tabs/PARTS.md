# Version A: a return record page with tabs, one job per tab

Open `queue.html` (all pages and states: `states.html`). Main return: Maple Ridge Consulting Inc. (Test).

Shape: the identity bar and a quiet strip name the return; MOJ sub navigation lists the steps in lifecycle order with a count badge on each; a "Next step" strip names the one next step as links; one URL and one job per tab. Evidence, Gaps, Books, Judgment, Round trip, Trace, Exceptions, Comments and Hand-off are separate pages, and Overview is the task list. Books and Judgment are two tabs (brief question 1). AI drafted state is a tag on the row (question 3). The next step is a list of links (question 2). Sources open in a docked panel under the table, with no page load.

## Task scripts and where they live
P1 queue.html; P2 gaps.html; P3 books.html; P4 evidence.html; P5 roundtrip.html; P6 judgment.html; P7 trace.html; P8 exceptions.html; P9 comments.html; P10 handoff.html. States: normal, flagged, error, empty and cannot-start-yet pages are listed in `states.html`.

## GOV.UK Frontend 6 parts used
Skip link, Generic header (text mark in place of the logo, no crown), service navigation, tag, task list (Overview), summary card (one question or step each), summary list (hand-off), table, checkboxes (small), radios (small, none preselected), text input, textarea, select, file upload, button (and secondary button), inset text, error summary and error message, details (keyboard shortcuts), footer.

## MOJ Frontend 11 parts used
Identity bar (return strip), sub navigation (tabs as real routes), notification badge (counts), sortable table (queue), search, alert (hold, nothing left), timeline (overview history).

## Composed outside GOV.UK and MOJ (each is an `app-` class in `../assets/app.css`)
- `app-wide`: a 1480px container for laptop and second monitor; GOV.UK's 960px is too narrow for dense tables.
- `app-search-bar`: search on every screen (RV-50); the Generic header has no search slot.
- `app-return-bar`: makes the MOJ identity bar a quiet strip; identity bar is "to be reviewed" in MOJ.
- `app-next-step`: the single next step as links; no part names "what to do next" (brief 3A).
- `app-dense`, `app-numeric`, `app-scroll`: dense editable table rows with a sticky header, tabular figures and a labelled scroll region; default row is about 46px.
- `app-row-flag`: flagged row (thick left edge and fill, always with the words "Flagged for a person").
- `app-bulk-bar`: bulk confirm with a count; no pattern acts on selected rows.
- `app-source-pane`, `app-source`, `app-source-doc`, `app-highlight`, `app-source-caption`, `app-source-empty`: the source pane with the figure highlighted; no pattern exists (RV-52). Opens with `:target`.
- `app-keys`: on-screen key legend.
- `app-count`, `app-req`, `app-stack`, `app-actions`, `app-slot-row`, `app-filter-row`, `app-hold`, `app-logo`: spacing, red asterisk for required fields (client app, amber A20), the hold text, and a text mark standing in for the logo PNG.
- `app-proto`: prototype-only storyboard note. Not built.

## Prototype shortcuts (not in the build)
Only Maple Ridge opens. Tabs after Books show their step as it is worked, with a prototype note; the built system shows "Cannot start yet" (see `roundtrip-blocked.html`). Keys K, E, M, D, `/`, `?` work; Keep and similar buttons are links to the next question.
