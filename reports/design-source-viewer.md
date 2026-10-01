# Design report: the source viewer (D03)

Branch `claude/design-source-viewer`, 1 Oct 2026. Brief: `design/briefs/source-viewer.md` (blueprint commit 0cdcdd4). Prototypes: `design/prototypes/source-viewer/` (start at `index.html`). Data: `reference/sample-clients/01-maple-ridge` (Maple Ridge Consulting Inc. (Test)); the statement rows and sheet rows are read from the real CSV.

Lead's two answers (amber) are built in: the box shows the OCR words found inside it (what AI-4 checks) and never a confidence score; an RV-22 written reason is a source kind in the viewer, "Reason written by <person>, <date>".

## The three versions
| Version | Path | Task | What differs |
|---|---|---|---|
| A | `a-docked-strip/` | CPA check and step through (TB-9) | Viewer docked at the right, full height; sources as numbered steps; CPA marks each source "Supports this figure, next source" |
| B | `b-tabs-and-decision/` | Preparer cites an orphan or tax choice (RV-22); verifies extracted values (EV-6) | Sources as MOJ sub navigation tabs; candidates plus the picker beside the evidence; written reason with the GOV.UK error pattern; second tab verifies values |
| C | `c-window-first/` | Ops checks a document or CRA capture | Viewer lives in its own window with a rail of sources; work page keeps a one-line summary; the same viewer docks when no window is open |

Each shows all seven kinds (document page with box, sheet row and column with the cell outlined, QBO line, client answer, CRA capture, last year's cell, written reason), the step through several sources of one figure (figure 1301 has five), "Not checked: no evidence" (CK-2), the flagged case (figure 8000 lists the flag's own evidence, marked, before the figure's source), the failed state with Try again (December page 3, fails once), the skeleton (CSS delay of 300 ms; a prototype setting loads images in 1.5 s), SIN, date of birth and account number blacked out inside the page images (no digits anywhere), and the second window by `window.open(url, name)` without `noopener`, following over a BroadcastChannel with a Follow toggle, "Window closed, open again", a blocked-pop-up message, and closing on sign-out. Under 600 px the viewer replaces the list with a Back control.

Parts used and the composed `app-` parts with reasons: `notes.md` in each version folder.

## Checks (design.md checks 6 to 9), run headless through `node tools/heavy.mjs`
Script: `design/prototypes/source-viewer/build/check.mjs` (Playwright and @axe-core/playwright, installed in a scratch folder, nothing global).

- **6 Retired terms and brief age:** none of export 1, export 2, review-lines export, receipt export, gate 1, judgment input sheet, AI-proposed GIFI, Judgment tab in the brief or any prototype file. No em or en dash, no filler, no SIN digits ("SIN ending" absent; the answer key's SIN does not appear). Brief names commit 0cdcdd4.
- **7 Prototype lint:** 0 findings. Every href resolves to a file or an anchor on the page; no `#` link; no self-link (the current-page record tab keeps the MOJ `aria-current` link, exempt); one h1 per page; only `govuk-`, `moj-` and `app-` classes, every `app-` class has CSS and is listed in `notes.md`; no inline style in the HTML (JS sets only the box position and page width); counts agree (8, 6, 5 and 4 rows against "of N" text and "Showing n of N").
- **8 axe** (wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa): 86 page-states at 1366 x 650 and 1093 x 525 (every state above, every source of the multi-source figures, the cite error, the recorded reason, all marked, windows, landing, signed out) plus the 320 px views: **0 violations, 0 incomplete**. Eleven runs first reported colour-contrast "incomplete" (cells partly under a scrolling container); each node's contrast was calculated from the computed colours and all are 4.5:1 or better, so none is left open. Earlier runs found and fixed: `aria-label` on a plain div, scroll regions without a focus style, a 19 px sign-out target.
- **Keyboard Tab walk** (both sizes; A 32 stops, B 26, C 34, window 6, verify 31): every stop has a visible focus style (the GOV.UK checkbox shows focus on its label, checked by eye), every target is at least 24 x 24 px, none is hidden by the header or the pane. Opening, stepping (`]`, `[`), next figure (`j`, `k`), the second window (`o`), Escape, the splitter (arrows, Home, End, Enter), Accept and Reject, Complete, Chase and the cite form all work by keyboard. The cite error moves focus to the error summary and the page title starts "Error: ".
- **9 Basis:** only `app-` parts listed in the notes; no CSS `zoom`; Roboto 400 and 700 self-hosted (`assets/fonts`), no CDN. `design/basis/` (D00) is not on this branch yet: `assets/govuk-moj.css` is compiled from govuk-frontend 6.5.1 and @ministryofjustice/frontend 11.1.0 with the palette from `reference/design-basis.md`. **Finding for D00:** MOJ's own `vendor/govuk-frontend/_index.scss` forwards GOV.UK base with fixed configuration, which clashes with a configured `@use` of GOV.UK; I patched that one forwarding file in a scratch copy (forward without `with`) to get the Ashbridge settings into both. The real `src/ui/styles/app.scss` will need the same workaround or a load-path alias.
- **320 px reflow:** nine views (lists, viewers, windows, landing) all fit 320 px with no sideways scroll except tables inside labelled scrollable regions; list and viewer show one at a time with Back (focus returns to the figure's button).

### Budgets (rule 18), measured by script
| Version, size | Clicks to open | Page loads | History added | Box visible after click | Box in view, focus on box | Pane (beside, full height) | Stage height | Step key presses | Escape returns to |
|---|---|---|---|---|---|---|---|---|---|
| A 1366 x 650 | 1 | 0 | 0 | 169 ms | yes, yes | 480 x 650, beside | 324 px | 1 | figure row |
| B 1366 x 650 | 1 | 0 | 0 | 189 ms | yes, yes | 480 x 650 | 368 px | 1 | figure row |
| C 1366 x 650 | 1 | 0 | 0 | 215 ms | yes, yes | 480 x 650 | 405 px | 1 | figure row |
| A 1093 x 525 | 1 | 0 | 0 | 160 ms | yes, yes | 480 x 525 | 199 px | 1 | figure row |
| B 1093 x 525 | 1 | 0 | 0 | 183 ms | yes, yes | 480 x 525 | 243 px | 1 | figure row |
| C 1093 x 525 | 1 | 0 | 0 | 168 ms | yes, yes | 480 x 525 | 280 px | 1 | figure row |
Panes never stack at either size; the divider's minimum is 360 px. "Stage" is the scrolling area of the card under the viewer's own header, steps and caption. A is the tightest (199 px at 1093 x 525) because it carries the steps and the mark button; the page image scrolls inside it with the box centred.

### Second window (script, three versions)
Opens on a click (popup opened in all three); follows a figure change, a source step and a figure change again; a step made in the window moves the work page's pane; Follow off keeps the window on its source and says what the work page is on, Follow on catches up; closing the window shows "Window closed, open again."; sign-out closes the window (all true) and lands on the signed-out page.

## Not settled by this design (for the panel and Zo's sitting)
- At 1093 x 525 the A stage is 199 px; B and C give more. The panel should say if the mark button and steps of A are worth that height.
- The second window is a browser popup; if Zo's browser blocks it, the blocked message shows and the docked pane stays available.
- The shell shows only the record tabs each prototype fills; the full tab set belongs to D01.
- A CRA capture and last year's cell are shown as summary cards (fields), not images; if capture images are kept, they use the same page-with-box card.
