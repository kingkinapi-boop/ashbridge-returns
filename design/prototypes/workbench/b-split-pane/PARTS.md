# Version B (round 2, fix round 2): steps on the left, a list in the middle, the detail and the shared source viewer on the right

Written from blueprint commit b9c5003 (v1.1) and the brief `design/briefs/workbench.md` v1.1. Open `queue.html`; every page and state is linked from `states.html`. Main return: Maple Ridge Consulting Inc. (Test). Made-up data only.

## Shape
- Two page loads in the whole task set: the queue (`queue.html`) and the return (`record.html`). Inside the return every step is a client-side route with its own URL (`record.html#/trace`), so a step change is 0 page loads. Choosing a row opens its detail and its source in the pane without a page load, a scroll or a history entry.
- The one record shell (rule 23): identity bar plus record tabs (Overview, Workbench, Review, Documents, History). The workbench fills the Workbench tab. Its steps are a numbered list of steps with counts, not a second tab set. The other tabs belong to other families and open `shell-other.html`, which says so.
- The pane sits beside the list at 1366 x 650 and at 1093 x 525 and stacks only under 720 px (rule 13). It is full height, sticky, and holds the same source viewer on every step (rule 20).
- The steps follow the lifecycle: Checklist, Evidence and facts, Gap review, Books and GIFI, Round trip, Trace, Diagnostics, Exceptions, CPA comments, Hand-off. Tax choices are made in Taxprep and appear in Trace beside the orphans, each with its cite button (TB-6, RV-22, RT-16); there is no separate form for them.

## v1.1 changes from round 1 (findings (a) Workbench B)
1. Books reads QBO's mapping from the uploaded .GFI and shows flags only: not mapped, mapped twice, changed from last year, total code refused (TB-3, TB-12). No AI codes, no confirm button. Round trip is RV-21's six steps with one upload (lock export and printed return). Trace uses RT-14's classes including dropped. Diagnostics are a step of their own, by iFirm category, a named reason for each Warning (RT-17).
2. The `:target` clash is gone (no `:target` anywhere): selection is script state, so the open row is never blanked. The pane is beside the list at 1093 px and a row pick does not scroll the page.
3. Round trip opens on the current step. "Download the import file" works (a real file) and the Checklist strip offers it: queue, name, Download is two clicks and one page load.
4. "Resolve at the number" goes to the cell in Trace. A comment with a drafted fix shows the AI drafted fix with its citations and "Approve the drafted fix" for the preparer (RV-12). Counts come from the rows, so they agree everywhere.
5. Header search opens a results page across returns, accounts and facts. Filters on every list over 5 rows work (queue, facts, accounts, trace, diagnostics). Saved views were removed; "Mine" and "With the CPA" are filters.
6. The SIN shows "SIN on file" (SEC-4). Focus moves into the opened pane. At 320 px the layout stacks and nothing scrolls sideways outside a labelled table region. Every source opens through the shared viewer, with "Send to second window".
7. Inside the one record shell; no Worklists step (only if Zo asks). Bulk verify never includes a fact flagged for a person.

## GOV.UK Frontend 6.5.1 parts used (vendored in `../vendor/`)
Skip link, Generic header (text mark in place of the logo file), tag, task list (Checklist), summary list, table, checkboxes (small), radios (none preselected), text input, textarea, select, file upload, button (including the start button and secondary and warning variants), inset text, error summary and error message, details, footer.

## MOJ Frontend 11.1.0 parts used
Identity bar, sub navigation (the record tabs), notification badge (counts on steps), sortable table (queue, facts, accounts, trace, diagnostics: `aria-sort`, default order set by the brief), search (the header search form).

## Composed outside GOV.UK and MOJ (`app-` classes in `assets/b.css`) and why
- `app-logo`: text mark standing in for the Ashbridge Tax logo file; the Generic header takes a logo image in the build.
- `app-wide`: 1480 px container; GOV.UK's 960 px is too narrow for dense tables on a laptop with two monitors.
- `app-topbar`, `app-topbar__inner`, `app-topbar__name`: service name, menu and search on the one row of the Generic header (fix round 2: they used to be a second bar; the pane needs the height). The Generic header has no search slot and search must be on every screen (RV-50). The search label is visually hidden (the button says Search).
- `app-return-bar`, `app-hold`: the MOJ identity bar as one quiet line, with the hold text. The identity bar is "to be reviewed" in MOJ and wraps badly with seven facts.
- `app-tabs`: wrapper that tightens the MOJ sub navigation used as the record tabs.
- `app-ws`, `app-split`, `app-main`, `app-main-title`: the list-and-detail grid (steps, list, pane). Neither design system has a master-detail layout. `app-split` is the two-column version on the queue.
- `app-steps`, `app-steps__here`: the numbered step list with counts and a current marker; MOJ side navigation scrolls sideways on narrow screens and cannot carry a count and a current marker together.
- `app-pane`, `app-paneset`, `app-item`, `app-pager`: the non-modal right pane, one item per row, with Prev and Next that follow the list (rule 21). No pattern exists.
- `app-item__head`, `app-item__scroll`, `app-item__rest`, `app-item__foot` (fix round 2, W1): the pane is pinned to the screen below the header and does not scroll as a whole. Inside an item: the heading and one line of context, then the source (evidence first), then the rest, which is the only part that scrolls; the decision and its button are pinned at the foot, with Prev and Next on the same row. Added by script (`layoutItem`) so every pane in every step has the same shape. No GOV.UK or MOJ pattern pins a decision beside a source.
- `app-cor`, `app-cor__row`, `app-cor__reason`: the shared cite-or-reason part, `design/parts/cite-or-reason/` (see its README): source radios, then "A written reason" with its box on the same line; typing in the box selects the radio. GOV.UK conditional reveal was not used because it hides the box until the radio is chosen.
- `app-viewer`, `app-viewer__head`, `app-viewer__box`, `app-viewer__box--tall`, `app-viewer__bar`, `app-viewer__cap`, `app-viewer__status`, `app-hl`: the shared source viewer (D03): excerpt with the source line highlighted and scrolled into the box, caption, and the second-window control (title and button on one row, caption clamped to two lines). The highlight has a thick outline, bold text and a hidden "highlighted" label, so it never relies on colour.
- `app-dense`, `app-numeric`, `app-tabular`, `app-scroll`: dense tables at repeat-work height, tabular figures, and a focusable labelled scroll region for tables (WCAG 1.4.10).
- `app-linkbtn`: a real button drawn as a link, for choosing a row without leaving the page or adding history. A link would change the URL.
- `app-row-selected`, `app-row-flag`: selected row; flagged row (thick left edge and the words "Flagged for a person" in its status cell).
- `app-bulk-bar`: sticky bulk action with a count; no pattern exists. It never includes a flagged row.
- `app-next-step`: the Checklist strip that names the one next step with a link or button.
- `app-filter-row`, `app-filtered`, `app-count-line`, `app-actions`, `app-slots`, `app-req`: layout helpers for filters, a row hidden by a filter, "Showing n of m", button groups, slot fields, and the red asterisk on required fields (carried over from the client app).
- `app-keys`: the on-screen key legend; rules need every shortcut listed.
- `app-live`: visually hidden live region that announces results of in-place actions.
- `app-view`: one step's main content, shown by the router.
- `app-held`: page state when someone else holds the return; change controls are hidden, reading stays.
- `app-stage`, `app-stage-on`, `app-proto`: prototype-only. The stage buttons show the return at four points in its life; the proto note marks a stand-in. Not built.
- `app-source-window`: layout of the second window page.

## Prototype behaviour that is not the build
- `assets/b.js` simulates what the build does: client-side routes, in-place actions, bulk verify, the shared viewer, the second window (opened by script, no `noopener`; it follows every selection and step through `postMessage`, a broadcast channel and storage events, and closes on sign-out) and the stage and hold switches. Pop-up blockers: the second window opens on a click.
- Only Maple Ridge opens from the queue; other returns open a stub page that says so. The Overview, Review, Documents and History tabs open a stub that says they belong to other families.
- Errors are shown by the same code a person triggers by pressing a button with an empty field; the "error" states in `states.html` trigger it for you.
- Round trip: uploads are not stored; the file type is checked, so a wrong type shows the error.
- The record's tab set (Overview, Workbench, Review, Documents, History) is provisional until the shared shell (D01) is designed.

## Keyboard
`/` search, `?` list, `n` next row, `p` previous row, `Esc` back to the selected row. Gap review: `K` keep, `E` save slot values, `M` merge, `D` moves focus to Drop (a key never deletes). Every key repeats a visible button, carries `aria-keyshortcuts`, does nothing in a text field, and can be turned off.

## Hooks for the shared checks (`design/verify/`, fix round 2)
`data-identity-bar` is on the MOJ identity bar. `data-evidence` is on the source box in the pane. `data-primary` is on the one button (or link) that decides on that source; `layoutItem` in `assets/b.js` sets it on the first submit or primary button in the pane foot. `data-count` with `data-scope` is on every visible count, and the scope words ("open", "to verify", "not answered", "flagged for a person") are in its text. `build/verify.mjs` runs V1 to V8 at both sizes with these.

## Prototype behaviour added in fix round 2 (not the build)
The pane's height is set by script from where the pane starts (`--app-pane-h`), so its foot is always on screen; the build does the same with a layout rule. The two page-level checks that cannot be written in CSS (the pane stays put when the page scrolls; the source box is inside the pane's visible part) are in `build/verify.mjs`.
