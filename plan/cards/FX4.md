# FX4 Spreadsheet reader: the five A07D Opus findings

Phase 1. Size M. Hard. Deps: A07D, SC4. Where: cloud.
Tags: core (citations and amounts: every figure a spreadsheet gives is checked against this text).
Paths: src/modules/sheets/**, src/contracts/sheets.ts
Clauses: EV-14, EV-5, EV-6, ARC-10, END-8
Read: `reports/A07D-opus-read.md` (all), `plan/cards/A07D.md`, `plan/cards/SC4.md`, `.claude/rules/testing.md`.
Spec commit: (spec-writer fills)

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
