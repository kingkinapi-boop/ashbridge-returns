# FX4 spec

Worker local-1 (Opus 5.5, laptop). Branch claude/FX4. Spec commit 63df226e, validated on main 25fc96d0 (code identical to 376d8bfa, where the tests ran).

## Tests written (15, clause IDs first)
- `src/modules/sheets/fx4-sums.acceptance.test.ts` (8): item 1, the Opus read totals and a property over cent totals up to 1e15 dollars (seed 20261031); item 2, the two Opus read cycles (joined through a finished node, through `A2 = A1*1`), a cycle-free SUM beside them still snapping, and a property over random SUM graphs whose strongly connected components a fixture oracle computes (seed 20261032); item 3, a 20,000-row running balance `SUM($A$1:A<r>)` inside 30 s and `SUM(A2:XFD1048576)` over terms out to the far corner inside 10 s, both read in a worker so a hang is stopped at its budget.
- `src/modules/sheets/fx4-slide.acceptance.test.ts` (7): items 4 and 5, the Opus read inputs as shared formulas through the reader, by (0, 0), S1 kept beside 5a, and one property per class (seeds 20261034 to 20261037): `'`-escaped structured references, names off the grid as written, names with non-ASCII letters, unquoted 3D sheet ranges.
- Fixtures (spec-owned): `src/modules/sheets/__fixtures__/fx4.ts` (sparse workbooks, SUM graphs, Tarjan oracle), `src/modules/sheets/__fixtures__/fx4-worker.mjs` (the budget harness).
- `tools/test/reading-rules.test.mjs`: every KNOWN entry owned by FX4 removed (R67 x5, R68 x2, R70 x4, R74 x3). The spec owns this file's KNOWN list for this card; the build never edits it.

## On main
13 of the 15 fail for the right reason (a missed cycle member snapped to 253914.88; the reads stopped at 30 s and 10 s; slides giving `#REF!` or sliding names, escapes and sheet names). Four SC4 rule tests fail by name: R67 (tokenizer cases), R68 (cycles), R70 (raw-XML variants), R74 (budgets). Typecheck, lint and deps:check clean; the rest of the unit project green except two laptop-only failures that fail on main too (real-parent symlink EPERM, basis build ESM path on Windows). The db project was not run (the card touches no database code).

## Step 6b (stub sweep)
A throwaway stub (escape-aware brackets, Unicode names, off-grid-as-written names, `:` after a cell, both quote styles and prefixes in raw.ts; Tarjan over every formula, a sorted-cell walk with a work budget, a refusal for a merge over a million cells in index.ts) passed all 15 tests and the four SC4 rules; the whole unit project then had no other failure but the stub's own two regexes (R67-scan, R70-scan) and the two laptop-only ones. Retired tests: none. Stub discarded, never committed.

## Amber (spec choices; also at the top of each test file)
- F1 item 1 is not reachable through the reader: in a 2,000,000-case search no SUM total read anything but its exact cents or its own text (from 2^46 dollars up the half-cent cap only lets a total snap when its cached double is the total's own double, so the snap prints the own text). Its two tests are guards that pass on main; the build still takes the one-line fix. If the Lead wants a failing test, it needs a product hook (for example an exported snap decision), which the card does not ask for.
- F2 cycle members include cycles through non-SUM formulas; F3 budgets are wall time from module load in a worker (a work counter needs a hook the card does not ask for); F4 an over-budget SUM may stay unsnapped (its own text), the first 100 running balances must read exact; "with a reason" is not asserted, as the contract has no field for one.
- F5 to F8 name rules: off-grid-as-written is a name; Unicode letters and digits in names; `'` escapes inside brackets; `X:Y!` is an unquoted 3D sheet range.
- The R70 raw-XML variants and the whole-sheet merge (KNOWN entries "not in the five findings") are in scope because the card's Check asks for "no FX4 entry left in KNOWN". The whole-sheet merge cannot be fixed by our code alone: ExcelJS 4.4.0 expands every merge on load (worksheet.js `_mergeCellsInternal`), so the build either keeps such a merge from the library or refuses the file with a reason (R74 accepts either).
- END-8 needs no new test: the A07 dependency tests (still running) pin the free library.

## For the Lead (Paths gap, SC not landed)
SC's KNOWN list (`tools/test/__fixtures__/schema-contract/known.json`, on claude/SC only) holds 11 entries owned by FX4 (R36, R41, R46, R54 x5, R56 x2). That file is not in FX4's Paths and not on main, so this spec cannot delete them. Whichever lands second must: if SC lands first, FX4 needs `tools/test/__fixtures__/schema-contract/known.json` in its Paths and a spec patch that deletes the 11 entries before the build (the defects are in `src/modules/sheets/**` and `src/contracts/sheets.ts`, inside Paths).
