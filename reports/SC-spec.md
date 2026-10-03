# SC spec, patch A415 re-validated (cloud, 3 Oct): the 5 gaps of reports/SC-spec-review-3.md

Spec commit: 0884fdfa15e538d71674d6a6c65690e065b8c74c on claude/SC (validated on main edd3af05).

## Checks on edd3af05 (Node 24.21.0, npm ci on the box)
- `npm run typecheck`: exit 0. `npm run lint`: exit 0, no output.
- Unit SC file: 87 passed (87). Db SC file (`--project db`): 23 passed (23). Not run on Postgres 16 (DB16 has not landed).
- `npm test`: unit Test Files 112 passed, Tests 2635 passed; db Test Files 10 passed, Tests 568 passed; exit 0.
- `npm run test:flake`: runs 1 to 5 ok (219540, 210982, 222721, 209382, 204200 ms), slowest boot 3310 ms, exit 0.

---

# SC spec, round 3 (cloud-93197d, 3 Oct): the 5 gaps of reports/SC-spec-review-3.md (A415)

Spec commit 348528d6 on claude/SC, validated on main 61cb3bc7 (origin/main merged; the full suite ran on 2288da55, and 2288da55..61cb3bc7 changes only plan, reports and .claude docs; both SC files re-ran green after the second merge). 110 rule tests: 87 unit in tools/test/schema-contract-rules.test.mjs, 23 db in src/contracts/schema-rules.db.test.ts (round 2 had 83 and 22). Spec files diffed against 1267a0fb: removed lines are only return types widened with a `seen` or `keys` list, the plant tests' live statuses swapped for pinned ones, and the R34-guard block replaced by a stricter one; no assertion was dropped. Retired tests (step 6b): none. SC is rules only, so the stub is empty, and the full suite with the new tests is green.

## What changed
1. Owners (gap 1). `FIX_CARDS` (FX3 to FX9) in both files: an entry owned by any other card fails, even an open one. Plant: an entry owned by W16 (and one by B04) is caught; FX3, FX4, FX7 and FX9 pass.
2. Pinned plan state (gap 2). Every plant test passes `PINNED_STATUSES`. The done-owner plant now uses FX6 pinned done (it used to read F02 and F01 from plan/slices.json). The PENDING plant also pins which subjects exist. Only the real-data known.json tests (unit and db) and the real PENDING test read plan/slices.json.
3. Problems that name no file (gap 3). `NO_FILE_HOMES` maps rules to files: R30 and R32 to taxprep.ts, R38 to src/core/test-no-network.ts (the setup file every project lists), R39 to amount-grammar.ts, R45, R45-enum and R45-cite to facts.ts, and R54 by reader label (A01 textlayer/**, A03 recorded/**, A07 sheets/**). A problem that names no file and has no row fails. `fileOk` now reads the walked file list in exact case. Plants: an R45 string filed under src/contracts/reading.ts, an R52 string with no row, `src/contracts/Facts.ts`, an A07 string filed under textlayer, and an E00 label with no row.
4. Sentinels (gap 4), all with the scanProblems message shape. Unit side:
   - R14: records.ts#VersionStampSchema.
   - R30: taxprep.ts#writeTaxprepCsv.
   - R37: 01-maple-ridge import.csv and src/contracts/__golden__/apostrophe-in.csv.
   - R47, R48 and R54: readers A01 and A07.
   - R52 and R53: 01-maple-ridge.
   - R51: testworld/clients/load.ts, once readers exist.

   Db side: `returns.returns` in the catalog for every real-data rule, plus one item per rule:
   - R12: returns.state_events.
   - R13: returns.facts.fact_key.
   - R14: returns.facts.version_stamp.
   - R15: returns.facts.status.
   - R41-sql: the check `returns.facts facts_version_stamp`.
   - R42: returns.facts.fact_key.
   - R43: returns.client_handoff.fact_id.
   - R44: returns.state_events.seq and returns.facts.version_no.

   The db scan rule gets its own plant test.
5. R34-guard (gap 5). guardFolder must refuse tools/test/__fixtures__ and name each R34_PLANTED file. A temp copy without the named plants and known.json must pass; what the copy raises is the only part KNOWN can excuse. This is planted with fake guards that name only the first plant, refuse the copy, or pass everything, and the real copy is checked to keep every other file. It runs once guard.ts lands (PENDING row R34-guard, owner W00b).

Also: the 37 R37 KNOWN entries are now owned by FX9 (A415). The PENDING comment says that whichever of SC and the subject card lands second clears the row.

## New defect on main (KNOWN, exact string)
- R18 src/contracts/auth.ts, owner FX7: FX7 (core) has listed this file in its Paths since A414, so the file needs `// @mutate`. FX7 adds it when it edits the file.

## Checks (Node 24.21.0, npm ci on the box, DATABASE_URL and SUPABASE unset)
- `npm run typecheck`: exit 0.
- `npm run lint`: exit 0, no output.
- Both SC files: unit 87 passed (87); db `npx vitest run --project db src/contracts/schema-rules.db.test.ts` 23 passed (23). Not run on Postgres 16, because DB16 (status carded) has not landed and there is no Postgres 16 harness on main yet.
- `npm test`: unit Test Files 109 passed, Tests 2584 passed; db Test Files 10 passed, Tests 568 passed; exit 0. The db project is the second half of `npm test`.
- `npm run test:flake`: runs 1 to 5 ok (272109, 269089, 269159, 273823, 270625 ms), slowest boot 3950 ms, exit 0.

## Amber (decided; reverse by editing the test)
- R12 and R41-sql have no single column, so their sentinels are a table (returns.state_events) and a check label.
- NO_FILE_HOMES also has an A03 row for R54 (A03 is a READERS entry), which the directive did not list. R47, R48, R52, R53 and R34-guard have no row yet, so a KNOWN entry whose string names no file fails for them until a spec job adds one.
- FIX_CARDS is FX3 to FX9, per the directive. The review asked for FX3 to FX8.

## Earlier rounds
Round 2 was 1267a0fb on b277a240 (105 tests: KNOWN exact entries, scan sentinels, R34 over the whole fixtures folder; A407). Round 1 was 34e8ac0 on 6d8efd6 (94 tests).  Round 1 amber notes (the R54 refusal shapes for A01 and A03, the PENDING list, the R52 catalogue, R53 year links, R46 and R56 as text scans) still hold: `git show 34e8ac0:reports/SC-spec.md`.

## Permission gaps
None. The main checkout's working tree had plan/ledger.jsonl modified, so the work ran in the worktree /home/user/wt-SC.

## Model
Opus 5.5.
