# FX4 spec

Worker local-1 (Opus 5.5, laptop). Branch claude/FX4.

- Round 1: spec commit 63df226e, validated on main 25fc96d0 (15 tests).
- Patch (Lead directive A434, the 11 gaps of reports/FX4-spec-review.md): see the card's "Spec commit" line for the commit; validated on main 83737283. 40 tests in four files.

## Tests (40, clause IDs first)
- `src/modules/sheets/fx4-sums.acceptance.test.ts` (17). Item 1: the Opus read totals through the reader; property seed 20261031, now log-uniform from 1e12 to 1e17 cents (gap 10); `centText` pinned directly: 7053684657509001n has no text, 4689734153625260n reads `46897341536252.6`, small examples, and property seed 20261040 (exact text or nothing; always a text below 1e15 cents). Item 2: the two Opus cycles and the cycle-free total; a cycle across two sheets (`Other!A1`, `'Cells (Test)'!A1`) and the same sheets with no cycle, which must snap to 253919.88 (gap 4); property seed 20261032 with node kinds `$A$n+0`, `IF`, `ROUND`, `AVERAGE(range)`, `SUM(range,0)`, `'Cells (Test)'!An*1` and `SUM($A$lo:$G$hi)` (gap 4); property seed 20261039 over acyclic graphs with Excel-true cached values: a SUM whose cells read as exact cents must snap (gap 6, a guard that passes on main); a 50,000-cell ring through `A<r+1>*1` read in-process (gap 5). Through `snapSums`: both Opus cycles and a self-reference skipped with reason `reference cycle`, and a 50,000-SUM ring, all skipped, no recursion (gaps 5 and 8d).
- `src/modules/sheets/fx4-walks.acceptance.test.ts` (12). Item 3 by work counts, each `snapSums` run in a worker only as a hang stop: `SUM_WORK_LIMIT >= 1_000_000`; the 20k running balance within `limit + cells`, each balance exact or skipped `over the work limit` with its own text; every balance k with k(k+1) within the limit exact; 20k rows of `SUM($A$1:$B$20000)` within the limit, C1 exact; the whole-sheet range reads at most the cells that exist, skips nothing, reads exactly `253914.88` (gap 7); a limit of 3 against six terms skips with the reason. `SUM(A2:A1048576)` and `SUM(A2:XFD2)` exact (guards). Two smoke reads through the reader at the S6 30 s budget. Merges (gap 9): `A1:XFD1048576` and 2,000 merges of 1,000 cells refused inside 10 s with a reason that says merge, names no library message and no file name; `A1:XFD1` reads.
- `src/modules/sheets/fx4-slide.acceptance.test.ts` (8). The Opus inputs plus `B1Ü*2`, `ÉB1*2`, `税B1*2`, `𝐀B1*2`, `SUM(Q1:Dec!B1)`, `Q1!B1+A1` through the reader (gaps 1, 2); property seed 20261035 adds 4-to-7-letter columns and run-on names (gap 3, passes on main); new property seed 20261038 over non-ASCII letters, combining marks and numbers, astral ones included, before, inside and after a cell-shaped run (gap 1); seed 20261037 now draws sheet names from four kinds, one or two sheets, and cells or areas with `$` parts after `!` (gap 2).
- `src/modules/sheets/fx4-engine.acceptance.test.ts` (3, ARC-10, gap 11): `READER_RULES` a whole number from 1; every .xlsx result stamped `{ name: 'exceljs', version: '4.4.0+rules.<N>' }`; the derived text of a fixed corpus matches `src/modules/sheets/__golden__/reader-rules.<N>.json`, so a change to derived text needs a new number and a new golden. The ARC-10 tag left the item 3 time tests.
- Spec-owned files: `src/modules/sheets/__fixtures__/fx4.ts` (now also several-sheet workbooks, in-memory cells, Excel-true acyclic graphs, the worker runner), `src/modules/sheets/__fixtures__/fx4-worker.mjs` (now also a `snap` job), `src/modules/sheets/__golden__/reader-rules.1.json` (new), and the KNOWN list of `tools/test/reading-rules.test.mjs` for this card (unchanged since round 1).

## On main 83737283
34 of the 40 fail by name for the stated reason: `does not export snapSums / centText / SUM_WORK_LIMIT / READER_RULES`, missed cycle members snapped to 253914.88, slides that move names, escapes and sheet names, reads stopped at their budgets. Six pass by design (guards): the two item 1 reader tests, the two-sheet acyclic example, the acyclic property, the whole-column and whole-row sums, and the `A1:XFD1` merge read. SC4's R67, R68, R70 and R74 still fail by name (round 1 removed their FX4 entries). Typecheck and lint clean. Other unit failures: the laptop-only three that fail on main too (RV-52 basis build, two real-parent symlink tests).

## Step 6b (stub sweep)
A throwaway stub (Unicode name classes and a 3D sheet prefix in raw.ts, `'` escapes in brackets, off-grid-as-written names; in index.ts `centText`, an iterative Tarjan over every formula's references across the workbook, a sorted per-column walk with a work counter, the merge-area cap before load, `READER_RULES = 1`) passed all 40. The whole unit project then failed only the stub's own regexes (R67-scan, R70-scan), R70 (the stub left out the raw-XML variants FX4 also owns) and the three laptop-only tests. Retired tests: none. Stub discarded, never committed. The golden was written from the stub and checked against the hand-pinned expectations (every corpus cell is pinned by another test).

## Amber (spec choices; also at the top of each test file)
- F3/F4: budgets are work counts; `visits` counts every cell a range walk reads, cycle search included; SUMs are taken in sheet order; k(k+1) within the limit (two reads per term) must be exact. Both smoke reads have the S6 30 s budget: ExcelJS 4.4.0 alone takes about 5 s on the laptop to load a sheet reaching row 1048576, so 10 s flaked under full-suite load with a correct stub.
- F9: a SUM over cells that read as exact cents must snap; any other SUM reads exact or own.
- F10: the merge cap is the total merged area of the workbook, over 1,000,000 cells refused before load (one region over the cap is the same refusal; the stub's figure, A434 says "over 1,000,000 cells").
- F6: names starting with a combining mark or a digit are not drawn (Excel refuses them; their text is not settled).
- F11: the rules golden lists only cells other tests pin exactly; the item 1 totals stay out.

## For the builder (not required by a test)
- The reader's row loop (`eachRow({ includeEmpty: true })` and `hiddenRows`) visits every row up to the sheet's extent; with one cell at row 1048576 it costs about 4 s on top of ExcelJS's load. Walking only the rows the sheet stores keeps the far-corner smoke well inside its budget.
- R67-scan and R70-scan flag any new formula or raw-XML regex in a product file without a registry entry: the cycle search should take references from raw.ts's tokenizer, and a merge scan should live in a registered raw-XML reader.

## Still to do (Lead directive A434)
SC's KNOWN entries owned by FX4 (`tools/test/__fixtures__/schema-contract/known.json`, 11 entries) wait for SC to land; a second spec patch deletes them before the build.

## Refit (cloud-aab122, 3 Oct)
Validated on main 164d8d66 (merged, no conflicts). typecheck and lint clean. sheets unit: 34 of 438 fail, all FX4 tests failing for the right reason (READER_RULES, snapSums, centText missing); tools/test adds only the known R18 failure (other cards lack // @mutate). No assertion changed.
