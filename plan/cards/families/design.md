# Family: screen design ({screen})

Cards D02 to D13 (D06 parked). Every screen card (V) depends on its design card, and a design card is done only when Zo approves it at a design sitting (RV-53); the Lead marks it done then. Deps, paths and clauses: the card's entry in `plan/slices.json`. Read blueprint 06, `reference/design-basis.md`, `design/basis/` (D00), `design/map/` (D01) and `.claude/rules/staff-screens.md`.

## Goal
A static, clickable design of the "{screen}" screens, with made-up data from the test world, built from GOV.UK and MOJ components in the Ashbridge brand, ready for Zo's design sitting and for builders to match exactly.

## Build
- Versions in `design/prototypes/{family}/<version>/` for the panel and the sitting; the version Zo approves is copied to `design/screens/{screen}/`: plain HTML pages using the D00 styles and components, one per state that matters (empty, normal, many items, error, the flagged case), each titled with the screen name and state.
- A short `notes.md`: what each part is for (clause IDs), keyboard keys, what happens on each button, and every component used with its GOV.UK or MOJ source.
- Real content from the test world, never lorem ipsum. Staff wording is fine here; nothing a client reads.

## Acceptance checks
1. Every clause on the card is visibly met on at least one page.
2. Every component is a GOV.UK or MOJ component or pattern, or is listed in notes.md as a composed one with the reason (RV-52).
3. axe finds no WCAG 2.2 AA issue on any page (RV-54).
4. Works by keyboard alone; focus is always visible.
5. No dead button, placeholder or unexplained field (RV-50).
6. The brief names the blueprint commit it was written from; a lint fails any brief or prototype naming a removed clause or retired term (export 1, export 2, review-lines export, receipt export, gate 1, judgment input sheet, AI-proposed GIFI). A brief older than the last commit touching its clauses is re-checked before design starts.
7. A prototype lint finds no self-link, no `#` link that changes nothing, no control drawn as plain text, no filler text in a data column, and no two counts that disagree.
8. Before pushing, the designer runs axe (contrast "incomplete" counts as a failure until checked), a keyboard Tab walk, 320 px reflow and the budget counter at both sizes of staff-screens rule 18, and reports the numbers.
9. Built on `design/basis/`: listed `app-` parts only, no CSS `zoom`, no third-party fonts; a new part goes into the basis with its reason.

## Not in this card
The React build (V cards).
