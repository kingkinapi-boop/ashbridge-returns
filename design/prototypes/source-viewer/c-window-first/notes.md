# Version C: window first (two monitors, ops checks)

Pages: `index.html` (check items), `window.html` (the viewer on the second monitor). Made-up data: Maple Ridge Consulting Inc. (Test).

## Structure
The work page is a list of items (documents and CRA captures) with Complete and Chase the client in the row, plus a one-line summary of the source now open ("source 2 of 2, Document page, ..."). The viewer lives in its own window: a vertical rail of sources at the left (each shows "Source n of N" and its kind), the card at the right, Follow at the top. While the window is open and following, the work page uses its full width. If no window is open (or it is closed or blocked), the same viewer docks at the right as the laptop fallback, so nothing is lost; when the window closes the page says "Window closed, open again". Complete is absent for an item with no file (rule 8); Chase the client is always there.

## Clauses and rules met
EV-5 (document page with masked SIN and date of birth, bank statement with the account number blacked out, CRA capture, client answers), TB-9 (steps in the rail), SEC-4, CK-2 ("Not checked: no evidence" for the Aurora card statement), rules 10, 18, 19 (Complete and Chase run in place, focus moves to the next row), 20 (the second window follows every selection, every step, and a Follow toggle; closes on sign-out), 22.

## Keys
As A, except `j` and `k` move between items. `o` opens the window on a user gesture only.

## Parts used
GOV.UK Frontend: generic header, skip link, table, tag, button, details, checkboxes (small), input, label, hint, summary list, inset text, warning text. MOJ Frontend: identity bar, sub navigation.

## Composed outside GOV.UK or MOJ
Those of A, plus `app-rail`, `app-rail__btn`, `app-rail__kind`, `app-rail__step`: the vertical list of sources used only in the window; GOV.UK has no vertical stepper. `app-split--no-pane`: the work page uses full width when the window is open. `app-window-main`, `app-viewer-root`: the window's page layout.
