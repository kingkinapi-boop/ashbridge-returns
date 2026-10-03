# GL3 build report

Branch claude/GL3 (head: see git log; spec commit 9da00fbd). Worker cloud-06931b.
Files: db/bridge/0001_bridge_views.sql, 0002_grants.sql, views.json, README.md; src/modules/golive/bridge/{index,db,manifest,scan}.ts and scan.test.ts (own tests, 13).
Acceptance: 29 of 29 unit, 25 of 25 db on PGlite. Whole unit project 2641 passed; whole db project 570 passed (PGlite).
typecheck clean; lint clean; deps:check 0 violations (208 modules); scope OK (all files inside paths); mutate:changed GL3: scan.ts 100.00 (125 killed, 0 survivors, forced run).
BLOCKED (partly): the db tests on Postgres 16 through `TEST_DB=pg16` cannot run: that harness (DB16, src/core/db/target.ts) is not on main yet, and pulling DB16's files into this tree was refused. Instead I applied db/schema/*.sql, the stand-in, 0001 and 0002 to the local Postgres 16 with psql: all apply, and the grant checks hold (anon no usage, returns_app 16 views select and no write, base table refused, client_app_reader sees sent/withdrawn/closed only, select * and created_at refused, no execute on returns functions). Re-run the db project with TEST_DB=pg16 once DB16 lands.
Ambers (all reversible, edit the file named):
1. 0002 revokes execute on all functions in schema returns from PUBLIC and grants it to returns_app (the test needs client_app_reader unable to execute; Postgres grants PUBLIC execute by default). GL2's roles may need to take over that grant.
2. bridge.cra_access has a `kind` column (v2_confirmed, v1_request, program_account); its constant branches cite the row's key column as source in views.json.
3. bridge.document reads one upload pointer per answer (name|drive:id); several entries in one answer need a later card.
4. findSentenceLiterals does not nest block comments or read E'..' strings (the draft files use neither); written as one regex so mutation 100 holds.
5. Security review (/security-review) not run by me: the Lead boards it. Scan code split from db code so only pure scans carry @mutate.

## Round 2 (cloud-0ac9e9, 3 Oct)
Merged origin/main 66de2c9 (DB16 in). R41 fix: manifest.ts uses NonBlankSchema from src/contracts/text.ts for clientAppCommit and rule. Run on Node 24.21, Postgres 16.14: `TEST_DB=pg16` db project 638 passed, 1 skipped (the PGlite-only DB16 test; the pg16 identity test passes); unit project 2820 passed; typecheck, lint, deps:check (214 modules) clean; scope OK (17 files). No @mutate file changed. BLOCKED: none. /security-review still the Lead's to board. Permission gaps: none. Model: Sonnet 5.5.
