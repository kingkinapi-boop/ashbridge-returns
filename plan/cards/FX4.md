# FX4 Spreadsheet reader: the five A07D Opus findings

**Lead ruling, 3 Oct 12:50Z (A470), on the refit-2 note:** all 11 FX4 rows in `tools/test/__fixtures__/schema-contract/known.json` (R36, R41, R46, R54, R56) name files inside this card's Paths (`src/modules/sheets/**`, `src/contracts/sheets.ts`), so they are this card's to fix, whether or not they are among the five A07D findings (A434). The spec job deletes all 11 rows (each SC rule then fails naming its file) and fills the Spec commit line; the build fixes each through `src/contracts/text.ts` and typed value switches; a row FX4 still owns after landing would fail SC's owner rule (A467).

**Lead directive, 3 Oct (A434): spec patch for the 11 gaps in reports/FX4-spec-review.md (on claude/FX4), then the build waits for SC to land and a second patch deletes FX4's entries in SC's known.json.** Export `snapSums(cells, limit)` returning `{visits, skipped:[{row,column,reason}]}` and `centText(cents)` so budgets are work counts, not wall time, and item 1 is testable (7053684657509001n ends `.01`). Cycles: range and cross-sheet edges, a 50,000-cell ring (no recursion), an acyclic SUM still snaps. Names: Unicode in any position (`B1Ü*2`, `ÉB1*2`), off-grid names past three letters; the generator draws unquoted 3D ranges (`SUM(Q1:Dec!B1)`). The whole-sheet range test must tell a snapped total from the cell's own text. A merge region over 1,000,000 cells is refused with a reason, never loaded (tested). ARC-10: the reader's engine version gains a rules suffix (`exceljs 4.4.0+rules.N`), bumped when derived text changes; tested. A whole-sheet merge ExcelJS would expand is a flag for a person, not a silent pass.**

Phase 1. Size M. Hard. Deps: A07D, SC4, SC. Where: cloud.
Tags: core (citations and amounts: every figure a spreadsheet gives is checked against this text).
Paths: src/modules/sheets/**, src/contracts/sheets.ts, tools/test/reading-rules.test.mjs, tools/test/__fixtures__/schema-contract/known.json
Clauses: EV-14, EV-5, EV-6, ARC-10, END-8
Read: `reports/A07D-opus-read.md` (all), `plan/cards/A07D.md`, `plan/cards/SC4.md`, `.claude/rules/testing.md`.
Spec commit: 5005db5c (patch A434: 40 tests in src/modules/sheets/fx4-sums, fx4-walks, fx4-slide and fx4-engine acceptance files, golden __golden__/reader-rules.1.json; round 1 63df226e removed FX4's 14 KNOWN entries from tools/test/reading-rules.test.mjs), validated on main 83737283. SC's 11 FX4 entries in schema-contract/known.json wait for SC to land (reports/FX4-spec.md)

## Goal
A07D lands with five findings from its Opus read (amber A393), none a wrong figure below $10 trillion. This card closes them, and only them. Landing rule (as A07D): if a fix fails its check once, the fallback is a removal (leave the figure unsnapped, or keep the formula text from the cell as written), never another round.

## The findings (reports/A07D-opus-read.md)
1. **Cents text at 16 or more significant digits** (index.ts, the snap writes `String(Number(cents)/100)`): snap only when the shortest text of the total equals the exact cent text; above that band the total keeps its own text.
2. **Cycle members missed**: a SUM that joins a cycle through an already finished node, or a cycle through a non-SUM formula, is not marked. Use strongly connected components (iterative, no recursion); every member of a cycle is unsnapped.
3. **Quadratic or unbounded range walks**: a running balance `SUM($A$1:A<r>)` at 10k rows takes 16 s; `SUM(A1:XFD1048576)` hangs. Walk only cells that exist inside the range (bounded by the sheet's extent); a SUM still over budget is left unsnapped with a reason.
4. **Structured-reference escapes**: the bracket reader ignores the `'` escape (`Table1[Col'[1]`).
5. **Name versus reference**: a name past XFD or row 1048576 is a name, not `#REF!`; names with non-ASCII letters (`ÜB1`) do not slide; an unquoted 3D range (`Q1:Q4!B1`) is a sheet range, not a cell.

## Spec
One acceptance test per finding, each with the failing input from the report, plus a property per class: 1 as a property over cent totals up to 1e15 (text maps back to the exact cents or the figure stays unsnapped); 2 as a property over random SUM graphs with cycles (every SCC member unsnapped); 3 as a time budget (20k-row running balance and a whole-sheet range under the S6 budget, clock pinned to work counts, not wall time, where possible); 4 and 5 through SC4's R67 tokenizer rule.

## Check
A checker who did neither, plus an Opus adversarial read: every finding's input gives the right result, SC4's rules green with no FX4 entry left in KNOWN, mutation 100 per `@mutate` file.

## SC KNOWN entries (3 Oct, A407)
SC lands with exact KNOWN entries owned by this card (reports/SC-findings.md, fix list step 3). Each defect fixed here deletes its entry; never widen an entry or weaken a rule (A329).
