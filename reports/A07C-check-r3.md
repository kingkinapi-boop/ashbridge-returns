# A07C check, round 3 (cloud-de3dc1, 2 Oct 2026): FAIL

Mechanical: typecheck, lint, deps:check clean; npm test 2260 unit + 488 db pass; sheets 363 pass; canary 100; mutate:changed A07C 100 (break 70); spec files unchanged since ba50f80. Scope: only plan/cards/A07B.md outside paths (a Lead edit carried on the branch, not the build).

Opus adversarial read (classes only) found, with the pure functions run from /tmp (ExcelJS not installed on that read):
1. Class 2, shared formula child (`<f t="shared" si="0"/>`): `slide()` in src/modules/sheets/xlsx/raw.ts moves references inside quoted sheet names (master `'Q4 FY2026'!B1*2` gives child `'Q5 FY2027'!B2*2`, Excel: `'Q4 FY2026'!B2*2`) and never moves whole-column or whole-row refs (`SUM(A:A)` in C1 stays `SUM(A:A)` in D1, Excel: `SUM(B:B)`; same for `1:1`). raw.formula wins over cell.formula for every shared child.
2. Class 1, numberText/plain (xlsx/index.ts): values >= 1e21 print the double's binary digits (`1E+23` reads "99999999999999991611392"; `1E+300` reads 301 junk digits).
3. Class 1, snapSums (by reading): nested SUMs snapped row-major; an outer total above or left of an inner SUM is processed first, the inner cached text is not yet cent text, so the outer is never snapped (A1 `SUM(A2:A3)`, A2 `SUM(B1:B6)`).
4. Soft: snap tolerance loose under cancellation (terms 1e13, -1e13, 0.01: bound 0.0156 capped 0.005, stale cached 0.014 rewritten to "0.01"); stored 5e-324 reads "0".
Classes 3 and 4 hold. No client sentence, key or real data.

Landing rule (A368): 1 to 3 are inside the classes, so this goes to the Lead. Rule candidates for SC: reference sliding must respect quoted sheet names and whole-row/column refs; number text from a stored literal never expands past what the file stores; derived-cell snapping must be dependency-ordered.

## Permission gaps
None.
## Model
Sonnet 5.5; Opus 5.5 for the adversarial read.
