# SC4 spec report

Model: Opus 5.5 (local worker), worker local-1, 3 Oct 2026.

## What was written

`tools/test/reading-rules.test.mjs`, 17 tests (unit project), clauses EV-14, EV-5, EV-6, ARC-10. Fixtures under `tools/test/__fixtures__/reading-rules/` (an in-memory stored-zip xlsx writer, layout symmetries, planted examples, the R74 worker harness).

- **R67** (3 tests): planted regex slider; tokenizer cases (quoted names, whole rows and columns, strings, brackets, A07D items 4 and 5) plus fast-check properties (identity at (0, 0), quoted and bracket text kept, out and back); a source scan for reference regexes outside a registered tokenizer.
- **R68** (2): planted row-major snap; nested SUM chains under row permutations and the 8 grid symmetries, and four cycle shapes (joined through a finished node, through a non-SUM formula, self, pair).
- **R69** (5): planted BigInt text; every registered number-to-text (sheets numberText, money formatCents, Taxprep rate and amount text) over fc.double plus edge doubles; planted SUM snap printing the double sum (new this round); SUM totals of 1e13 and up read the exact cents of their terms or keep their own text; a source scan for toFixed, toPrecision, toExponential, toLocaleString, Intl and BigInt expansion with no entry.
- **R70** (3): planted reader; single-quoted attributes, namespace prefixes, attributes on value elements and all three, each read as the plain file; a source scan for raw-XML regexes.
- **R74** (2): planted nested loop over A1:XFD1048576 stopped at its budget (its bounded twin finishes); the A07 reader on a 20k-row running balance (30 s), a whole-sheet SUM range (10 s) and a whole-sheet merge (10 s), each in a worker thread stopped at its budget.
- **R56 exemption** (2): planted file; every absolute tolerance in src/contracts and src/modules is a named page-scale epsilon.
- Landing list: E01, B01, T01, L01 (R68) and T01 (R69) must add a registry entry when their folder lands; the rule fails until they do.

## KNOWN (owner FX4 unless named)

R67: items 4, 5a (XYZ100, A1048577), 5b (ÜB1), 5c (Q1:Q4!B1). R68: cycle "joined" member Z, cycle "non-sum" member X. R70: all four variants (0 of 6 cells). R74: all three cases. R69: Taxprep rate text invents digits at 1.00000000001e20 (toFixed(4) from about 1e17 up); F03 and F03R are done, so the Lead names the owner card.

## Validation

Validated on main 7eaf18cf (A07D landed): merged into claude/SC4. `npx vitest run --project unit tools/test`: 11 other files green (211 tests), the 3 SC4 tests that need ExcelJS fail at import because the laptop's node_modules has no ExcelJS (it is in package.json; the junction points to the main checkout's install). With ExcelJS aliased to a stub, 15 of 17 pass; the 2 left (R68 registry, R69 sum) read xlsx through ExcelJS. Their outcomes on A07D were predicted with standalone copies of snapSums on the same layouts: nested chains pass, cycles "joined" and "non-sum" fail (in KNOWN), self and pair pass; R69 sum passes (the snap never reads a cent other than its own text or the exact sum in 2,000,000 searched pairs). R74 outcomes on real ExcelJS are not measured: KNOWN entries match "did not finish" or "failed". So the job is reported without `--validated`: a cloud toolchain refit runs the 3 ExcelJS tests and fixes only what they flag (a KNOWN entry that does not match is stale and fails by name). typecheck and lint do not cover tools/**. 6b: none (new files only; no other test is contradicted).

## Amber

1. R70 KNOWN owner is FX4 though R70 is not among the five Opus findings (same reader file; FX4 is the A07D fix card).
2. R74 adds a whole-sheet merge case (mergedRanges walks every address a merge names; same cause as item 3).
3. R69 sum: "refuses" is read as "keeps its own text" (the reader's observable); a planted double-sum snap shows the rule bites.
4. R67 static scan allows anchored whole-text regexes (SUM_RANGE) and checks the identifier side by scan only.
5. R56 exemption is a separate tolerance scan; SC's R56 file is untouched.
6. The Lead adds tools/test/reading-rules.test.mjs to the Paths of E01, B01, T01 and L01 (landing list).
