# SC11 spec patch (A455): reported (cloud-23be1d)

Commit 7fd5141b on claude/SC11; main f980ffd9 merged. Validated on main f980ffd9: typecheck, lint, unit (2674) green; db project fails only SC11's own tests (pg16: all new ones fail for the right reason, e.g. tx after end resolves, quoted/space/$ custom settings read null, read-only default not applied, foreign role dropped, DO block/create group role left, rolled-back role fails close, quoted role name syntax error, aborted block fails close, bad DB16_RUN_ID accepted, inherited id reused).
- 19 tests added to src/core/db/rules.acceptance.db.test.ts (39 total): late tx (3), setting forms (5), session read-only/isolation (1), per-handle roles (5), run id (2), R92 empty catch (3). Round 1 tests kept; the two R91 teardown tests now read the minted id from DB16_RUN_ID.
- tools/test-homes.json: dbCatchAllow now holds the one index.ts `catch {}` entry with its reason.

## Contract added for the build
- Every PgTx method (query, exec, rollback) rejects once its transaction ended (commit, rollback or error); no call reaches the pooled connection.
- Custom settings set by `set_config (`, quoted names, `$` names are carried into a transaction, or the transaction is refused naming the statement (message matches refused|custom setting).
- Session default_transaction_read_only and default_transaction_isolation apply to the transaction (set before/at begin).
- Role tracking per handle: a role another connection creates meanwhile is never dropped; roles made by DO block or `create group` are dropped at close; a rolled-back role does not fail close; an aborted block does not stop the drop loop; names escaped as identifiers.
- `pg16RunId()` throws naming DB16_RUN_ID when the id is not ^[0-9a-z_]+$; global setup always mints a fresh id and sets DB16_RUN_ID (an inherited one is never reused or dropped).

## Amber
- "Inherited id refused" is read as: global setup ignores and replaces it (a throw would break the existing R91 tests' setup). Reverse: make setup throw instead.
- Empty-catch hit text is normalised to `catch {}` (comments removed); one allow entry silences one hit.
- Step 6b: no full stub sweep; nothing outside src/core/db reads DB16_RUN_ID or pg16 tx internals (grep), so no other test is contradicted.

## Permission gaps
None (Postgres 16 password set on the local throwaway cluster to run the pg16 db project).
## Model
Sonnet 5.5 (non-core card).
