# F01 check, round 3 (cloud-6e552e, Node 24, Sonnet 5.5 plus one Opus adversarial read)

Result: **FAIL**, narrow. Branch claude/F01 at ac0526d, spec 95a3b63.

Passing: typecheck, lint, deps:check; scope OK (23 files); acceptance tests untouched (diff of records.acceptance.db.test.ts empty); `npm test` unit 1402 and db 249 pass; `test:flake` 5 of 5; mutation 100 on records.ts (38) and text.ts (14).

## Failures (Opus read, verified in code)
1. `gifi_mappings.mapping_version` (and gifi_code) can be rewritten after insert: db/schema/30_books.sql:15-26 has a BEFORE INSERT next-version trigger only and no update guard (facts, entries, judgment_inputs and versions have one). Repro: insert version 1, then `update returns.gifi_mappings set mapping_version = 999`. Breaks check 20 and TB-3 history. The S7 tests cover inserts only.
2. JSON keys are text that can be blank, refused by neither SQL nor zod: stamp keys (db/schema/00_schema.sql:23-33; src/contracts/records.ts:34-36, `z.record(z.string(), ...)`); source member keys (30_books.sql:92-98). Repro: version_stamp `{" ":"v1"}` accepted; sources `[{"\t":"x"}]` makes an entry explained.

## Risks (not failures)
3. The catalog loops in 90_learning.sql:240-281 (non-blank CHECKs, return_id FKs) reach other cards' tables (05_bridge, 15_auth, 35_qbo, 80_jobs sort before 90); the allow-list is hard-coded in SQL, not in text.ts as findings B1/R13 said, so a later value column needing '' is refused.
4. zod is looser than SQL on numbers: version_no and mapping_version accept 0 and negatives; source_page and source_row lack `>= 1` (records.ts:68,98,103,106,135,144,157); zod does not mirror `sources_are_real` (records.ts:143).
5. The seq guard can be stepped around with nextval/setval plus OVERRIDING SYSTEM VALUE; order stays monotonic, low risk.

Rule candidates: every table with a version column gets an update guard (catalog rule); non-blank applies to JSON keys as well as values, in SQL and zod.

Permission gaps: none. Model: Sonnet 5.5; adversarial read Opus.
