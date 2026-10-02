# A01 build round 3 (cloud-8ec957, 2 Oct 2026)

Branch claude/A01, merged main (F01D landed, `isBlank` in src/contracts/text.ts).
- `textlayer/index.ts` drops blank items and blank tokens with `isBlank`; no `trim()`. The false Stryker disable at the old line 70 is gone; one true-reason disable on the token guard (pdfjs ends an item at an invisible character, so a blank token cannot sit in a non-blank item).
- `src/contracts/reading.ts` WordSchema uses the same `isBlank`.
- New unit test in `textlayer.geometry.test.ts` (invisible tokens inside a line make no word). No acceptance test edited.
- Numbers: typecheck, lint, deps:check clean; `src/modules/ocr` + `src/contracts` 1664 tests pass (30 files); ocr + reading 221 pass; `mutate:changed A01` 100 (131 killed, 0 survived); scope OK; `npm audit --audit-level=high` 0.
- Amber: none. Findings-reviewer notes (fingerprint trust, store per engine) carried to A02/A03 as the card says.

## Permission gaps
None.

## Model
Sonnet 5.5.
