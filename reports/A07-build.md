# A07 build (cloud-e945f9)
Branch claude/A07. Files: src/contracts/sheets.ts, src/modules/sheets/{index,csv/index,xlsx/index}.ts, unit tests beside them, package.json and lock (exceljs 4.4.0, exact).
Acceptance: all 50 A07 tests pass; 37 own unit tests; full unit suite 1422 plus db 2 green. typecheck, lint, deps:check, scope clean; `npm audit --audit-level=high` exit 0 (4 moderate, all in exceljs's uuid pin; no high). mutate:changed A07: 100.00 on all four marked files.
Amber 1: ExcelJS 4.4.0 is the library (MIT, no install script, no key); the lock diff is large because npm 11 rewrote it. Reverse: swap `xlsx/index.ts` and XLSX_LIBRARY.
Amber 2: ExcelJS gives dates as linear JS dates, so `dateText` turns them back to the file serial and applies the 1900 or 1904 rules itself (29 Feb 1900 included).
Amber 3: a blank CSV line is a row with one empty cell; an unterminated quote is refused; refusals are cached like results (same bytes, same answer); file kind goes by content first (zip, compound file), then by .csv/.tsv/.txt name.
Amber 4: xlsx cells listed are those the file stores per row (merged followers included as empty); `.xls` and password-protected both start with the compound-file header and are told apart by the "EncryptedPackage" stream name.
Note for Lead: an uncaught describe-time throw in a mutated schema reads as "Survived" in Stryker, so schema unit tests build lazily inside each test.
Permission gaps: reading node_modules source was refused (not needed). Model: Sonnet 5.5.
