# SC11 round 3 build: Opus read 3 (4 Oct 2026)

Read-only. Diff bfbe1cb~1..bfbe1cb on src/core/db/index.ts, vitest-setup.ts, global-setup.ts, against plan/cards/SC11.md (A508: RC1, RC2, S4 to S12, R118, B3 to B14), the spec tests src/core/db/pool-rules.acceptance.test.ts and rules.acceptance.db.test.ts, and reports/SC11-build.md (round 3). No tests run (a flake run was using the checkout). Line numbers are index.ts at HEAD unless named.

## Verdict: FAIL (two small fixes; everything else is right)

## Must fix

1. **RC2 not fixed for pools: endPool marks the pool ended on a timeout, so the forced drop's 57P01 goes "late" and fails the next test.** index.ts:262-264 sets `tracker.ended = true` in a `finally`, so it is set when the 5 s bound fires with connections still open. close() then runs the drop step (:532, `with (force)`), which kills those still-open backends; their 57P01 reaches the client listener (:240), `isEnded()` is true, and the line goes to `lateErrors` (:204): this close() does not name it, the next test's afterEach does ("late: ..."). The card's risk line asks the opposite ("B4's ordering keeps the 57P01 in that close, not the next test"), RC2 says the owner is decided at the end, and the build report's "marks a pool ended only after its end" (reports/SC11-build.md:7) is not true on the timeout path. Same on createPg16Template's endPool-timeout path (:608-624: drop after a timed-out endPool, errors go late). Fix: endPool marks ended only when the end resolved; on a rejection the owner (PgDb.close after its drop step, next to :538; the template after its drop) marks the tracker ended. A pg16 test: hold a checked-out client, close(), expect the 57P01 in close()'s rejection and takeLateErrors() empty (S6's shape with a held client instead of a killed idle one).

2. **The global teardown's bounds do not add up, so a hang can lose R91's result and the per-database names.** global-setup.ts:17 bounds dropRunDatabases at 8000 ms, but inside it the list step is bounded at 3000 (index.ts:561, default) and the drop step at 7500 (:572): 10.5 s worst case inside an 8 s bound. The role check gets another 3000 (global-setup.ts:19, default), so the teardown's worst case is 11 s against the 10 s vitest teardownTimeout the builder names in amber (3) (reports/SC11-build.md:8): on a hung cluster vitest can give up on the teardown before settleAll rejects, losing both the drop failure and the R91 compare (the "security net silently skipped" RC1 names). Also, the drops run one after another inside one 7500 bound, so one hung drop (5000, :576) plus a few slow ones leaves the rest undropped and unnamed (only "drop: did not finish within 7500 ms"), which B8's "collect per item" does not allow. 7500 and 8000 are unnamed literals (task item 2). Fix: named teardown bounds whose sum, list and drops included, stays inside 0.8 of the teardownTimeout (pin teardownTimeout in vitest.config.ts and add it to S11's arithmetic), or run the role check first (it does not depend on the drops) so R91 never waits behind them; give each drop its own bound and name every database not reached.

## Lesser (fix while there or log amber)

3. **Equal nested bounds let the outer timer replace the detailed failure.** vitest-setup.ts:28 bounds closeClones at exactly the sum of CLOSE_BOUNDS_MS (19 s), and each close's step timers start one after another, so when every step of a close hangs the outer fires first and the per-step names (which step hung, the recorded 57P01 lines) are dropped with the abandoned promise. Same shape: close's endPool step 5000 (:531) around endPool's own 5000 (:258). Give the outer a margin (sum plus one step), still inside 0.8 of hookTimeout (22 s + 3 s = 25 s > 24 s, so trim a step bound or raise hookTimeout by measurement).
4. **withAdmin has no late path.** index.ts:273-275 pushes into a local array; an error that arrives after withAdmin returned (end timed out at :285, socket still open) is lost. Route it through recorderFor (late once withAdmin has returned).
5. **Unasked behaviour change, amber (1): every openPool pool now times out a connect at 3 s** (:225). pg-pool applies connectionTimeoutMillis to a request queued for a free slot too, so a test whose fifth concurrent transaction on a clone (max 4, :635) waits over 3 s now fails "timeout exceeded when trying to connect". Not seen in the reported runs; scope it to inspectIdle's connects or log the risk with a test.
6. endPool's timeout message lost the count of still-open connections and the "checked out and never released?" hint the old message gave (old :207; new :255-259). The spec test still matches on the pool label.
7. Setup-time admin queries (template and clone `create database`, listRoles at setup) have no bound of their own beyond the 3 s connect; they are not cleanup sequences, so not a card failure.

## Round 2 failures 1 to 7: status

1. close drop unwrapped: fixed, the drop is a settleAll step (:532) and `this.problems` is read after it (:539).
2. template failure path: fixed, endPool, schemaProblems and the drop always run with the schema error primary (:603-627); success path drops on an endPool failure (:611-613, :624). Lesser 1 above applies.
3. withAdmin: fixed, connect inside the try (:278), end through settleAll with the run's failure primary (:285), recorded lines with code attached on every exit (:289-291).
4. endPool on an untracked pool: fixed, rejects "not opened by openPool" (:253).
5. openPool without a sink: fixed, live errors "no owner" (:205, named at :772), late only after the end (:204).
6. session errors during close: fixed for the session (mainEnded set when main.end settles, :526-528, and after every step, :538). Not fixed for the pool: must-fix 1.
7. unbounded waits: mainEnd bounded (:523), inspectIdle connects inside its try with the pool's 3 s connect bound and releases (destroys) taken clients on failure (:736-749), withAdmin connect bounded (:271). Teardown arithmetic: must-fix 2.

## Checks asked

- (1) Every step runs after an earlier failure and none masks the error in flight: close (:511-540), closeClones (allSettled, :696-698), assertCleanClones (allSettled, ownerless and late always taken, :765-774), dropOwnedRoles (each role a step, :484-500), dropRunDatabases (:559-579), template both paths (:604-627), createPgliteTemplate catch (:664), vitest-setup afterEach and afterAll (settleAll; the finally holds only setClock), makeTeardown (settleAll). transaction's finally now wipes through settleAll and never throws over the body's error (:466-476). Exceptions: must-fix 2 and lesser 3 (an outer bound that replaces the inner names).
- (2) Every wait has a bound: yes in close and the afterEach; the teardown's bounds are unnamed literals and do not nest (must-fix 2).
- (3) endPool on an untracked pool rejects (:253). Ownership at end: right for the session, wrong for a pool whose end timed out (must-fix 1), absent for withAdmin (lesser 4).
- (4) Hand-written lists: CLOSE_BOUNDS_MS keys match close's five steps in order and each step reads its own key (:123-129, :514-532); the afterEach bound is computed from it, not copied. test-homes.json `harness` lists index.ts, global-setup.ts, vitest-setup.ts, test-no-network.ts, read-own-source.ts (all exist); dbCatchAllow still one entry and its reason still matches the transaction code (:456-462, :466-476). The vitest-setup comment "0.8 of the hookTimeout" holds (22 s of 24 s). The teardown's 7500 and 8000 stand for nothing named (must-fix 2).
- (5) Security: no weakening. listRoles still reads every role of the cluster (:784-789, `select rolname from pg_roles`); makeTeardown always runs the role compare after the drops and names a failing listRoles; leftoverRoles unchanged. dropOwnedRoles drops only roles this handle made (quoteIdent kept). R92 allow list unchanged (one entry); no `.catch(() => undefined)`, no empty error listener (all four listeners record: :227, :240, :273, :320); the one `.catch` (:611) rethrows. No secret printed: errors carry pg message and code only; the url and password never enter a message.
- (6) Built beyond the card: openPool's default 3 s connect timeout on every pool (lesser 5, logged amber 1); "(code X)" in schema-file messages (amber 2, harmless); transaction's wipe through settleAll (needed for R118's finally rule, in scope). Nothing else.

## Security review (medium or higher only)

No medium or higher security finding. The only security-relevant item is must-fix 2 (R91's compare can be abandoned by vitest's teardown timeout on a hung cluster), which I rate as a correctness defect of a test net rather than a vulnerability: no role, permission, redaction or secret handling is weakened.

## Verification gaps in reports/SC11-build.md

- Slowest drop not recorded (the card's risk line asks for it); the 1.9 s for 25 closes is a whole-close time.
- No test covers the endPool-timeout-then-forced-drop path (must-fix 1), which the card names as the main risk of running drops after failures.
