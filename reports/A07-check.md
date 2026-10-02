# A07 check (cloud-b37146, 2 Oct 2026)

FAIL (3 findings from the Opus adversarial read; I did not re-run its probes myself).

Passed: typecheck, lint, deps:check, npm test (1422 unit, 2 db), 87 A07 tests, scope, spec files unchanged since the spec commit, mutation canary (strong 100, weak 10), mutate:changed A07 (100, 0 survivors), `npm audit --audit-level=high` (4 moderate only: uuid via exceljs, qs). e2e not run (no screens).

Failures:
1. src/modules/sheets/xlsx/index.ts:71 takes a formula's cached value from ExcelJS `cell.text`. Cached 0 and FALSE come back as "", a cached error as "[object Object]". So `cellValueMatches(ptr, "0")` on a zero total says "formula cell: cached value differs" (EV-6, EV-14). Fix: build the text from `cell.result` (number, boolean, `{error}`); add tests for cached 0, false and an error.
2. src/modules/sheets/xlsx/index.ts:100-104 reports hidden rows and columns only through the cells inside them. A hidden row or column with no stored cells leaves no trace (EV-14 "never dropped"). Fix: list hidden row and column numbers per sheet, or emit cells for them.
3. src/modules/sheets/index.ts:46,56: cache key is the fingerprint plus a CSV-looking flag, but the unsupported-file refusal names the file name. The same bytes as "a.pdf" then "b.doc" return a refusal naming a.pdf. Fix: drop the name from the reason or put the extension in the key.

Rule candidate: a cache key must include every input the cached result depends on, including the file name when the result mentions it.
Rule candidate: a reader that reports "hidden" must report it for empty rows and columns too (test with an empty hidden row).

Permission gaps: none.
Model: checker on Sonnet 5.5; adversarial read on Opus.
