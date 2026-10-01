# Version C: window first (two monitors, ops checks), an embed variant of A's viewer

Pages: `index.html` (check items), `window.html` (the viewer on the second monitor). Made-up data: Maple Ridge Consulting Inc. (Test). Same viewer script as A. C's behaviour is now shared by all three versions: while the second window is open and following, the pane hides and the list uses the full width; C is the family that leans on it.

## Structure
The work page is a list of items (documents and CRA captures). Each row holds Show sources, Complete and Chase; the same Complete and Chase sit in the viewer's decision slot so one Tab from the box reaches them. A one-line summary of the source now open shows only while the pane is hidden ("source 2 of 2, Document page, ..."). The heading, count, window controls and filter fold into three short rows so at least three full rows show beside the docked pane at 1366 x 650 and 1093 x 525. The second window uses A's numbered strip (one window layout for every family; the old vertical rail is gone). With no window, a closed one, Follow off or a blocked pop-up, the same viewer docks at the right.

One shared next (rules 19 and 22): after Complete or Chase the next unhandled row after this one in list order gets focus (and its sources show), then the first unhandled above, and after the last one focus goes to "All items checked", which is announced. Complete is absent for an item with no file (rule 8); Chase is always there. State is kept in session storage.

## Clauses and rules met
EV-5 (document page with masked SIN and date of birth, bank statement with the account number blacked out, CRA capture, client answers), TB-9, SEC-4, CK-2 ("Not checked: no evidence" for the Aurora card statement), rules 3, 10, 18, 19, 20 (the window follows every selection, step and Follow toggle; sign-out ends it), 21, 22, 23.

## Keys
As A without `m`; `j` and `k` move between items. `o` opens the window on a user gesture only.

## Parts used
GOV.UK Frontend: generic header, skip link, table, tag, button, details, checkboxes (small), input, label, hint, summary list, inset text, warning text. MOJ Frontend: identity bar, sub navigation.

## Composed outside GOV.UK or MOJ
Those of A (same CSS file), including `app-split--no-pane` (the list takes the full width while the window follows), `app-summary-strip--window` (the one-line summary shown only then), `app-window-main` and `app-viewer-root` (the window's page layout). The old `app-rail*` parts are removed.
