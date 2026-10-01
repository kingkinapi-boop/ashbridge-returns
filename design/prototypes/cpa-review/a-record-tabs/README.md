# Version A: record page, tabs and three panes

The brief's recommended pattern A. One record page per return with tabs in the return's fixed order: Brief, the sections, Flags, Comments, History (and "Changes after rework" when a return comes back). A section tab opens three panes side by side: return (left), trace (middle), source (right). The source can pop out to the second monitor with `w` and follows every click; the laptop keeps all three panes.

Start: `index.html` (or `queue.html`).

## How it handles the tasks
- Brief: three columns (six numbers and tier; pinned flags scrolling inside; largest changes, attestations, assumptions folded). The heading shares a row with the coverage strip.
- Reviewed marks: each tab carries a shape (tick, circle, warning sign) with the status word for screen readers; the section page shows the word, who and when, and the "Mark section reviewed" button (`m`). A changed number removes the mark and the page says why.
- Approve appears in the coverage strip only when every section is marked (`a`); until then the strip lists the sections left as links.

## Parts used
| Part | From | Status |
|---|---|---|
| Skip link, generic header, service navigation, phase banner | GOV.UK Frontend 6.5.1 | stable |
| Table, summary list, summary card, tag, button, details, inset text, error summary, error message, radios (small), textarea, checkboxes (small), notification banner (success) | GOV.UK Frontend | stable |
| Identity bar (corporation, year end, tier, state) | MOJ Frontend 11.1.0 | To be reviewed |
| Sub navigation (the tabs) | MOJ | To be reviewed |
| Badge (flag count, changed count) | MOJ | To be reviewed |
| Alert (warning: back from rework, mark removed) | MOJ | To be reviewed |
| Sortable table (queue, flags) | MOJ | To be reviewed |
| Timeline (History) | MOJ | To be reviewed |

## Composed outside GOV.UK and MOJ (each an `app-` class), and why
| Part | Why |
|---|---|
| `app-panes`, `app-pane` three-pane layout | No GOV.UK or MOJ split view exists (design basis, searched 28 Sep). Panes are labelled regions; they stack below 1280 px. |
| `app-dot` evidence dots | EV-11 needs four evidence levels plus "not checked". Colour, shape (filled circle, hollow circle, triangle, diamond, dashed square) and a word; in the narrow return pane the word is visually hidden and a legend sits above. |
| `app-flag` | EV-12: an open flag shows apart from the dot, never as a dot colour. |
| `app-row--flag`, `app-row--hi`, `app-row--current` | RV-3 and RV-8 highlighting: a thick left rule plus words (visible in the trace, hidden in the row), never colour alone. |
| `app-sheet` spreadsheet grid, `app-page` document page, `app-source-card` | The source viewer (RV-4, EV-14): CSV sources shown as sheet, row and column with the figure boxed by outline plus a "Figure" label; documents as a page with the figure boxed; non-document sources (client answer, CRA capture, adjusting entry, judgment input, last year) as a card, never a blank pane. |
| `app-key`, `app-toolbar` | RV-6 keys shown on screen beside the control they repeat; no GOV.UK or MOJ shortcut pattern exists. |
| `app-coverage` | RV-5 coverage strip: sections left as links, or Approve; no disabled button. |
| `app-dense` | RV-51: 16 px body type for repeat desk work (GOV.UK's smallest size) and tighter padding. |
| `app-scroll`, `app-table-scroll` | Flag list scrolls inside the brief; every table scrolls sideways inside a labelled region at 320 px (WCAG 1.4.10). |
| `app-width-container--wide` | Up to 1600 px for the review screen (design basis). |
| `app-link-button` | Choosing a source from the trace list without a page load. |
| Source pop-out window (`viewer.html`) | The two-monitor follow mode; no GOV.UK or MOJ pattern. |
