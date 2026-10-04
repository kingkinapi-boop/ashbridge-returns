# SC11 round 4 build: Opus read (4 Oct 2026)

Read-only. Branch sc11-check = origin/claude/SC11 at 7b9695c9. Diff `origin/main...HEAD`, round 4 build ce864f2b on spec 09ef20c9 (A540: S13 to S20, B15 to B20, R119, R120). No tests run (another job holds the db and flake runs). Written as `-4` because reports/SC11-opus-read.md is tracked (the round 2 read).

## Verdict: PASS on the code. Two report gaps for the checker, no code failure.

## Checked and right

- Spec integrity: no build commit (741b8f03, f6bcfaf1, bfbe1cba, ce864f2b) touches a spec test, fixture or tools/test-homes.json. Merge commits change only tools/test-homes.json (53c6a018 joins main's `harness` with the spec's keys; no content change to either side).
- Scope: product changes only in src/core/db/index.ts, global-setup.ts, vitest-setup.ts (all three in the `harness` list). Nothing outside the db harness. No `.catch(() => undefined)` or empty listener in index.ts; the one `catch {}` (index.ts:498) is the dbCatchAllow entry named by A453.
- B15: endPool sets `tracker.ended` only after its settleAll resolved (index.ts:300); on its bound it throws and the tracker stays live. `markPoolEnded` exported (:279); close calls it after the drop step, before reading problems (:577 to :578); createPg16Template after its drop, then re-reads schemaProblems for errors that came during the drop (:696 to :701). A sinkless pool's errors stay "no owner" until marked (recorderFor :235 to :237).
- B16: settleAll `deadlineMs` (:200 to :205), DEADLINE_MARGIN_MS exported (:123), "not reached" named. dropOwnedRoles gets close's step bound minus the margin (:538); close gets CLOSE_TOTAL_MS and closeClones' afterEach step is CLOSE_STEP_MS = total + margin (vitest-setup.ts:28); dropRunDatabases' deadline (:638) is DROP_RUN_STEP_MS minus the margin.
- B17: POOL_END_BOUND_MS 4500 inside close's endPool 5000; every boundMs and deadlineMs is a named constant or an expression of them (R119). Afterwards worst case 3000 + 19250 = 22.25 s of 24.
- B18: makeTeardown runs the role check first, then dropRunDatabases (global-setup.ts:28 to :41); worst 2000 + 5250 = 7.25 s of 8. Drops run concurrently with Promise.allSettled, each bounded, every one not dropped named (:630 to :634). R91 still compares the whole cluster's roles; the security net is not weakened.
- B19: withAdmin's listener is recorderFor with `returned` (:313 to :314, :328): lines attached on every exit, late after return.
- B20: endPool's message names the count still open and "checked out and never released?" (:303).
- R120: no ended/closed flag assigned in a try `finally` (transaction sets `state.ended` in try and catch, :489, :493; mainEnd uses a Promise `.finally` on the end itself, allowed).
- R107 / S20: tools/test-homes.json dbGrantAllow has exactly one entry per grant in db/bridge/0002_grants.sql (lines 15, 16, 24, 25; the column list matches the file word for word after normalising), owner GL3, reasons from GL3's card. No other grant in db/**/*.sql. dbGrantFixtures names only db/bridge/__fixtures__/client-app-standin.sql with the required reason; grantScan exempts only a listed, existing file under `__fixtures__` (sql-rules.acceptance.test.ts:171 to :181), the test pins the list to that one entry (:292 to :293), and a planted default-privilege grant elsewhere still fails (:302 to :312). Narrow.
- Clauses: nothing contradicts ARC-6 (no outside service; LOCAL_PASSWORD is the pre-existing decision 0003 test default), SEC-1 or ARC-15 (no core or @mutate file touched).

## Report gaps (for the checker, not code)

1. reports/SC11-build.md: "Slowest single drop: not instrumented". A540's build items say "Record the slowest single drop in the build report" (round 3 asked the same and it was not done either). It matters now: the teardown drop bound fell from 7.5 s to 3.5 s (build amber 2) with no measurement of headroom. The checker should measure it on pg16.
2. The report shows test:flake FLAKE_RUNS=5 only; A540's risks ask test:flake FLAKE_RUNS=10 on pg16 and test:flake:shifted (shifted reported). The running check job covers it.

## Lesser (no fix needed for this card; SC11b candidates)

- An outer bound shorter than its inner step remains around withAdmin: the role check (2000) and the list (1500) wrap withAdmin, whose connect alone may take ADMIN_CONNECT_BOUND_MS 3000 plus an end step of 3000 (index.ts:307, :324); close's drop step (4750 to 5000) wraps the same. On a slow cluster the outer "did not finish" fires and the inner names are dropped. It fails safe (the run still fails by name), and RC-C's list in A540 does not name withAdmin.
- ADMIN_CONNECT_BOUND_MS, DROP_BOUND_MS and CLOSE_END_STEP_MS are named but not exported (the last two are reachable through CLOSE_BOUNDS_MS). B17 says "named exported constants"; R119 passes as written.
- A late admin error in the global teardown's process goes to that process's lateErrors, which nothing reads there.
- Close's mainEnd `.finally` marks the session ended on a rejected end too (the client is dead then; harmless).
- lateErrors, ownerlessErrors and trackers are still module state: SC3's build item per A540.
