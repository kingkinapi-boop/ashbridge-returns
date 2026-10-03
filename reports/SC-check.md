# SC check (cloud-e17d8e, 3 Oct 2026)

FAIL. Branch claude/SC at b68ef0d (main is 68 commits ahead, not merged in; merge before the next round).

Passed: typecheck, lint, deps:check, `npm test` (unit 2509, db 507), scope OK (52 files), spec files unchanged since the spec commit a069a19, no product code changed. Not completed: `npm run test:flake` printed no result in this run (rerun next round).

Failures (Opus adversarial read of the diff, spot-checked 1 and 3):
1. KNOWN entry R43 at `src/contracts/schema-rules.db.test.ts:53` matches `^returns\.[a-z_]+\.[a-z_]+_id: points at no built table...`, so any pointer column in any table, including future ones, passes without a FUTURE_POINTERS entry. Owner reads "F01 family", not FX3. List the covered columns by name.
2. Other KNOWN entries exempt whole files or open sets, not named defects: `tools/test/schema-contract-rules.test.mjs:44` (R41 off for any message in reading, facts, checks, taxprep, amount-grammar), `:51` (R23 for every `\w+RecordSchema`), `:39-40` (R37 for any CSV under sample-clients taxprep and reference/taxprep). Owners F01, F02, G00/G02, G01, F09B, E03 at `:48-55` and db `:51-53`, `:61-62`, not FX3 as the card line says. Narrow each to the exact message and file.
3. R34 scan drops the whole SC fixtures folder (`testDataFiles()`, `:897`), including goldens and clean files. Excuse only the planted-r34 files by name.
4. Repo-wide rules can pass on an empty scan: R16 (`:1418-1422`), R17 (`:1434`), R41 (`:1758`), R49 (`:1973`), R56 (`:2004`) never assert a file was scanned; R18 (`:1454`) does not assert any core file matched. None is empty today (12 schema .sql, 29 core files).
5. Note: planted fixtures use a Luhn-valid SIN 271000002, jordan.lee@realmail.ca, (416) 555-2368 (`planted-r34-pii.*`). Made up, but KNOWN `:38` says A05 was told to use a non-Luhn number for the same kind of plant; keep that consistent.

Rule candidate: a KNOWN entry names one exact message (or a counted list) and one owner card; a rule that scans files asserts the scan is non-empty.

Permission gaps: none. Model: Sonnet 5.5, adversarial read by an Opus subagent.
