# B04 spec report (cloud-e9d462, 3 Oct 2026)

1. Tests: 129 (115 unit, 14 db) in src/contracts/qbo.acceptance.test.ts, src/modules/qbo/{read-books,engines}.acceptance.test.ts, read-books.acceptance.db.test.ts, api/{mapping,limits}.acceptance.test.ts and testworld/qbo/export.acceptance.test.ts. Goldens (spec-owned): src/modules/qbo/__golden__/c01-trial-balance.json and c01-journal-entries.json. All fail only on the missing modules (contracts/qbo, modules/qbo, api/mapping, testworld/qbo/export); typecheck and lint errors are those imports and what follows from them.
2. Clauses: TB-1, TB-10, TB-13, EV-5, ARC-6, ARC-20, OUT-3, SEC-10, SEC-11 (plus EV-1, SEC-7, ARC-3 on the tables), checks 1 to 10, and card note A446 (ids and links in the stand-in folder, R93, R94).
3. Validated on main c2c7db54 (merged into claude/B04, based on claude/W00c 74041137). Spec commit 9ba0e6a9.
4. Retired: none. A stub sweep (unit 6973 and db 559, all green; lint and typecheck clean) found no test that contradicts this spec.
5. Ambers: the names and shapes in the test headers; composite key `date|type|number|accountId|amountCents`; an ambiguous or blank-number match is composite; stand-in rows are strict; export accountId is the account number; transactions are read for every account in either trial balance; 3 or 4 tries on endless 429s; the OAuth POST is exempt from GET-only; a missing QBO_STANDIN_DIR refuses; the JE memo type comes from W00's model as it is (not a TB-2 type, so B05 may refuse it); the golden leaves out accountType and accountSubType.

## For the Lead
- **Paths gap (A414):** the records catalog test needs every return_id to be a foreign key to returns.returns(id). 35_qbo.sql runs before 50_returns.sql, so it cannot declare that key. Options: rename the file to 56_qbo.sql, or add qbo_snapshots to 90_learning.sql's list. Either one changes Paths. The db tests seed the return and plant a missing one.
- **SC R47 PENDING (A415):** SC holds `PENDING { rule: 'R47', subject: 'src/modules/qbo', owner: 'B04' }`, and SC is not on main. Whichever lands second removes the row.
- **R94:** `readRegularFile` (src/core/safe-read.ts) comes with A04 round 5. The tests check only the behaviour (links refused, ids checked), so the build can wait for A04 or use its own lstat check.
- **SC3 R62:** QBO_ENGINE is in env.ts with no default, so `readSettings({NODE_ENV:'production'})` is unchanged. Production with the setting unset refuses, naming it.

## Patch A454 (cloud-7c6fec, 3 Oct)
Renamed 35_qbo.sql to 56_qbo.sql in the db test's header and return_id note (the only mentions in tests); no assertion changed. Merged origin/main (plan files taken from main). Typecheck and lint: errors only in the card's own qbo acceptance tests (modules not built); nothing else. Not run: npm test (W00c not landed, branch still carries its files). The card text's Paths and Build lines still say 35_qbo.sql: the Lead must change them to 56_qbo.sql before the build (scope.mjs). Opus spec review still owed (core). Model: Sonnet 5.5.
