# Version C: return walk with the source on the second monitor

Built for the laptop plus second monitor. The laptop shows the return section full width; opening a number puts its trace directly under that line. The source lives in its own window (`viewer.html`), opened once with `w` and dragged to the second monitor, where it follows every number. On one screen the source shows docked on the right instead.

Start: `index.html` (or `queue.html`).

## How it handles the tasks
- Brief: a cover sheet. Left: the sections as a GOV.UK task list with their marks, the coverage strip and the tier. Right: six numbers and attestations. Below: pinned flags; changes and assumptions folded. A prompt to open the source window before starting.
- Walking: tabs are only Brief, Walk the return, Flags, Comments, History. Sections are walked with GOV.UK pagination (Previous section, Next section) and `[`, `]`.
- Reviewed marks: in the task list on the brief and on each section; the walk is the coverage order.
- Trade-off: the brief is the longest of the three (it does not fit one laptop screen; see the report), and without a second monitor the docked source is narrower than in A.

## Parts used
Same GOV.UK and MOJ parts as Version A, plus:
| Part | From | Status |
|---|---|---|
| Task list (sections and their marks on the brief) | GOV.UK Frontend 6.5.1 | stable |
| Pagination, block style (previous and next section) | GOV.UK Frontend | stable |

The MOJ sub navigation carries only five tabs here.

## Composed outside GOV.UK and MOJ, and why
As Version A, plus:
| Part | Why |
|---|---|
| `app-trace-row` | The trace opened inline under the line it explains, so the eye stays on the return; no GOV.UK or MOJ row-detail pattern. |
| `app-panes--two`, `app-sticky` | Return and docked source side by side on one screen; the docked source stays in view while the return scrolls. |
| Source window as the main source view | The two-monitor layout is the design here, not an option. |
