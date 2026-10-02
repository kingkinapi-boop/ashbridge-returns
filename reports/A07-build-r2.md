# A07 build round 2 (cloud-575f8d)
Branch claude/A07. Files: src/contracts/sheets.ts, src/modules/sheets/index.ts, src/modules/sheets/xlsx/index.ts, new unit tests src/modules/sheets/xlsx/typed.test.ts. No acceptance test edited.
Acceptance: all 26 round-2 tests and the round-1 ones pass (sheets: 121 tests); full unit suite 1545 green. typecheck, lint, deps:check, scope clean; `npm audit --audit-level=high` exit 0 (moderate only, as round 1). mutate:changed A07 (incremental cache cleared): 100.00 on all four marked files.
B1 `typed()` is the one switch from library value to text (number via `numberText`, boolean, date, string, error, rich text, hyperlink), for plain and cached values; `cell.text` is gone. B2 hiddenRows from row records, hiddenColumns from column definitions (spans expanded). B3 cache key fingerprint:route (compound, zip, csv, unsupported), no file name in reasons, structuredClone on read. B4 schemas: no trim transform (refine only), `error` type, `cached`, hidden lists, `formula cell: no cached value`.
Amber 1: `numberText` is String(x) except within 1e-9 of a whole cent (cent digits, BigInt from 1e21). Reverse: drop the cent branch in xlsx/index.ts.
Amber 2: three Stryker disables with reasons (equivalent mutants: unused early-return, `?.`, sort and fallback in hiddenColumns, route label). Reverse: delete the comments and add tests.
Note: Stryker's incremental file does not see a newly added test file; delete reports/mutation/stryker-incremental.json before mutate:changed after adding tests.
Permission gaps: none. Model: Sonnet 5.5.
