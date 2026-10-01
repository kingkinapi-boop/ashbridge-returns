# Version A: docked pane with numbered steps (CPA review)

Pages: `index.html` (work page with the viewer docked at the right), `window.html` (the second window). Made-up data: Maple Ridge Consulting Inc. (Test). Start at `../index.html` for state links.

## Structure
Record shell (identity bar, record tab) over a split: figures at the left, resizable divider, the one viewer at the right, full height. Sources of a figure are numbered steps above the card (TB-9): "1 Page, 2 Sheet, 3 QBO, 4 Answer, 5 Reason", with Prev and Next. The CPA marks each source "Supports this figure, next source"; the status of the row follows (Not checked, Checking n of N, Checked, Flagged for a person, Not checked: no evidence).

## Clauses and rules met
EV-5 (all seven source kinds: figure 1301 has page, sheet, QBO line, client answer, written reason; 2680 has CRA capture, QBO line, last year's return; the box on a page; the grid with the outlined cell), EV-6 (words found in the box, no confidence score), EV-14 (sheet row and column), TB-7 and TB-9 (step through, "Source n of N", kind, name, page, who added), RV-4 (flag evidence shown as its own sources: figure 8000 lists the flag's evidence first), RV-22 (written reason as a source kind, "Reason written by Anita Rao (Test), 30 Sep 2026"), SEC-4 (the T5 draft and statement pages are blacked out in the image; "SIN on file" in words, no digits), CK-2 ("Not checked: no evidence" for Accounting fees, never blank). Rules 10 (keys repeat visible buttons, can be turned off), 18 (no page load, no history entry), 19 (marking runs in place, focus moves to the next source), 20 (beside the work, box scrolled into view and focused, second window by `window.open(url, name)` without `noopener`), 22 (no key marks or unmarks).

## Keys
`j` next figure, `k` previous figure (buttons Previous and Next in the strip above the list), `]` next source, `[` previous source (buttons Prev and Next in the viewer), `o` open or bring back the second window (button Open in second window), `Esc` back to the figure's row (on a small screen, back to the list). The divider takes Left and Right arrows, Home, End, Enter (reset).

## Buttons
Show sources: opens the viewer on that figure, focus in on the box. Supports this figure, next source: marks, moves to the next source, announces. Remove mark: click only. Open in second window: opens the named window; the status line says open, closed ("Window closed, open again") or blocked. Follow (in the window): on by default; off keeps the window on its source and says what the work page now shows. Sign out: closes the window, then signs out.

## Parts used
GOV.UK Frontend: generic header, skip link, table, tag, button (primary and secondary), details, checkboxes (small), input, label, hint, summary list, inset text, warning text, error summary, visually hidden. MOJ Frontend: identity bar, sub navigation (record tab).

## Composed outside GOV.UK or MOJ (listed in the D00 basis with reason)
- `app-split`, `app-splitter`: no split view exists in either set; needed to put the viewer beside the work (rule 20). The splitter follows the WAI-ARIA window splitter pattern.
- `app-viewer` and its parts (`__head`, `__meta`, `__toolbar`, `__stage`, `__card`, `__foot`): the viewer itself.
- `app-steps`: numbered step buttons for TB-9; GOV.UK has no stepper that changes content in place.
- `app-page`, `app-box`, `app-box__label`, `app-skeleton`, `app-ocr`: the page image with the thick outline and the words "Boxed figure"; box position is the only inline style.
- `app-sheet`, `app-cell-boxed`, `app-sheet-wrap`: a grid with one outlined cell (EV-14); GOV.UK table has no cell outline.
- `app-button-compact`, `app-key`, `app-actions`: dense desktop (RV-51).
- `app-table-dense`, `app-row--selected`, `app-summary-strip`, `app-filter`, `app-scroll`: dense list and a visible selected row (word plus bar, not colour alone).
- `app-wide`, `app-shell`, `app-brand`: full-width fixed-viewport shell and the Ashbridge Tax logo link.
- `app-only-narrow`: the Back control under 600 px.
