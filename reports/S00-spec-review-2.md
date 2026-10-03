# S00 spec review, round 2 (Opus, cold, 3 Oct)

Spec: claude/S00-refit at e2dca05 (card line d16ce7c), `core/sim.acceptance.test.ts` 105 tests, harness, six goldens. Read against reports/S00-spec-review.md (11 gaps), reports/S00-spec.md (round 4 refit) and `.claude/rules/testing.md`.

## Verdict: GO. All 11 gaps are closed by real tests; the build can open.

## Gap by gap
1. Fail-first: closed. A throwaway stub with the full API and empty bodies (it exists, so nothing fails on an import): 90 of 105 fail, each listed with its line and first failing assertion; the 15 that pass on it are named as fixture checks or vacuous on an empty module (goldens of the reference model, determinism, the four-field line shape, the planted scans, the readsBackAs filter). Each of those is backed by a failing test: the goldens pin the export bytes and `toEqual` pins every line's keys. The full-pass stub then ran all 105 green together on main 0355e1e (1b), whole suite green, none retired.
2. Form and box: closed. GIFI_CASH carries S1599 and 1002, ContactPartner IW and ""; a replaced, an emptied and a cents line assert all four fields; a cell with neither gets "" for both.
3. Property over rate and yes or no cells: closed. Values and `exportedApostrophe(kind, value)` per cell, `' '` and `""` giving N, export length exact; a planted rate apostrophe was caught.
4. Report rule as a property: closed. Random held subset, distinct rows (whole, blank, cents, unknown), lines equal the model in row order, summary exactly when empty.
5. Cents by class: closed. 48600.01, 100.00, .5, -0.01 in a plain and a repeating copy, other rows still import, events exact; the next-copy cents row creates no copy (unconfirmed, named so).
6. Windows-1252: closed. 0x92 and 0x80 counted twice each, no 0xE2; a Latin-1 writer (0x19, 0xAC) fails.
7. Apostrophe and comma in text: closed. O'Brien, "A, B", '-5 round trip byte for byte; the property's text takes `'` and `,`, filtered through F03's own reader (a data filter with a planted check, not a rule).
8. Ident230, Ident451, ContactID: closed, unconfirmed, with lines and events exact; ContactID back to the client code after openReturn().
9. F03 refusal: closed. Unquoted value, `toEqual({ ok: false, faults })` with F03's own faults, events and both exports unchanged; no BOM or UTF-8 case.
10. Refusal reasons: closed for typeCell and clearCell, with nothing changed.
11. Taxprep's real bytes: closed. The day 2 Riverdale file, set up from its own header, exports back byte for byte plus the ContactID row.

No earlier assertion was changed (diff against 39ac95b: only the import line, the textArb regex and the harness doc comment).

## For the Lead (amber, not gaps)
- Gap 1b ran on 0355e1e, not a5475d6: newer main, so stronger.
- Unconfirmed tests (gaps 5, 8, 9 and the earlier RT-7 gap-index ones) flip if the trial shows otherwise: one spec round, named in the test titles.
- The three round 1 wording and by-kind notes in the first review still stand for the next trial day.
