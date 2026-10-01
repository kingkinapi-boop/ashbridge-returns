# Parts used, and what is composed (queues and return record, version A)

Version A is the one kept after the findings review (reports/findings-designs.md, 1 Oct 2026). Versions B and C are kept as folders (`b-split/`, `c-pipeline/`, `build/build-b.mjs`, `build/build-c.mjs`, `_shared/app.css`, `_shared/app.js`) exactly as they were; they are not linked from the index and not built or checked again.

Pages are static HTML built by `node build/build-a.mjs` (no packages) and linted by `node build/check.mjs`. Styles: GOV.UK Frontend 6.5.1 and MOJ Frontend 11 CSS, vendored in `_shared/govuk.css` and `_shared/moj.css`, plus `_shared/a.css` (the Ashbridge look as CSS variables standing in for `design/basis/settings.scss`, which does not exist yet, and the `app-` classes below). No font is loaded from a third party: the page asks for Roboto and falls back to Arial; the build self-hosts Roboto. `_shared/proto.js` is the shared prototype script: it stands in for the build's React behaviour and for MOJ's sortable-table script (both official scripts are ES modules, which Chrome will not load from file://). It holds every in-place action (filter, sort, bulk assign, tab routes, nudge, ops forms, source viewer, list context) so no page repeats them. Data: ten sample clients plus 290 synthetic filler returns (names end "(Test)"); pinned date Monday 8 Jun 2026. Every return, filler included, has a record page.

## Official parts used
GOV.UK: skip link, Generic header, service navigation, table, tag, summary list, summary card, warning text, inset text, notification banner (nudge sent), error summary and error message, form group, select, text input, file upload, checkboxes (small), button, details (keyboard shortcuts), task list, footer.
MOJ: sub navigation (list views and record tabs; the current view is a span, not a link to itself), identity bar, button menu (record actions, real buttons), timeline, badge (counts), alert (approval void), sortable table markup (aria-sort headers).

## Composed outside GOV.UK or MOJ, and why
- `app-logo`, `app-logo__mark`, `app-logo__name`: the Ashbridge logo in the Generic header (stand-in mark; the build uses the logo file from the client app).
- `app-header-row`, `app-search`, `app-search__label`, `app-search__input`, `app-search__button`: header search, in the header row beside the logo so the list starts higher.  GOV.UK has no staff search; made of label, input and button. One match opens the return; more show a results list (`search.html`); none says so.
- `app-filterbar`, `app-filterbar__input`: the list filter on one line (label, box, result count).
- `app-chips`, `app-chip`, `app-chip--clear`: inline filter and toggle buttons with counts, no page load. MOJ's filter reloads the page (RV-52 gap). Real buttons with aria-pressed.
- `app-pipeline`, `app-pipe`, `app-pipe__count`, `app-pipe__label`, `app-pipe__age`, `app-pipe--zero`: the state strip from version C, on top of the Board; real buttons with counts that filter the list. GOV.UK has no count strip.
- `app-bulkbar`: appears only when rows are selected (no disabled button), sticky at the foot of the window, with the error in place. MOJ multi-select and action bar do not keep the list in place.
- `app-tablewrap`: labelled scrollable region around a table so it can scroll sideways at 320 px (WCAG 1.4.10).
- `app-facts`, `app-facts__list`: the record's facts in four columns (a summary list takes twice the height and pushes the tabs below the fold at 1366 x 650).
- `app-since`, `app-since__list`: "Since you last opened this return", first under the identity bar. A bordered block; inset text is for a quote or a note, this is a list of links.
- `app-listnav`: the line with Back to the list, Previous (p) and Next (n), which follow the list you came from.
- `app-linkbutton`: a real button drawn as a link, for choosing a document (an action, not navigation).
- `app-docs`, `app-docs__list`, `app-viewer`, `app-src__hit`: the document list with the source viewer beside it (never below), full height, box scrolled into view, focus moved in, "Send to second window" opened by script. A stand-in for the shared source viewer (D03, not yet designed); replace it when D03 lands.
- `app-steps`, `app-step`, `app-step__head`, `app-step__name`, `app-step__status`, `app-opsform`: the Ops checklist. Each step holds its own in-place form of three fields or fewer. A task list cannot hold a form.
- `app-panel`: one record tab's content; hidden or shown by the client-side route.
- `app-stepper`, `app-stepper__done`: lifecycle position (from version C), an ordered list with words ("Done:" prefix), in the Overview tab.
- `app-money`: tabular figures for money.
- `app-index`, `app-shortcuts`, `app-record`, `app-sourcepage`: prototype index lists, the shortcuts details, and body hooks for the record and source pages.

## Fix round 2, what changed (findings (a), Queues-record)
1. Ops tab per RV-30 and RT-19 (A30: nothing between approval and T183CORP): CRA capture checklist, T183CORP sent, signed certificate upload, check export upload, confirmation number, notice of assessment, each an in-place step. Next-ops-step values are real per state.
2. Back, n and p follow the list you came from (filter, sort, scroll kept in sessionStorage). Enter or `o` opens a row; the preparer lands on Workbench, the CPA on Review, ops on Ops.
3. `search.html`: a results page when more than one return matches; filler returns reachable (every filler has a record page).
4. "Days in this state" and "Days waiting on client"; one date format per column; view badges, chips and strip agree with the rows (checked by `build/check.mjs`).
5. "Since you last opened" first, under the identity bar.
6. Board: state strip on top, filing-week chips (overdue, next 7 days, 8 to 28 days, later; RV-40), the list scrolls into view when a state is chosen.
7. Sticky bulk bar, error in place with the GOV.UK pattern, focus to the next row, result announced; rows flagged for a person have no checkbox; Filed has its own view and is not in Next ops step.
8. Real buttons everywhere (no aria-pressed links, no links drawn as buttons); every table region is labelled for 320 px; focus goes to the nudge banner; sources open in the viewer beside the list.

## Rules checked by script (`node build/check.mjs`)
Retired terms; no self-link, no `#` link to nothing, no link drawn as a button, no filler in a data cell, view badges, chips, strip and captions agree with the rows; one h1, unique ids, no dash, no inline style; only govuk-, moj- and app- classes, each listed here; no zoom, no third-party font in `a.css`. Browser checks (axe, keyboard walk, 320 px, budgets) are in `build/verify.mjs`.
