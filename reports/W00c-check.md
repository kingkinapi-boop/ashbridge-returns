# W00c check (cloud-4c2861)

Result: FAIL (Opus adversarial read of RC1 to RC4). Mechanical steps passed.

## Passed
- typecheck, lint, deps:check clean (Node 24.21).
- `npm test`: unit 4982 of 4982, db 488 of 488.
- Spec diff (`1b555abb` to HEAD, acceptance and golden files): empty.
- Scope: clean against origin/main's card (faults.test.ts and checks.test.ts are in its Paths; the card copy on claude/W00c is stale).
- Flake: runs 1 and 2 ok; stopped early because the Opus read had already failed the card. Not completed.
- Mutation: not completed (stopped for the same reason). Re-run on the next check.

## Failures (Opus read)
1. RC3 open: a client with no accounts loads clean. `ClientSchema.accounts` (testworld/model/schema.ts:40) has no `.min(1)`; checks.ts has no zero-accounts test. C01 with accounts=[], transactions=[], statementBalances={}, adjustingEntries=[] and TBs equal to opening loads. No acceptance test covers it.
2. RC3/RC4: reversed fiscal year accepted. Nothing checks yearStart <= yearEnd. `yearMonths` (checks.ts:114) returns [], so year coverage (checks.ts:173) checks nothing. C01 with start 2025-12-31, end 2025-01-01 loads.
3. RC1 weak: markers pin only the count and sum of a marker's rows (checks.ts:222-227), not each row. C10 with one priorYear row +1 cent and another -1 cent loads; two missingFromExport rows in May load (statement roll sees only the month total); priorYear rows can move to any 2024-12 date or swap which row carries the marker. Per the card's landing rule this goes to the Lead: redesign markers as catalogue-listed row ids.
4. RC4: "regular file" uses statSync, which follows symlinks (testworld/clients/load.ts:247). accounts/zz.csv as a symlink to ../answer-key.json is accepted and its lines counted as export rows. Use lstat, or a realpath that must stay under accounts/.
5. RC4 partial: onboarding.json financial_year_end and fiscal_year_start are plain z.string() (load.ts:83-84); "2025-02-30" loads and is not compared with fiscalYear.
6. Minor RC2: `recordsOf` turns a missing field into String(undefined) (load.ts:287), so "key (1200 undefined)" resolves; repeated JSON object keys (two "CHQ" in statementBalances) are lost silently at JSON.parse.

Held: dupOf cases, one-cent change on a single marked row, extra marked row, priorYear inside the year, repeated ids of each kind, prototype-name keys, calendar dates, file field shapes, directory or malformed JSON, "(...)" qualifiers. No extras outside the card, no real-looking people or numbers, no secrets, no paid service.

Rule candidates: every load boundary rejects empty collections and reversed ranges; file-type checks use lstat; every date field in a loaded file is validated as a calendar date and cross-checked with its twin.

Permission gaps: none. Model: Sonnet 5.5 checker; Opus 5.5 subagent for the adversarial read.
