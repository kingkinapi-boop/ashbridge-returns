# A07 check round 2 (cloud-eb1e31, Node 24, claude/A07 at 93ab657)

FAIL. Steps 1 to 6 and 7 clean: typecheck, lint, deps:check, full unit (1543) and db (2) pass; sheets 121 tests pass; scope OK; spec files unchanged since b47d477 (builder added xlsx/typed.test.ts, a new file only); npm audit --audit-level=high exit 0 (2 moderate, qs and uuid, transitive); mutation canary 100, mutate:changed A07 100 (540 killed, 11 timeout, 0 survived).

Opus adversarial read of the diff found defects the tests miss (probed with scratch scripts):
1. xlsx/index.ts:49-51 numberText (S6 float rule): fixed 1e-9 snap is below one float step above ~8.4M. 9000000.1+0.2 reads "9000000.299999999"; 123456789.12+0.01+0.01 reads "123456789.14000002". normaliseAmount refuses both, so a correct citation of a large total gets "value differs". Needs a size-scaled (ulp-relative) band.
2. xlsx/index.ts:132: a zip that is not a workbook (a .docx) loads in ExcelJS, then `workbook.properties.date1904` throws an uncaught TypeError instead of a refusal. Repro: createSheetsReader().read(docxBytes,'letter.docx').
3. index.ts:30-35 routeOf: magic bytes win over the .csv name, so a CSV whose first cell starts "PK" (header "PKey,Amount") goes to the zip route and is refused with a JSZip message carrying a library URL.
4. Minor, xlsx/index.ts:56 and 63-64 typed: a cached `<v>#DIV/0!</v>` without t="e" reads as number "NaN" (no finite guard); a hyperlink cell whose text is rich text returns undefined and reads as empty.

Card rule: S6 (item 1) alone would land the rest; items 2 and 3 are other failures, so the findings review decides (park or split).
Rule candidates: every reader refuses a wrong-kind container with a reason, never throws (run on A01, A07, E00 intake); route by file name before magic bytes only where the name is trusted, else try the route and fall back; number-to-text rules tested with large-magnitude noise, not just small values.
Permission gaps: none. Model: Sonnet 5.5 checker; Opus 5.5 adversarial read.
