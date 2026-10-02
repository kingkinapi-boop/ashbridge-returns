# F03R check, round 2 (cloud-e81ab0, 2 Oct 2026)

FAIL on the Opus adversarial read. Steps 1 to 9 pass: typecheck, lint, deps:check clean; npm test 787 of 787; spec files unchanged since af234ce; scope clean; mutation canary ok; mutation 100 on taxprep.ts.

## Failures (from the Opus read, probed with npx tsx; no test covers them)
1. RT-3, RT-9 regression: `1'234`, `12'`, `-12'`, `1'2'3` now parse OK as text with apostrophe=false in both columns; origin/main refused them with an `apostrophe` fault (digits-plus-apostrophe branch). The new `startsWith("'")||startsWith("-'")` test dropped it. The writer also writes `1'234` and reads it back. Expected: an apostrophe fault for a number with an apostrophe inside; `O'Brien` stays allowed.
2. Card Build line, writer read-back: `formatValue` only checks `classifyValue(written).ok`; it never compares the read-back value with the input. No input differs today (-0 is allowed by check 7), but the required check is missing.
3. Check 8: ALWAYS_EXPORTED has the right eight cells, but Ident120, 121, 311 and 492 are spread from IGNORED_ON_IMPORT, so they cite "skipped on import", not the export finding (FINDINGS.md line 45, item 9). Each entry must cite the export finding.

Minor, not counted: rate 123456789012.3456 is refused with the wrong reason ("more than 4 decimals"); NBSP-only text is refused as blank though the parser reads it as text.

Rule candidate: when a branch of a parser is replaced, grep the old branch's inputs and keep a test for each (same as F09A's rule candidate).

## Permission gaps
None.

## Model
Sonnet 5.5; adversarial read by Opus.
