# F05M spec (cloud-85862e, Sonnet 5.5)

No acceptance tests to write: the card says F05's acceptance tests stand and F05M adds unit tests for mutation survivors only (build job). Premise checked on origin/main cfc8d79: `src/contracts/checks.ts` exists and carries no `// @mutate` marker; `checks.acceptance.test.ts` and `checks.test.ts` exist.
Tests written: 0. Clauses covered: none new. Validated on main cfc8d79 (nothing changed).
Amber: none.

## Permission gaps
None.
## Model
Sonnet 5.5 (core card, but no test content was written, so no Opus spec-writer was started).

## Toolchain refit (local-4e012b, Sonnet 5.5, 2 Oct)
Merged origin/main eda0bda into claude/F05M. No assertion changed; no acceptance test written (the card adds none). typecheck and lint clean; vitest unit 278 passed, 2 failed: src/modules/storage/real-parent.acceptance.test.ts (A05) with EPERM on `fs.symlinkSync` (Windows laptop has no symlink right; not F05M, passes in cloud). Old validated sha cfc8d79, new validated sha eda0bda. Opus not used (no tests written).
Permission gaps: none. Model: Sonnet 5.5.
