# Parts used, and what is composed (queues and return record)

Pages are static HTML built by `node build/build-a.mjs`, `build-b.mjs`, `build-c.mjs` (no packages). Styles: GOV.UK Frontend 6.5.1 and MOJ Frontend 11 CSS, vendored in `_shared/` (govuk.css, moj.css), plus `_shared/app.css` (the Ashbridge look as CSS variables, standing in for `design/basis/settings.scss`, and the `app-` classes below). `_shared/app.js` is a classic script because both official scripts are ES modules, which Chrome will not load from file:// (the build uses the official scripts). Data: ten sample clients plus 290 synthetic filler rows (names end "(Test)"); pinned date Monday 8 Jun 2026. Only the ten sample clients have record pages; filler rows are not clickable in A and C, and in B they show a summary with a note.

## Official parts in all three versions
GOV.UK: skip link, Generic header, service navigation (My work, CPA review, Ops, Board or Pipeline), table, tag, summary list, summary card, warning text, inset text, notification banner (nudge sent), error summary and error message, select, text input, checkboxes (small), button, details (keyboard shortcuts), task list (workbench and ops tabs), footer.
MOJ: sub navigation (list views, record tabs), identity bar (corporation, year end, state and tier tags, actions), button menu (record actions), timeline (history), badge (counts), alert (approval void), sortable table markup (aria-sort headers).

## Version A, tabs (a-tabs)
Parts: the official list above. Record tabs are MOJ sub navigation, one tab per job (Overview, Workbench, Review, Documents, Exceptions, History, Ops). Related lists on Overview at 5 rows with "View all".
Composed outside GOV.UK or MOJ, and why:
- `app-search`, `app-search-row`: header search with Enter to the top match. GOV.UK has no staff search; made of label, input and button.
- `app-filterbar`, `app-chips`, `app-chip`: inline filter and chips with counts, no page load (brief budget 200 ms). MOJ's filter reloads the page (RV-52 gap).
- Whole-list sort: MOJ's sortable table sorts the one page it is given, which here is the whole list (300 rows, no pagination), so no gap in markup; `app.js` stands in for MOJ's script in the prototype.
- `app-bulkbar`: appears only when rows are selected (no disabled button); MOJ multi-select and action bar do not give a select-then-assign bar that keeps the list in place.
- `app-pipeline` (owner count strip, Option C): a list of links with counts and oldest age. GOV.UK has no chart or count strip; it is a table-like list of links, not a chart.
- `app-facts`: the record header facts as a two-column summary list in a bordered box (summary card has a title bar we do not need).
- `app-tablewrap`: labelled scrollable region for tables at narrow widths (MOJ scrollable pane is for fixed-height panes).
- `app-money`: tabular figures for money. `app-logo`, `app-logo__*`: Ashbridge logo in the Generic header (stand-in mark; the build uses the logo file from the client app). `app-index`, `app-shortcuts`, `app-src`: prototype index lists, shortcuts details, the sample source box.

## Version B, split (b-split)
Uses the same official parts, plus MOJ side navigation for the record's sections (instead of tabs).
Composed: `app-split`, `app-split__list`, `app-split__pane`: two panes with the selected row's summary (GOV.UK and MOJ have no master-detail layout). Reason: the CPA triage case; the brief flags the cost of width. Pane is a live region; j and k move the selection, n and p move between records; all listed under "Keyboard shortcuts", off switch provided. Plus all of A's composed parts except `app-bulkbar` (bulk assign is its own page here).

## Version C, pipeline first (c-pipeline)
Uses the same official parts. Composed: `app-pipeline` as the front door (Option C), `app-stepper` (lifecycle position as an ordered list with words, not dots), `app-group-head` (state group header with count). Second window: documents open in a named window ("ashbridge-source") that follows later clicks, by plain `target` and a BroadcastChannel message from `app.js`; no part exists in GOV.UK or MOJ for this.

## Rules checked by script (`node build/check.mjs`)
Every local link exists; one h1 per page; only govuk-, moj- and app- classes; no inline style; no em or en dash; unique ids. Not run: axe, keyboard walk, 320 px reflow (needs the build's test rig).

## Not decided here (amber candidates)
Column sets per role; saved views stored per staff account; bulk assign as a bar (A) or its own page (B); whether filler rows need full records in the build (they will).
