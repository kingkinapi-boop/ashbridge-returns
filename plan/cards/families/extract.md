# Family: reading a document type ({doc})

Phase (the card's own, in plan/slices.json). Where: local or cloud; check: cloud (the Tesseract path on the cloud Linux runner).
Tags: none.

Cards E10 to E25. Deps, paths and clauses: the card's entry in `plan/slices.json`. Read blueprint 03 (EV-5 to EV-7), `src/modules/extraction/_core/` (E01) and the answer files from the matching render card.

## Goal
Turn every "{doc}" document into facts, each with its page and box, checked by arithmetic, so no number enters the return without its source.

## Build
- `src/modules/extraction/{doc}/`: the reader for this document type, on top of the E01 framework. Code first (layout rules, tables row by row); AI only where layout varies, through the AI runner with recorded answers in tests.
- The self-checks this document allows (EV-7): statements add up, balances roll, totals match their lines.
- Each fact names its fact key, origin (EV-10) and source box.

## Acceptance checks
1. EV-6: on every test-world document of this type, every value in the answer file is extracted with the right box, and nothing is extracted that is not in its box.
2. EV-7: a planted arithmetic fault (from the messy set, or a changed total) marks the extraction suspect.
3. EV-5: every fact has exactly one source pointer.
4. The scanned version (Tesseract path) reaches the same facts, or reports what it could not read.
5. Recorded AI answers only; no network in tests.

## Not in this card
Books, mapping or checks.
