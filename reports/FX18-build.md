# FX18 build, round 3 (B9 to B12)
Branch claude/FX18; head is the commit that carries this report. Worker cloud-5e4a47.
Files: src/modules/ai/runner/engines.ts, schemas.ts, exchange-limits.build.test.ts.
- B9: per-wait `{ seen, waitedName }`; first `<id>.<other ext>` name held apart (one), any other `<id>.*` is a stranger; logOnce lost its `exempt` parameter; R104 marker rewritten (seenMax + 1 keys).
- B10: `quotedName` (JSON.stringify, Cf/Zl/Zp as \u hex) used for stranger lines.
- B11: comments at engines.ts:43, schemas.ts:46 and :49.
- B12: all three schemas.ts disables removed, cloud run: mutants 647 to 654 (lines 35, 40, 51) all scored Survived (not killed, no import crash credited). The three next-line disables stay; reasons now quote that status.
- Added a quotedName unit test (soft hyphen, ZWSP, U+2028/2029) to kill a padStart survivor.
Numbers: S10 to S12 and all src/modules/ai, src/core, tools/test unit tests pass (1258); typecheck, lint, deps:check clean; scope OK (15 files); mutate:changed FX18 --force: 100.00 on all five files.
Amber: the testing.md line ("an exemption from a cap is tested with two exempt names and a flood of them") is outside Paths, left to the Lead. Not run: db/pg16 project (no db change).
Permission gaps: none. Model: Sonnet 5.5. Opus read and security review still to do (check job).
