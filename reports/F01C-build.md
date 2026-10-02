# F01C build (cloud-0b4981, Node 24, Sonnet 5.5)

Branch claude/F01C on spec 3c54b09. Files: db/schema/{00,20,30,40,60,90}*.sql, src/contracts/{records,text}.ts, records.test.ts, value-columns.db.test.ts.
Acceptance: records-repairs.acceptance (zod 17 of 17, db file all pass). Full suite: db 295 pass; unit 1531 pass, 1 FAIL not from this card: taxprep.acceptance.test.ts F03 "RT-3 RT-9 property Windows-1252" (seed 20261002; the writer refuses a character; no file of F03 touched here).
Typecheck, lint, deps:check clean. Mutation 100 on records.ts (91) and text.ts (21). scope.mjs F01C: only plan/cards/F01.md outside paths, which came in with the merge of main, not this build.
Built: returns.version_update_guard() on gifi_mappings (version, return, account, gifi_code); blank JSON keys refused in is_version_stamp, sources_are_real and zod (record key NonBlankSchema; sourcesAreReal mirrors SQL, applied when explained); version_no, mapping_version, source_page, source_row are whole numbers from 1 in zod; 90_learning loops scoped to F01's 21 tables; VALUE_COLUMNS frozen in text.ts.
Ambers: (1) the SQL side marks value columns with a `VALUE_COLUMN` column comment (SQL cannot read text.ts); value-columns.db.test.ts keeps the comments equal to VALUE_COLUMNS; reverse by an explicit list in 90. (2) The F01 table list in 90_learning.sql is explicit names; a later table is never in it. (3) Only gifi_mappings got the new guard; facts, entries, judgment_inputs, versions already refuse updates (their own triggers).
Permission gaps: none. Model: Sonnet 5.5.
