# Version B3b: Trace, Exceptions and CPA comments drawn out (designer 5, cards D08 and D12)

Built on version B (the list-and-detail split, `../b-split-pane/`), which stays as it is. Written from the brief `design/briefs/workbench.md` v1.1 and the lane's rulings A485, A512, A519 and A531. Open `queue.html`; every page and state is linked from `states.html`. Made-up data only (names end "(Test)").

Only three steps are redrawn here: Trace, Exceptions and CPA comments. The other steps are B's, copied unchanged, so a task can still be clicked from the checklist to the hand-off.

## Two returns
- `record.html`: Maple Ridge Consulting Inc. (Test). Trace has 9 open rows in the traced stage (5 orphans, 2 overrides, 1 dropped cell, 1 changed outside the trace) and 38 cells in all; Exceptions has 13 rows (5 red, 8 amber, 8 not answered); CPA comments has 6 comments in 5 sections.
- `record-eglinton.html`: Eglinton Retail Ltd. (Test). Fixed at the traced stage. Trace shows cells linked from another return and an edit to a prior-year cell; Exceptions has 5 rows; CPA comments is empty. Steps this page does not draw open `shell-other.html?step=<step>`, which says so.
- The stage buttons (Maple Ridge only) show the return at import, upload, traced and rework. `?hold=other` shows the read-only held state. `#/trace/error`, `#/exceptions/error` and `#/comments/error` trigger each error state.

## What each of the three steps shows (and the clause it answers)
- **Trace (D08, RT-14 to RT-25, TB-6).** The six classes in words: Traced, Rolled forward, Calculated, Orphan, Overridden, Dropped. Big groups are collapsed and carry a count: traced, rolled forward, calculated, allowed typing, linked from another return, imported from CRA, and the one rounding line (named "rounding"). An edited CRA cell is an override with both values side by side. "Changed outside the trace" (the export differs from the lock) is its own flagged row. Whole dollars everywhere. An orphan opens the cite step: it records exactly one of a source pointer or a written reason. Candidates list "Holds this exact value" first and "Rounds to this value" apart, none preselected; typing a reason selects "A written reason". Tax choices (CCA claim, dividend designation, election, business limit share, loss claim) carry a kind tag and are cited in the same form. A class filter and a "Show tax choices" filter sit above the table.
- **Exceptions (D08, EX-1 to EX-4).** One list, red first then by dollar effect. Each has the three answers Fixed, Explained, Accepted risk (small radios, none preselected), and a source or reason box. "Per client" alone is refused (EX-2) with a message that says what to write. "Use last year's answer" is a button that offers, and is never applied by itself. Accepted risk is tagged "for the CPA to judge"; the preparer's page has no judge control. The new checks CK-38 (slips the return implies), CK-51 to CK-59 and AI-13 appear only as made-up rows in this one list: slips, pre-registration input tax credit, pay to a relative, small supplier limit, late-filing exposure, prepaid expense, quick method, and a grant in suspense. No new screen, and the clause numbers are not printed on the page.
- **CPA comments (D12, RV-1, RV-12).** One h2 per section in the RV-1 order. A simple comment carries a drafted fix tagged "AI draft", with its citations, in two kinds: a fact value (before and after, goes into the next import file) or a Taxprep entry (becomes a to-do for the preparer). Approve draft and Reject draft are offered to the assigned preparer only; Reject needs a reason. "Cannot tell" shows its reason and offers no approve. "Resolve at the number" opens the cell in Trace; a comment about a missing document opens the Documents tab stub. Nothing here clears or closes a comment: the CPA does that.

## GOV.UK Frontend 6.5.1 parts used (vendored in `../vendor/`)
Skip link, Generic header (text mark in place of the logo file), tag, summary list, table, radios (small and inline; none preselected), text input, textarea, select, button (primary, secondary), inset text, error summary and error message, details (the collapsed trace groups), footer. Checkboxes, task list and file upload come from B's other steps.

## MOJ Frontend 11.1.0 parts used
Identity bar, sub navigation (the record tabs), notification badge (counts on steps), sortable table (queue, trace, exceptions: `aria-sort`; exceptions' default order is red first then dollar effect, set by its own clause), search (the header search form).

## Composed outside GOV.UK and MOJ (`app-` classes in `assets/b3b.css`) and why
Everything from version B carries over; B3b adds two classes of its own, `app-cor__group` and `app-inline-field`. It also changes three rules inside the pane for these steps (no new class): Prev and Next sit beside the state line, the secondary detail is a collapsed GOV.UK details ("Flag, effect and how to answer"), and the source caption keeps one line when the screen is under 580 px high.
- `app-cor__group`: the bold line that names a group of candidates in the cite form ("Holds this exact value", "Rounds to this value"). A GOV.UK radios group has no group heading inside one fieldset; a nested fieldset would cost a row at 1093 x 525.
- `app-inline-field`: a label and its textarea on one row (the exception's "Source or reason", the comment's "Reason to reject" and answer box), so the pinned foot of the pane stays about 30 px shorter at 1093 x 525. GOV.UK has no inline label and text area; the label is still a real label for the box.
- `app-cor`, `app-cor__row`, `app-cor__reason`: the shared cite-or-reason part, `design/parts/cite-or-reason/`, read-only here (see its README): source radios, then "A written reason" with its box on the same line.
- `app-logo`: text mark standing in for the Ashbridge Tax logo file; the build takes the image.
- `app-wide`: 1480 px container; GOV.UK's 960 px is too narrow for dense tables on a laptop with two monitors.
- `app-topbar`, `app-topbar__inner`, `app-topbar__name`: service name, menu and search on the one row of the Generic header. The Generic header has no search slot and search must be on every screen (RV-50).
- `app-return-bar`, `app-hold`: the MOJ identity bar as one quiet line, with the hold text.
- `app-tabs`: wrapper that tightens the MOJ sub navigation used as the record tabs.
- `app-ws`, `app-split`, `app-main`, `app-main-title`: the list-and-detail grid (steps, list, pane). Neither design system has a master-detail layout.
- `app-steps`, `app-steps__here`: the numbered step list with counts and a current marker.
- `app-pane`, `app-paneset`, `app-item`, `app-pager`: the non-modal right pane, one item per row, with Prev and Next that follow the list (rule 21).
- `app-item__head`, `app-item__scroll`, `app-item__rest`, `app-item__foot`: the pinned pane. The heading and state line, then the source, then the rest (the only part that scrolls); the decision is pinned at the foot with Prev and Next. B3b adds a compact head (`data-compact`) so the foot of an exception or a comment leaves the source box at least 50 px high at 1093 x 525.
- `app-viewer`, `app-viewer__head`, `app-viewer__box`, `app-viewer__box--tall`, `app-viewer__bar`, `app-viewer__cap`, `app-viewer__status`, `app-hl`: the shared source viewer (D03) with its second-window control; the highlight uses an outline, bold text and a hidden label, never colour alone.
- `app-dense`, `app-numeric`, `app-tabular`, `app-scroll`: dense tables, tabular figures, a focusable labelled scroll region for tables (WCAG 1.4.10).
- `app-linkbtn`: a real button drawn as a link, for choosing a row without leaving the page or adding history.
- `app-row-selected`, `app-row-flag`: selected row; flagged row (thick left edge and the words "Flagged for a person" in its status cell).
- `app-bulk-bar`: sticky bulk action with a count (B's Evidence step); it never includes a flagged row.
- `app-next-step`: the Checklist strip that names the one next step.
- `app-filter-row`, `app-filtered`, `app-count-line`, `app-actions`, `app-slots`, `app-req`: layout helpers for filters, a row hidden by a filter, "Showing n of m", button groups, slot fields, and the red asterisk on required fields.
- `app-keys`: the on-screen key legend; every shortcut is listed.
- `app-live`: visually hidden live region that announces results of in-place actions.
- `app-view`: one step's main content, shown by the router.
- `app-held`: page state when someone else holds the return; change controls are hidden, reading stays.
- `app-stage`, `app-stage-on`, `app-proto`: prototype-only (stage buttons, stand-in note). Not built.
- `app-source-window`: layout of the second window page.

## Keyboard
`/` search, `?` list, `n` next row, `p` previous row, `Esc` back to the selected row. New here: `A` moves focus to Approve draft (never approves), `C` moves focus to the answer box on a comment. Gap review keys are B's. Every key repeats a visible button, carries `aria-keyshortcuts`, does nothing in a text field, and can be turned off.

## Prototype behaviour that is not the build
- `assets/b3b.js` is `b.js` with four changes: a fixed stage for the second return, the "per client" phrase check on exception answers (`data-ban`), the accepted-risk tag, and the listeners for "Use last year's answer", Approve draft and the candidate source preview. `assets/sources3b.js` adds this version's made-up sources to the shared viewer.
- The pages are written by `build/gen3b.mjs` and `build/genresults3b.mjs` from `build/data3b.mjs`, so every count agrees. The build does not need them.
- Approve, Reject, "Use last year's answer" and the answers change only the page's state, not any data. Reload resets it.
- `build/verify3b.mjs` runs the family checks (lint, walk, feat, rules V1 to V8, axe, keys, reflow, budgets).
