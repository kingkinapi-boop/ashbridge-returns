# BL0 check (cloud-bc1db8)

PASS. typecheck, lint, deps:check green; npm test 1703 unit + 350 db pass (18 of 18 acceptance); spec file unchanged since 428bad0; scope OK; mutate:canary ok; mutate:changed 100 on ai.ts and checks.ts.

Opus read of every string field: ai.ts clean (value fields correctly plain). checks.ts `nonBlank` calls `isBlank`.

Not failures (no non-blank rule exists today, so outside the card's "replace existing rules"), for the Lead to carry as a follow-up rule test:
- checks.ts:45 `inputs: z.array(z.string())` accepts `[" "]` or zero-width only
- checks.ts:117 `acceptedBy` and :118 `note` accept blank when present (`nonBlank.optional()`)
- checks.ts:68 `flag(reason)` has no blank guard (CK-5), borderline

Rule candidate: every text field outside the value list uses the one blank rule, including array items and optional fields.

Permission gaps: none. Model: Sonnet 5.5 checker, Opus 5.5 read.
