# Version B: coverage rail, list and detail

A list-and-detail split. A rail on the left (MOJ side navigation) lists the return: Brief, then the sections in order, each with its mark in words (Reviewed, Not reviewed, Mark removed), then Flags, Comments and History. The section sits in the middle; the detail on the right shows the trace above the source. Nothing needs the second monitor, which stays free for Taxprep or QuickBooks.

Start: `index.html` (or `queue.html`).

## How it handles the tasks
- Brief: one column beside the rail, top to bottom: six numbers and the tier side by side, then pinned flags, then changes and assumptions, then attestations.
- Reviewed marks: always visible in the rail as words, so coverage is read without opening anything; GitHub's "Viewed" file tree is the model.
- Approve: the same coverage strip as A, under the section heading.
- Trade-off: trace and source each get half the right column's height, so long sources scroll more than in A.

## Parts used
Same GOV.UK parts as Version A, plus:
| Part | From | Status |
|---|---|---|
| Side navigation (the rail) | MOJ Frontend 11.1.0 | To be reviewed; the design basis notes its h4 level and reflow issue. Here its section titles are h2 and the rail stacks above the content below 1280 px. |

No sub navigation tabs in this version.

## Composed outside GOV.UK and MOJ, and why
As Version A (`app-dot`, `app-flag`, row highlights, `app-sheet`, `app-page`, `app-source-card`, `app-key`, `app-toolbar`, `app-coverage`, `app-dense`, `app-scroll`, `app-table-scroll`, `app-width-container--wide`, `app-link-button`), plus:
| Part | Why |
|---|---|
| `app-panes--rail`, `app-panes--railpage`, `app-rail-col` | The three-column grid of rail, section and detail; no GOV.UK or MOJ layout holds a rail beside a split. |
| `app-pane__body--half` | Trace and source stacked in one column, each half the screen height. |

No source pop-out in this version (the viewer page still exists for comparison).
