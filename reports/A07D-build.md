# A07D build

Branch claude/A07D, code head 8f1a125.
Files: src/modules/sheets/xlsx/raw.ts (new reference tokenizer `slide`), xlsx/index.ts (numberText at the edges, dependency-ordered SUM snaps with cycle marking), xlsx/a07d.test.ts (unit tests).
Acceptance: all 16 A07D tests pass, unedited. Sheets suite 398 of 398; full suite 2469 unit and 488 db pass. Typecheck, lint, deps:check and scope clean.
Mutation: 100 on raw.ts and index.ts (cleared the incremental cache once; a stale cache hid a killed mutant). Four Stryker disables, each with its reason.

Ambers:
- Fix-list item 2 (raw XML variants) skipped: no spec probe failed.
- Off-grid ranges become one #REF! (spec choice S1).
- Drift from snapped inner terms is added to a SUM's bound, capped at half a cent (S4).

Could not do: nothing outstanding.

## Permission gaps
None.

## Model
Sonnet, as run.
