# SC11 round 2 build: Opus read (3 Oct 2026)

Read-only. Diff `59e10743..HEAD` (f6bcfaf1 build, 030e1d6f report) on src/core/db/index.ts and src/core/db/vitest-setup.ts, against plan/cards/SC11.md (directive 3 Oct 16:23Z, B1 and B2) and the spec tests in src/core/db/rules.acceptance.db.test.ts (R116, R117, S3) and src/core/db/pool-rules.acceptance.test.ts (S1, S2 scans). No tests run (a test run was using the checkout).

## Verdict: FAIL (small fix round; the core of B1 and B2 is right)

## What is right

- Every `new pg.Pool` / `new pg.Client` in index.ts now has a recording error listener: openPool (index.ts:162, pool listener :164, client listener :177), PgDb.main (:255, :257), withAdmin (:215, :217). No empty listener, no `.catch(() => undefined)` added. The only raw `pool.end()` is inside endPool (:196).
- B1: every client is tracked from the pool's `connect` to the client's `end` (:167 to :176), including one destroyed by `release(true)` (inspectIdle :629, transaction :411); endPool awaits them after `pool.end()` with a 5 s bound and a named failure (:184 to :211). Used in close() (:457) and both paths of createPg16Template (:505, :509). `with (force)` stays (:475, :485).
- B2: pool and client errors share one recorder per pool (one WeakSet), so pg-pool's idle listener re-emitting the client's error is counted once. One admin helper serves dropDatabase, dropRunDatabases, listRoles, the template create and the clone create.
- Late errors (after the pool or handle ended) go to `lateErrors`, named by the next assertCleanClones; vitest-setup.ts adds an afterAll so the last test of a file is covered.
- Security: R91 still lists every role of the cluster (listRoles :662, global-setup.ts unchanged); no role, permission or redaction check weakened; R92 allow list unchanged (one entry).
- Nothing built beyond the card except the logged amber (openPool applies connOpts to a bare connectionString, so the local test password is used; no secret printed).

## Failures

1. **index.ts:462, errors lost at close().** `await dropDatabase(this.adminUrl, this.name)` is outside any try. If it throws (now more likely: withAdmin rethrows any recorded admin error), every collected failure, including the recorded 57P01 lines from `this.problems` and an endPool timeout, is dropped and only the drop error surfaces. Fix: wrap it with `note(e)` like the steps above it, then throw the joined list.
2. **index.ts:504 to 507, createPg16Template failure path masks errors.** If `endPool(schemaPool)` rejects (5 s bound) the schema error `e` is lost and the template database is not dropped; `schemaProblems` (recorded connection errors) are never reported on this path (only on the success path, :510). Fix: collect endPool's error and schemaProblems into the thrown error, and always attempt the drop.
3. **index.ts:222 to 228, withAdmin swallows recorded errors when `run` or `end` throws.** `errors` is only read on the success path; if the query rejects (for example "Connection terminated unexpectedly" after a kill) the listener's 57P01 line, which carries the code, is discarded. Also an `admin.end()` rejection in the finally masks `run`'s error. Fix: on every exit, attach the recorded error lines to whatever is thrown.

## Lesser points (fix while there, or log as amber)

4. **index.ts:186 to 197, endPool on an untracked pool degrades to a raw `pool.end()`.** A pool not made by openPool resolves with zero tracked ends, which is exactly the R117 behaviour the rule forbids; S2's scan only checks where `pool.end()` is written, not which pools reach endPool. Throw ("pool not opened by openPool") instead of falling back.
5. **index.ts:142, openPool without a sink sends every error to lateErrors even while the pool is live,** labelled "late". Only the spec tests call it so; harmless now, misleading later. Either require the sink or label live errors differently.
6. **index.ts:256 with :436, the session's errors during close go late.** `closed_` is set at the start of close(), so a 57P01 on the main session during inspectIdle or dropOwnedRoles is not in this close()'s rejection; it fails the next test's afterEach instead (allowed by S3's "next afterEach", but it blames the wrong test). Setting a separate "ended" flag after `main.end()` would keep it with the right handle.
7. **Unbounded waits in close().** Only endPool is bounded. `this.main.end()` (:454, also unwrapped: a rejection skips endPool and the drop), inspectIdle's `pool.connect()` (:615, outside its try, so a failed connect leaks the clients already taken until endPool times out), and withAdmin's connect and query have no bound. The directive's risk line asks to bound every wait and name it so the 30 s hookTimeout never fires.

## Verification gaps in reports/SC11-build.md (directive's "Risks and re-test")

- Connection peak against max_connections for the 25-clone lease afterEach: not measured.
- FLAKE_RUNS=10 run: not done. R91's two teardown tests and DB16's pg16.acceptance.test.ts re-run after the admin helper change: not reported.

## Hand-written lists

None added by this build. The R116 header comment (pool-rules.acceptance.test.ts:3 to 11) says the 87066e33 plant has 8 sites and three raw `pool.end()`; this matches the diff's removed lines (dropDatabase, dropRunDatabases, template create, schema pool, clone create, clone pool, PgDb.main, listRoles; pool.end at close and the two template paths).
