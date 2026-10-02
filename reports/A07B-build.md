# A07B build

Branch claude/A07B (head: see the push; commit message "A07B build"). Worker cloud-91dc0c.
Files: src/modules/sheets/index.ts, src/modules/sheets/xlsx/index.ts; new tests src/modules/sheets/route.test.ts and src/modules/sheets/xlsx/a07b.test.ts.
Acceptance: a07b.acceptance.test.ts 27 passed, 1 skipped (A01's reader test, runs once src/modules/ocr exists). Full suite 1584 passed, 1 skipped, 55 files.
typecheck clean; lint clean; deps:check no violations; scope.mjs A07B OK (51 files inside paths).
mutate:changed A07B: all four changed files 100 (index.ts, xlsx/index.ts, csv/index.ts, contracts/sheets.ts).
Built: numberText snaps within 4 ulps (min 1e-9, capped at 0.0025); non-finite number reads as error "#NUM!"; rich-text hyperlink text; non-workbook zips refused with the fixed reason "not a workbook (not a readable .xlsx file)" (no library text); "PK" bytes under a CSV name try the workbook then fall back to CSV.
Ambers: (1) error code for a non-finite number is "#NUM!" because the pinned library drops the stored text; reverse by changing NOT_A_NUMBER. (2) A .docx or zip named .csv/.txt falls back to CSV and reads as text, as the card says "falls back". Reverse: restrict fallback by a fixed check.
Setup note: this sandbox refused `source nvm`; used /opt/nvm/versions/node/v24.21.0/bin/node directly.
Unresolved: none.
