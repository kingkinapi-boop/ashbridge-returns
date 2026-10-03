# Family: test documents ({doc})

Phase (the card's own, in plan/slices.json). Where: cloud (scan bytes are compared on the cloud Linux runner, as W20).

Cards W21 to W38. Deps, paths and clauses: the card's entry in `plan/slices.json`. Read blueprint 03 (documents) and `testworld/render/_core/` (W20).

**Layouts first (decision 0024):** before W21's spec, a research pair and a research checker write `reference/layouts/<doc>.md` for each document kind from public pages only (bank statement guides and samples, CRA slips, payroll, loans): columns, formats, running balances, page carry-over. No client documents. Each render card cites its layout file; its check compares the rendered document with it.

## Goal
Realistic made-up documents of type "{doc}" for every test-world kind that has them, so reading and extraction are tested on something that looks like the real thing.

## Build
- A renderer in `testworld/render/{doc}/` that turns a kind's data into the document (PDF, or spreadsheet and CSV for trial balances), laid out like the real ones Ontario firms see, with every number placed where a reader would expect it.
- Alongside each rendered document, an answer file: every value on it with its page and box, so extraction tests know the truth.
- "scan": a rasterised copy of chosen documents (for OCR tests). "messy": duplicates, a wrong-year statement, a tampered PDF (edited balance that no longer rolls), a missing month, split and merged PDFs.
- Deterministic output (same bytes every run).

## Acceptance checks
1. For every kind that lists "{doc}", the renderer produces the document and its answer file.
2. Every value in the answer file is found at its box in the rendered PDF's text layer (or cell in the spreadsheet).
3. Output is identical across two runs (fingerprint compare).
4. Nothing real: made-up names and numbers only.

## Not in this card
Reading the documents (E10 to E25).
