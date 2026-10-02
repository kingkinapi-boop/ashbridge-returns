# A07C build, round 2 (cloud-ae6ed2, 2 Oct 2026)
Branch claude/A07C, head see claim note. Files: src/modules/sheets/xlsx/raw.ts, xlsx/index.ts, new xlsx/raw.test.ts (32 unit tests).
- R2-1: raw.ts reads self-closed `<f .../>`; a shared child takes its master's formula slid to its address (`slide`: relative references move, `$` ones and string literals stay); index.ts takes every formula cell's text from the sheet's own `<f>` (the library throws on a child whose master was hyperlinked).
- R2-2: the absolute 1e-9 floor is gone; numberText snaps only within 4 ulps of the value.
- R2-3: an empty stored `<v></v>` is no value, so a formula with it caches none.
- Acceptance: 331 of 331 sheet tests pass (25 round-2 tests were failing). Full suite 2243 + 427 pass; typecheck, lint, deps:check clean; mutation 100 on changed files (raw.ts, index.ts).
- scope.mjs flags plan/cards/A07B.md only (arrives by the merge of main, as in the last check).
- Amber: `slide` handles A1-style references only (no whole-column or whole-row `A:A`, `1:1`, no R1C1); one Stryker disable comment each on index.ts formula fallback and raw.ts shared-id guard (equivalent mutants). Reverse: extend `slide` and its tests.
- Rule candidate for SC (already on the card): regexes over raw sheet XML handle self-closed elements; snap tolerances are relative to magnitude.
- Permission gaps: none (node_modules reads are denied, so ExcelJS's own slideFormula was not used). Model: Sonnet 5.5.
