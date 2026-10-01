# Brief: the source viewer (card D03)

Written 1 Oct 2026 from blueprint commit 0cdcdd4 (origin/main), clauses EV-5, EV-6, EV-14, TB-7, TB-9, RV-4, RV-22, SEC-4, rules 18 to 23. Role: design research only. Family: the one viewer that the CPA review, the workbench and the queues and record embed (R5 of reports/findings-designs.md).

## Why one viewer
The three designers each invented a viewer: a new window per click, a pane docked under a table, panes that stack below 1100 px, a fixed pane that never scrolled to the box, a second window that went stale on a section change, a flag that showed the number's source instead of its own evidence, and "SIN ending 456" (breaks SEC-4). D03 is designed once, panelled, then embedded; no family draws its own.

## Research (pages opened, 1 Oct 2026)
- DataSnipper, "How to add a Validation Snip" (search result, page body not readable here): the tick mark in the cell is linked to the rectangle drawn on the PDF; stored in the workbook. Copy: the cell-to-box link is the unit, not the page. Avoid: nothing in their help shows the click-back behaviour, so we spec it ourselves. https://knowledge.datasnipper.com/how-to-validate-data-on-a-document ; Excel Online snips page opened, silent on viewer behaviour: https://knowledge.datasnipper.com/how-to-use-snips-in-datasnipper-excel-online
- Caseware Working Papers, "Create tickmarks" (opened): tickmarks and document references are annotations on a line; hover shows who added it and when. Copy: who and when on every pointer (RV-11). https://documentation.caseware.com/2022/WorkingPapers/en/Content/Engagements/Review-Signoff/Annotation/Create-Tickmarks.htm
- Microsoft Dynamics 365 Invoice capture side-by-side viewer (opened, same pattern Hubdoc and Dext sell; their own help pages were not opened, only a comparison search): fields left, original document right; an eye icon beside a field positions and highlights the value on the document; page, zoom, fit and rotate controls top right; draggable resize line; colour states for mapped and unmapped values; confidence thresholds. Copy: one control per figure that jumps and boxes; resizable divider; page and zoom controls. Avoid: lines paged five at a time, and edit mode inside the viewer. https://learn.microsoft.com/en-us/dynamics365/finance/accounts-payable/invoice-capture-workspace
- PDF.js (opened): viewer URL hash takes `page`, `nameddest`, `zoom`, `pagemode`; no rectangle in the hash. The viewer object's scrollPageIntoView takes a destination array with fit type `XYZ` or `FitR`, in PDF coordinates (GitHub issues 6947, 9704, search result only). Implication: we draw our own overlay box from stored box coordinates and call scrollPageIntoView; do not rely on URL hashes. https://github.com/mozilla/pdf.js/wiki/Viewer-options
- W3C APG window splitter (opened): role `separator`, aria-valuenow, min, max, label, aria-controls; arrow keys resize, Enter collapses, optional Home, End, F6. Use for the pane divider. https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/
- MDN window.open (opened): a named target reuses one window; needs a user click each call; returns null when blocked; `noopener` breaks the link back. https://developer.mozilla.org/en-US/docs/Web/API/Window/open
- MDN BroadcastChannel (opened): same-origin windows message each other; baseline since 2022; sender does not hear itself. Use to make the second window follow every selection. https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel
- Not found: any accessible-viewer standard beyond the above; a screen-reader name for "boxed figure" must be our own (see budgets).

## Task scripts
| Role | Task | How often | Sees together | Decides | Next |
|---|---|---|---|---|---|
| CPA | Check a number against its source | dozens per return | return cell, trace, source with box | agrees, comments, marks | next number (`j`) |
| CPA | Step through all sources of one figure (TB-9) | several per return | trace list, source n of N | each source supports it | next source |
| Preparer | Cite a tax choice or orphan (RV-22) | a few per return | the figure, the picker, the evidence | pick source or write a reason | record, next orphan |
| Preparer | Verify an extracted value (EV-6) | many | value, box, OCR words | accept or reject | next value |
| Ops | Check a document or CRA capture | per return | the item and its source | complete or chase | next item |
Source kinds, one viewer (EV-5): a document page with a box; a sheet, row and column (EV-14, shown as a grid with the cell outlined); a QBO line (account or transaction, dated snapshot); a client answer; a CRA capture; last year's return cell; a written reason (author, time). Anything without evidence shows "Not checked: no evidence" (CK-2), never a blank.

## Budgets (measured at 1366 x 650 and 1093 x 525, rule 18)
- Open a source: 0 page loads, 1 click or 1 key, visible in under 1 s (first paint of the page image or card; skeleton after 300 ms; failed state with a retry).
- Box scrolled into view and focus moved in on open; Escape returns focus to the figure it came from. No history entry added.
- Step to next or previous source: 1 key (`]` and `[`), shows "Source 2 of 4", with kind, name, page and who added it.
- Second window: opened by one click or `o` on a user gesture, named, no `noopener`; follows every selection and tab change; a "Follow" toggle; a visible "Window closed, open again" state; closes on sign-out.
- Beside the work, never below: pane at the right, resizable divider (APG splitter), minimum 360 px; at 1093 wide it narrows the trace, it never stacks. Under 600 px it becomes a full-width view with a Back control.
- SIN, date of birth, banking details masked in the page image itself (black out the boxes server side before the image leaves, SEC-4); no digits in alt text, labels or titles: "SIN on file".

## Pattern options (design 2 or 3, the designer decides)
1. Docked right pane, second window optional (Dynamics split viewer). Copy the divider, page and zoom controls, eye-style "show me" per figure. Avoid: a separate edit mode. Fits all three families with one component.
2. Right pane plus a persistent trace strip above it listing the figure's sources as numbered steps (Caseware annotation list, TB-9). Copy: numbered steps and who and when. Avoid: a list that scrolls out of view.
3. Two-monitor default: the viewer is its own window, a small summary in the work page (DataSnipper snip-to-cell idea turned around). Copy: the follow channel. Avoid: popup blockers, a lost window; so needs option 1 as the laptop fallback.
GOV.UK and MOJ: no split-view part exists, so compose with MOJ sub navigation for sources, GOV.UK pagination for step, summary list for non-document cards, tag for kind, inset text for the reason.

## Shared parts and tests to design in
One component with source-kind cards, one overlay box (thick outline plus the words "Boxed figure"), one stepper, one Follow control. Rule tests for the designer: axe clean with "incomplete" zero, keyboard Tab walk, 320 px reflow, no `zoom`, and a lint that no page draws its own viewer.

## Questions (for the Lead, not Zo)
Does the box carry a confidence or OCR text for the CPA (EV-6)? Does a reason (RV-22) show beside the figure or in the viewer? Settle in the card; both are amber.
