# Design: the preparer's workbench (three versions)

1 Oct 2026. Brief: `design/briefs/workbench.md`. Rules: `.claude/rules/staff-screens.md`, `reference/design-basis.md`. Clauses RV-20 to RV-25, RV-50 to RV-55. Made-up sample clients only (Maple Ridge Consulting Inc. (Test) is the main return; worklists in version C also use Halton, Bluewater, Eglinton Holdings and Danforth rows from the answer keys). Books come from QBO; the trial balance and GIFI mapping are read from it. The preparer makes tax choices in Taxprep; every typed value gets a source with a cite action; lock; one export plus the printed return.

Open `design/prototypes/workbench/index.html`. Pages link to each other; GOV.UK Frontend 6 and MOJ Frontend 11 CSS and Roboto load from cdn.jsdelivr.net, so a connection is needed. No installs. A page list per version is in `states.html`.

## Versions
| Version | Path | Structure |
|---|---|---|
| A | `design/prototypes/workbench/a-record-tabs/` | One return record page, MOJ sub navigation tabs in lifecycle order with count badges, a next-step strip, one job per tab, source panel docked under the table |
| B | `design/prototypes/workbench/b-split-pane/` | Side navigation of steps, one table per step, a non-modal detail and source pane at the right; the queue peeks the same way; Books and Judgment grouped as one step "Tax work" with two parts |
| C | `design/prototypes/workbench/c-worklists-second-window/` | Worklists across returns (accounts, facts, cells, exceptions) with bulk confirm; small return page for checklist, gaps, judgment, round trip, comments and hand-off; sources open in a named second window that follows the clicks |

Each version covers P1 to P10 in task order and these states: normal, flagged (unmapped or unconfirmed account, orphans, what is left), error (judgment, round trip receipt check, exceptions, hand-off, cells), empty (no search results, no documents, zero orphans, no comments, nothing to map), cannot start yet, and held by someone else (read only).

## The brief's three questions, as shown
1. Books and Judgment: two tabs in A; two parts of one step in B; Books a worklist and Judgment on the return page in C.
2. Next step: a list of links in A and C; a single button on the Overview in B.
3. AI drafted state: a tag on the row in A and C (plus an inset at the top in C); an inset on the tab in B.

## Parts used (details and reasons in each version's `PARTS.md`)
- GOV.UK: skip link, Generic header, service navigation, tag, task list, summary card, summary list, table, checkboxes, radios, input, textarea, select, file upload, button, inset text, error summary and message, details, footer.
- MOJ: identity bar, sub navigation, side navigation (B), notification badge, sortable table, search, alert, timeline (A).
- Composed, with a reason each: wide container, search bar, quiet identity strip, next-step strip, dense editable table rows, flagged row, bulk confirm bar, source pane (docked in A, right pane in B, second window in C), split layout (B), key legend, prototype notes. No pattern exists for any of them (RV-52). The Ashbridge palette comes only through GOV.UK 6's CSS custom properties, and a text mark stands in for the logo PNG.

## What I checked
All 78 pages: one h1 each, no duplicate ids, every link and anchor resolves, every field has a label, only `govuk-`, `moj-` and `app-` classes, no inline style, no em dash. Rendered in headless Edge at 1440 px for a page of each version. Not run: axe, the keyboard-only journeys, 320 px reflow, page-load and click budgets (the build's tests do those).

## Known weaknesses to judge at the sitting
- A: the docked source panel sits under a long table, so on a laptop the figure and its source are far apart; best with a second monitor or a taller window.
- B: three columns are tight on a laptop alone (the pane drops below the list under 1100 px); strongest for P2, P3, P7 where each row needs its evidence.
- C: fastest for batch mapping and verifying, but the single-return story is spread over worklists and a small return page; depends on a second monitor for the source window.
- Prototype only: other returns do not open; later steps show their working state with a dashed "Prototype note" instead of "Cannot start yet" (one blocked example per version); the `:target` pane jumps the page a little where the build would not.

## Questions for the sitting
- A with C's worklists as a top-level tab (the brief suggests this): wanted?
- Is the source in a second window by default on two monitors, with the docked or right pane as the laptop fallback?
