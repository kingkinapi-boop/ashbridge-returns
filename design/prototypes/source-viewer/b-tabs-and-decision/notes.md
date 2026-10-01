# Version B: source tabs and the decision beside the evidence (preparer)

Pages: `index.html` (cite figures), `verify.html` (verify extracted values, EV-6), `window.html` (second window). Made-up data: Maple Ridge Consulting Inc. (Test).

## Structure
Same shell and split as A, but the sources of a figure are MOJ sub navigation tabs with Prev and Next, and the decision sits under the evidence. A figure with no source (an orphan, or a tax choice) shows its candidate sources in the tabs ("Candidate source 1 of 2") and two ways to settle it, in place: "Cite the source shown", or "Write a reason instead" (a details panel with a labelled textarea). An empty reason shows the GOV.UK error summary and the same message at the field; the summary is focused. A recorded reason appears in the viewer as its own source kind: "Reason written by Anita Rao (Test), 1 Oct 2026" (RV-22). After recording, focus moves into the new card, the status becomes Cited, the count updates, and a button offers the next one to cite.

`verify.html`: the list of values read from page 2 of the December statement; Show the box opens the box and the words found inside it; Accept and Reject run in place and focus moves to the next value (rule 19).

## Clauses and rules met
EV-5, EV-6, EV-14, RV-22, TB-7, SEC-4, CK-2 as in A; rules 9 (error pattern, no preselected choice), 10, 18, 19, 20, 22 (no key accepts, rejects or cites).

## Keys
Same as A. No key cites, accepts or rejects.

## Parts used
GOV.UK Frontend: generic header, skip link, table, tag, button (primary, secondary, warning), details, textarea, label, hint, error summary, error message, form group, summary list, inset text, checkboxes (small), input. MOJ Frontend: identity bar, sub navigation (record tabs and the source tabs).

## Composed outside GOV.UK or MOJ
Those of A, plus:
- `app-reset-button`: the source tabs are buttons wearing `moj-sub-navigation__link`, because choosing a source must not change the page or add a history entry (a link would). Reason: MOJ sub navigation is links only.
- `app-viewer__foot--block`: the decision form needs block layout under the card.
