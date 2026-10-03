# SC11 spec: reported (cloud-06931b)

Branch claude/SC11 is cut from claude/DB16 (fc7b45df, build round 5), not main: R90 to R92 need DB16's index.ts. Merge DB16 to main first, or land SC11 in the same train. Spec commit dda1c955; main merged in (f9da8e52).

- 20 tests in `src/core/db/rules.acceptance.db.test.ts` (ARC-6, SEC-1, ARC-15), plant `src/core/db/__fixtures__/index-36672c88.ts` (index.ts at 36672c88, three edits listed in its header), `dbCatchAllow: []` added to tools/test-homes.json.
- Validated on main f9da8e52 (merged): typecheck, lint, unit (2674) green; db project fails only SC11's own tests (4 on PGlite, 13 on pg16, each "does not export X").
- Throwaway stub (not committed) of the contract below: unit 2674, db PGlite 575 and pg16 590 all pass, including the plants. Retired in 6b: none.

## Contract the build must meet (index.ts, vitest-setup.ts, global-setup.ts; nothing in product code)
- `idleConnectionProblems(db)`: works through `db.pool`, `db.customSettings`, `db.closed`; takes `pool.idleCount` idle connections, rolls back first (an aborted block hides role), names role, session authorization, session-source setting, tracked custom setting, open transaction; [] on PGlite or a closed handle. It may destroy a connection it finds dirty (the tests re-dirty before each check).
- `assertCleanClones()` rejects naming every problem of every open clone; vitest-setup afterEach calls it before `closeClones()`.
- `close()` rejects naming a dirty idle connection, after the database is dropped.
- `leftoverRoles(before, after)`: sorted names in after, not in before. Global teardown records pg_roles at setup, drops run databases first, then rejects naming leftover roles.

## Amber
- Spec file also holds R92's source scan (db project, runs on both backends); the scan skips `__fixtures__` and test files, matches `.catch(() => undefined | {} | null | void 0)` and `.catch(noop)`.
- Allow entries are `{file, text, reason}` with the exact text; stale entries fail. R92 passes before the build (nothing swallows now); its plant test and rule tests prove the scan.
- R91's teardown test runs under a temporary DB16_RUN_ID so it never drops the real run's databases; it needs the db project's one-file-at-a-time pg16 mode.

## Permission gaps
None.
## Model
Sonnet 5.5 (worker).
