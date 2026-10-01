# Version B: source tabs and the decision slot (preparer), an embed variant of A's viewer

Pages: `index.html` (cite figures, and the second record tab verify values, EV-6, at `index.html?tab=verify`), `window.html` (second window). Made-up data: Maple Ridge Consulting Inc. (Test). Same viewer script as A; B changes only the source navigation (MOJ sub navigation tabs) and what sits in the decision slot (`extra`).

## Structure
Same shell and split as A. The sources of a figure are MOJ sub navigation tabs with Prev and Next. The decision slot under the evidence holds, for a figure with no source (an orphan, or a tax choice), its candidate sources in the tabs ("Candidate source 1 of 2") and two ways to settle it in place: "Cite the source shown" (2 clicks) or "Write a reason instead" (details panel, labelled textarea). An empty reason shows the GOV.UK error summary (focused), the same message at the field and "Error: " in the title. A recorded reason is its own source kind: "Reason written by Anita Rao (Test), 1 Oct 2026" (RV-22). After recording, focus moves into the new card, the status becomes Cited, and a button offers the next one to cite. Cites and reasons are kept in session storage so a reload keeps them.

The two record tabs, Cite figures and Verify values, are client routes on one page: pushState, 0 page loads, their own URL (`?tab=verify`), Back and Forward work, and the second window gets the new list. Verify values lists the values read from page 2 of the December statement; the slot holds Accept and Reject beside the box and the words found in it; Accept opens the next value's box with focus in it, and the last one ends on the "every value is checked" message.

## Clauses and rules met
EV-5, EV-6, EV-14, RV-22, TB-7, SEC-4, CK-2 as in A; rules 3, 9 (error pattern, no preselected choice), 10, 18, 19, 20, 21, 22 (no key accepts, rejects or cites), 23 (one record shell, two tabs).

## Keys
`j k [ ] + = - 0 o Esc` as in A. No key cites, accepts or rejects.

## Parts used
GOV.UK Frontend: generic header, skip link, table, tag, button (primary, secondary, warning), details, textarea, label, hint, error summary, error message, form group, summary list, inset text, checkboxes (small), input. MOJ Frontend: identity bar, sub navigation (record tabs and the source tabs).

## Composed outside GOV.UK or MOJ
Those of A (same CSS file, same listed parts), plus:
- `app-reset-button`: the source tabs are buttons wearing `moj-sub-navigation__link`, because choosing a source must not change the page or add a history entry (a link would). MOJ sub navigation is links only.
- `app-viewer__foot--block`: the decision form needs block layout under the card.
