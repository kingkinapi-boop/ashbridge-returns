# Version A: docked pane with numbered steps (CPA review), the base component

Pages: `index.html` (work page with the viewer docked at the right), `window.html` (the second window). Made-up data: Maple Ridge Consulting Inc. (Test). Start at `../index.html` for state links. This version is the one viewer every family embeds (panel recommendation); B supplies its decision slot and C its window-first behaviour, and the three share `assets/viewer.js`, `work.js` and `window.js`.

## Structure
Record shell (header, the return region with the identity bar and record tab, then main) over a split: figures at the left, then one pane region "Source viewer" holding the resize handle and the viewer, full height. The viewer is one row of chrome above the page: title and zoom; numbered steps (TB-9, "1 Page, 2 Sheet, 3 QBO, 4 Answer, 5 Reason") with Prev and Next; "Source n of N", kind, name and page; who added it and the words found inside the box. The page area is at least 60% of the screen height at 1366 x 650 and 1093 x 525, in the pane and in the window. The decision slot at the foot holds "Supports this figure, next source" with the key `m` (Reviewed, next): it marks the source in view, never unmarks, steps on, and on the last source goes to the first unmarked source of the figure, then the next unmarked figure, then the "all checked" message (focused and announced).

Page sources open at the largest zoom that keeps the smallest text in the box at least 12 CSS px; if the box cannot be both whole and readable at the pane width, the page opens readable and scrolls to the box's left edge. Zoom in stops where the whole box still shows (never clipped). The size persists per kind for the session. The selection (figure and source), the filter and the list scroll live in the URL and session storage by `history.replaceState`, so a reload or Back returns to the same place with no history entry.

## Clauses and rules met
EV-5, EV-6 (words found in the box, no confidence score), EV-14, TB-7, TB-9, RV-4 (flag evidence listed first), RV-22 (written reason as a source kind), SEC-4 ("SIN on file", no digits), CK-2 ("Not checked: no evidence"). Rules 3 (axe incl. region and landmark-unique), 10, 18, 19, 20, 21, 22, 23.

## Keys (D01's one shortcut list)
`j` next figure, `k` previous figure, `]` next source, `[` previous source, `+` or `=` zoom in, `-` zoom out, `0` fit the box, `m` Reviewed, next, `o` open or bring back the second window, `Esc` back to the figure's row (on a small screen, back to the list). Each repeats a visible button, carries `aria-keyshortcuts`, does nothing in a text field and can be turned off. The divider takes Left and Right arrows, Home, End, Enter (reset).

## Second window
`window.open(url, name)` with no `noopener`. A two-way link: each page says hello on load and answers the other's hello, both beat every 2 seconds and the other counts the window closed after 6 seconds of silence (or at once on a close). Every message carries the return, so another return's work page never drives the window; the window follows the work tab last used on its return. While the window is open and following, the pane hides and the list takes the width; with Follow off, a closed window or a blocked pop-up the pane returns. Sign out from any window goes through a second channel and ends every same-origin page (in the product the server ends the session; the channel is the second line).

## Parts used
GOV.UK Frontend: generic header, skip link, table, tag, button (primary, secondary), details, checkboxes (small), input, label, hint, summary list, inset text, warning text, error summary, visually hidden. MOJ Frontend: identity bar, sub navigation (record tab).

## Composed outside GOV.UK or MOJ (listed in the D00 basis with reason)
- `app-split`, `app-split__left`, `app-split__work`, `app-split__pane`, `app-splitter`: no split view exists in either set; needed to put the viewer beside the work (rule 20). The splitter follows the WAI-ARIA window splitter pattern and sits inside the pane region so no landmark leaves it out.
- `app-viewer` and its parts (`app-viewer__head`, `app-viewer__title`, `app-viewer__zoom`, `app-viewer__steps`, `app-viewer__meta`, `app-viewer__who`, `app-viewer__body`, `app-viewer__stage`, `app-viewer__card`, `app-viewer__foot`, `app-viewer__empty`, `app-viewer--window`, `app-viewer-root`, `app-zoom-level`, `app-meta-who`, `app-meta-ocr`, `app-flagnote`): the viewer itself.
- `app-steps`, `app-steps__btn`, `app-steps__marked`: numbered step buttons for TB-9; GOV.UK has no stepper that changes content in place.
- `app-page`, `app-box`, `app-box--below`, `app-box__label`, `app-skeleton`, `app-ocr`: the page image with the thick outline and the words "Boxed figure"; the box position and the page width are the only inline styles.
- `app-sheet`, `app-cell-boxed`, `app-sheet-wrap`: a grid with one outlined cell (EV-14); GOV.UK table has no cell outline.
- `app-button-compact`, `app-key`, `app-actions`: dense desktop (RV-51).
- `app-table-dense`, `app-row--selected`, `app-summary-strip`, `app-filter`, `app-scroll`, `app-worktop`, `app-counts`, `app-done`, `app-what`: dense list, a visible selected row (word plus bar, not colour alone), the heading, filter and window controls folded into few rows so three or more rows show beside the pane.
- `app-wide`, `app-shell`, `app-shell--stack`, `app-brand`, `app-bar-link`, `app-return`: full-width fixed-viewport shell and the Ashbridge Tax logo link.
- `app-only-narrow`: the Back control under 600 px.
- `app-split--no-pane`: the list takes the full width while the second window follows.
- `app-window-main`, `app-summary-strip--window`, `app-summary-strip--window-top`, `app-keys-inline`: the second window's page layout and the one-line summary shown when the pane is hidden.
